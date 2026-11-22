<?php
/**
 * Visitor statistics without cookies or third-party analytics.
 *
 *   POST JSON {p, r, s, w, tk?}          - one page view (sent by main.js 16-visits.js on ntu.dp.ua)
 *        p: path, r: referrer URL, s: utm_source, w: screen width, tk: Firebase ID token of a signed-in user (optional)
 *   POST JSON {action: "summary", from, to}  (Bearer: super admin)  - per-day totals, top pages/sources/devices, signed-in users
 *   POST JSON {action: "raw", from, to}      (Bearer: super admin)  - every view, for the CSV export
 *
 * Storage: /home/ntu.dp.ua/private/visits/YYYY-MM-DD.jsonl (outside public_html), one JSON line per view:
 *   {t: unix time, v: visitor id, p: path, r: source, d: device, o: OS, u?: uid, n?: name}
 * The visitor id is an HMAC of IP + User-Agent + date with a server secret: unique visitors per day can be counted,
 * but the IP is never stored and the id changes every day (no cross-day tracking of guests).
 * Files older than KEEP_DAYS are deleted.
 */
declare(strict_types=1);
require __DIR__ . '/lib/firebase.php';
require __DIR__ . '/lib/mailer.php';

const RTDB = 'https://' . FB_PROJECT_ID . '-default-rtdb.europe-west1.firebasedatabase.app';
const KEEP_DAYS = 400;
const MAX_RANGE_DAYS = 92;
const BOT_RE = '~bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pagespeed|curl|wget|python|java/|go-http|okhttp|monitor|uptime~i';

api_headers();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') out(204, []);
if ($method !== 'POST') out(405, ['error' => 'METHOD']);

date_default_timezone_set('Europe/Kyiv');
$dir = dirname(__DIR__, 2) . '/private/visits'; // public_html/api -> /home/ntu.dp.ua/private/visits
if (!is_dir($dir) && !@mkdir($dir, 0700, true)) out(503, ['error' => 'STORAGE']);

$in = json_decode((string)file_get_contents('php://input', false, null, 0, 8192), true);
if (!is_array($in)) out(400, ['error' => 'BAD_REQUEST']);
$action = (string)($in['action'] ?? 'hit');

if ($action === 'hit') record_hit($in, $dir);
if ($action !== 'summary' && $action !== 'raw') out(400, ['error' => 'BAD_REQUEST']);

/* ---------------------------------------------------------------- admin reports */
$jwt = fb_bearer();
$user = $jwt ? fb_verify_id_token($jwt) : null;
if (!$user || empty($user['email_verified'])) out(401, ['error' => 'TOKEN']);
$uid = (string)$user['sub'];
if (!preg_match('/^[A-Za-z0-9]{10,64}$/', $uid)) out(401, ['error' => 'TOKEN']);
[$code, $isAdmin] = fb_http('GET', RTDB . '/admins/' . $uid . '.json?auth=' . rawurlencode($jwt), null, []);
if ($code !== 200 || $isAdmin !== true) out(403, ['error' => 'FORBIDDEN']);
if (limited('visits-report:' . $uid, 120, 3600)) out(429, ['error' => 'TOO_MANY_ATTEMPTS']);

$from = (string)($in['from'] ?? ''); $to = (string)($in['to'] ?? '');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) out(400, ['error' => 'BAD_RANGE']);
$a = strtotime($from . ' 00:00:00'); $b = strtotime($to . ' 00:00:00');
if ($a === false || $b === false || $b < $a || ($b - $a) / 86400 > MAX_RANGE_DAYS) out(400, ['error' => 'BAD_RANGE']);

$days = [];
for ($d = $a; $d <= $b; $d = strtotime('+1 day', $d)) $days[] = date('Y-m-d', $d);

if ($action === 'raw') {
    $rows = [];
    foreach ($days as $day) foreach (read_day($dir, $day) as $h) {
        $rows[] = $h;
        if (count($rows) >= 50000) out(200, ['ok' => true, 'rows' => $rows, 'truncated' => true]);
    }
    out(200, ['ok' => true, 'rows' => $rows, 'truncated' => false]);
}

$perDay = []; $pages = []; $refs = []; $devices = []; $oses = []; $hours = array_fill(0, 24, 0); $users = [];
$allVisitors = 0; $allViews = 0;
foreach ($days as $day) {
    $v = []; $u = []; $views = 0;
    foreach (read_day($dir, $day) as $h) {
        $views++;
        $v[$h['v']] = true;
        $pages[$h['p']] = ($pages[$h['p']] ?? 0) + 1;
        $refs[$h['r']] = ($refs[$h['r']] ?? 0) + 1;
        $devices[$h['d']] = ($devices[$h['d']] ?? 0) + 1;
        $oses[$h['o']] = ($oses[$h['o']] ?? 0) + 1;
        $hours[(int)date('G', $h['t'])]++;
        if (!empty($h['u'])) {
            $u[$h['u']] = true;
            $x = $users[$h['u']] ?? ['uid' => $h['u'], 'name' => '', 'views' => 0, 'days' => [], 'last' => 0];
            $x['views']++;
            $x['days'][$day] = true;
            $x['last'] = max($x['last'], $h['t']);
            if (!empty($h['n'])) $x['name'] = $h['n'];
            $users[$h['u']] = $x;
        }
    }
    $perDay[] = ['day' => $day, 'visitors' => count($v), 'views' => $views, 'users' => count($u)];
    $allVisitors += count($v); $allViews += $views;
}
$top = function (array $m, int $n = 15): array {
    arsort($m);
    $out = [];
    foreach (array_slice($m, 0, $n, true) as $k => $c) $out[] = ['k' => (string)$k, 'n' => $c];
    return $out;
};
$users = array_values(array_map(fn($x) => ['uid' => $x['uid'], 'name' => $x['name'], 'views' => $x['views'], 'days' => count($x['days']), 'last' => $x['last']], $users));
usort($users, fn($x, $y) => $y['last'] <=> $x['last']);
out(200, [
    'ok' => true, 'days' => $perDay, 'visitors' => $allVisitors, 'views' => $allViews, 'registered' => count($users),
    'pages' => $top($pages), 'sources' => $top($refs), 'devices' => $top($devices, 5), 'os' => $top($oses, 8),
    'hours' => $hours, 'users' => array_slice($users, 0, 500),
]);

/* ---------------------------------------------------------------- helpers */

/** Records one page view and exits with 204. Bad or bot requests are silently ignored (also 204). */
function record_hit(array $in, string $dir): void
{
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    if ($ua === '' || preg_match(BOT_RE, $ua)) out(204, []);
    $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin !== '' && $origin !== SITE && $origin !== 'https://www.ntu.dp.ua') out(204, []);
    $path = (string)($in['p'] ?? '');
    if (!preg_match('~^/([a-z0-9-]{1,60}\.html)?$~', $path)) out(204, []);
    if ($path === '/index.html') $path = '/';

    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    $day = date('Y-m-d');
    $visitor = substr(hash_hmac('sha256', $ip . '|' . $ua . '|' . $day, visits_secret($dir)), 0, 16);
    // anti-inflation: at most 300 views per visitor and 1000 per IP an hour (the limiter key is a hash, not the IP)
    if (limited('visit:' . $visitor, 300, 3600) || limited('visit-ip:' . hash('sha256', $ip . '|' . $day), 1000, 3600)) out(204, []);

    $row = ['t' => time(), 'v' => $visitor, 'p' => $path, 'r' => source((string)($in['r'] ?? ''), (string)($in['s'] ?? '')),
        'd' => device((int)($in['w'] ?? 0), $ua), 'o' => os_name($ua)];
    $tk = (string)($in['tk'] ?? '');
    if ($tk !== '' && strlen($tk) < 4096) {
        $u = fb_verify_id_token($tk);
        if ($u && preg_match('/^[A-Za-z0-9]{10,64}$/', (string)$u['sub'])) {
            $row['u'] = (string)$u['sub'];
            $name = trim((string)($u['name'] ?? ''));
            if ($name !== '') $row['n'] = mb_substr($name, 0, 40);
        }
    }
    @file_put_contents($dir . '/' . $day . '.jsonl', json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
    prune($dir);
    out(204, []);
}

/** Server secret for the visitor hash: derived from the service-account key, or a random file next to the logs. */
function visits_secret(string $dir): string
{
    $sa = fb_sa();
    if ($sa) return hash('sha256', 'ntu-visits|' . $sa['private_key'], true);
    $f = $dir . '/.secret';
    if (!is_file($f)) { $old = umask(0077); @file_put_contents($f, bin2hex(random_bytes(32))); umask($old); }
    return (string)@file_get_contents($f);
}

/** Where the visitor came from: utm_source, else the referrer host grouped into well-known names. */
function source(string $ref, string $utm): string
{
    $utm = strtolower(preg_replace('/[^a-z0-9_.-]/i', '', $utm) ?? '');
    if ($utm !== '') return mb_substr('utm:' . $utm, 0, 60);
    $host = strtolower((string)parse_url($ref, PHP_URL_HOST));
    if ($host === '') return 'Прямий захід';
    $host = preg_replace('/^(www|m|l|lm|mobile)\./', '', $host) ?? $host;
    if ($host === 'ntu.dp.ua') return 'Внутрішній перехід';
    $groups = ['google.' => 'Google', 'bing.com' => 'Bing', 'duckduckgo.com' => 'DuckDuckGo', 'yandex.' => 'Yandex',
        'instagram.com' => 'Instagram', 'facebook.com' => 'Facebook', 'linkedin.com' => 'LinkedIn', 'lnkd.in' => 'LinkedIn',
        't.me' => 'Telegram', 'telegram.org' => 'Telegram', 't.co' => 'X (Twitter)', 'x.com' => 'X (Twitter)',
        'youtube.com' => 'YouTube', 'tiktok.com' => 'TikTok', 'nmu.org.ua' => 'nmu.org.ua', 'mail.google.com' => 'Gmail'];
    foreach ($groups as $needle => $name) if (str_contains($host, $needle)) return $name;
    return mb_substr($host, 0, 60);
}

function device(int $w, string $ua): string
{
    if (preg_match('/iPad|Tablet/i', $ua) || ($w >= 700 && $w < 1100 && preg_match('/Android|Mobile/i', $ua))) return 'Планшет';
    if (preg_match('/Mobi|Android|iPhone/i', $ua) || ($w > 0 && $w < 700)) return 'Телефон';
    return 'Комп’ютер';
}

function os_name(string $ua): string
{
    foreach (['Android' => 'Android', 'iPhone' => 'iOS', 'iPad' => 'iOS', 'Windows' => 'Windows', 'Mac OS X' => 'macOS', 'CrOS' => 'ChromeOS', 'Linux' => 'Linux'] as $k => $v) {
        if (str_contains($ua, $k)) return $v;
    }
    return 'Інша';
}

/** All views of one day (a missing file is an empty day). */
function read_day(string $dir, string $day): array
{
    $f = $dir . '/' . $day . '.jsonl';
    if (!is_file($f)) return [];
    $out = [];
    foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $h = json_decode($line, true);
        if (is_array($h) && isset($h['t'], $h['v'], $h['p'])) {
            $h += ['r' => '', 'd' => '', 'o' => ''];
            $out[] = $h;
        }
    }
    return $out;
}

/** Deletes day files older than KEEP_DAYS (at most once a day). */
function prune(string $dir): void
{
    $mark = $dir . '/.pruned';
    if (is_file($mark) && (string)@file_get_contents($mark) === date('Y-m-d')) return;
    @file_put_contents($mark, date('Y-m-d'));
    $limit = date('Y-m-d', strtotime('-' . KEEP_DAYS . ' days'));
    foreach (glob($dir . '/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].jsonl') ?: [] as $f) {
        if (basename($f, '.jsonl') < $limit) @unlink($f);
    }
}
