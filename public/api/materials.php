<?php
/**
 * Moderation of study materials sent by students (materials.html).
 *
 * Students write to materials/pending/{id} directly (database rules: verified email, own uid, own email).
 * A super admin (admins/{uid} = true in the Realtime Database) decides here:
 *   POST JSON {action: "approve", id}          -> copies the entry to materials/approved/{id}, removes it from pending,
 *                                                 emails the author "published"
 *   POST JSON {action: "reject", id, reason}   -> emails the author the reason, removes the entry and its uploaded file
 * Authorization: Bearer <admin's Firebase ID token>. Every database call is made WITH that token, so the database
 * rules are the final check (only admins may read pending entries and write approved ones).
 */
declare(strict_types=1);

require __DIR__ . '/lib/firebase.php';
require __DIR__ . '/lib/mail-template.php';
require __DIR__ . '/lib/mailer.php';

const RTDB = 'https://' . FB_PROJECT_ID . '-default-rtdb.europe-west1.firebasedatabase.app';

api_headers();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') out(204, []);
if ($method !== 'POST') out(405, ['error' => 'METHOD']);

$jwt = fb_bearer();
$admin = $jwt ? fb_verify_id_token($jwt) : null;
if (!$admin || empty($admin['email_verified'])) out(401, ['error' => 'TOKEN']);
$adminUid = (string)$admin['sub'];
if (!preg_match('/^[A-Za-z0-9]{10,64}$/', $adminUid)) out(401, ['error' => 'TOKEN']);
if (limited('materials:' . $adminUid, 120, 3600)) out(429, ['error' => 'TOO_MANY_ATTEMPTS']);

/** Realtime Database REST call as the signed-in admin (the rules apply). */
function db(string $method, string $path, ?array $body = null): array
{
    global $jwt;
    return fb_http($method, RTDB . '/' . $path . '.json?auth=' . rawurlencode($jwt),
        $body === null ? null : json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), ['Content-Type: application/json']);
}

[$code, $isAdmin] = db('GET', 'admins/' . $adminUid);
if ($code !== 200 || $isAdmin !== true) out(403, ['error' => 'FORBIDDEN']);

$in = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($in)) out(400, ['error' => 'BAD_REQUEST']);
$action = (string)($in['action'] ?? '');
$id = (string)($in['id'] ?? '');
if (!in_array($action, ['approve', 'reject'], true) || !preg_match('/^[A-Za-z0-9_-]{10,40}$/', $id)) out(400, ['error' => 'BAD_REQUEST']);

[$code, $item] = db('GET', 'materials/pending/' . $id);
if ($code !== 200) out(502, ['error' => 'UPSTREAM']);
if (!is_array($item)) out(404, ['error' => 'NOT_FOUND']);

$title = mb_substr((string)($item['ti'] ?? ''), 0, 150);
$email = (string)($item['e'] ?? '');
$name = mb_substr((string)($item['n'] ?? ''), 0, 40);
$hello = $name !== '' ? 'Вітаємо, ' . $name . '!' : 'Вітаємо!';

if ($action === 'approve') {
    $pub = ['ti' => $title, 'type' => (string)$item['type'], 'url' => (string)$item['url'], 'ts' => (int)round(microtime(true) * 1000)];
    foreach (['subj', 'd', 'fn', 'n', 'u'] as $k) {
        if (isset($item[$k]) && is_string($item[$k]) && $item[$k] !== '') $pub[$k] = $item[$k];
    }
    [$code] = db('PUT', 'materials/approved/' . $id, $pub);
    if ($code !== 200) out(502, ['error' => 'UPSTREAM']);
    db('DELETE', 'materials/pending/' . $id);
    $mailed = valid_email($email) && send_mail($email, 'Ваш матеріал опубліковано на World Students', mail_render([
        'greeting' => $hello,
        'title' => 'Матеріал опубліковано',
        'intro' => 'Дякуємо! Ваш матеріал «' . $title . '» перевірено й додано до розділу «Навчальні матеріали». Тепер він допомагатиме іншим студентам.',
        'button' => 'Переглянути матеріали',
        'url' => SITE . '/materials.html#materials-list',
        'note' => 'Маєте ще корисні конспекти чи методички? Надсилайте їх через ту саму форму на сторінці матеріалів.',
    ]));
    out(200, ['ok' => true, 'mailed' => $mailed]);
}

/* reject */
$reason = trim(preg_replace('/\s+/u', ' ', (string)($in['reason'] ?? '')) ?? '');
if (mb_strlen($reason) < 3 || mb_strlen($reason) > 500) out(400, ['error' => 'REASON']);
if (!valid_email($email)) out(400, ['error' => 'NO_EMAIL']);
if (!function_exists('mail')) out(503, ['error' => 'NOT_CONFIGURED']);
$sent = send_mail($email, 'Ваш матеріал не опубліковано - World Students', mail_render([
    'greeting' => $hello,
    'title' => 'Матеріал не опубліковано',
    'intro' => 'Дякуємо, що надіслали матеріал «' . $title . '». На жаль, цього разу ми не можемо його опублікувати. Причина: ' . $reason,
    'button' => 'Надіслати інший матеріал',
    'url' => SITE . '/materials.html#share',
    'note' => 'Ви можете виправити матеріал і надіслати його ще раз. Якщо маєте питання, напишіть нам через сторінку контактів.',
]));
// the author must learn the decision: keep the entry if the email did not go out, so the admin can retry
if (!$sent) out(502, ['error' => 'MAIL']);
db('DELETE', 'materials/pending/' . $id);

// remove the uploaded file (only our own uploads/YYYY/MM/<random>.<ext>)
if (preg_match('~^' . preg_quote(SITE, '~') . '/uploads/(\d{4}/\d{2}/[a-f0-9]{32}\.[a-z0-9]{2,5})$~', (string)($item['url'] ?? ''), $m)) {
    $file = dirname(__DIR__) . '/uploads/' . $m[1];
    if (is_file($file)) @unlink($file);
}
out(200, ['ok' => true, 'mailed' => true]);
