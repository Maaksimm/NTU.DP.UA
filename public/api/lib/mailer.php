<?php
/**
 * Shared helpers for the mail endpoints (mail.php, broadcast.php):
 * JSON replies, file-based rate limit, MIME email with the inline logo, sent with PHP mail() from noreply@ntu.dp.ua.
 */
declare(strict_types=1);

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) { http_response_code(404); exit; }

const SITE = 'https://ntu.dp.ua';
const MAIL_FROM = 'noreply@ntu.dp.ua';
const MAIL_FROM_NAME = 'World Students · НТУ «ДП»';

/** JSON API headers + CORS for the production origin only. */
function api_headers(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === SITE || $origin === 'https://www.ntu.dp.ua') {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    }
}

function out(int $code, array $data): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Sliding-window limit: at most $max events per $window seconds for $key. */
function limited(string $key, int $max, int $window): bool
{
    $dir = sys_get_temp_dir() . '/ntu_mail_rl';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $f = $dir . '/' . hash('sha256', $key);
    $now = time();
    $list = is_file($f) ? array_filter((array)json_decode((string)file_get_contents($f), true), fn($t) => is_int($t) && $t > $now - $window) : [];
    if (count($list) >= $max) return true;
    $list[] = $now;
    @file_put_contents($f, json_encode(array_values($list)), LOCK_EX);
    return false;
}

function enc_header(string $s): string
{
    return '=?UTF-8?B?' . base64_encode($s) . '?=';
}

function valid_email(string $e): bool
{
    return strlen($e) <= 254 && filter_var($e, FILTER_VALIDATE_EMAIL) !== false;
}

/**
 * $parts = [html, text] from mail_render(). $extraHeaders - e.g. List-Unsubscribe for newsletters.
 */
function send_mail(string $to, string $subject, array $parts, array $extraHeaders = []): bool
{
    [$html, $text] = $parts;
    $alt = 'a' . bin2hex(random_bytes(12));
    $rel = 'r' . bin2hex(random_bytes(12));
    $logoFile = dirname(__DIR__, 2) . '/assets/img/logo.png';
    $headers = array_merge([
        'From: ' . enc_header(MAIL_FROM_NAME) . ' <' . MAIL_FROM . '>',
        'Reply-To: ' . MAIL_FROM,
        'Message-ID: <' . bin2hex(random_bytes(16)) . '@ntu.dp.ua>',
        'Date: ' . date(DATE_RFC2822),
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $alt . '"',
        'Content-Language: uk',
        'X-Auto-Response-Suppress: All',
        'Auto-Submitted: auto-generated',
    ], $extraHeaders);
    // multipart/alternative: plain text + (HTML with the inline logo as multipart/related)
    $nl = "\r\n";
    $body = "--$alt{$nl}Content-Type: text/plain; charset=UTF-8{$nl}Content-Transfer-Encoding: base64{$nl}{$nl}" . chunk_split(base64_encode($text))
        . "--$alt{$nl}Content-Type: multipart/related; boundary=\"$rel\"; type=\"text/html\"{$nl}{$nl}"
        . "--$rel{$nl}Content-Type: text/html; charset=UTF-8{$nl}Content-Transfer-Encoding: base64{$nl}{$nl}" . chunk_split(base64_encode($html));
    if (is_file($logoFile)) {
        $body .= "--$rel{$nl}Content-Type: image/png; name=\"logo.png\"{$nl}Content-Transfer-Encoding: base64{$nl}Content-ID: <logo@ntu.dp.ua>{$nl}"
            . "Content-Disposition: inline; filename=\"logo.png\"{$nl}{$nl}" . chunk_split(base64_encode((string)file_get_contents($logoFile)));
    }
    $body .= "--$rel--{$nl}--$alt--{$nl}";
    return mail($to, enc_header($subject), $body, implode($nl, $headers), '-f' . MAIL_FROM);
}
