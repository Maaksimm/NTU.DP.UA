/* =====================================================================
   Шапка: випадаюче меню, кнопка «Налаштування відображення»,
   лічильники, жива статистика, фото-історія при прокрутці, демо-чат
   ===================================================================== */
const NTU_PREFS = {
	get(k) { try { return localStorage.getItem(k) } catch (e) { return null } },
	set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch (e) {} },
}

/* --- Одна кнопка: тема, режим ЧБ, мова, розмір тексту --- */
function initPrefs() {
	const box = document.querySelector('[data-prefs]')
	if (!box) return
	const btn = box.querySelector('[data-prefs-btn]')
	const panel = box.querySelector('.prefs__panel')
	const root = document.documentElement
	const bw = box.querySelector('[data-pref-bw]')

	function sync() {
		const theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
		box.querySelectorAll('[data-pref-theme]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.prefTheme === theme)))
		box.querySelectorAll('[data-pref-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.prefLang === (root.lang === 'en' ? 'en' : 'uk'))))
		const fs = root.getAttribute('data-fs') || 'm'
		box.querySelectorAll('[data-pref-fs]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.prefFs === fs)))
		bw.checked = root.getAttribute('data-bw') === '1'
		bw.setAttribute('aria-checked', String(bw.checked))
	}
	function open(on) {
		panel.hidden = !on
		btn.setAttribute('aria-expanded', String(on))
		box.classList.toggle('is-open', on)
		// the panel lives in the header (z-index 100); the open mobile menu is above it (200), so lift the header while the panel is open
		document.body.classList.toggle('prefs-open', on)
		if (on) sync()
	}
	btn.addEventListener('click', e => { e.stopPropagation(); open(panel.hidden) })
	document.addEventListener('click', e => { if (!panel.hidden && !box.contains(e.target)) open(false) })
	document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { open(false); btn.focus() } })

	box.querySelectorAll('[data-pref-theme]').forEach(b => b.addEventListener('click', () => { setTheme(b.dataset.prefTheme); sync() }))
	box.querySelectorAll('[data-pref-lang]').forEach(b => b.addEventListener('click', () => {
		NTU_PREFS.set('ntu-lang', b.dataset.prefLang)
		applyLang(b.dataset.prefLang)
		document.dispatchEvent(new CustomEvent('ntu:lang'))
		sync()
	}))
	box.querySelectorAll('[data-pref-fs]').forEach(b => b.addEventListener('click', () => {
		const v = b.dataset.prefFs
		if (v === 'm') root.removeAttribute('data-fs'); else root.setAttribute('data-fs', v)
		NTU_PREFS.set('ntu-fs', v === 'm' ? null : v)
		sync()
	}))
	bw.addEventListener('change', () => {
		if (bw.checked) root.setAttribute('data-bw', '1'); else root.removeAttribute('data-bw')
		NTU_PREFS.set('ntu-bw', bw.checked ? '1' : null)
		sync()
	})
	sync()
}

/* --- Випадаюче меню: наведення на десктопі, перший дотик відкриває меню на сенсорних екранах --- */
function initMega() {
	const items = [...document.querySelectorAll('[data-mega]')]
	if (!items.length) return
	const page = document.body.dataset.page
	const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
	let closeTimer = null
	function set(item, on) {
		item.classList.toggle('is-open', on)
		item.querySelector('.mega__top').setAttribute('aria-expanded', String(on))
	}
	function closeAll(except) { items.forEach(i => { if (i !== except) set(i, false) }) }
	items.forEach(item => {
		const top = item.querySelector('.mega__top')
		// підсвічуємо лише перший розділ, де є поточна сторінка (сторінка може бути в кількох меню)
		if (!document.querySelector('.mega__top.active') && item.querySelector(`[data-nav="${page}"]`)) top.classList.add('active')
		item.addEventListener('mouseenter', () => { if (!canHover) return; clearTimeout(closeTimer); closeAll(item); set(item, true) })
		item.addEventListener('mouseleave', () => { if (!canHover) return; closeTimer = setTimeout(() => set(item, false), 160) })
		item.addEventListener('focusin', () => { closeAll(item); set(item, true) })
		item.addEventListener('focusout', e => { if (!item.contains(e.relatedTarget)) set(item, false) })
		top.addEventListener('click', e => {
			if (canHover) return
			if (!item.classList.contains('is-open')) { e.preventDefault(); closeAll(item); set(item, true) }
		})
		top.addEventListener('keydown', e => {
			if (e.key === 'ArrowDown') { e.preventDefault(); set(item, true); item.querySelector('.mega__links a')?.focus() }
		})
	})
	document.addEventListener('click', e => { if (!e.target.closest('[data-mega]')) closeAll() })
	document.addEventListener('keydown', e => {
		if (e.key !== 'Escape') return
		const open = items.find(i => i.classList.contains('is-open'))
		if (open) { set(open, false); open.querySelector('.mega__top').focus() }
	})
}

/* --- Лічильники: числа «набігають», коли блок з’являється на екрані --- */
function ntuFormat(n) {
	if (n >= 1800 && n <= 2100) return String(n) // роки без пробілів
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}
function initCountUp() {
	const els = document.querySelectorAll('[data-countup]')
	if (!els.length) return
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
	const io = new IntersectionObserver(entries => entries.forEach(en => {
		if (!en.isIntersecting) return
		io.unobserve(en.target)
		const el = en.target, target = +el.dataset.countup, suf = el.dataset.suffix || ''
		const sufText = () => (suf ? T(suf.trim()).replace(/^/, suf.match(/^\s*/)[0]) : '')
		if (reduce || !target) { el.textContent = ntuFormat(target) + sufText(); return }
		const from = target >= 1800 && target <= 2100 ? target - 40 : 0
		const t0 = performance.now(), dur = 1400
		const step = now => {
			const p = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - p, 3)
			el.textContent = ntuFormat(Math.round(from + (target - from) * eased)) + sufText()
			if (p < 1) requestAnimationFrame(step)
		}
		requestAnimationFrame(step)
	}), { threshold: 0.5 })
	els.forEach(el => io.observe(el))
}

/* --- Жива статистика (як на monobank): цифри змінюються наживо --- */
function initLiveStats() {
	const els = document.querySelectorAll('[data-live]')
	if (!els.length) return
	const DB = ((window.NTU_CHAT || {}).databaseURL || '').replace(/\/+$/, '')
	function animateTo(el, target, unit) {
		const from = +(el.dataset.cur || 0), t0 = performance.now()
		el.dataset.cur = target
		const step = now => {
			const p = Math.min(1, (now - t0) / 1200), v = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)))
			el.textContent = ntuFormat(v) + (unit ? ' ' + T(unit) : '')
			if (p < 1) requestAnimationFrame(step)
		}
		requestAnimationFrame(step)
	}
	function start(el) {
		const kind = el.dataset.live, arg = el.dataset.liveArg
		if (kind === 'since') {
			const t0 = Date.parse(arg)
			const tick = () => { el.textContent = ntuFormat(Math.floor((Date.now() - t0) / 1000)) + ' ' + T('секунд') }
			tick(); setInterval(tick, 1000)
		} else if (kind === 'count') {
			const [n, unit] = String(arg).split('|')
			animateTo(el, +n, unit || '')
		} else if (kind === 'chat') {
			if (!DB) { el.textContent = T('чат у локальному режимі'); return }
			const load = () => fetch(DB + '/chat/messages.json?shallow=true')
				.then(r => (r.ok ? r.json().then(d => ({ ok: true, d })) : { ok: false }))
				.then(res => {
					if (!res.ok) return
					animateTo(el, res.d ? Object.keys(res.d).length : 0, 'повідомлень')
					el.closest('.live-card')?.classList.add('is-live')
				})
				.catch(() => {})
			load(); setInterval(() => { if (!document.hidden) load() }, 30000)
		} else if (kind === 'users') {
			// кількість зареєстрованих: api/stats.php (сервісний ключ), інакше - сам, якщо користувач увійшов
			const show = n => { animateTo(el, n, 'користувачів'); el.closest('.live-card')?.classList.add('is-live') }
			const viaAuth = () => {
				const A = window.NTU_AUTH
				if (!A || !A.user || !A.db) { if (!el.dataset.cur) el.textContent = T('увійдіть, щоб побачити'); return }
				A.db('GET', 'users?shallow=true', undefined, true).then(d => show(d ? Object.keys(d).length : 0)).catch(() => {})
			}
			const load = () => fetch('api/stats.php', { cache: 'no-store' })
				.then(r => (r.ok ? r.json() : Promise.reject(r.status)))
				.then(d => { if (typeof d.users === 'number') show(d.users); else viaAuth() })
				.catch(viaAuth)
			load(); setInterval(() => { if (!document.hidden) load() }, 60000)
		}
	}
	const io = new IntersectionObserver(entries => entries.forEach(en => {
		if (en.isIntersecting) { io.unobserve(en.target); start(en.target) }
	}), { threshold: 0.3 })
	els.forEach(el => io.observe(el))
}

/* --- Фото-історія: при прокрутці вниз з’являється нове фото (липка рамка праворуч) --- */
function initStory() {
	document.querySelectorAll('[data-story]').forEach(story => {
		const steps = [...story.querySelectorAll('[data-story-step]')]
		const photos = [...story.querySelectorAll('[data-story-photo]')]
		const dots = [...story.querySelectorAll('.story__progress i')]
		let cur = 0
		function show(i) {
			if (i === cur) return
			cur = i
			steps.forEach((s, k) => s.classList.toggle('is-active', k === i))
			photos.forEach((p, k) => { p.classList.toggle('is-active', k === i); p.classList.toggle('is-past', k < i) })
			dots.forEach((d, k) => d.classList.toggle('is-active', k === i))
		}
		const io = new IntersectionObserver(entries => entries.forEach(en => {
			if (en.isIntersecting) show(+en.target.dataset.storyStep)
		}), { rootMargin: '-45% 0px -45% 0px' })
		steps.forEach(s => io.observe(s))
	})
}

/* --- Демо-чат «На зв’язку» (як на monobank): повідомлення з’являються по черзі --- */
function initChatDemo() {
	document.querySelectorAll('[data-chat-demo]').forEach(box => {
		const list = box.querySelector('.cdemo__list')
		const msgs = [...box.querySelectorAll('.cdemo__msg')]
		const typing = box.querySelector('.cdemo__typing')
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		let timers = [], running = false, gen = 0
		const wait = ms => new Promise(r => timers.push(setTimeout(r, ms)))
		function reset() { msgs.forEach(m => m.classList.remove('is-in')); typing.classList.remove('is-in') }
		async function play() {
			if (running) return
			running = true
			const my = ++gen
			while (running && my === gen) {
				reset()
				await wait(500)
				for (const m of msgs) {
					if (!running || my !== gen) return
					if (m.classList.contains('cdemo__msg--in')) {
						list.appendChild(typing)
						typing.classList.add('is-in')
						await wait(1200)
						typing.classList.remove('is-in')
					} else await wait(650)
					list.insertBefore(m, typing)
					m.classList.add('is-in')
					await wait(900)
				}
				await wait(5000)
			}
		}
		function stop() { running = false; timers.forEach(clearTimeout); timers = [] }
		if (reduce) { msgs.forEach(m => m.classList.add('is-in')); return }
		new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) play(); else stop() }), { threshold: 0.35 }).observe(box)
	})
}

document.addEventListener('DOMContentLoaded', () => {
	initPrefs()
	initMega()
	initCountUp()
	initLiveStats()
	initStory()
	initChatDemo()
	const burger = document.querySelector('.burger')
	if (burger) new MutationObserver(() => burger.setAttribute('aria-expanded', String(burger.classList.contains('is-open')))).observe(burger, { attributes: true, attributeFilter: ['class'] })
})
