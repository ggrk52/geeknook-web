<?php
/**
 * GeekNook Real-Time Stock API
 * GET  /api/stock.php       -> Current calculated stock table + recent SKU write-offs (no PII)
 * POST /api/stock.php       -> Atomic check / commit / admin reset actions
 */

require_once __DIR__ . '/stock-lib.php';

gn_send_cors_headers('GET, POST, OPTIONS');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode(gn_get_live_stock(), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input');
$data = $raw ? @json_decode($raw, true) : null;
if (!is_array($data)) {
    $data = $_POST ?: [];
}

$action = trim((string)($data['action'] ?? 'check'));
if (!in_array($action, ['check', 'commit', 'reset'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Unknown stock action'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'reset') {
    $configFile = __DIR__ . '/b2b-config.php';
    $config = file_exists($configFile) ? @include($configFile) : [];
    $expectedKey = $config['stock_admin_key'] ?? (getenv('STOCK_ADMIN_KEY') ?: '');
    $providedKey = (string)($data['admin_key'] ?? '');
    if (empty($expectedKey) || !hash_equals((string)$expectedKey, $providedKey)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Forbidden: Admin key required'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

$tx = gn_stock_transaction($action, $data);
http_response_code($tx['httpCode']);
echo json_encode($tx['body'], JSON_UNESCAPED_UNICODE);
