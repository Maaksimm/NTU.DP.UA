/* ===== Card carousels: grids of 3+ cards become sliders ===== */
function initCardCarousels() {
	const ARW = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'
	document.querySelectorAll('.grid-3, .grid-4').forEach(grid => {
		if (grid.closest('[data-news-slider]') || grid.classList.contains('news-slide')) return
		const items = [...grid.children]
		if (items.length < 3 || !items.every(c => /(^|\s)(card|institute-card|card-faculty)(\s|$)/.test(c.className))) return
		const wrap = document.createElement('div')
		wrap.className = 'cc'
		grid.parentNode.insertBefore(wrap, grid)
		wrap.appendChild(grid)
		grid.classList.add('cc-track')
		grid.style.setProperty('--cc-n', grid.classList.contains('grid-4') ? 4 : 3)
		grid.classList.remove('reveal')
		items.forEach(c => c.classList.remove('reveal'))
		const prev = document.createElement('button'), next = document.createElement('button'), dots = document.createElement('div')
		prev.type = next.type = 'button'
		prev.className = 'cc-arrow cc-prev'
		next.className = 'cc-arrow cc-next'
		prev.innerHTML = ARW('M15 5l-7 7 7 7')
		next.innerHTML = ARW('M9 5l7 7-7 7')
		dots.className = 'cc-dots'
		wrap.append(prev, next, dots)
		let pages = 1, step = 1, perView = 1
		const gap = () => parseFloat(getComputedStyle(grid).columnGap) || 24
		function measure() {
			const w = items[0].getBoundingClientRect().width
			perView = Math.max(1, Math.round((grid.clientWidth + gap()) / (w + gap())))
			step = (w + gap()) * perView
			pages = Math.ceil(items.length / perView)
			wrap.classList.toggle('is-static', pages <= 1)
			prev.setAttribute('aria-label', T('Назад'))
			next.setAttribute('aria-label', T('Вперед'))
			if (dots.children.length !== pages) {
				dots.innerHTML = ''
				for (let i = 0; i < pages; i++) {
					const b = document.createElement('button')
					b.type = 'button'
					b.setAttribute('aria-label', T('Слайд') + ' ' + (i + 1))
					b.addEventListener('click', () => grid.scrollTo({ left: i * step }))
					dots.appendChild(b)
				}
			}
			update()
		}
		function update() {
			const max = grid.scrollWidth - grid.clientWidth
			const at = grid.scrollLeft
			let p = Math.round(at / step)
			if (at >= max - 8) p = pages - 1
			p = Math.max(0, Math.min(pages - 1, p))
			prev.disabled = at <= 8
			next.disabled = at >= max - 8
			;[...dots.children].forEach((d, i) => d.classList.toggle('is-active', i === p))
		}
		prev.addEventListener('click', () => grid.scrollBy({ left: -step }))
		next.addEventListener('click', () => grid.scrollBy({ left: step }))
		grid.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true })
		new ResizeObserver(measure).observe(grid)
		measure()
	})
}
/* ===== Dynamic timeline: scroll-driven line, items slide in, dots light up ===== */
function initTimelines() {
	document.querySelectorAll('[data-tl]').forEach(tl => {
		const items = [...tl.querySelectorAll('.tl__item')]
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
		const io = new IntersectionObserver(es => es.forEach(e => {
			if (e.isIntersecting) {
				e.target.classList.add('is-in')
				io.unobserve(e.target)
			}
		}), { threshold: 0.2, rootMargin: '0px 0px -8% 0px' })
		items.forEach((it, i) => {
			it.style.transitionDelay = (i % 2) * 0.08 + 's'
			reduce ? it.classList.add('is-in') : io.observe(it)
		})
		let ticking = false
		function update() {
			ticking = false
			const r = tl.getBoundingClientRect(), vh = innerHeight, mark = vh * 0.58
			const p = Math.max(0, Math.min(1, (mark - r.top) / r.height))
			tl.style.setProperty('--tl-p', p.toFixed(4))
			items.forEach(it => {
				const d = it.querySelector('.tl__dot').getBoundingClientRect()
				it.classList.toggle('is-active', d.top + d.height / 2 < mark)
			})
		}
		const req = () => !ticking && ((ticking = true), requestAnimationFrame(update))
		addEventListener('scroll', req, { passive: true })
		addEventListener('resize', req)
		update()
	})
}
document.addEventListener('DOMContentLoaded', () => {
	initCardCarousels()
	initTimelines()
})
