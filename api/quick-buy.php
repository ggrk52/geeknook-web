<?php
/**
 * GeekNook 1-Click Quick Buy Ingestion & Telegram Dispatcher
 * Captures fast checkout leads, logs them reliably to disk, and notifies the team via Telegram.
 * Hardened with Origin whitelisting, IP rate limiting, anti-bot honeypot, catalog price checks, and safe HTML Telegram formatting.
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

// 3. Anti-bot Honeypot check (hidden spam fields)
$honeypot = $data['fax_field'] ?? $data['website'] ?? $data['company_fax'] ?? '';
if (!empty($honeypot)) {
    echo json_encode(['success' => true, 'order_number' => 'GN-1C-OK']);
    exit;
}

// 4. IP Rate Limiting (max 5 requests per 60 seconds per IP)
$clientIp = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rateFile = sys_get_temp_dir() . '/gn_rate_' . md5($clientIp . '_quickbuy') . '.json';
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
        'error'   => 'Слишком много запросов. Пожалуйста, подождите минуту перед повторным оформлением.'
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

$orderNumber   = sanitize($data['order_number'] ?? ('GN-1C-' . mt_rand(100000, 999999)), 50);
$name          = sanitize($data['name'] ?? '', 100);
$phone         = sanitize($data['phone'] ?? '', 50);
$productId     = sanitize($data['product_id'] ?? '', 50);
$productTitle  = sanitize($data['product_title'] ?? 'Товар GeekNook', 150);
$productOption = sanitize($data['product_option'] ?? 'Стандарт', 50);
$price         = sanitize($data['price'] ?? 0, 20);
$promoCode     = sanitize($data['promo_code'] ?? '', 30);
$utm           = is_array($data['utm'] ?? null) ? $data['utm'] : [];

// 6. Validation
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

// 7. Catalog Price Verification
$catalogPrices = [
    'focus-station-walnut' => ['85' => 19999, '116' => 24999, 'default' => 19999],
    'focus-station-oak'    => ['85' => 19999, '116' => 24999, 'default' => 19999],
    'focus-station-black'  => ['85' => 19999, '116' => 24999, 'default' => 19999],
    'headphone-stand'      => 2999,
    'gamepad-stand'        => 2999,
    'phone-dock'           => 2999,
    'cable-organizer'      => 4999,
    'cable-organizer-mini' => 1999,
    'laptop-open'          => 4999,
    'laptop-closed'        => 4999,
    'mac-shelf'            => 4999,
    'u-shelf'              => 4999,
    'shelf-45'             => 6999,
    'switch-stand'         => 4999,
    'desk-mat-light'       => 1499,
    'desk-mat-dark'        => 1499
];

$expectedPrice = null;
if (isset($catalogPrices[$productId])) {
    $ref = $catalogPrices[$productId];
    if (is_array($ref)) {
        if (strpos($productOption, '116') !== false) {
            $expectedPrice = $ref['116'] ?? $ref['default'];
        } elseif (strpos($productOption, '85') !== false) {
            $expectedPrice = $ref['85'] ?? $ref['default'];
        } else {
            $expectedPrice = $ref['default'] ?? 19999;
        }
    } else {
        $expectedPrice = $ref;
    }
}

$numericClientPrice = (float)preg_replace('/[^\d.]/', '', (string)$price);
$priceWarning = '';
if ($expectedPrice !== null && $numericClientPrice > 0 && abs($numericClientPrice - $expectedPrice) > 100) {
    $priceWarning = " ⚠️ <i>(Каталог: " . number_format($expectedPrice, 0, '.', ' ') . " ₽)</i>";
}

// 8. Log order to disk (guaranteed persistent record)
$logFile = __DIR__ . '/orders.log';
$logEntry = json_encode([
    'type'           => 'quick_buy_1click',
    'order_number'   => $orderNumber,
    'timestamp'      => date('Y-m-d H:i:s'),
    'ip'             => $clientIp,
    'user_agent'     => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
    'name'           => $name,
    'phone'          => $phone,
    'product_id'     => $productId,
    'product_title'  => $productTitle,
    'product_option' => $productOption,
    'client_price'   => $price,
    'catalog_price'  => $expectedPrice,
    'promo_code'     => $promoCode,
    'utm'            => $utm
], JSON_UNESCAPED_UNICODE) . PHP_EOL;

@file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);

// 9. Telegram Bot Notification (Protected: no hardcoded secrets, safe HTML formatting)
$telegramSuccess = false;
$configFile = __DIR__ . '/b2b-config.php';
$config = file_exists($configFile) ? include($configFile) : [];

$botToken = $config['telegram_bot_token'] ?? (getenv('TELEGRAM_BOT_TOKEN') ?: '');
$chatId   = $config['telegram_chat_id'] ?? (getenv('TELEGRAM_CHAT_ID') ?: '');

if (!empty($botToken) && !empty($chatId) && $botToken !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    $optText = ($productOption && $productOption !== 'Стандарт') ? " (" . $productOption . ")" : "";
    $utmParts = [];
    foreach ($utm as $k => $v) {
        if (!empty($v) && (strpos($k, 'utm_') === 0 || in_array($k, ['yclid', '_openstat', 'gclid'], true))) {
            $utmParts[] = $k . ': ' . sanitize($v, 100);
        }
    }
    $utmString = !empty($utmParts) ? implode(', ', $utmParts) : 'Прямой заход';

    // Safe HTML escaping for Telegram Bot API
    $escOrder   = htmlspecialchars($orderNumber, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $escName    = htmlspecialchars($name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $escPhone   = htmlspecialchars($phone, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $escProduct = htmlspecialchars($productTitle . $optText, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $escPrice   = number_format($numericClientPrice, 0, '.', ' ') . ' ₽' . $priceWarning;
    $escPromo   = !empty($promoCode) ? htmlspecialchars($promoCode, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') : '';
    $escUtm     = htmlspecialchars($utmString, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    $msgLines = [
        "⚡️ <b>НОВЫЙ ЗАКАЗ В 1 КЛИК GEEKNOOK!</b>",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "🔢 <b>Заказ:</b> <code>#" . $escOrder . "</code>",
        "👤 <b>Имя:</b> " . $escName,
        "📞 <b>Телефон:</b> <code>" . $escPhone . "</code>",
        "🛒 <b>Товар:</b> " . $escProduct,
        "💰 <b>Сумма:</b> " . $escPrice,
        !empty($escPromo) ? ("🏷 <b>Промокод:</b> <code>" . $escPromo . "</code>") : null,
        "━━━━━━━━━━━━━━━━━━━━━━",
        "📊 <b>Источник:</b> " . $escUtm,
        "⏰ " . date('d.m.Y H:i:s') . " (МСК)",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "⚡️ <b>Срочно связаться с покупателем в течение 10 минут!</b>"
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

// 10. Final Response
echo json_encode([
    'success'           => true,
    'order_number'      => $orderNumber,
    'message'           => 'Заказ успешно оформлен! Менеджер свяжется с вами в течение 10 минут.',
    'telegram_notified' => $telegramSuccess
], JSON_UNESCAPED_UNICODE);
