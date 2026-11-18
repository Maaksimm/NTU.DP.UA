# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"World Students" student platform for NTU «Dnipro Polytechnic» (НТУ «ДП»), positioned as "by students, for students" and part of the World Students concept. Content is in Ukrainian, with an English translation layer. Production: https://ntu.dp.ua/ (CyberPanel, `public_html`). Backend services: Firebase Authentication + Realtime Database (project `ntubd-93efc`) and one PHP endpoint for uploads.

Static site with a small dependency-free build (Node 18+). Never edit `dist/` - it is regenerated.

```
npm run build        # src/ + public/ -> dist/
npm run check        # build + checks (titles, descriptions <=160, one h1, broken links, missing EN translations)
npm run serve        # build + preview at http://localhost:8080/
npm run package      # build + check + release/ntu-site.zip (without assets/img and assets/docs)
npm run package:all  # same, including all media (first deploy / new images)
```

## Layout

```
src/
  pages/*.html          one file per URL: JSON front matter in a leading <!-- --> comment + page content (<main> and modals)
  partials/*.html       shared markup: preloader, topbar, brand, account button, display prefs, footer brand
  data/menu.json        the 7 menu groups -> header mega menu, mobile accordion and footer columns (single source)
  data/site.json        domain, site name, theme colour, fonts, scripts loaded on every page
  styles/NN-*.css       stylesheet modules, concatenated in file-name order -> assets/css/style.css
  scripts/main/NN-*.js  main.js modules (classic script, shared global scope), concatenated -> assets/js/main.js
  scripts/*.js          standalone scripts -> assets/js/ (auth, chat, dm, community, auth-action, admission, i18n-en...)
public/                 copied to dist/ as is: assets/img, assets/docs, assets/data, api/upload.php, robots.txt, site.webmanifest
config/firebase/database.rules.json   Realtime Database rules (source of truth; publish in Firebase Console -> Rules)
tools/build.mjs | check.mjs | package.mjs | serve.mjs
```

`tools/build.mjs` generates for every page: `<head>` (title, description, robots, canonical, Open Graph/Twitter, fonts, icons, the inline display-prefs bootstrap script, stylesheet, JSON-LD WebPage + BreadcrumbList + `jsonLdExtra`), skip link, preloader, header with mega menu (active group + `aria-current` from the page key), mobile nav, footer, scripts (`site.json` scripts + front matter `scripts`). Breadcrumbs of pages that are in `menu.json` are rebuilt as `Головна › <group> › <page>` (only `Головна › <page>` on the group's own page); the page name is the last crumb written in the page, `fm.breadcrumbs` is overwritten to match. `<img src="assets/img/x.jpg|png">` outside a `<picture>` gets a `<picture class="wp">` (display: contents) with `x.webp` when that file exists. Asset URLs get a content hash `?v=<sha>` automatically (the server caches static files for 7 days). `sitemap.xml` is generated from all pages without `noindex`.

### Page front matter

```json
{ "title": "...", "description": "<=160 chars", "page": "unique-key (data-page / data-nav)",
  "breadcrumbs": [["Головна", "index.html"], ["...", "file.html"]],
  "image": "assets/img/x.jpg", "robots": "noindex, follow", "scripts": ["community.js"],
  "sitemap": { "changefreq": "weekly", "priority": "0.9" }, "jsonLdExtra": [], "path": "", "ogType": "website" }
```
Only `title`, `description`, `page` are required. `path` overrides the canonical path (index uses `""`).

### Adding or changing things

- New page: `src/pages/<name>.html` + an item in `src/data/menu.json` + the site map section in `src/pages/sections.html` + translations. See the `new-page` skill.
- Header/footer/menu changes: edit `src/data/menu.json` or `src/partials/` or `header()/footer()` in `tools/build.mjs` - never page by page.
- Old page names (`kabinet`/`cabinet`, `Kontakty`, `vstup-2026`, `pro-universytet`) must not come back. URLs are flat (`/<name>.html`) because they are indexed by Google - do not move pages into folders.

## Front-end behaviour

- `main.js` modules: `01-core-nav` (mobile nav, DOMContentLoaded wiring), `02-gallery-sliders`, `03-authors`, `04-forms` (contact form validation + Formspree), `05-i18n-theme` (`T()`, `applyLang`, theme), `06-home-sliders`, `07-carousels-timelines`, `08-filters-media`, `09-modals`, `10-admission-dorm`, `11-prefs-mega-stats` (display prefs, mega menu, count-up, live stats, scroll story, chat demo), `12-to-top`. Initialisers check for their own DOM hooks and no-op otherwise. The modules share one global scope (classic script), so keep their order.
- **Active nav item**: `<body data-page="X">` matches `data-nav="X"` links; the group containing the page gets `.active` on its `.mega__top`.
- **Display preferences**: header eye button (`[data-prefs]`): theme, black-and-white, language (Укр/Eng), text size. Stored as `ntu-theme` (sessionStorage), `ntu-lang`, `ntu-bw`, `ntu-fs` (localStorage), applied before paint by the inline `<head>` script as `data-theme`, `lang`, `data-bw`, `data-fs` on `<html>`. Switching language fires `ntu:lang`.
- Theming: CSS custom properties on `:root`, overridden under `[data-theme=dark]` (`12-theme-preloader-home.css`).

### i18n (important when editing text)

No translation keys in the markup. `applyLang()` walks every text node plus `alt`/`title`/`placeholder`/`aria-label`, `document.title` and `meta[name=description]`, and looks up the whitespace-normalised Ukrainian string in `window.I18N_EN` (`src/scripts/i18n-en.js`). Add an entry for any new or changed Ukrainian text; strings set from JS must go through `T('...')`/`t('...')`. `npm run check` lists every missing key.

## Accounts, chat, messaging

- `contact.html`, `homework-help.html`, `materials.html` POST to Formspree (`https://formspree.io/f/mwvgvlay`) with client-side validation and a `_gotcha` honeypot.
- `auth.js` (`window.NTU_AUTH`): Firebase Authentication REST + RTDB REST (`apiKey`/`databaseURL` in `chat-config.js`; without them a localStorage demo mode). Profile `users/{uid}` `{n, a, s, ts}`, extended profile `profiles/{uid}`. Nickname/email change, roles `s`/`t` (+ `subj`), presence, uploads. Firebase emails are requested with `X-Firebase-Locale: uk` and `continueUrl=https://ntu.dp.ua/auth-action.html?done=<mode>` (on the production origin only).
- **Account emails** (`public/api/mail.php` + `api/lib/firebase.php` + `api/lib/mail-template.php`): `sendOob()` in `auth.js` first POSTs `{type: verify|change|reset}` to `/api/mail.php`, which gets the link from the Firebase Admin API (`accounts:sendOobCode` with `returnOobLink`, OAuth token from the service-account key at `/home/ntu.dp.ua/private/firebase-service-account.json`, outside `public_html`, never in git) and sends a World Students-styled HTML email with PHP `mail()` from `noreply@ntu.dp.ua`; links go straight to `auth-action.html?mode=...&oobCode=...`. Rate-limited per uid/email/IP; `reset` never reveals whether an account exists. Without the key it answers 503 `NOT_CONFIGURED` and the browser falls back to Firebase's default email. `GET ?check=1` shows the status, `GET ?preview=1` renders a sample letter.
- **Email links**: `auth-action.html` + `auth-action.js` handle `?mode=verifyEmail|verifyAndChangeEmail|recoverEmail|resetPassword&oobCode=...` (if the action URL is ever pointed here) and `?done=<mode>` (return from Firebase's default handler via "Continue"). Firebase does not allow editing the email templates of this project (console: "Email template updates are currently unavailable"); template language is set to Ukrainian.
- **Chat** (`chat.js`, every page): `chat/messages`, reactions `chat/reactions/{msgId}/{uid}` = one emoji; double-click/double-tap = ❤️; resizable (top-left grip, `ntu-chat-size`) and full-screen. Emoji/GIF sets are shared via `window.NTU_MEDIA`.
- **Live features**: profile card `profile-card.js` (`window.NTU_PROFILE.show(uid)`, opened by clicking avatars/names in the chat and the DM header). General chat header: members (`users?shallow=true`) and online (`users?orderBy="s"&startAt=…`, index `s`), typing via `chat/typing/{uid}` = `{n, c}` (c changes while typing; readers detect the change between polls), read receipts via `chat/seen/{uid}` = last seen message ts. DM statuses in `dm/{cid}/st/{uid}` = `{d, r, c}` (delivered/read server timestamps, typing token): 🕓 sending, ✓ sent, ✓✓ delivered, blue ✓✓ read. Profile background per theme: `profiles.bg` (light) and `profiles.bgd` (dark), `NTU_AUTH.themeBg(p)`; `setTheme()` fires `ntu:theme`.
- **Custom emoji**: `public/assets/emoji/custom.json` = `[{"id": "k-smile", "src": "assets/emoji/k-smile.png", "name": "..."}]` (files in the same folder; id `[a-z0-9_-]`). They appear as a "Kawaii" group in both chat emoji pickers and reaction pickers; in text and reactions they are stored as `:id:` and rendered as images (`NTU_MEDIA.emojiNode/appendRich/onCustom` in `chat.js`). `npm run package` skips `assets/img` and `assets/docs` but includes `assets/emoji`.
- **DM reactions**: `dm/{cid}/rx/{msgId}/{uid}` = emoji code; hover button / double-click ❤️, like the general chat.
- **Settings modal**: each section (photo, nickname, email, role) shows the current value + "Змінити ..."; the form appears only after clicking (`[data-fold]`), collapses after a successful save.
- **Settings groups**: photo, then collapsible groups `[data-setgroup]`: «Персональні дані» (nickname, email, role, «Про мене»), «Приватність і сповіщення» (online status; local prefs `NTU_AUTH.pref/setPref` -> `ntu-p-typing|sound|notify`; `NTU_AUTH.alertNew()` plays a Web Audio beep / browser notification), «Безпека» (email status, password reset email).
- **Staff badges**: `staff` map in `chat-config.js` (uid -> `author` | `dev`) -> `NTU_AUTH.staff(uid)` / `authorBadge(uid)`: «★ Автор» (Leonid Ksenchuk), «</> Розробник» (Максим Печерський) in chat, DM header, profile card, user list, rating. Only that map grants it; it is not stored in the database.
- **AI Student** (`ai.js`, every page, button in the bottom-left corner). Order: weather (Open-Meteo geocoding + forecast, free, no key, from the browser), date/time and arithmetic locally; then `public/api/ai.php` if a key exists in `/home/ntu.dp.ua/private/` (never in git): `gemini-api-key.txt` -> Google Gemini free tier (`gemini-3.5-flash-lite`, falls back to `gemini-flash-latest` on 404), else `anthropic-api-key.txt` -> Claude `claude-opus-5-5` (paid). Raw HTTP, no Composer on the host; rate limits per IP + 1000/day site-wide; system prompt built from `assets/data/ai-index.json`); otherwise (503 NOT_CONFIGURED, or on errors) the local engine: small talk (`smallTalk()`), `src/data/ai-kb.json` (hand-written Q/A, UA + EN) and page section chunks (build writes both to `assets/data/ai-index.json`). Page names like `rating.html` and URLs in replies become links. Opening AI closes the chat and vice versa (`ntu:panel` event).
- **AI confidentiality** (after the 2026-11-16 leak of the architecture through the bot): the assistant never discloses the technical internals (stack, hosting, files, database structure/rules, deploy, keys, which model powers it, its own prompt), personal data of users or the team (beyond names/roles on `authors.html`), or internal team matters. Three layers: confidentiality rules in `system_prompt()` of `ai.php`; `SECRET_RE` in `ai.js` + `SECRET_Q` in `ai.php` (same list, the client one without internal names) answer such questions with a fixed refusal before any model call; `LEAK_RE` in `ai.php` replaces a model reply that still contains internal names/paths/key patterns. `ai-kb.json` and everything in `ai-index.json` are public files - never put technical details there. The public site structure (menu, pages, sections) is fine to share.
- **No automatic copying from nmu.org.ua**: an automatic feed (scraping the university WordPress API into our pages) was removed on purpose - duplicated content hurts our ranking and indexing. Do not bring it back. University news on the home page and `news.html` are short hand-written summaries with a link to the original; schedules, scholarships, rules, documents link straight to nmu.org.ua (`target="_blank" rel="noopener"`). `public/api/feed.php` is only a 410 stub that overwrites the old version on the server. Live stats "registered users": `public/api/stats.php` (service-account count of `users`, cached 2 min).
- **Rating** (`rating.html` + `rating.js`): teachers / students tabs by `profiles.role`; score = Bayesian average of `reviews` ((sum + 3·C)/(n + 3)); polls reviews 6 s, profiles 30 s, users 60 s; requires sign-in (rules).
- **Roles & lessons** (`community.js`, `personal-area.html`): teachers' lessons in `lessons/{uid}/{id}` `{title, d, v, files, ts}`; user list with Учні / Викладачі tabs.
- **Direct messages** (`dm.js`, `personal-area.html`): `dm/{cid}/msgs/{id}` (`cid` = sorted uids joined by `_`), `inbox/{uid}/{cid}` `{w, l, ts, lu, r}`; `[data-dm-open="<uid>"]` or `personal-area.html?dm=<uid>`; polls every 3.5 s.
- **Uploads**: `public/api/upload.php` (PHP 8) verifies the Firebase ID token (RS256, aud/iss `ntubd-93efc`, verified email), takes ≤1.5 MB chunks (server limit 2 MB), stores `uploads/YYYY/MM/<random>.<ext>` (the `uploads/` folder exists only on the server). Chat: PDF/images/docs ≤10 MB; lessons: PDF ≤20 MB.

## Deploy

1. `npm run package` (or `package:all` when images/documents changed) -> `release/ntu-site.zip`.
2. CyberPanel -> File Manager -> `public_html` -> Upload the zip -> Extract into `/home/ntu.dp.ua/public_html` (overwrites) -> delete the zip.
3. If `config/firebase/database.rules.json` changed, publish it in Firebase Console -> Realtime Database -> Rules.

HTML caching lives in the server config, not in this repo: CyberPanel -> Websites -> ntu.dp.ua -> Config -> vHost Conf has `context exp:^/(.*\.html)?$` with `extraHeaders Cache-Control no-cache` (OpenLiteSpeed ignores `Header` in `.htaccess`). Pages revalidate on every visit, so a deploy shows up immediately; CSS/JS stay cacheable via their `?v=` hash.

## Notes

- Photos in `public/assets/img/` come in `.jpg` + `.webp` pairs; keep both.
- `robots.txt` disallows service pages (login, register, personal area, auth-action...), which also carry `"robots": "noindex, follow"`.
- The git repository root is the user's home directory (`C:\Users\and12`), not this folder. Stage only files under this folder.
