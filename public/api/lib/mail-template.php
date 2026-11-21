<?php
/**
 * HTML email in the World Students style (table layout + inline styles, so it renders in Gmail, Outlook, Apple Mail).
 * mail_render(['title','intro','button','url','note','preheader','greeting', 'items'?, 'unsubscribe'?]) -> [html, text]
 *   items       - optional list of [emoji, title, text], shown as a feature list before the button (newsletters)
 *   unsubscribe - optional URL; adds an unsubscribe line to the footer (newsletters)
 */
declare(strict_types=1);

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) { http_response_code(404); exit; }

function mail_e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

function mail_render(array $m): array
{
    $site = 'https://ntu.dp.ua';
    $title = mail_e($m['title']);
    $intro = mail_e($m['intro']);
    $btn = mail_e($m['button']);
    $url = mail_e($m['url']);
    $note = mail_e($m['note']);
    $pre = mail_e($m['preheader'] ?? $m['intro']);
    $hello = mail_e($m['greeting'] ?? 'Вітаємо!');
    $year = date('Y');
    // remote image, not a cid: attachment - the Gmail mobile app often drops cid: images.
    // The file has an opaque white background (3x size) so it stays visible when Gmail recolours letters in dark mode.
    $logo = mail_e($m['logo'] ?? $site . '/assets/email/logo.png');
    $font = "font-family:Manrope,Onest,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    $items = mail_items($m['items'] ?? [], $font);
    $unsubUrl = isset($m['unsubscribe']) ? mail_e($m['unsubscribe']) : '';
    $footNote = $unsubUrl !== ''
        ? 'Ви отримали цей лист, бо зареєстровані на платформі. Не хочете отримувати новини? <a href="' . $unsubUrl . '" style="color:#1a6fc4">Відписатися</a>.'
        : 'Лист надіслано автоматично, відповідати на нього не потрібно.';

    $html = <<<HTML
<!DOCTYPE html>
<html lang="uk"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">
<title>{$title}</title></head>
<body style="margin:0;padding:0;background:#eef4fb;{$font}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{$pre}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4fb;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(11,37,69,.12)">
<tr><td style="background:#155aa0;background-image:linear-gradient(135deg,#155aa0,#1a6fc4);padding:28px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td><span style="display:inline-block;background:#ffffff;border-radius:12px;padding:8px 12px"><img src="{$logo}" width="120" height="50" alt="НТУ «Дніпровська політехніка»" style="display:block;width:120px;height:50px;border:0"></span></td>
<td align="right" style="color:#cfe3fb;font-size:12px;letter-spacing:.08em;text-transform:uppercase;{$font}">World Students</td>
</tr></table>
</td></tr>
<tr><td style="padding:36px 36px 8px;{$font}">
<p style="margin:0 0 6px;color:#1a6fc4;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">{$hello}</p>
<h1 style="margin:0 0 14px;color:#0b2545;font-size:26px;line-height:1.25;font-weight:800">{$title}</h1>
<p style="margin:0 0 26px;color:#4a5b70;font-size:16px;line-height:1.6">{$intro}</p>
{$items}
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:14px;background:#1a6fc4">
<a href="{$url}" style="display:inline-block;padding:15px 30px;color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;border-radius:14px;{$font}">{$btn}</a>
</td></tr></table>
<p style="margin:26px 0 6px;color:#7a8a9e;font-size:13px;line-height:1.5">Якщо кнопка не працює, скопіюйте посилання в браузер:</p>
<p style="margin:0 0 26px;font-size:13px;line-height:1.5;word-break:break-all"><a href="{$url}" style="color:#1a6fc4">{$url}</a></p>
</td></tr>
<tr><td style="padding:0 36px 30px;{$font}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f8fe;border-radius:16px"><tr><td style="padding:16px 18px;color:#4a5b70;font-size:13.5px;line-height:1.55">{$note}</td></tr></table>
</td></tr>
<tr><td style="padding:22px 36px;border-top:1px solid #e3ecf6;color:#8a99ab;font-size:12px;line-height:1.6;{$font}">
World Students · студентська платформа НТУ «Дніпровська політехніка», створена студентами для студентів.<br>
пр. Дмитра Яворницького, 19, Дніпро, 49005 · <a href="{$site}/" style="color:#1a6fc4;text-decoration:none">ntu.dp.ua</a><br>
© {$year} World Students. {$footNote}
</td></tr>
</table>
</td></tr></table>
</body></html>
HTML;

    $text = $m['greeting'] ?? 'Вітаємо!';
    $text .= "\n\n" . $m['title'] . "\n\n" . $m['intro'];
    foreach ($m['items'] ?? [] as [$icon, $head, $body]) $text .= "\n\n" . $icon . ' ' . $head . "\n" . $body;
    $text .= "\n\n" . $m['button'] . ': ' . $m['url'] . "\n\n" . $m['note']
        . "\n\n--\nWorld Students · НТУ «Дніпровська політехніка»\n" . $site . "/\n";
    if (isset($m['unsubscribe'])) $text .= 'Відписатися від новин: ' . $m['unsubscribe'] . "\n";
    return [$html, $text];
}

/** Feature list for newsletters: [[emoji, title, text], ...] -> table HTML ('' for an empty list). */
function mail_items(array $items, string $font): string
{
    if (!$items) return '';
    $rows = '';
    foreach ($items as [$icon, $head, $body]) {
        $rows .= '<tr><td width="58" valign="top" style="padding:0 14px 16px 0"><div style="width:44px;height:44px;line-height:44px;text-align:center;font-size:22px;background:#eef4fb;border-radius:14px">' . mail_e($icon) . '</div></td>'
            . '<td valign="top" style="padding:0 0 16px;' . $font . '"><p style="margin:2px 0 4px;color:#0b2545;font-size:16px;font-weight:800">' . mail_e($head) . '</p>'
            . '<p style="margin:0;color:#4a5b70;font-size:14.5px;line-height:1.55">' . mail_e($body) . '</p></td></tr>';
    }
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px">' . $rows . '</table>';
}
