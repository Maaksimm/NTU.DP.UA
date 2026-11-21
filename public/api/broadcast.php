<?php
/**
 * Newsletter to every registered user ("на платформі з'явився чат" + other news), sent from noreply@ntu.dp.ua.
 * Only the platform team (STAFF_UIDS, the same uids as `staff` in chat-config.js) can send; the page is broadcast.html.
 *
 * GET  ?preview=1                 - the letter in the browser (dummy unsubscribe link)
 * GET  ?unsub=<uid>&s=<sig>       - one-click unsubscribe (link from the letter, HMAC-signed)
 * POST Authorization: Bearer <ID token of a staff account>, JSON:
 *   {action: "status"}            - recipients total / already sent / unsubscribed
 *   {action: "test"}              - send the letter only to the caller's own email
 *   {action: "send", confirm: "SEND"} - send the next batch (BATCH letters); call again until remaining = 0
 * Recipients: Firebase Auth accounts with a verified email that are not disabled and did not unsubscribe.
 * Progress is stored per CAMPAIGN outside public_html, so a repeated run never mails anyone twice.
 */
declare(strict_types=1);

require __DIR__ . '/lib/firebase.php';
require __DIR__ . '/lib/mail-template.php';
require __DIR__ . '/lib/mailer.php';

const CAMPAIGN = '2026-11-chat';
const BATCH = 25;
const STAFF_UIDS = ['wm6Q5hkr1cQIGVsWzlLTDJlsQ5q1', 'AFWawaCZt7aBmCN9QTWtpglFyot1'];
const SUBJECT = 'На World Students з’явився чат - і ще багато нового';

/* ---------------------------------------------------------------- storage */

/** /home/ntu.dp.ua/private/broadcast (next to the service-account key), never inside public_html. */
function bc_dir(): string
{
    $dir = dirname(fb_sa_path()) . '/broadcast';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    if (!is_dir($dir) || !is_writable($dir)) out(503, ['error' => 'STORAGE']);
    return $dir;
}

function bc_read(string $name): array
{
    $f = bc_dir() . '/' . $name . '.json';
    $d = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    return is_array($d) ? $d : [];
}

function bc_write(string $name, array $data): void
{
    $f = bc_dir() . '/' . $name . '.json';
    if (@file_put_contents($f, json_encode($data), LOCK_EX) === false) out(503, ['error' => 'STORAGE']);
}

/* ---------------------------------------------------------------- unsubscribe links */

function unsub_sig(string $uid): string
{
    $sa = fb_sa();
    if (!$sa) out(503, ['error' => 'NOT_CONFIGURED']);
    // key derived from the private service-account key: nobody outside the server can forge a link
    $key = hash('sha256', 'ntu-unsub|' . $sa['private_key'], true);
    return substr(fb_b64url_encode(hash_hmac('sha256', $uid, $key, true)), 0, 22);
}

function unsub_url(string $uid): string
{
    return SITE . '/api/broadcast.php?unsub=' . rawurlencode($uid) . '&s=' . unsub_sig($uid);
}

/* ---------------------------------------------------------------- letter */

function letter(string $name, string $unsubUrl): array
{
    return mail_render([
        'greeting' => $name !== '' ? 'Привіт, ' . $name . '!' : 'Привіт!',
        'title' => 'На платформі з’явився чат',
        'intro' => 'World Students - студентська платформа НТУ «Дніпровська політехніка», яку ми робимо студентами для студентів. Поки тебе не було, ми додали багато нового - заходь подивитися:',
        'items' => [
            ['💬', 'Загальний чат', 'Спілкуйся з усіма студентами наживо: реакції емодзі, ❤️ подвійним кліком, GIF, файли й фото, видно, хто зараз онлайн і хто друкує.'],
            ['✉️', 'Особисті повідомлення', 'Пиши напряму одногрупникам і викладачам - зі статусами «доставлено» й «прочитано».'],
            ['⭐', 'Рейтинг викладачів', 'Залишай відгуки й дивись оцінки викладачів та студентів.'],
            ['🤖', 'AI Student', 'Помічник у кутку сайту відповідає на питання про вступ, навчання, розклад і навіть погоду.'],
            ['👤', 'Профіль і сторіз', 'Фото, «Про мене», фон профілю для світлої й темної теми, сторіз студентів на головній.'],
        ],
        'button' => 'Відкрити платформу',
        'url' => SITE . '/',
        'note' => 'Увійди з тією ж поштою, з якою реєструвався. Знайшов помилку або маєш ідею? Напиши нам у чаті - ми читаємо все.',
        'preheader' => 'Чат, особисті повідомлення, рейтинг викладачів і AI Student - усе вже на ntu.dp.ua.',
        'unsubscribe' => $unsubUrl,
    ]);
}

/* ---------------------------------------------------------------- recipients */

/** All Firebase Auth accounts that may receive the letter: [uid => email]. */
function recipients(): array
{
    $tk = fb_admin_token('https://www.googleapis.com/auth/cloud-platform');
    if (!$tk) out(503, ['error' => 'NOT_CONFIGURED']);
    $list = [];
    $page = '';
    for ($i = 0; $i < 50; $i++) {
        $url = 'https://identitytoolkit.googleapis.com/v1/projects/' . FB_PROJECT_ID . '/accounts:batchGet?maxResults=1000'
            . ($page !== '' ? '&nextPageToken=' . rawurlencode($page) : '');
        [$code, $d] = fb_http('GET', $url, null, ['Authorization: Bearer ' . $tk]);
        if ($code !== 200 || !is_array($d)) out(502, ['error' => 'UPSTREAM', 'detail' => (string)($d['error']['message'] ?? $code)]);
        foreach ($d['users'] ?? [] as $u) {
            $email = strtolower((string)($u['email'] ?? ''));
            if (empty($u['emailVerified']) || !empty($u['disabled']) || !valid_email($email)) continue;
            $list[(string)$u['localId']] = $email;
        }
        $page = (string)($d['nextPageToken'] ?? '');
        if ($page === '') break;
    }
    return $list;
}

/* ---------------------------------------------------------------- staff auth */

function staff_user(): array
{
    $jwt = fb_bearer();
    $user = $jwt ? fb_verify_id_token($jwt) : null;
    if (!$user) out(401, ['error' => 'TOKEN']);
    if (!in_array((string)$user['sub'], STAFF_UIDS, true) || empty($user['email_verified'])) out(403, ['error' => 'FORBIDDEN']);
    return $user;
}

/* ---------------------------------------------------------------- routes */

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET' && isset($_GET['preview'])) {
    header('Content-Type: text/html; charset=utf-8');
    header('X-Robots-Tag: noindex');
    echo letter('Студенте', SITE . '/api/broadcast.php?unsub=PREVIEW')[0];
    exit;
}

// GET shows a confirmation button (mail scanners open links on their own), POST unsubscribes
// (the button, or the one-click List-Unsubscribe-Post request from Gmail / Apple Mail).
if (isset($_GET['unsub'])) {
    header('Content-Type: text/html; charset=utf-8');
    header('X-Robots-Tag: noindex');
    header('Cache-Control: no-store');
    $uid = (string)$_GET['unsub'];
    $sig = (string)($_GET['s'] ?? '');
    $valid = preg_match('/^[A-Za-z0-9]{10,40}$/', $uid) === 1 && preg_match('/^[A-Za-z0-9_-]{22}$/', $sig) === 1
        && hash_equals(unsub_sig($uid), $sig);
    $done = $valid && $method === 'POST';
    if ($done) {
        $unsub = bc_read('unsubscribed');
        $unsub[$uid] = time();
        bc_write('unsubscribed', $unsub);
    }
    http_response_code($valid ? 200 : 400);
    if (!$valid) {
        [$head, $msg, $form] = ['Не вдалося відписатися', 'Посилання недійсне. Спробуйте відкрити його ще раз з листа.', ''];
    } elseif ($done) {
        [$head, $msg, $form] = ['Ви відписалися', 'Готово: листів з новинами платформи більше не буде. Листи для входу й підтвердження пошти приходитимуть як і раніше.', ''];
    } else {
        $action = mail_e('?unsub=' . rawurlencode($uid) . '&s=' . rawurlencode($sig));
        [$head, $msg, $form] = ['Відписатися від новин?', 'Ви більше не отримуватимете листів з новинами World Students.',
            '<form method="post" action="' . $action . '" style="margin:0 0 20px"><button type="submit" style="padding:13px 26px;border:0;border-radius:14px;background:#1a6fc4;color:#fff;font:800 15px Manrope,Arial,sans-serif;cursor:pointer">Так, відписатися</button></form>'];
    }
    echo '<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Відписка - World Students</title></head>'
        . '<body style="margin:0;padding:48px 16px;background:#eef4fb;font-family:Manrope,\'Segoe UI\',Arial,sans-serif;color:#0b2545;text-align:center">'
        . '<h1 style="font-size:24px">' . mail_e($head) . '</h1>'
        . '<p style="max-width:460px;margin:0 auto 20px;color:#4a5b70;line-height:1.6">' . mail_e($msg) . '</p>' . $form
        . '<a href="' . SITE . '/" style="color:#1a6fc4;font-weight:700">Повернутися на ntu.dp.ua</a></body></html>';
    exit;
}

api_headers();
if ($method === 'OPTIONS') out(204, []);
if ($method !== 'POST') out(405, ['error' => 'METHOD']);
if (fb_sa() === null || !function_exists('mail')) out(503, ['error' => 'NOT_CONFIGURED']);

$user = staff_user();
$in = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($in)) out(400, ['error' => 'BAD_REQUEST']);
$action = (string)($in['action'] ?? '');

if ($action === 'status') {
    $all = recipients();
    $sent = bc_read('sent-' . CAMPAIGN);
    $unsub = bc_read('unsubscribed');
    $pending = array_diff_key($all, $sent, $unsub);
    out(200, ['ok' => true, 'campaign' => CAMPAIGN, 'subject' => SUBJECT, 'total' => count($all),
        'sent' => count(array_intersect_key($sent, $all)), 'unsubscribed' => count(array_intersect_key($unsub, $all)), 'remaining' => count($pending)]);
}

if ($action === 'test') {
    if (limited('bc-test:' . $user['sub'], 5, 3600)) out(429, ['error' => 'TOO_MANY_ATTEMPTS']);
    $uid = (string)$user['sub'];
    $ok = send_mail((string)$user['email'], SUBJECT, letter(fb_user_name($uid), unsub_url($uid)),
        ['List-Unsubscribe: <' . unsub_url($uid) . '>', 'List-Unsubscribe-Post: List-Unsubscribe=One-Click']);
    out($ok ? 200 : 502, $ok ? ['ok' => true, 'to' => $user['email']] : ['error' => 'MAIL']);
}

if ($action === 'send') {
    if (($in['confirm'] ?? '') !== 'SEND') out(400, ['error' => 'CONFIRM']);
    // one batch at a time; the page calls again until nothing remains
    $lock = fopen(bc_dir() . '/send.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) out(409, ['error' => 'BUSY']);
    @set_time_limit(120);
    $all = recipients();
    $sent = bc_read('sent-' . CAMPAIGN);
    $pending = array_slice(array_diff_key($all, $sent, bc_read('unsubscribed')), 0, BATCH, true);
    $failed = [];
    foreach ($pending as $uid => $email) {
        $uid = (string)$uid;
        $ok = send_mail($email, SUBJECT, letter(fb_user_name($uid), unsub_url($uid)),
            ['List-Unsubscribe: <' . unsub_url($uid) . '>', 'List-Unsubscribe-Post: List-Unsubscribe=One-Click']);
        // a failed address is still marked, so one bad mailbox cannot block the whole campaign
        $sent[$uid] = $ok ? time() : -time();
        if (!$ok) $failed[] = $email;
        bc_write('sent-' . CAMPAIGN, $sent);
        usleep(300000);
    }
    flock($lock, LOCK_UN);
    $remaining = count(array_diff_key($all, $sent, bc_read('unsubscribed')));
    out(200, ['ok' => true, 'sent' => count($pending) - count($failed), 'failed' => count($failed), 'remaining' => $remaining]);
}

out(400, ['error' => 'ACTION']);
