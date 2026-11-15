<?php
/**
 * Firebase helpers for the World Students API (PHP 8, no Composer).
 *  - fb_verify_id_token(): checks a Firebase ID token (RS256, Google securetoken certs, aud/iss, expiry)
 *  - fb_admin_token():     OAuth2 access token from the service-account key (cached ~55 min)
 *  - fb_oob_link():        Identity Toolkit accounts:sendOobCode with returnOobLink (the link is returned, no Firebase email is sent)
 * The service-account key lives OUTSIDE public_html: /home/ntu.dp.ua/private/firebase-service-account.json
 * (or the path in the NTU_FIREBASE_SA environment variable).
 */
declare(strict_types=1);

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) { http_response_code(404); exit; }

const FB_PROJECT_ID = 'ntubd-93efc';

function fb_b64url_decode(string $s): string
{
    return (string)base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4));
}

function fb_b64url_encode(string $s): string
{
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}

function fb_http(string $method, string $url, ?string $body, array $headers): array
{
    $ctx = stream_context_create(['http' => [
        'method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body ?? '',
        'timeout' => 10, 'ignore_errors' => true,
    ]]);
    $raw = @file_get_contents($url, false, $ctx);
    $code = 0;
    foreach ($http_response_header ?? [] as $h) if (preg_match('~^HTTP/\S+\s+(\d{3})~', $h, $m)) $code = (int)$m[1];
    return [$code, $raw === false ? null : json_decode($raw, true)];
}

function fb_google_certs(): ?array
{
    $cache = sys_get_temp_dir() . '/ntu_fb_certs.json';
    if (is_file($cache) && filemtime($cache) > time() - 3600) {
        $c = json_decode((string)file_get_contents($cache), true);
        if (is_array($c) && $c) return $c;
    }
    [$code, $c] = fb_http('GET', 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', null, []);
    if ($code !== 200 || !is_array($c) || !$c) return null;
    @file_put_contents($cache, json_encode($c));
    return $c;
}

/** Returns the token payload or null. */
function fb_verify_id_token(string $jwt): ?array
{
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) return null;
    [$h64, $p64, $s64] = $parts;
    $head = json_decode(fb_b64url_decode($h64), true);
    $pay = json_decode(fb_b64url_decode($p64), true);
    if (!is_array($head) || !is_array($pay) || ($head['alg'] ?? '') !== 'RS256' || empty($head['kid'])) return null;
    $certs = fb_google_certs();
    $cert = $certs[$head['kid']] ?? null;
    if (!$cert || openssl_verify($h64 . '.' . $p64, fb_b64url_decode($s64), $cert, OPENSSL_ALGO_SHA256) !== 1) return null;
    $now = time();
    if (($pay['aud'] ?? '') !== FB_PROJECT_ID || ($pay['iss'] ?? '') !== 'https://securetoken.google.com/' . FB_PROJECT_ID) return null;
    if (($pay['exp'] ?? 0) < $now || ($pay['iat'] ?? $now + 999) > $now + 300 || empty($pay['sub'])) return null;
    return $pay;
}

function fb_bearer(): string
{
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (!$auth && function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) if (strtolower($k) === 'authorization') $auth = $v;
    }
    return preg_match('/^Bearer\s+([A-Za-z0-9\-_.]+)$/', $auth, $m) ? $m[1] : '';
}

function fb_sa_path(): string
{
    $env = getenv('NTU_FIREBASE_SA');
    if ($env) return $env;
    // public_html/api/lib -> /home/ntu.dp.ua/private/
    return dirname(__DIR__, 3) . '/private/firebase-service-account.json';
}

function fb_sa(): ?array
{
    $p = fb_sa_path();
    if (!is_file($p) || !is_readable($p)) return null;
    $sa = json_decode((string)file_get_contents($p), true);
    if (!is_array($sa) || ($sa['type'] ?? '') !== 'service_account' || empty($sa['private_key']) || empty($sa['client_email'])) return null;
    if (($sa['project_id'] ?? '') !== FB_PROJECT_ID) return null;
    return $sa;
}

function fb_admin_token(string $scope = 'https://www.googleapis.com/auth/identitytoolkit'): ?string
{
    $cache = sys_get_temp_dir() . '/ntu_fb_admin_' . substr(hash('sha256', fb_sa_path() . '|' . $scope), 0, 12) . '.json';
    if (is_file($cache)) {
        $c = json_decode((string)file_get_contents($cache), true);
        if (is_array($c) && ($c['exp'] ?? 0) > time() + 60) return $c['token'];
    }
    $sa = fb_sa();
    if (!$sa) return null;
    $now = time();
    $head = fb_b64url_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $claims = fb_b64url_encode(json_encode([
        'iss' => $sa['client_email'], 'scope' => $scope,
        'aud' => 'https://oauth2.googleapis.com/token', 'iat' => $now, 'exp' => $now + 3600,
    ]));
    $sig = '';
    if (!openssl_sign($head . '.' . $claims, $sig, $sa['private_key'], OPENSSL_ALGO_SHA256)) return null;
    $body = http_build_query(['grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $head . '.' . $claims . '.' . fb_b64url_encode($sig)]);
    [$code, $d] = fb_http('POST', 'https://oauth2.googleapis.com/token', $body, ['Content-Type: application/x-www-form-urlencoded']);
    if ($code !== 200 || empty($d['access_token'])) return null;
    $old = umask(0077);
    @file_put_contents($cache, json_encode(['token' => $d['access_token'], 'exp' => $now + (int)($d['expires_in'] ?? 3600)]));
    umask($old);
    return $d['access_token'];
}

/** sendOobCode with returnOobLink=true. Returns [oobCode|null, errorCode|null]. */
function fb_oob_link(array $body): array
{
    $tk = fb_admin_token();
    if (!$tk) return [null, 'NOT_CONFIGURED'];
    $body['returnOobLink'] = true;
    [$code, $d] = fb_http('POST', 'https://identitytoolkit.googleapis.com/v1/projects/' . FB_PROJECT_ID . '/accounts:sendOobCode',
        json_encode($body), ['Content-Type: application/json', 'Authorization: Bearer ' . $tk]);
    if ($code !== 200 || empty($d['oobLink'])) {
        $msg = (string)($d['error']['message'] ?? 'ERR');
        return [null, preg_split('/[\s:]/', $msg)[0] ?: 'ERR'];
    }
    parse_str((string)parse_url($d['oobLink'], PHP_URL_QUERY), $q);
    return [isset($q['oobCode']) && is_string($q['oobCode']) ? $q['oobCode'] : null, isset($q['oobCode']) ? null : 'ERR'];
}

/** Public profile name (users/{uid}/n is world-readable by the database rules). */
function fb_user_name(string $uid): string
{
    if (!preg_match('/^[A-Za-z0-9]{10,40}$/', $uid)) return '';
    [$code, $d] = fb_http('GET', 'https://' . FB_PROJECT_ID . '-default-rtdb.europe-west1.firebasedatabase.app/users/' . $uid . '/n.json', null, []);
    return $code === 200 && is_string($d) ? mb_substr($d, 0, 40) : '';
}
