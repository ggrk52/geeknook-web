<?php
/**
 * GeekNook 1-Click Quick Buy Ingestion & Telegram Dispatcher
 * Captures fast checkout leads, logs them reliably to disk, and notifies the team via Telegram.
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

$orderNumber   = sanitize($data['order_number'] ?? ('GN-1C-' . mt_rand(100000, 999999)), 50);
$name          = sanitize($data['name'] ?? '', 100);
$phone         = sanitize($data['phone'] ?? '', 50);
$productId     = sanitize($data['product_id'] ?? '', 50);
$productTitle  = sanitize($data['product_title'] ?? 'Товар GeekNook', 150);
$productOption = sanitize($data['product_option'] ?? 'Стандарт', 50);
$price         = sanitize($data['price'] ?? 0, 20);
$promoCode     = sanitize($data['promo_code'] ?? '', 30);
$utm           = is_array($data['utm'] ?? null) ? $data['utm'] : [];

// 3. Validation
$errors = [];
if (empty($name) || mb_strlen($name) < 2) {
    $errors[] = 'Укажите ваше имя';
}

$digitsOnly = preg_replace('/\D/', '', $phone);
if (mb_strlen($digitsOnly) < 10) {
    $errors[] = 'Укажите корректный номер телефона (не менее 10 цифр)';
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => implode(', ', $errors), 'errors' => $errors]);
    exit;
}

// 4. Log order to disk (guaranteed persistent record)
$logFile = __DIR__ . '/orders.log';
$logEntry = json_encode([
    'type'           => 'quick_buy_1click',
    'order_number'   => $orderNumber,
    'timestamp'      => date('Y-m-d H:i:s'),
    'ip'             => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    'user_agent'     => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
    'name'           => $name,
    'phone'          => $phone,
    'product_id'     => $productId,
    'product_title'  => $productTitle,
    'product_option' => $productOption,
    'price'          => $price,
    'promo_code'     => $promoCode,
    'utm'            => $utm
], JSON_UNESCAPED_UNICODE) . PHP_EOL;

@file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);

// 5. Telegram Bot Notification
$telegramSuccess = false;
$configFile = __DIR__ . '/b2b-config.php';
$config = file_exists($configFile) ? include($configFile) : [];

$botToken = $config['telegram_bot_token'] ?? '8925465504:AAHKTQUxaQdNePXOFcsnPgcBRpnnMXG44FU';
$chatId   = $config['telegram_chat_id'] ?? '841456475';

if (!empty($botToken) && !empty($chatId) && $botToken !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    $optText = ($productOption && $productOption !== 'Стандарт') ? " (" . $productOption . ")" : "";
    $utmParts = [];
    foreach ($utm as $k => $v) {
        if (!empty($v) && (strpos($k, 'utm_') === 0 || in_array($k, ['yclid', '_openstat', 'gclid']))) {
            $utmParts[] = $k . ': ' . sanitize($v, 100);
        }
    }
    $utmString = !empty($utmParts) ? implode(', ', $utmParts) : 'Прямой заход';

    $msgLines = [
        "⚡️ *НОВЫЙ ЗАКАЗ В 1 КЛИК GEEKNOOK!*",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "🔢 *Заказ:* `#" . $orderNumber . "`",
        "👤 *Имя:* " . $name,
        "📞 *Телефон:* `" . $phone . "`",
        "🛒 *Товар:* " . $productTitle . $optText,
        "💰 *Сумма:* " . number_format((float)$price, 0, '.', ' ') . " ₽",
        !empty($promoCode) ? ("🏷 *Промокод:* `" . $promoCode . "`") : null,
        "━━━━━━━━━━━━━━━━━━━━━━",
        "📊 *Источник:* " . $utmString,
        "⏰ " . date('d.m.Y H:i:s') . " (МСК)",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "⚡️ *Срочно связаться с покупателем в течение 10 минут!*"
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

// 6. Response
echo json_encode([
    'success'           => true,
    'order_number'      => $orderNumber,
    'message'           => 'Заказ успешно оформлен! Менеджер свяжется с вами в течение 10 минут.',
    'telegram_notified' => $telegramSuccess
], JSON_UNESCAPED_UNICODE);
