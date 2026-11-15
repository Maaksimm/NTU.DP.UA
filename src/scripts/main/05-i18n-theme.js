function T(s) {
	return (document.documentElement.lang === 'en' && window.I18N_EN && window.I18N_EN[s]) || s
}
/* ===== Theme switcher + language switcher (UA / EN) ===== */
const I18N = { orig: new WeakMap(), attrs: ['alt', 'title', 'placeholder', 'aria-label'] }
function i18nNorm(s) { return s.replace(/\s+/g, ' ').trim() }
function applyLang(lang) {
	const dict = window.I18N_EN || {}
	const en = lang === 'en'
	document.documentElement.lang = en ? 'en' : 'uk'
	const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
		acceptNode: n => (n.parentElement && /^(SCRIPT|STYLE|NOSCRIPT)$/.test(n.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
	})
	let n
	while ((n = w.nextNode())) {
		if (!I18N.orig.has(n)) I18N.orig.set(n, n.nodeValue)
		const base = I18N.orig.get(n), key = i18nNorm(base)
		if (!key) continue
		const tr = en && dict[key]
		n.nodeValue = tr ? base.match(/^\s*/)[0] + tr + base.match(/\s*$/)[0] : base
	}
	document.querySelectorAll('[alt],[title],[placeholder],[aria-label]').forEach(el => {
		I18N.attrs.forEach(a => {
			if (!el.hasAttribute(a)) return
			const k = 'i18nOrig' + a.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())
			if (!(k in el.dataset)) el.dataset[k] = el.getAttribute(a)
			const t = en && dict[i18nNorm(el.dataset[k])]
			el.setAttribute(a, t || el.dataset[k])
		})
	})
	if (!document.documentElement.dataset.titleUk) document.documentElement.dataset.titleUk = document.title
	const tt = en && dict[i18nNorm(document.documentElement.dataset.titleUk)]
	document.title = tt || document.documentElement.dataset.titleUk
	const md = document.querySelector('meta[name="description"]')
	if (md) {
		if (!md.dataset.uk) md.dataset.uk = md.content
		md.content = (en && dict[i18nNorm(md.dataset.uk)]) || md.dataset.uk
	}
	document.querySelectorAll('[data-lang-toggle]').forEach(b => b.setAttribute('aria-checked', en ? 'true' : 'false'))
	const tb = document.querySelector('[data-theme-toggle]')
	if (tb) tb.setAttribute('aria-label', en ? 'Toggle theme' : T('Змінити тему'))
}
function setTheme(t) {
	document.documentElement.setAttribute('data-theme', t)
	try { sessionStorage.setItem('ntu-theme', t); localStorage.removeItem('ntu-theme') } catch (e) {}
	// фон профілів залежить від теми: скрипти перемальовують його за цією подією
	document.dispatchEvent(new CustomEvent('ntu:theme', { detail: t }))
}
document.addEventListener('DOMContentLoaded', () => {
	document.querySelectorAll('[data-theme-toggle]').forEach(b =>
		b.addEventListener('click', () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')))
	document.querySelectorAll('[data-lang-toggle]').forEach(b =>
		b.addEventListener('click', () => {
			const next = document.documentElement.lang === 'en' ? 'uk' : 'en'
			try { localStorage.setItem('ntu-lang', next) } catch (e) {}
			applyLang(next)
		}))
	let l = 'uk'
	try { l = localStorage.getItem('ntu-lang') || 'uk' } catch (e) {}
	applyLang(l)
})
