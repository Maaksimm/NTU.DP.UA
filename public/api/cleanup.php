<?php
/**
 * Cleanup of uploaded files that nothing points to any more (personal-area.html, super admin panel «Файли на сервері»).
 *
 *   POST JSON {action: "scan"}   -> counts: all files in uploads/, unreferenced ones, expired stories
 *   POST JSON {action: "clean"}  -> deletes expired stories (+ their likes) from the database, then every file in
 *                                   uploads/ that no database record references; writes adminLog
 * Authorization: Bearer <super admin's Firebase ID token> (admins/{uid} = true, checked with the admin's own token).
 *
 * Safety:
 *  - references are collected from EVERY top-level database node (one request per node with the service account);
 *    if any request fails, nothing is deleted;
 *  - files younger than GRACE seconds are never deleted (an upload whose record is not saved yet, e.g. a story
 *    still being composed);
 *  - only regular files inside uploads/YYYY/MM/ are touched.
 */
declare(strict_types=1);
require __DIR__ . '/lib/firebase.php';
require __DIR__ . '/lib/mailer.php';

const RTDB = 'https://' . FB_PROJECT_ID . '-default-rtdb.europe-west1.firebasedatabase.app';
const GRACE = 48 * 3600;
const STORY_TTL_MS = 24 * 3600 * 1000;
const REF_RE = '~uploads/(\d{4}/\d{2}/[A-Za-z0-9_-]+\.[A-Za-z0-9]{2,5})~';

api_headers();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') out(204, []);
if ($method !== 'POST') out(405, ['error' => 'METHOD']);

$jwt = fb_bearer();
$user = $jwt ? fb_verify_id_token($jwt) : null;
if (!$user || empty($user['email_verified'])) out(401, ['error' => 'TOKEN']);
$uid = (string)$user['sub'];
if (!preg_match('/^[A-Za-z0-9]{10,64}$/', $uid)) out(401, ['error' => 'TOKEN']);
[$code, $isAdmin] = fb_http('GET', RTDB . '/admins/' . $uid . '.json?auth=' . rawurlencode($jwt), null, []);
if ($code !== 200 || $isAdmin !== true) out(403, ['error' => 'FORBIDDEN']);

$in = json_decode((string)file_get_contents('php://input'), true);
$action = is_array($in) ? (string)($in['action'] ?? '') : '';
if (!in_array($action, ['scan', 'clean'], true)) out(400, ['error' => 'BAD_REQUEST']);
if (limited('cleanup:' . $uid, $action === 'clean' ? 5 : 30, 3600)) out(429, ['error' => 'TOO_MANY_ATTEMPTS']);

$tk = fb_admin_token('https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email');
if (!$tk) out(503, ['error' => 'NOT_CONFIGURED']);
@set_time_limit(120);

/** Service-account database call (bypasses the rules). */
function sdb(string $method, string $path, ?array $body = null): array
{
    global $tk;
    // 'node?shallow=true' -> RTDB/node.json?shallow=true ; '?shallow=true' -> RTDB/.json?shallow=true
    [$p, $q] = array_pad(explode('?', $path, 2), 2, '');
    return fb_http($method, RTDB . '/' . $p . '.json' . ($q !== '' ? '?' . $q : ''),
        $body === null ? null : json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ['Authorization: Bearer ' . $tk, 'Content-Type: application/json']);
}

/**
 * Strict read for the reference scan: a cut-off or malformed body must abort the cleanup, never count as "empty"
 * (otherwise every file referenced only by that node would look orphaned). Returns the decoded value.
 */
function sread(string $path)
{
    global $tk;
    [$p, $q] = array_pad(explode('?', $path, 2), 2, '');
    $ctx = stream_context_create(['http' => [
        'method' => 'GET', 'header' => 'Authorization: Bearer ' . $tk, 'timeout' => 60, 'ignore_errors' => true,
    ]]);
    $raw = @file_get_contents(RTDB . '/' . $p . '.json' . ($q !== '' ? '?' . $q : ''), false, $ctx);
    $code = 0;
    foreach ($http_response_header ?? [] as $h) if (preg_match('~^HTTP/\S+\s+(\d{3})~', $h, $m)) $code = (int)$m[1];
    if ($raw === false || $code !== 200) out(502, ['error' => 'UPSTREAM', 'node' => $path]);
    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) out(502, ['error' => 'UPSTREAM', 'node' => $path]);
    if ($data === null && trim($raw) !== 'null') out(502, ['error' => 'UPSTREAM', 'node' => $path]);
    return $data;
}
@ini_set('memory_limit', '512M');

/* ---- 1. expired stories (older than 24 h: the site no longer shows them) ---- */
$stories = sread('stories');
$stories = is_array($stories) ? $stories : [];
$nowMs = (int)round(microtime(true) * 1000);
$expired = [];
foreach ($stories as $id => $s) {
    if (is_array($s) && is_numeric($s['ts'] ?? null) && $nowMs - (int)$s['ts'] > STORY_TTL_MS && preg_match('/^[A-Za-z0-9_-]{4,40}$/', (string)$id)) $expired[] = (string)$id;
}
// clean: delete expired stories FIRST; references are collected afterwards from a fresh read, so the files of a
// story whose delete failed stay referenced and are kept
$removedStories = 0;
if ($action === 'clean') {
    foreach ($expired as $id) {
        sdb('DELETE', 'storyLikes/' . $id);
        sdb('DELETE', 'storyViews/' . $id);
        [$c] = sdb('DELETE', 'stories/' . $id);
        if ($c === 200) $removedStories++;
    }
}

/* ---- 2. every file reference in the database (all top-level nodes; any failed read aborts) ---- */
$top = sread('?shallow=true');
if (!is_array($top)) out(502, ['error' => 'UPSTREAM']);
$refs = [];
foreach (array_keys($top) as $node) {
    if (!preg_match('/^[A-Za-z0-9_-]{1,64}$/', (string)$node)) out(502, ['error' => 'UPSTREAM', 'node' => 'name']);
    $data = sread(rawurlencode((string)$node));
    if (preg_match_all(REF_RE, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '', $m)) {
        foreach ($m[1] as $r) $refs[$r] = true;
    }
}

/* ---- 3. files on disk ---- */
$root = realpath(dirname(__DIR__) . '/uploads');
$all = 0; $allBytes = 0; $orphans = []; $orphanBytes = 0; $young = 0;
if ($root !== false) {
    foreach (glob($root . '/[0-9][0-9][0-9][0-9]/[0-9][0-9]/*') ?: [] as $f) {
        if (!is_file($f)) continue;
        $rel = substr($f, strlen($root) + 1);
        $rel = str_replace('\\', '/', $rel);
        $size = (int)@filesize($f);
        $all++; $allBytes += $size;
        if (isset($refs[$rel])) continue;
        if (time() - (int)@filemtime($f) < GRACE) { $young++; continue; }
        $orphans[] = [$f, $size];
        $orphanBytes += $size;
    }
}

$report = [
    'ok' => true, 'files' => $all, 'bytes' => $allBytes, 'orphans' => count($orphans), 'orphanBytes' => $orphanBytes,
    'young' => $young, 'expiredStories' => count($expired),
];
if ($action === 'scan') out(200, $report);

/* ---- 4. clean ---- */
$deleted = 0; $freed = 0;
foreach ($orphans as [$f, $size]) {
    $real = realpath($f);
    if ($real === false || !str_starts_with($real, $root . DIRECTORY_SEPARATOR)) continue;
    if (@unlink($real)) { $deleted++; $freed += $size; }
}
sdb('POST', 'adminLog', [
    'a' => $uid, 'n' => mb_substr((string)($user['name'] ?? ''), 0, 40), 'act' => 'files.clean',
    'd' => 'Видалено файлів: ' . $deleted . ' (' . round($freed / 1048576, 1) . ' МБ), прострочених сторіз: ' . $removedStories,
    'ts' => ['.sv' => 'timestamp'],
]);
out(200, $report + ['deleted' => $deleted, 'freed' => $freed, 'removedStories' => $removedStories]);
