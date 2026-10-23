<?php
/**
 * GeekNook B2B Lead Ingestion & Telegram Dispatcher
 * Captures corporate leads, logs them reliably to disk, and notifies the team via Telegram.
 * Hardened with Origin whitelisting, IP rate limiting, anti-bot honeypot, and safe HTML Telegram formatting.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// 1. Strict CORS Whitelist
$allowedOrigins = [
    'https://geeknook.ru',
    'https://www.geeknook.ru',
    'http://geeknook.ru',
    'http://www.geeknook.ru',
    'https://ggrk52.github.io'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!empty($origin)) {
    $parsedHost = parse_url($origin, PHP_URL_HOST);
    $isLocal = in_array($parsedHost, ['localhost', '127.0.0.1'], true);
    $isTilda = $parsedHost && preg_match('/\.tilda\.(ws|cc)$/i', $parsedHost);
    if (in_array($origin, $allowedOrigins, true) || $isLocal || $isTilda) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    } else {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Forbidden: Origin not allowed']);
        exit;
    }
} else {
    header('Access-Control-Allow-Origin: https://geeknook.ru');
}

header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// 2. Read and parse incoming payload
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

// 3. Anti-bot Honeypot check
$honeypot = $data['fax_field'] ?? $data['website'] ?? $data['company_website'] ?? '';
if (!empty($honeypot)) {
    echo json_encode(['success' => true, 'lead_id' => 'LEAD-OK']);
    exit;
}

// 4. IP Rate Limiting (max 5 leads per 60 seconds per IP)
$clientIp = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rateFile = sys_get_temp_dir() . '/gn_rate_' . md5($clientIp . '_b2blead') . '.json';
$now = time();
$requests = [];
if (file_exists($rateFile)) {
    $rateData = @json_decode(@file_get_contents($rateFile), true);
    if (is_array($rateData)) {
        $requests = array_filter($rateData, function($t) use ($now) { return ($now - $t) < 60; });
    }
}
if (count($requests) >= 5) {
    http_response_code(429);
    echo json_encode([
        'success' => false,
        'error'   => 'Слишком много запросов. Пожалуйста, подождите минуту перед отправкой заявки.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
$requests[] = $now;
@file_put_contents($rateFile, json_encode($requests), LOCK_EX);

// 5. Extract and sanitize fields
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

// 6. Validation
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

// 7. Request type human-readable label
$typeLabels = [
    'test_drive'     => '🚗 Бесплатный тест-драйв в офис (14 дней)',
    'kp_calculation' => '📄 Официальное коммерческое предложение (КП)',
    'cad_library'    => '📐 3D CAD-библиотека для архитекторов',
    'general'        => '💼 Общий корпоративный B2B-запрос'
];
$typeTitle = $typeLabels[$requestType] ?? $typeLabels['general'];

// 8. Generate Lead ID and log locally to disk (never lose leads!)
$leadId = 'LEAD-' . date('Ymd-His') . '-' . substr(md5(uniqid(mt_rand(), true)), 0, 4);
$logFile = __DIR__ . '/leads.log';
$logEntry = json_encode([
    'lead_id'      => $leadId,
    'timestamp'    => date('Y-m-d H:i:s'),
    'ip'           => $clientIp,
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

// 9. Telegram Bot Notification (Protected: no hardcoded secrets, safe HTML formatting)
$telegramSuccess = false;
$configFile = __DIR__ . '/b2b-config.php';
$config = file_exists($configFile) ? include($configFile) : [];

$botToken = $config['telegram_bot_token'] ?? (getenv('TELEGRAM_BOT_TOKEN') ?: '');
$chatId   = $config['telegram_chat_id'] ?? (getenv('TELEGRAM_CHAT_ID') ?: '');

if (!empty($botToken) && !empty($chatId) && $botToken !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    // Safe HTML escaping for Telegram
    $escType    = htmlspecialchars($typeTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $escCompany = htmlspecialchars($company ?: 'Не указано', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $escInn     = !empty($inn) ? htmlspecialchars($inn, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') : '';
    $escContact = htmlspecialchars($contactName ?: 'Не указано', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $escEmail   = htmlspecialchars($email ?: 'Не указан', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $escPhone   = !empty($phone) ? htmlspecialchars($phone, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') : '';
    $escPlaces  = htmlspecialchars($workplaces, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $escTier    = htmlspecialchars($packageTier, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $escComment = !empty($comment) ? htmlspecialchars($comment, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') : '';
    $escLeadId  = htmlspecialchars($leadId, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    $msgLines = [
        "🚨 <b>НОВАЯ B2B ЗАЯВКА GEEKNOOK!</b>",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "🎯 <b>Тип запроса:</b> " . $escType,
        "🏢 <b>Компания:</b> " . $escCompany,
        !empty($escInn) ? ("🔢 <b>ИНН:</b> <code>" . $escInn . "</code>") : null,
        "👤 <b>Контакт:</b> " . $escContact,
        "📧 <b>Email:</b> " . $escEmail,
        !empty($escPhone) ? ("📞 <b>Телефон:</b> <code>" . $escPhone . "</code>") : null,
        "🪑 <b>Мест:</b> " . $escPlaces,
        "📦 <b>Пакет:</b> " . $escTier,
        !empty($escComment) ? ("💬 <b>Комментарий:</b> <i>" . $escComment . "</i>") : null,
        "━━━━━━━━━━━━━━━━━━━━━━",
        "🆔 <code>#" . $escLeadId . "</code> | ⏰ " . date('d.m.Y H:i:s') . " (МСК)"
    ];

    $messageText = implode("\n", array_filter($msgLines));
    $tgPayload = [
        'chat_id'    => $chatId,
        'text'       => $messageText,
        'parse_mode' => 'HTML'
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

// 10. Success response
echo json_encode([
    'success'          => true,
    'lead_id'          => $leadId,
    'message'          => 'Заявка успешно принята! Наш B2B-менеджер свяжется с вами в течение 30 минут.',
    'telegram_notified' => $telegramSuccess
], JSON_UNESCAPED_UNICODE);
