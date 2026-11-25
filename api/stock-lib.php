<?php
/**
 * GeekNook Shared Atomic Stock Ledger Library
 * Manages canonical warehouse baseline (data/stock.json) and atomic order deductions with file locking.
 */

if (isset($_SERVER['SCRIPT_FILENAME']) && realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'])) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

function gn_send_cors_headers($methods = 'GET, POST, OPTIONS') {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');

    $allowedOrigins = [
        'https://geeknook.ru',
        'https://www.geeknook.ru',
        'https://ggrk52.github.io'
    ];
    $cfgPath = __DIR__ . '/b2b-config.php';
    $cfgData = file_exists($cfgPath) ? (include $cfgPath) : [];
    if (is_array($cfgData['allowed_origins'] ?? null)) {
        foreach ($cfgData['allowed_origins'] as $extraOrigin) {
            if (is_string($extraOrigin) && $extraOrigin !== '') {
                $allowedOrigins[] = rtrim($extraOrigin, '/');
            }
        }
    }
    $envOrigins = getenv('GEEKNOOK_ALLOWED_ORIGINS') ?: '';
    if ($envOrigins !== '') {
        foreach (explode(',', $envOrigins) as $envOrigin) {
            $trimmed = rtrim(trim($envOrigin), '/');
            if ($trimmed !== '') {
                $allowedOrigins[] = $trimmed;
            }
        }
    }

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (!empty($origin)) {
        $parsedHost = parse_url($origin, PHP_URL_HOST);
        $isLocal = in_array($parsedHost, ['localhost', '127.0.0.1'], true);
        if (in_array(rtrim($origin, '/'), $allowedOrigins, true) || $isLocal) {
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

    header('Access-Control-Allow-Methods: ' . $methods);
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Max-Age: 86400');

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// Orders contain personal data. Refuse storage inside the HTTP document root.
function gn_private_log_path($filename) {
    $directory = realpath(getenv('GEEKNOOK_PRIVATE_LOG_DIR') ?: dirname(__DIR__, 2));
    $publicRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__));
    if (!$directory || !$publicRoot || !is_dir($directory) || !is_writable($directory)) return null;
    $prefix = rtrim($publicRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    if ($directory === $publicRoot || strpos($directory . DIRECTORY_SEPARATOR, $prefix) === 0) return null;
    $path = $directory . DIRECTORY_SEPARATOR . $filename;
    return is_link($path) ? null : $path;
}

function gn_stock_baseline() {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $path = dirname(__DIR__) . '/data/stock.json';
    if (!file_exists($path)) {
        return [
            'stockDate'    => date('Y-m-d'),
            'snapshotHash' => '',
            'items'        => []
        ];
    }
    $raw = @file_get_contents($path);
    $decoded = $raw ? @json_decode($raw, true) : null;
    $cached = is_array($decoded) ? $decoded : ['stockDate' => '', 'snapshotHash' => '', 'items' => []];
    return $cached;
}

function gn_stock_ledger_path() {
    $envDir = getenv('GEEKNOOK_PRIVATE_LOG_DIR');
    if ($envDir && is_dir($envDir) && is_writable($envDir)) {
        return rtrim($envDir, DIRECTORY_SEPARATOR) . '/geeknook-stock-ledger.json';
    }
    $parentDir = dirname(__DIR__, 2);
    if (is_dir($parentDir) && is_writable($parentDir)) {
        return rtrim($parentDir, DIRECTORY_SEPARATOR) . '/geeknook-stock-ledger.json';
    }
    return sys_get_temp_dir() . '/geeknook-stock-ledger.json';
}

function gn_resolve_item_codes($productId, $optionStr = '', $quantity = 1) {
    $qty = max(1, intval($quantity));
    $id = trim((string)$productId);
    $opt = mb_strtolower(trim((string)$optionStr), 'UTF-8');

    // Bundle expansions
    $bundles = [
        'bundle-developer-pro' => [
            ['focus-station-walnut', '85 см'],
            ['laptop-closed', ''],
            ['cable-organizer', ''],
            ['desk-mat-dark', '80 × 40 см']
        ],
        'bundle-creator-studio' => [
            ['focus-station-black', '116 см'],
            ['laptop-open', ''],
            ['headphone-stand', ''],
            ['desk-mat-xl', '120 × 60 см']
        ],
        'bundle-minimalist-focus' => [
            ['focus-station-oak', '85 см'],
            ['phone-dock', ''],
            ['cable-organizer', ''],
            ['desk-mat-light', '80 × 40 см']
        ]
    ];

    if (isset($bundles[$id])) {
        $resolved = [];
        foreach ($bundles[$id] as $comp) {
            foreach (gn_resolve_item_codes($comp[0], $comp[1], $qty) as $part) {
                $code = $part['code'];
                $resolved[$code] = ($resolved[$code] ?? 0) + $part['quantity'];
            }
        }
        $out = [];
        foreach ($resolved as $c => $q) {
            $out[] = ['code' => (string)$c, 'quantity' => $q];
        }
        return $out;
    }

    // If direct article code was sent
    $baseline = gn_stock_baseline();
    if ($id !== '' && isset($baseline['items'][$id])) {
        return [['code' => $id, 'quantity' => $qty]];
    }

    $aliases = [
        'addon-laptop'       => 'laptop-open',
        'addon-headphones'   => 'headphone-stand',
        'addon-gamepad'      => 'gamepad-stand',
        'addon-phone'        => 'phone-dock',
        'addon-mac'          => 'mac-shelf',
        'addon-cable'        => 'cable-organizer',
        'addon-mat'          => 'desk-mat-xl',
        'focus-station-1200' => 'focus-station-walnut',
        'focus-board-600'    => 'focus-station-oak',
        'focus-station-900'  => 'focus-station-black',
        'cable-mini'         => 'cable-organizer-mini'
    ];
    if (isset($aliases[$id])) {
        $id = $aliases[$id];
    }

    // Size detection for mats & stands
    $is116 = (strpos($opt, '116') !== false);
    $is120 = (strpos($opt, '120') !== false);
    $is100 = (strpos($opt, '100') !== false);
    $is80  = (strpos($opt, '80') !== false);

    $code = null;
    switch ($id) {
        case 'focus-station-walnut': $code = $is116 ? '202404202' : '202404201'; break;
        case 'focus-station-oak':    $code = $is116 ? '2024042004' : '2024042003'; break;
        case 'focus-station-black':  $code = $is116 ? '2024042006' : '202404205'; break;
        case 'laptop-closed':        $code = '202404203'; break;
        case 'laptop-open':          $code = '202404204'; break;
        case 'cable-organizer':      $code = '202404206'; break;
        case 'headphone-stand':      $code = '202404207'; break;
        case 'phone-dock':
            $code = (strpos($opt, 'орех') !== false || strpos($opt, 'walnut') !== false) ? '202404220' : '202404208';
            break;
        case 'gamepad-stand':
            $code = (strpos($opt, 'nintendo') !== false || strpos($opt, 'switch') !== false) ? '202404209' : '202404210';
            break;
        case 'cable-organizer-mini': $code = '202404213'; break;
        case 'shelf-45':             $code = '202404214'; break;
        case 'mac-shelf':            $code = '202404217'; break;
        case 'switch-stand':         $code = '202404218'; break;
        case 'u-shelf':              $code = '202404219'; break;
        case 'desk-mat-xl':
            if ($is80) $code = '20240400';
            elseif ($is100) $code = '20240402';
            else $code = '20240403';
            break;
        case 'desk-mat-dark':
            if ($is120) $code = '20240407';
            elseif ($is100) $code = '20240406';
            else $code = '20240404';
            break;
        case 'desk-mat-light':
            if ($is120) $code = '20240411';
            elseif ($is100) $code = '20240410';
            else $code = '20240408';
            break;
        default:
            $code = $id;
            break;
    }

    return [['code' => (string)$code, 'quantity' => $qty]];
}

function gn_aggregate_requests($items) {
    $counts = [];
    if (!is_array($items)) return $counts;
    foreach ($items as $item) {
        if (!is_array($item)) continue;
        $qty = max(1, intval($item['quantity'] ?? 1));
        if (!empty($item['code'])) {
            $c = trim((string)$item['code']);
            $counts[$c] = ($counts[$c] ?? 0) + $qty;
        } elseif (!empty($item['id'])) {
            foreach (gn_resolve_item_codes($item['id'], $item['option'] ?? '', $qty) as $part) {
                $c = $part['code'];
                $counts[$c] = ($counts[$c] ?? 0) + $part['quantity'];
            }
        }
    }
    return $counts;
}

function gn_read_ledger_locked($fp, $baseline) {
    rewind($fp);
    $raw = stream_get_contents($fp);
    $ledger = $raw ? @json_decode($raw, true) : null;
    $hash = $baseline['snapshotHash'] ?? '';
    if (!is_array($ledger) || (($ledger['snapshotHash'] ?? '') !== $hash)) {
        return [
            'snapshotHash'    => $hash,
            'stockDate'       => $baseline['stockDate'] ?? '',
            'deductions'      => [],
            'committedOrders' => [],
            'movements'       => []
        ];
    }
    $ledger['deductions'] = is_array($ledger['deductions'] ?? null) ? $ledger['deductions'] : [];
    $ledger['committedOrders'] = is_array($ledger['committedOrders'] ?? null) ? $ledger['committedOrders'] : [];
    $ledger['movements'] = is_array($ledger['movements'] ?? null) ? $ledger['movements'] : [];
    return $ledger;
}

function gn_write_ledger_locked($fp, $ledger) {
    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($ledger, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    fflush($fp);
}

function gn_compute_items_from_ledger($baseline, $ledger) {
    $computed = [];
    $deductions = $ledger['deductions'] ?? [];
    foreach (($baseline['items'] ?? []) as $code => $entry) {
        $codeStr = (string)$code;
        $baseStock = intval($entry['stock'] ?? 0);
        $initialStock = intval($entry['initialStock'] ?? $baseStock);
        $initialSpent = intval($entry['initialSpent'] ?? 0);
        $orderSpent = intval($deductions[$codeStr] ?? 0);
        $remaining = max(0, $baseStock - $orderSpent);
        $computed[$codeStr] = [
            'code'         => $codeStr,
            'name'         => $entry['name'] ?? ('Товар ' . $codeStr),
            'category'     => $entry['category'] ?? 'Каталог',
            'price'        => intval($entry['price'] ?? 0),
            'initialStock' => $initialStock,
            'initialSpent' => $initialSpent,
            'orderSpent'   => $orderSpent,
            'totalSpent'   => $initialSpent + $orderSpent,
            'stock'        => $remaining
        ];
    }
    return $computed;
}

function gn_get_live_stock() {
    $baseline = gn_stock_baseline();
    $ledgerPath = gn_stock_ledger_path();
    $fp = @fopen($ledgerPath, 'c+');
    $ledger = [
        'snapshotHash'    => $baseline['snapshotHash'] ?? '',
        'stockDate'       => $baseline['stockDate'] ?? '',
        'deductions'      => [],
        'committedOrders' => [],
        'movements'       => []
    ];
    if ($fp) {
        if (flock($fp, LOCK_SH)) {
            $ledger = gn_read_ledger_locked($fp, $baseline);
            flock($fp, LOCK_UN);
        }
        fclose($fp);
    }

    return [
        'success'         => true,
        'stockDate'       => $baseline['stockDate'] ?? '',
        'snapshotHash'    => $baseline['snapshotHash'] ?? '',
        'items'           => gn_compute_items_from_ledger($baseline, $ledger),
        'recentMovements' => array_slice($ledger['movements'], 0, 50)
    ];
}

function gn_stock_transaction($action, $payload = []) {
    $baseline = gn_stock_baseline();
    $ledgerPath = gn_stock_ledger_path();
    $fp = @fopen($ledgerPath, 'c+');
    if (!$fp) {
        return ['httpCode' => 503, 'body' => ['success' => false, 'error' => 'Stock ledger storage unavailable']];
    }

    $result = ['httpCode' => 200, 'body' => ['success' => true]];
    if (flock($fp, LOCK_EX)) {
        $ledger = gn_read_ledger_locked($fp, $baseline);
        $computed = gn_compute_items_from_ledger($baseline, $ledger);

        if ($action === 'reset') {
            $ledger = [
                'snapshotHash'    => $baseline['snapshotHash'] ?? '',
                'stockDate'       => $baseline['stockDate'] ?? '',
                'deductions'      => [],
                'committedOrders' => [],
                'movements'       => []
            ];
            gn_write_ledger_locked($fp, $ledger);
            $computed = gn_compute_items_from_ledger($baseline, $ledger);
            $result['body'] = [
                'success'         => true,
                'reset'           => true,
                'items'           => $computed,
                'recentMovements' => []
            ];
        } else {
            $requests = gn_aggregate_requests($payload['items'] ?? []);
            $orderNo = trim((string)($payload['order_number'] ?? ''));

            if ($action === 'commit' && $orderNo !== '' && in_array($orderNo, $ledger['committedOrders'], true)) {
                $result['body'] = [
                    'success'          => true,
                    'ok'               => true,
                    'alreadyCommitted' => true,
                    'items'            => $computed,
                    'recentMovements'  => array_slice($ledger['movements'], 0, 50)
                ];
            } else {
                $shortages = [];
                foreach ($requests as $code => $reqQty) {
                    $entry = $computed[$code] ?? null;
                    $available = $entry ? intval($entry['stock']) : 0;
                    if ($reqQty > $available) {
                        $shortages[] = [
                            'code'      => $code,
                            'title'     => $entry['name'] ?? $code,
                            'requested' => $reqQty,
                            'available' => $available
                        ];
                    }
                }

                if (!empty($shortages)) {
                    $first = $shortages[0];
                    $result['httpCode'] = 409;
                    $result['body'] = [
                        'success'    => false,
                        'ok'         => false,
                        'outOfStock' => true,
                        'error'      => 'Недостаточно товара на складе. Артикул ' . $first['code'] . ', доступно: ' . $first['available'] . ' шт.',
                        'shortages'  => $shortages,
                        'items'      => $computed
                    ];
                } elseif ($action === 'check') {
                    $result['body'] = [
                        'success' => true,
                        'ok'      => true,
                        'items'   => $computed
                    ];
                } else {
                    $movementItems = [];
                    foreach ($requests as $code => $reqQty) {
                        $ledger['deductions'][$code] = intval($ledger['deductions'][$code] ?? 0) + $reqQty;
                        $movementItems[] = ['code' => $code, 'qty' => $reqQty];
                    }
                    if ($orderNo !== '') {
                        $ledger['committedOrders'][] = $orderNo;
                        if (count($ledger['committedOrders']) > 200) {
                            array_shift($ledger['committedOrders']);
                        }
                    }
                    if (!empty($movementItems)) {
                        array_unshift($ledger['movements'], [
                            'timestamp'   => gmdate('Y-m-d\TH:i:s\Z'),
                            'orderNumber' => $orderNo !== '' ? $orderNo : ('GN-' . mt_rand(100000, 999999)),
                            'type'        => trim((string)($payload['type'] ?? 'cart')),
                            'items'       => $movementItems
                        ]);
                        $ledger['movements'] = array_slice($ledger['movements'], 0, 50);
                    }
                    gn_write_ledger_locked($fp, $ledger);
                    $computed = gn_compute_items_from_ledger($baseline, $ledger);
                    $result['body'] = [
                        'success'         => true,
                        'ok'              => true,
                        'items'           => $computed,
                        'recentMovements' => array_slice($ledger['movements'], 0, 50)
                    ];
                }
            }
        }
        flock($fp, LOCK_UN);
    } else {
        $result = ['httpCode' => 503, 'body' => ['success' => false, 'error' => 'Unable to lock stock ledger']];
    }

    fclose($fp);
    return $result;
}
