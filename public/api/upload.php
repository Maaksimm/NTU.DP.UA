<?php
/**
 * Завантаження файлів для особистих повідомлень і записів уроків (World Students).
 *
 * POST multipart частинами: file=<частина>, kind=chat|lesson, upload_id, index, total, size, name;
 * заголовок Authorization: Bearer <Firebase ID token>.
 * Токен перевіряється за підписом (RS256, відкриті ключі Google securetoken), aud/iss проєкту, строком дії
 * та підтвердженою поштою. Дозволені лише перелічені типи файлів; ім'я на сервері випадкове.
 * GET ?check=1 - повертає ліміти сервера (без секретів) для діагностики.
 */
declare(strict_types=1);

const PROJECT_ID = 'ntubd-93efc';
const SITE = 'https://ntu.dp.ua';
const MAX_BYTES = ['chat' => 10 * 1024 * 1024, 'lesson' => 20 * 1024 * 1024];
const TYPES = [
    'chat' => [
        'pdf' => ['application/pdf'],
        'png' => ['image/png'], 'jpg' => ['image/jpeg'], 'jpeg' => ['image/jpeg'], 'webp' => ['image/webp'], 'gif' => ['image/gif'],
        'txt' => ['text/plain'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
        'pptx' => ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
        'zip' => ['application/zip', 'application/x-zip-compressed'],
    ],
    'lesson' => ['pdf' => ['application/pdf']],
];

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === SITE || $origin === 'https://www.ntu.dp.ua') {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Authorization');
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
}

function out(int $code, array $data): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function toBytes(string $v): int
{
    $v = trim($v);
    $n = (int)$v;
    switch (strtolower(substr($v, -1))) {
        case 'g': return $n * 1024 * 1024 * 1024;
        case 'm': return $n * 1024 * 1024;
        case 'k': return $n * 1024;
    }
    return $n;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') out(204, []);
if ($method === 'GET' && isset($_GET['check'])) {
    out(200, ['ok' => true, 'upload_max_filesize' => ini_get('upload_max_filesize'), 'post_max_size' => ini_get('post_max_size'),
              'openssl' => function_exists('openssl_verify'), 'finfo' => class_exists('finfo')]);
}
if ($method !== 'POST') out(405, ['error' => 'METHOD']);

/* ---------- Firebase ID token ---------- */
function b64url(string $s): string
{
    return (string)base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4));
}

function googleCerts(): array
{
    $cache = sys_get_temp_dir() . '/ntu_fb_certs.json';
    if (is_file($cache) && filemtime($cache) > time() - 3600) {
        $c = json_decode((string)file_get_contents($cache), true);
        if (is_array($c) && $c) return $c;
    }
    $ctx = stream_context_create(['http' => ['timeout' => 8]]);
    $raw = @file_get_contents('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', false, $ctx);
    $c = $raw ? json_decode($raw, true) : null;
    if (!is_array($c) || !$c) out(503, ['error' => 'CERTS']);
    @file_put_contents($cache, $raw);
    return $c;
}

function verifyToken(string $jwt): array
{
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) out(401, ['error' => 'TOKEN']);
    [$h64, $p64, $s64] = $parts;
    $head = json_decode(b64url($h64), true);
    $pay = json_decode(b64url($p64), true);
    if (!is_array($head) || !is_array($pay) || ($head['alg'] ?? '') !== 'RS256' || empty($head['kid'])) out(401, ['error' => 'TOKEN']);
    $certs = googleCerts();
    $cert = $certs[$head['kid']] ?? null;
    if (!$cert) out(401, ['error' => 'TOKEN']);
    if (openssl_verify($h64 . '.' . $p64, b64url($s64), $cert, OPENSSL_ALGO_SHA256) !== 1) out(401, ['error' => 'TOKEN']);
    $now = time();
    if (($pay['aud'] ?? '') !== PROJECT_ID || ($pay['iss'] ?? '') !== 'https://securetoken.google.com/' . PROJECT_ID) out(401, ['error' => 'TOKEN']);
    if (($pay['exp'] ?? 0) < $now || ($pay['iat'] ?? $now + 999) > $now + 300 || empty($pay['sub'])) out(401, ['error' => 'EXPIRED']);
    if (empty($pay['email_verified'])) out(403, ['error' => 'NOT_VERIFIED']);
    return $pay;
}

$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if (!$auth && function_exists('getallheaders')) {
    foreach (getallheaders() as $k => $v) if (strtolower($k) === 'authorization') $auth = $v;
}
if (!preg_match('/^Bearer\s+([A-Za-z0-9\-_.]+)$/', $auth, $m)) out(401, ['error' => 'TOKEN']);
$user = verifyToken($m[1]);

/* ---------- file (частинами по <=1.5 МБ, бо upload_max_filesize на сервері 2 МБ) ---------- */
$kind = ($_POST['kind'] ?? 'chat') === 'lesson' ? 'lesson' : 'chat';
$uploadId = (string)($_POST['upload_id'] ?? '');
$index = (int)($_POST['index'] ?? -1);
$total = (int)($_POST['total'] ?? 0);
$size = (int)($_POST['size'] ?? 0);
$name = (string)($_POST['name'] ?? '');
if (!preg_match('/^[a-f0-9]{32}$/', $uploadId) || $total < 1 || $total > 20 || $index < 0 || $index >= $total) out(400, ['error' => 'CHUNK']);
if ($size <= 0) out(400, ['error' => 'EMPTY']);
if ($size > MAX_BYTES[$kind]) out(413, ['error' => 'TOO_LARGE', 'max' => MAX_BYTES[$kind]]);
$ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
$allowed = TYPES[$kind];
if (!isset($allowed[$ext])) out(415, ['error' => 'TYPE']);

if (empty($_FILES['file']) || !is_array($_FILES['file'])) {
    $cl = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    out($cl > toBytes((string)ini_get('post_max_size')) ? 413 : 400, ['error' => $cl ? 'TOO_LARGE' : 'NO_FILE']);
}
$f = $_FILES['file'];
if (in_array($f['error'] ?? UPLOAD_ERR_NO_FILE, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) out(413, ['error' => 'TOO_LARGE']);
if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) out(400, ['error' => 'NO_FILE']);

$tmpRoot = sys_get_temp_dir() . '/ntu_chunks';
if (!is_dir($tmpRoot)) @mkdir($tmpRoot, 0700, true);
// прибираємо незавершені завантаження, старші за годину
if (random_int(1, 20) === 1) {
    foreach (glob($tmpRoot . '/*', GLOB_ONLYDIR) ?: [] as $d) {
        if (filemtime($d) < time() - 3600) { array_map('unlink', glob($d . '/*') ?: []); @rmdir($d); }
    }
}
$chunkDir = $tmpRoot . '/' . preg_replace('/[^A-Za-z0-9]/', '', (string)$user['sub']) . '_' . $uploadId;
if (!is_dir($chunkDir) && !@mkdir($chunkDir, 0700, true)) out(500, ['error' => 'STORAGE']);
if (!move_uploaded_file($f['tmp_name'], $chunkDir . '/' . $index)) out(500, ['error' => 'STORAGE']);

$have = count(glob($chunkDir . '/*') ?: []);
if ($have < $total) out(200, ['done' => false, 'received' => $have, 'total' => $total]);

/* усі частини на місці: збираємо, перевіряємо розмір і реальний тип вмісту */
$assembled = $chunkDir . '/full';
$outF = fopen($assembled, 'wb');
for ($i = 0; $i < $total; $i++) {
    $part = $chunkDir . '/' . $i;
    if (!is_file($part)) { fclose($outF); out(400, ['error' => 'CHUNK']); }
    fwrite($outF, (string)file_get_contents($part));
    @unlink($part);
}
fclose($outF);
$cleanup = function () use ($chunkDir, $assembled) { @unlink($assembled); @rmdir($chunkDir); };
$real = (int)filesize($assembled);
if ($real !== $size || $real > MAX_BYTES[$kind]) { $cleanup(); out(400, ['error' => 'SIZE']); }
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($assembled) ?: '';
if (!in_array($mime, $allowed[$ext], true)) { $cleanup(); out(415, ['error' => 'TYPE']); }

/* Чисте ім'я для показу: без шляхів і керувальних символів */
// прибираємо керувальні символи та скісні риски (у PHP-рядку «\\\\» - це один зворотний слеш у регулярному виразі)
$display = preg_replace('~[\x00-\x1F\x7F/\\\\]+~u', '', $name);
if (!is_string($display) || $display === '') $display = 'file.' . $ext;
$display = mb_substr(trim($display), 0, 150) ?: ('file.' . $ext);

$sub = date('Y/m');
$dir = dirname(__DIR__) . '/uploads/' . $sub;
if (!is_dir($dir) && !mkdir($dir, 0755, true)) { $cleanup(); out(500, ['error' => 'STORAGE']); }
$file = bin2hex(random_bytes(16)) . '.' . $ext;
if (!rename($assembled, $dir . '/' . $file)) { $cleanup(); out(500, ['error' => 'STORAGE']); }
@chmod($dir . '/' . $file, 0644);
@rmdir($chunkDir);

out(200, ['done' => true, 'url' => SITE . '/uploads/' . $sub . '/' . $file, 'name' => $display, 'size' => $real, 'type' => $mime]);
