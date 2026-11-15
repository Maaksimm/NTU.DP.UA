#!/usr/bin/env node
/**
 * Quality checks on the built site (run `npm run build` first). Exit code 1 if any error.
 *  - every page: unique <title>, meta description <= 160 chars, one <h1>, canonical URL
 *  - internal links and asset references point to files that exist in dist/
 *  - Ukrainian UI text (text nodes, alt/title/placeholder/aria-label, title, description,
 *    and T('...')/t('...') strings in JS) has an English entry in src/scripts/i18n-en.js
 * Usage: node tools/check.mjs [--i18n-only] [--quiet]
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const quiet = process.argv.includes('--quiet')
if (!fs.existsSync(DIST)) { console.error('dist/ not found - run `npm run build` first'); process.exit(1) }

const errors = [], warnings = []
const ctx = { window: {} }
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/scripts/i18n-en.js'), 'utf8'), ctx)
const dict = Object.fromEntries(Object.entries(ctx.window.I18N_EN).map(([k, v]) => [k.replace(/\s+/g, ' ').trim(), v]))
const norm = s => s.replace(/\s+/g, ' ').trim()
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
const CYR = /[А-Яа-яІіЇїЄєҐґ]/
const missing = new Map()
const need = (s, where) => { s = norm(s); if (s && CYR.test(s) && !(s in dict) && !missing.has(s)) missing.set(s, where) }

const pages = fs.readdirSync(DIST).filter(f => f.endsWith('.html'))
const titles = new Map()
for (const f of pages) {
	const html = fs.readFileSync(path.join(DIST, f), 'utf8')
	const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1]
	const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1]
	if (!title) errors.push(f + ': no <title>')
	else if (titles.has(title)) errors.push(f + ': duplicate <title> (also ' + titles.get(title) + ')')
	else titles.set(title, f)
	if (!desc) errors.push(f + ': no meta description')
	else if (decode(desc).length > 160) warnings.push(f + ': meta description is ' + decode(desc).length + ' chars (> 160)')
	const h1 = (html.match(/<h1[\s>]/g) || []).length
	if (h1 !== 1) warnings.push(f + ': ' + h1 + ' <h1> elements')
	if (!/<link rel="canonical"/.test(html)) errors.push(f + ': no canonical link')

	// links and assets
	for (const m of html.matchAll(/\s(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
		const u = m[1]
		if (/^(https?:|mailto:|tel:|data:|javascript:|\/\/)/.test(u)) continue
		if (!fs.existsSync(path.join(DIST, decodeURI(u)))) errors.push(f + ': broken link ' + u)
	}

	// i18n
	const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
	const body = h.slice(h.indexOf('<body'))
	for (const m of body.matchAll(/\b(?:alt|title|placeholder|aria-label)="([^"]*)"/g)) need(decode(m[1]), f)
	if (title) need(decode(title), f)
	if (desc) need(decode(desc), f)
	body.replace(/<[^>]+>/g, '\u0000').split('\u0000').forEach(t => need(decode(t), f))
}
for (const f of fs.readdirSync(path.join(DIST, 'assets/js')).filter(f => f.endsWith('.js') && f !== 'i18n-en.js')) {
	const src = fs.readFileSync(path.join(DIST, 'assets/js', f), 'utf8')
	for (const m of src.matchAll(/\b[tT]\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g)) need(m[1].replace(/\\'/g, "'"), 'assets/js/' + f)
}
for (const [s, where] of missing) warnings.push('i18n: no English for ' + JSON.stringify(s) + ' (' + where + ')')

if (!quiet || errors.length) for (const w of warnings) console.log('warn  ' + w)
for (const e of errors) console.log('ERROR ' + e)
console.log(`${pages.length} pages checked: ${errors.length} errors, ${warnings.length} warnings (${missing.size} missing translations)`)
process.exit(errors.length ? 1 : 0)
