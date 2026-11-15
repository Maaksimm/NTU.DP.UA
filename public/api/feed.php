<?php
/**
 * Вимкнено: автоматичне завантаження матеріалів із сайту університету більше не використовується
 * (копії чужого контенту шкодять індексації). Файл лишається заглушкою, щоб перезаписати стару версію на сервері.
 */
http_response_code(410);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
echo '{"error":"GONE"}';
