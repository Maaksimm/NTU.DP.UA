<?php
/**
 * Публічна статистика платформи для «Живої статистики» на головній.
 * GET -> {users: <кількість зареєстрованих користувачів>}
 * Список users/ читають лише авторизовані (правила бази), тому рахуємо на сервері сервісним ключем
 * (/home/ntu.dp.ua/private/firebase-service-account.json) і віддаємо лише число. Кеш 2 хв.
 * Без ключа - 503 NOT_CONFIGURED (браузер тоді рахує сам, якщо користувач увійшов).
 */
declare(strict_types=1);
require __DIR__ . '/lib/firebase.php';

const DB_URL = 'https://ntubd-93efc-default-rtdb.europe-west1.firebasedatabase.app';

function reply(int $code, array $data): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header($code === 200 ? 'Cache-Control: public, max-age=60' : 'Cache-Control: no-store');
    echo json_encode($data);
    exit;
}

$cache = sys_get_temp_dir() . '/ntu_stats.json';
$c = is_file($cache) ? json_decode((string)@file_get_contents($cache), true) : null;
if (is_array($c) && filemtime($cache) > time() - 120) reply(200, $c);

$tk = fb_admin_token('https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email');
if (!$tk) {
    if (is_array($c)) reply(200, $c);
    reply(503, ['error' => 'NOT_CONFIGURED']);
}
[$code, $d] = fb_http('GET', DB_URL . '/users.json?shallow=true', null, ['Authorization: Bearer ' . $tk]);
if ($code !== 200) {
    if (is_array($c)) reply(200, $c);
    reply(502, ['error' => 'UPSTREAM']);
}
$res = ['users' => is_array($d) ? count($d) : 0];
@file_put_contents($cache, json_encode($res));
reply(200, $res);
