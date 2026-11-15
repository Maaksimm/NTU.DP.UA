/* ===== Admission 2026: programs table (data from assets/data/admission-2026.json) ===== */
function initAdmissionTable() {
	const body = document.getElementById('admBody')
	if (!body) return
	const search = document.getElementById('admSearch')
	const sortSel = document.getElementById('admSort')
	const empty = document.getElementById('admEmpty')
	let data = null
	let level = 'bachelor'
	let form = 'Денна'
	const fmt = n => (n == null ? '-' : Number(n).toLocaleString('uk-UA').replace(/\u00a0/g, ' '))
	const cell = (tr, text, cls) => {
		const td = document.createElement('td')
		if (cls) td.className = cls
		td.textContent = text
		tr.appendChild(td)
		return td
	}
	function render() {
		if (!data) return
		const q = search.value.trim().toLowerCase()
		let rows = data.rows.filter(r => r.l === level && r.f === form && (!q || (r.p + ' ' + r.s + ' ' + r.c + ' ' + (r.fac || '')).toLowerCase().includes(q)))
		const by = sortSel.value
		rows = rows.slice().sort((a, b) => {
			if (by === 'budget') return b.b - a.b || a.p.localeCompare(b.p, 'uk')
			if (by === 'priceAsc') return (a.pr ?? 1e9) - (b.pr ?? 1e9)
			if (by === 'priceDesc') return (b.pr ?? -1) - (a.pr ?? -1)
			if (by === 'apps') return b.apps - a.apps
			return a.p.localeCompare(b.p, 'uk')
		})
		body.textContent = ''
		rows.forEach(r => {
			const tr = document.createElement('tr')
			const td1 = cell(tr, r.p)
			if (r.fac) {
				const f = document.createElement('span')
				f.className = 'adm-fac'
				f.textContent = r.fac
				td1.appendChild(f)
			}
			const td2 = document.createElement('td')
			const code = document.createElement('span')
			code.className = 'adm-code'
			code.textContent = r.c
			td2.appendChild(code)
			td2.appendChild(document.createTextNode(r.s))
			tr.appendChild(td2)
			cell(tr, r.b > 0 ? T('до') + ' ' + r.b : T('немає'))
			cell(tr, r.k > 0 ? String(r.k) : '-')
			cell(tr, fmt(r.pr))
			cell(tr, r.ab || r.ac ? (r.ab ? r.ab.toFixed(1) : '-') + ' / ' + (r.ac ? r.ac.toFixed(1) : '-') : '-')
			body.appendChild(tr)
		})
		empty.hidden = rows.length > 0
	}
	document.querySelectorAll('[data-adm-level]').forEach(b => b.addEventListener('click', () => {
		document.querySelectorAll('[data-adm-level]').forEach(x => x.classList.toggle('is-active', x === b))
		level = b.dataset.admLevel
		render()
	}))
	document.querySelectorAll('[data-adm-form]').forEach(b => b.addEventListener('click', () => {
		document.querySelectorAll('[data-adm-form]').forEach(x => x.classList.toggle('is-active', x === b))
		form = b.dataset.admForm
		render()
	}))
	search.addEventListener('input', render)
	sortSel.addEventListener('change', render)
	fetch('assets/data/admission-2026.json')
		.then(r => r.json())
		.then(d => {
			data = d
			const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = Number(v).toLocaleString('uk-UA').replace(/\u00a0/g, ' ') }
			set('admStatOffers', d.totalOffers)
			set('admStatLicence', d.licence)
			set('admStatApps', d.applications)
			const st = document.getElementById('admStats')
			if (st) st.hidden = false
			render()
		})
		.catch(() => {
			empty.hidden = false
			empty.textContent = T('Не вдалося завантажити дані. Відкрийте сторінку vstup.osvita.ua.')
		})
}


/* ===== Dormitory photo slider (inside #dormModal) ===== */
function initDormSlider() {
	const root = document.getElementById('dormSlider')
	const modal = document.getElementById('dormModal')
	if (!root || !modal) return
	const slides = Array.from(root.querySelectorAll('.dslider__slide'))
	const thumbs = Array.from(root.querySelectorAll('.dslider__thumb'))
	const count = root.querySelector('.dslider__count')
	const playBtn = root.querySelector('.dslider__play')
	const stage = root.querySelector('.dslider__stage')
	const DELAY = 4500
	const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
	let cur = 0
	let timer = null
	let playing = !reduce
	function show(n) {
		const next = (n + slides.length) % slides.length
		slides.forEach((s, i) => {
			s.classList.toggle('is-active', i === next)
			s.classList.toggle('is-before', i < next)
		})
		thumbs.forEach((t, i) => t.classList.toggle('is-active', i === next))
		const th = thumbs[next]
		if (th && th.scrollIntoView) th.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
		count.textContent = next + 1 + ' / ' + slides.length
		cur = next
		restart()
	}
	function stop() {
		clearTimeout(timer)
		timer = null
		root.classList.remove('is-playing')
	}
	function restart() {
		stop()
		if (!playing || modal.hidden) return
		root.style.setProperty('--ds-delay', DELAY + 'ms')
		void root.offsetWidth
		root.classList.add('is-playing')
		timer = setTimeout(() => show(cur + 1), DELAY)
	}
	function setPlaying(v) {
		playing = v
		playBtn.textContent = v ? T('Пауза') : T('Грати')
		playBtn.setAttribute('aria-pressed', v ? 'true' : 'false')
		restart()
	}
	root.querySelector('.dslider__nav--prev').addEventListener('click', () => show(cur - 1))
	root.querySelector('.dslider__nav--next').addEventListener('click', () => show(cur + 1))
	thumbs.forEach(t => t.addEventListener('click', () => show(Number(t.dataset.i))))
	playBtn.addEventListener('click', () => setPlaying(!playing))
	stage.addEventListener('mouseenter', stop)
	stage.addEventListener('mouseleave', restart)
	document.addEventListener('keydown', e => {
		if (modal.hidden) return
		if (e.key === 'ArrowRight') show(cur + 1)
		if (e.key === 'ArrowLeft') show(cur - 1)
	})
	let x0 = null
	stage.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; stop() }, { passive: true })
	stage.addEventListener('touchend', e => {
		if (x0 == null) return
		const dx = e.changedTouches[0].clientX - x0
		x0 = null
		if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1))
		else restart()
	})
	// start from the first photo whenever the modal opens, stop when it closes
	new MutationObserver(() => {
		if (modal.hidden) stop()
		else { playing = !reduce; playBtn.textContent = playing ? T('Пауза') : T('Грати'); show(0) }
	}).observe(modal, { attributes: true, attributeFilter: ['hidden'] })
	if (reduce) playBtn.textContent = T('Грати')
}
