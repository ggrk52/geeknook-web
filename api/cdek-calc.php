<?php
/**
 * GeekNook CDEK API v2 Calculator Proxy
 * Authenticates with CDEK OAuth 2.0 and calculates real-time shipping tariffs.
 * Automatically resolves city codes and caches access tokens locally.
 * Credentials are read dynamically from cdek-config.php or environment variables.
 */

// Allow cross-origin requests from frontends
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Load CDEK credentials dynamically (protected from Git)
$configFile = __DIR__ . '/cdek-config.php';
$config = file_exists($configFile) ? (include $configFile) : [];

$cdekClientId = !empty($config['client_id']) 
    ? $config['client_id'] 
    : (getenv('CDEK_CLIENT_ID') ?: '');

$cdekClientSecret = !empty($config['client_secret']) 
    ? $config['client_secret'] 
    : (getenv('CDEK_CLIENT_SECRET') ?: '');

if (empty($cdekClientId) || empty($cdekClientSecret)) {
    echo json_encode([
        'success'  => false,
        'error'    => 'Ключи CDEK API не настроены на сервере (файл api/cdek-config.php отсутствует).',
        'fallback' => true
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

const CDEK_AUTH_URL      = 'https://api.cdek.ru/v2/oauth/token';
const CDEK_CALC_URL      = 'https://api.cdek.ru/v2/calculator/tariff';
const CDEK_CITIES_URL    = 'https://api.cdek.ru/v2/location/cities';
const DEFAULT_FROM_CODE  = 44; // Москва (Склад/офис GeekNook)

// Default package parameters (Focus Station: ~5.5 kg, 85x25x12 cm)
const DEFAULT_WEIGHT = 5500;
const DEFAULT_LENGTH = 85;
const DEFAULT_WIDTH  = 25;
const DEFAULT_HEIGHT = 12;

// Fast lookup for top cities to avoid extra HTTP calls
const KNOWN_CITY_CODES = [
    'москва'          => 44,
    'санкт-петербург' => 137,
    'петербург'       => 137,
    'питер'           => 137,
    'казань'          => 424,
    'екатеринбург'    => 134,
    'нижний новгород' => 41,
    'краснодар'       => 43,
    'самара'          => 188,
    'челябинск'       => 139,
    'ростов-на-дону'  => 42,
    'уфа'             => 135,
    'омск'            => 136,
    'красноярск'      => 271,
    'воронеж'         => 40,
    'пермь'           => 138,
    'волгоград'       => 39,
    'тюмень'          => 140,
    'сочи'            => 45,
    'новосибирск'     => 270,
    'владивосток'     => 273,
    'иркутск'         => 274,
    'ярославль'       => 46,
    'томск'           => 275,
    'барнаул'         => 272,
    'саратов'         => 189,
    'тула'            => 51,
    'тверь'           => 55,
    'ижевск'          => 415,
    'ульяновск'       => 191
];

function getCachedToken($clientId, $clientSecret) {
    $cacheFile = sys_get_temp_dir() . '/cdek_token_cache_' . md5($clientId) . '.json';
    
    if (file_exists($cacheFile)) {
        $data = json_decode(@file_get_contents($cacheFile), true);
        if ($data && isset($data['access_token']) && isset($data['expires_at'])) {
            // Check if token has at least 3 minutes remaining
            if (time() < ($data['expires_at'] - 180)) {
                return $data['access_token'];
            }
        }
    }
    
    // Request a fresh token via cURL
    $ch = curl_init(CDEK_AUTH_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS     => http_build_query([
            'grant_type'    => 'client_credentials',
            'client_id'     => $clientId,
            'client_secret' => $clientSecret
        ]),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200 || !$response) {
        return null;
    }
    
    $json = json_decode($response, true);
    if (!isset($json['access_token'])) {
        return null;
    }
    
    $token = $json['access_token'];
    $expiresIn = isset($json['expires_in']) ? intval($json['expires_in']) : 3600;
    
    @file_put_contents($cacheFile, json_encode([
        'access_token' => $token,
        'expires_at'   => time() + $expiresIn
    ]));
    
    return $token;
}

function resolveCityCode($cityName, $token) {
    $clean = mb_strtolower(trim($cityName), 'UTF-8');
    if (isset(KNOWN_CITY_CODES[$clean])) {
        return KNOWN_CITY_CODES[$clean];
    }
    
    // Check partial matches in known codes
    foreach (KNOWN_CITY_CODES as $name => $code) {
        if (mb_strpos($clean, $name, 0, 'UTF-8') !== false) {
            return $code;
        }
    }
    
    // Query CDEK location API
    $ch = curl_init(CDEK_CITIES_URL . '?city=' . urlencode($cityName) . '&country_codes=RU');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $token],
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($code === 200 && $resp) {
        $arr = json_decode($resp, true);
        if (is_array($arr) && !empty($arr) && isset($arr[0]['code'])) {
            return intval($arr[0]['code']);
        }
    }
    
    return null;
}

// Parse request input (GET or POST JSON / Form)
$input = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    if (!empty($raw)) {
        $json = json_decode($raw, true);
        if (is_array($json)) {
            $input = $json;
        }
    }
    if (empty($input)) {
        $input = $_POST;
    }
} else {
    $input = $_GET;
}

$toCity = isset($input['to_city']) ? trim($input['to_city']) : '';
$toCode = isset($input['to_code']) ? intval($input['to_code']) : 0;
$weight = isset($input['weight']) ? max(500, intval($input['weight'])) : DEFAULT_WEIGHT;
$length = isset($input['length']) ? max(10, intval($input['length'])) : DEFAULT_LENGTH;
$width  = isset($input['width'])  ? max(10, intval($input['width']))  : DEFAULT_WIDTH;
$height = isset($input['height']) ? max(5, intval($input['height']))   : DEFAULT_HEIGHT;

if (empty($toCity) && empty($toCode)) {
    echo json_encode([
        'success' => false,
        'error'   => 'Не указан город или код города назначения (to_city / to_code).'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$token = getCachedToken($cdekClientId, $cdekClientSecret);
if (!$token) {
    echo json_encode([
        'success'  => false,
        'error'    => 'Не удалось авторизоваться в API СДЭК.',
        'fallback' => true
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($toCode <= 0 && !empty($toCity)) {
    $toCode = resolveCityCode($toCity, $token);
}

if (!$toCode) {
    echo json_encode([
        'success'  => false,
        'error'    => 'Не удалось определить код города для «' . $toCity . '»',
        'fallback' => true
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Build calculation payload for Tariff 136 (Посылка склад-склад / ПВЗ)
$payload = [
    'type'          => 1, // Интернет-магазин
    'tariff_code'   => 136, // Посылка склад-склад (до ПВЗ)
    'from_location' => [
        'code' => DEFAULT_FROM_CODE
    ],
    'to_location'   => [
        'code' => $toCode
    ],
    'packages'      => [
        [
            'weight' => $weight,
            'length' => $length,
            'width'  => $width,
            'height' => $height
        ]
    ]
];

$ch = curl_init(CDEK_CALC_URL);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json'
    ],
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_SSL_VERIFYPEER => true
]);

$calcResp = curl_exec($ch);
$calcCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($calcCode === 200 && $calcResp) {
    $calcJson = json_decode($calcResp, true);
    if (isset($calcJson['delivery_sum'])) {
        echo json_encode([
            'success'       => true,
            'delivery_sum'  => floatval($calcJson['delivery_sum']),
            'total_sum'     => floatval($calcJson['total_sum'] ?? $calcJson['delivery_sum']),
            'period_min'    => intval($calcJson['period_min'] ?? 1),
            'period_max'    => intval($calcJson['period_max'] ?? 3),
            'calendar_min'  => intval($calcJson['calendar_min'] ?? $calcJson['period_min'] ?? 1),
            'calendar_max'  => intval($calcJson['calendar_max'] ?? $calcJson['period_max'] ?? 3),
            'currency'      => $calcJson['currency'] ?? 'RUB',
            'city_code'     => $toCode,
            'tariff_code'   => 136
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// Return graceful fallback notice if CDEK couldn't calculate
echo json_encode([
    'success'  => false,
    'error'    => 'СДЭК вернул код ' . $calcCode . ' при расчете тарифа',
    'raw'      => $calcResp ? json_decode($calcResp, true) : null,
    'fallback' => true
], JSON_UNESCAPED_UNICODE);
