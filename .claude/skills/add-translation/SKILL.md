---
name: add-translation
description: Add or update English translations in src/scripts/i18n-en.js for new or changed Ukrainian text. Use after editing any visible text on the site.
argument-hint: [files or text to translate]
---

Translations are a flat dictionary `window.I18N_EN` in `src/scripts/i18n-en.js`: key = Ukrainian text with whitespace collapsed to single spaces, value = English.

For $ARGUMENTS (if empty, everything changed in the working tree under this folder):

1. Run `npm run check`; it lists every missing key (`i18n: no English for ...`). Or delegate to the `i18n-auditor` agent.
2. Strings built in JS must go through `T('...')`/`t('...')` and also have a key.
3. When Ukrainian text changed, add the new key and remove the old one if nothing uses it any more.
4. `npm run check` must end with 0 missing translations.
