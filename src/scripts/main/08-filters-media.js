/* ===== Materials: search + type filter ===== */
function initResourceFilter() {
	const grid = document.getElementById('resGrid')
	if (!grid) return
	const search = document.getElementById('resSearch')
	const empty = document.getElementById('resEmpty')
	const chips = document.querySelectorAll('.res-chip')
	let type = 'all'
	function apply() {
		const q = search.value.trim().toLowerCase()
		let shown = 0
		grid.querySelectorAll('.res-card').forEach(c => {
			// card text is Ukrainian in data-text, so search matches visible text in either language
			const hay = c.dataset.text + ' ' + c.textContent.toLowerCase()
			const ok = (type === 'all' || c.dataset.type === type) && (!q || hay.includes(q))
			c.hidden = !ok
			if (ok) shown++
		})
		empty.hidden = shown > 0
	}
	chips.forEach(ch => ch.addEventListener('click', () => {
		chips.forEach(x => x.classList.toggle('is-active', x === ch))
		type = ch.dataset.filter
		apply()
	}))
	search.addEventListener('input', apply)
	// materials.js adds approved student materials later and fires this event
	grid.addEventListener('ntu:res', apply)
}

/* ===== Media gallery: category filter ===== */
function initMediaFilter() {
	const items = document.querySelectorAll('.mg-grid .gallery-item')
	if (!items.length) return
	const chips = document.querySelectorAll('[data-mg-filter]')
	chips.forEach(ch => ch.addEventListener('click', () => {
		chips.forEach(x => x.classList.toggle('is-active', x === ch))
		const f = ch.dataset.mgFilter
		items.forEach(i => { i.hidden = !(f === 'all' || i.dataset.cat === f) })
	}))
}

/* ===== YouTube click-to-play thumbnails ===== */
document.addEventListener('click', e => {
	const b = e.target.closest && e.target.closest('.vid[data-yt]')
	if (!b) return
	const f = document.createElement('iframe')
	f.src = 'https://www.youtube-nocookie.com/embed/' + b.dataset.yt + '?autoplay=1&rel=0'
	f.title = b.getAttribute('aria-label') || ''
	f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'
	f.allowFullscreen = true
	b.replaceChildren(f)
	b.removeAttribute('data-yt')
	b.style.cursor = 'default'
})

/* ===== Background videos (home hero, personal area) ===== */
// The poster shows at once; the video file is requested only when motion is allowed and the
// connection is not in data-saving / 2G mode. It plays only while visible and the tab is active.
function initBgVideo() {
	const vids = document.querySelectorAll('video[data-bg-video]')
	if (!vids.length) return
	const conn = navigator.connection
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
	if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return
	vids.forEach(v => {
		let inView = false
		const sync = () => {
			if (inView && !document.hidden) {
				const p = v.play()
				if (p) p.catch(() => {})
			} else v.pause()
		}
		v.muted = true
		v.src = v.dataset.bgVideo
		v.addEventListener('playing', () => v.classList.add('is-playing'), { once: true })
		new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync() }).observe(v)
		document.addEventListener('visibilitychange', sync)
	})
}
