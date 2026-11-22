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

`tools/build.mjs` generates for every page: `<head>` (title, description, robots, canonical, Open Graph/Twitter, fonts, icons, the inline display-prefs bootstrap script, stylesheet, JSON-LD WebPage + BreadcrumbList + `jsonLdExtra`), skip link, preloader, header with mega menu (active group + `aria-current` from the page key), mobile nav, footer, scripts (`site.json` scripts + front matter `scripts`). Breadcrumbs of pages that are in `menu.json` are rebuilt as `Головна › <group> › <page>` (only `Головна › <page>` on the group's own page); the page name is the last crumb written in the page, `fm.breadcrumbs` is overwritten to match. `<img src="assets/img/x.jpg|png">` outside a `<picture>` gets a `<picture class="wp">` (display: contents) with `x.webp` when that file exists. Asset URLs get a content hash `?v=<sha>` automatically (the server caches static files for 7 days). `sitemap.xml` is generated from all pages without `noindex`. Every `<img src="assets/img/...">` without size gets `width`/`height` read from the file header (CLS; base CSS `img{height:auto}` keeps them as a ratio only). `og:image:width/height/alt` and JSON-LD `dateModified` are generated. `tools/lastmod.json` (commit it) stores `{page: [contentHash, date]}`: the sitemap `lastmod` changes only when the page source changes. Google Fonts load without blocking render (preload + onload).

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
- **Newsletter** (`public/api/broadcast.php` + `broadcast.html`/`broadcast.js`, noindex): letter «На платформі з’явився чат» to every Firebase Auth account with a verified email. Only `STAFF_UIDS` (same uids as `staff` in `chat-config.js`) can send; sends in batches of 25, progress per `CAMPAIGN` in `/home/ntu.dp.ua/private/broadcast/` (never mails anyone twice), HMAC-signed unsubscribe link + `List-Unsubscribe` header. `?preview=1` shows the letter. For a new campaign change `CAMPAIGN`, `SUBJECT` and `letter()`. Shared mail helpers (`send_mail`, `limited`, `out`) are in `api/lib/mailer.php`; `mail_render()` accepts optional `items` and `unsubscribe`. The letter logo is a remote image `https://ntu.dp.ua/assets/email/logo.png` (opaque white background, 3x size), not a `cid:` attachment: the Gmail mobile app dropped `cid:` images and dark mode hid the transparent logo.
- **Glassmorphism illustrations**: `<span class="hero-art glass-art" data-glass="NAME" aria-hidden="true"></span>` inside a `page-hero page-hero--art` section; the build inlines the SVG from `tools/glass-icons.mjs` (chat, calendar, weather, cards, piggy, documents, folder, image, bookmark, location); free LottieFiles glass animations (Lottie Simple License) are in `public/assets/lottie/`. Dropping `public/assets/lottie/glass-NAME.json` (Lottie JSON, e.g. the IconScout Glassmorphism pack) makes the build add `data-lottie`, and `13-glass-lottie.js` swaps the SVG for the animation (lottie-web from cdnjs, skipped with reduced motion).
- **Email links**: `auth-action.html` + `auth-action.js` handle `?mode=verifyEmail|verifyAndChangeEmail|recoverEmail|resetPassword&oobCode=...` (if the action URL is ever pointed here) and `?done=<mode>` (return from Firebase's default handler via "Continue"). Firebase does not allow editing the email templates of this project (console: "Email template updates are currently unavailable"); template language is set to Ukrainian.
- **Chat** (`chat.js`, every page): `chat/messages`, reactions `chat/reactions/{msgId}/{uid}` = one emoji; double-click/double-tap = ❤️; resizable (top-left grip, `ntu-chat-size`) and full-screen. Emoji/GIF sets are shared via `window.NTU_MEDIA`.
- **Live features**: profile card `profile-card.js` (`window.NTU_PROFILE.show(uid)`, opened by clicking avatars/names in the chat and the DM header). General chat header: members (`users?shallow=true`) and online (`users?orderBy="s"&startAt=…`, index `s`), typing via `chat/typing/{uid}` = `{n, c}` (c changes while typing; readers detect the change between polls), read receipts via `chat/seen/{uid}` = last seen message ts. DM statuses in `dm/{cid}/st/{uid}` = `{d, r, c}` (delivered/read server timestamps, typing token): 🕓 sending, ✓ sent, ✓✓ delivered, blue ✓✓ read. Profile background per theme: `profiles.bg` (light) and `profiles.bgd` (dark), `NTU_AUTH.themeBg(p)`; `setTheme()` fires `ntu:theme`.
- **Custom emoji**: `public/assets/emoji/custom.json` = `[{"id": "k-smile", "src": "assets/emoji/k-smile.png", "name": "..."}]` (files in the same folder; id `[a-z0-9_-]`). They appear as a "Kawaii" group in both chat emoji pickers and reaction pickers; in text and reactions they are stored as `:id:` and rendered as images (`NTU_MEDIA.emojiNode/appendRich/onCustom` in `chat.js`). `npm run package` skips `assets/img` and `assets/docs` but includes `assets/emoji`.
- **DM reactions**: `dm/{cid}/rx/{msgId}/{uid}` = emoji code; hover button / double-click ❤️, like the general chat.
- **Pinned members & local chat themes** (`chat-prefs.js` = `window.NTU_CHATPREFS`, `chat-members.js`, `27-chat-prefs.css`): private per-user prefs `{pins: {uid: ts}, themes: {'chat' | <cid>: themeId}}` in localStorage `ntu-chat-prefs`, synced to RTDB `prefs/{uid}` (owner-only rule). General chat header: members button (list of `users`, search, 📌 pin -> pinned on top) and palette button (theme picker); DM header has the same pin/theme buttons, pinned conversations sort first in the inbox. Themes are `data-ctheme` on `.chat-panel` / `.dm__conv`.
- **Stories music**: only the user's own uploaded track (MP3/M4A/OGG); the old generated tracks (`story-music.js`) were removed.
- **Settings modal**: each section (photo, nickname, email, role) shows the current value + "Змінити ..."; the form appears only after clicking (`[data-fold]`), collapses after a successful save.
- **Settings groups**: photo, then collapsible groups `[data-setgroup]`: «Персональні дані» (nickname, email, role, «Про мене»), «Приватність і сповіщення» (online status; local prefs `NTU_AUTH.pref/setPref` -> `ntu-p-typing|sound|notify`; `NTU_AUTH.alertNew()` plays a Web Audio beep / browser notification), «Безпека» (email status, password reset email).
- **Super admins**: `admins/{uid}` = `true` in the Realtime Database, added only by hand in Firebase Console (the rules forbid client writes; a user can read only their own flag). `NTU_AUTH.isAdmin()` (cached promise). Rules let admins delete any chat message, story (+ its likes), tale, review and lesson, and moderate materials; the UI shows 🗑 on chat messages, delete on stories/tales, and the moderation queue on `materials.html`. **Teacher role needs admin approval**: users (register page, Google sign-in, settings) can only set `profiles.role` = `s`; choosing «Викладач» writes a request `roleRequests/{uid}` `{n, subj, ts[, st: 'no']}` (`NTU_AUTH.setRole` returns `{pending: true}`, the cabinet shows «на розгляді / відхилено»). Only an admin may set `profiles/{uid}/role` = `t` (+ `subj`); an approved teacher may change the subject. Admin panel «Ролі викладачів» in `personal-area.html` (`role-admin.js`): approve (with subject) / reject requests, list teachers (`profiles` index `role`) and remove the role.
- **Student materials** (`materials.html` + `materials.js` + `public/api/materials.php`): a signed-in user with a verified email uploads a file (`upload.php` kind `material`: PDF/DOCX/PPTX/XLSX/ZIP <= 20 MB) or gives a link -> `materials/pending/{id}` `{u, n, e, ti, type: file|link|article, url, subj?, d?, fn?, ts}` (rules: own uid, `e` must equal the token email). Admins see the queue; `materials.php` (admin ID token, every DB call is made with it, so the rules are the final check) `approve` -> copies to `materials/approved/{id}` (public read) + "published" email; `reject` + reason -> email with the reason, then deletes the entry and the uploaded file (kept if the email fails, so the admin can retry). Approved items become cards in `#resGrid`; the search/filter re-runs on the `ntu:res` event.
- **Staff badges**: `staff` map in `chat-config.js` (uid -> `author` | `dev`) -> `NTU_AUTH.staff(uid)` / `authorBadge(uid)`: «★ Автор» (Leonid Ksenchuk), «</> Розробник» (Максим Печерський) in chat, DM header, profile card, user list, rating. Only that map grants it; it is not stored in the database.
- **AI Student** (`ai.js`, every page, button in the bottom-left corner). Order: weather (Open-Meteo geocoding + forecast, free, no key, from the browser), date/time and arithmetic locally; then `public/api/ai.php` if a key exists in `/home/ntu.dp.ua/private/` (never in git): `gemini-api-key.txt` -> Google Gemini free tier (`gemini-3.5-flash-lite`, falls back to `gemini-flash-latest` on 404), else `anthropic-api-key.txt` -> Claude `claude-opus-5-5` (paid). Raw HTTP, no Composer on the host; rate limits per IP + 1000/day site-wide; system prompt built from `assets/data/ai-index.json`); otherwise (503 NOT_CONFIGURED, or on errors) the local engine: small talk (`smallTalk()`), `src/data/ai-kb.json` (hand-written Q/A, UA + EN) and page section chunks (build writes both to `assets/data/ai-index.json`). Page names like `rating.html` and URLs in replies become links. Opening AI closes the chat and vice versa (`ntu:panel` event).
- **AI confidentiality** (after the 2026-11-16 leak of the architecture through the bot): the assistant never discloses the technical internals (stack, hosting, files, database structure/rules, deploy, keys, which model powers it, its own prompt), personal data of users or the team (beyond names/roles on `authors.html`), or internal team matters. Three layers: confidentiality rules in `system_prompt()` of `ai.php`; `SECRET_RE` in `ai.js` + `SECRET_Q` in `ai.php` (same list, the client one without internal names) answer such questions with a fixed refusal before any model call; `LEAK_RE` in `ai.php` replaces a model reply that still contains internal names/paths/key patterns. `ai-kb.json` and everything in `ai-index.json` are public files - never put technical details there. The public site structure (menu, pages, sections) is fine to share.
- **No automatic copying from nmu.org.ua**: an automatic feed (scraping the university WordPress API into our pages) was removed on purpose - duplicated content hurts our ranking and indexing. Do not bring it back. University news on the home page and `news.html` are short hand-written summaries with a link to the original; schedules, scholarships, rules, documents link straight to nmu.org.ua (`target="_blank" rel="noopener"`). `public/api/feed.php` is only a 410 stub that overwrites the old version on the server. Live stats "registered users": `public/api/stats.php` (service-account count of `users`, cached 2 min).
- **Moderation panel** (`admin-tools.js`, card «Модерація» in `personal-area.html`, super admins only): reports queue `reports/{kind_id}/{uid}` = `{k: chat|story|tale, id, o, x, r, ts}` (one per user per post; «Поскаржитись» ⚑ on others' chat messages, stories, tales via `NTU_AUTH.report()`); admin action log `adminLog/{id}` = `{a, n, act, t?, d?, ts}` written by `NTU_AUTH.adminLog()` (and by `materials.php` / `cleanup.php`); server file cleanup `public/api/cleanup.php` (scan/clean: deletes stories older than 24 h and files in `uploads/` that no database node references; files younger than 48 h are kept; aborts if any node read fails).
- **Visitor statistics** (`public/api/visits.php` + main.js `16-visits.js` + `admin-stats.js`, card «Відвідувачі сайту» in `personal-area.html`, super admins): one POST per page view on ntu.dp.ua only (path, referrer/utm_source, screen width, ID token if signed in), no cookies; stored as `/home/ntu.dp.ua/private/visits/YYYY-MM-DD.jsonl` (outside public_html, deleted after 400 days); unique visitor per day = HMAC(IP + UA + date), the IP is never stored; bots filtered by UA. Report: date range up to 92 days, per-day chart, top pages/sources/devices/OS, signed-in users who visited, CSV by day and CSV of all views.
- **Custom chat photo background** (`chat-prefs.js` `paintCustom`): preloaded on page load; uploaded as WebP (JPEG fallback) up to 1920 px; when the photo and the panel proportions differ a lot (e.g. portrait photo in the full-screen chat) or it would be upscaled > 2.2x, it is shown whole (`contain`) over a CSS-blurred copy of itself (layer `.ct-bgfx` with z-index -1 behind the message list, no canvas, so it works cross-origin), otherwise `cover`; fades in when loaded, recalculated on panel resize (ResizeObserver). A newly chosen photo is shown at once from a `blob:` URL while it uploads.
- **Hidden online status**: when `profiles.hide`, the heartbeat writes `presence/{uid}` (admin-only read) instead of `users/{uid}/s`; admins see it via `NTU_AUTH.revealHidden()`, the CSV export uses it for «Востаннє онлайн».
- **Teacher role request limit**: 2 per 24 h, counter `roleReqQuota/{uid}` = `{c, w, ts}` written in the same root PATCH as `roleRequests/{uid}`; the rules check both.
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
