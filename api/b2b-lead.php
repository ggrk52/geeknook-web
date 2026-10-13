<?php
/**
 * GeekNook B2B Lead Ingestion & Telegram Dispatcher
 * Captures corporate leads, logs them reliably to disk, and notifies the team via Telegram.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// 1. Read and parse incoming payload
$rawInput = file_get_contents('php://input');
$data = [];

if (!empty($rawInput)) {
    $decoded = json_decode($rawInput, true);
    if (is_array($decoded)) {
        $data = $decoded;
    }
}

if (empty($data) && !empty($_POST)) {
    $data = $_POST;
}

// 2. Extract and sanitize fields
function sanitize($val, $maxLength = 255) {
    if ($val === null) return '';
    $val = trim((string)$val);
    $val = strip_tags($val);
    if (mb_strlen($val) > $maxLength) {
        $val = mb_substr($val, 0, $maxLength);
    }
    return $val;
}

$company     = sanitize($data['company'] ?? '', 100);
$inn         = sanitize($data['inn'] ?? '', 20);
$contactName = sanitize($data['contact_name'] ?? $data['name'] ?? '', 100);
$email       = sanitize($data['email'] ?? '', 100);
$phone       = sanitize($data['phone'] ?? '', 50);
$workplaces  = sanitize($data['workplaces'] ?? '15', 20);
$packageTier = sanitize($data['package_tier'] ?? $data['tier'] ?? 'Growth Team', 50);
$requestType = sanitize($data['request_type'] ?? 'test_drive', 50);
$comment     = sanitize($data['comment'] ?? $data['message'] ?? '', 500);

// 3. Validation
$errors = [];
if (empty($company)) {
    $errors[] = 'Укажите название компании или студии';
}
if (empty($email) && empty($phone)) {
    $errors[] = 'Укажите корпоративный email или телефон для связи';
} elseif (!empty($email) && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Укажите корректный email адрес';
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => implode(', ', $errors), 'errors' => $errors]);
    exit;
}

// 4. Request type human-readable label
$typeLabels = [
    'test_drive'     => '🚗 Заказ бесплатного офисного тест-драйва (14 дней)',
    'kp_calculation' => '📄 Запрос официального коммерческого предложения (КП)',
    'cad_library'    => '📐 Запрос 3D CAD-библиотеки для архитекторов',
    'general'        => '💼 Общий корпоративный B2B-запрос'
];
$typeTitle = $typeLabels[$requestType] ?? $typeLabels['general'];

// 5. Generate Lead ID and log locally to disk (never lose leads!)
$leadId = 'LEAD-' . date('Ymd-His') . '-' . substr(md5(uniqid(mt_rand(), true)), 0, 4);
$logFile = __DIR__ . '/leads.log';
$logEntry = json_encode([
    'lead_id'      => $leadId,
    'timestamp'    => date('Y-m-d H:i:s'),
    'ip'           => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    'user_agent'   => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
    'type'         => $requestType,
    'company'      => $company,
    'inn'          => $inn,
    'contact_name' => $contactName,
    'email'        => $email,
    'phone'        => $phone,
    'workplaces'   => $workplaces,
    'package_tier' => $packageTier,
    'comment'      => $comment
], JSON_UNESCAPED_UNICODE) . PHP_EOL;

@file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);

// 6. Telegram Bot Notification
$telegramSuccess = false;
$configFile = __DIR__ . '/b2b-config.php';
$config = file_exists($configFile) ? include($configFile) : [];

$botToken = $config['telegram_bot_token'] ?? '';
$chatId   = $config['telegram_chat_id'] ?? '';

if (!empty($botToken) && !empty($chatId) && $botToken !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    $msgLines = [
        "🚨 *НОВАЯ B2B ЗАЯВКА GEEKNOOK!*",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "🎯 *Тип запроса:* " . $typeTitle,
        "🏢 *Компания:* " . ($company ?: 'Не указано'),
        !empty($inn) ? ("🔢 *ИНН:* `" . $inn . "`") : null,
        "👤 *Контакт:* " . ($contactName ?: 'Не указано'),
        "📧 *Email:* " . ($email ?: 'Не указан'),
        !empty($phone) ? ("📞 *Телефон:* " . $phone) : null,
        "🪑 *Мест:* " . $workplaces,
        "📦 *Пакет:* " . $packageTier,
        !empty($comment) ? ("💬 *Комментарий:* " . $comment) : null,
        "━━━━━━━━━━━━━━━━━━━━━━",
        "🆔 `" . $leadId . "` | ⏰ " . date('d.m.Y H:i:s') . " (МСК)"
    ];

    $messageText = implode("\n", array_filter($msgLines));
    $tgPayload = [
        'chat_id'    => $chatId,
        'text'       => $messageText,
        'parse_mode' => 'Markdown'
    ];

    $ch = curl_init('https://api.telegram.org/bot' . $botToken . '/sendMessage');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($tgPayload),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    $tgResponse = curl_exec($ch);
    $httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $telegramSuccess = true;
    }
}

// 7. Success response
echo json_encode([
    'success'          => true,
    'lead_id'          => $leadId,
    'message'          => 'Заявка успешно принята! Наш инженер свяжется с вами в течение 10 минут.',
    'telegram_notified'=> $telegramSuccess
], JSON_UNESCAPED_UNICODE);
