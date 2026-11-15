# World Students · НТУ «Дніпровська політехніка»

Студентська платформа Національного технічного університету «Дніпровська політехніка»: від студентів для студентів. Сайт: **https://ntu.dp.ua/**

## Швидкий старт

Потрібен лише Node.js 18+ (сторонніх пакетів немає).

```bash
npm run serve        # зібрати сайт і відкрити http://localhost:8080/
npm run check        # зібрати й перевірити: заголовки, описи, биті посилання, переклади
npm run package      # архів release/ntu-site.zip для CyberPanel (без картинок)
npm run package:all  # те саме, разом із картинками й документами
```

## Структура

| Тека | Що там |
|---|---|
| `src/pages/` | сторінки: дані сторінки (JSON у коментарі на початку) + вміст `<main>` |
| `src/partials/` | спільні шматки розмітки (прелоадер, логотип, кнопка акаунта, налаштування вигляду) |
| `src/data/menu.json` | меню: шапка, мобільне меню й футер будуються з одного файлу |
| `src/data/site.json` | домен, назва сайту, шрифти, скрипти на всіх сторінках |
| `src/styles/` | стилі, поділені на модулі (збираються в `assets/css/style.css`) |
| `src/scripts/` | JavaScript: `main/` - модулі `main.js`, решта - окремі скрипти (чат, акаунти, листування…) |
| `public/` | статичні файли без змін: картинки, документи, `api/upload.php`, `robots.txt` |
| `config/firebase/` | правила Realtime Database |
| `tools/` | збирання, перевірка, пакування, локальний сервер |
| `dist/` | готовий сайт (генерується, у git не зберігається) |

Шапка, футер, `<head>` (SEO, Open Graph, JSON-LD), `sitemap.xml` і версії CSS/JS генеруються автоматично, тож їх не треба копіювати по сторінках.

## Деплой

1. `npm run package` → `release/ntu-site.zip`.
2. CyberPanel → File Manager → `public_html` → Upload → Extract → видалити архів.
3. Якщо змінилися `config/firebase/database.rules.json` - опублікувати їх у Firebase Console → Realtime Database → Rules.

Старі назви сторінок (`kabinet`/`cabinet`, `Kontakty`, `vstup-2026`, `pro-universytet`) не повертаємо.
