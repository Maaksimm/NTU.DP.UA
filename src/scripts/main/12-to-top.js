/* ===== Кнопка «нагору» збоку + індикатор, на скільки відсотків прокручено сторінку ===== */
function initToTop() {
	if (document.querySelector('.totop')) return
	const wrap = document.createElement('div')
	wrap.className = 'totop'
	wrap.innerHTML = '<button type="button" class="totop__btn" aria-label="' + T('Прокрутити сторінку нагору') + '" title="' + T('Нагору') + '">'
		+ '<svg class="totop__ring" viewBox="0 0 48 48" aria-hidden="true"><circle class="totop__track" cx="24" cy="24" r="21"/><circle class="totop__fill" cx="24" cy="24" r="21" pathLength="100"/></svg>'
		+ '<svg class="totop__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg></button>'
		+ '<span class="totop__pct" aria-hidden="true">0%</span>'
	document.body.appendChild(wrap)
	const btn = wrap.querySelector('.totop__btn'), fill = wrap.querySelector('.totop__fill'), pct = wrap.querySelector('.totop__pct')
	let ticking = false
	function update() {
		ticking = false
		const h = document.documentElement.scrollHeight - document.documentElement.clientHeight
		const y = window.scrollY || document.documentElement.scrollTop
		const p = h > 0 ? Math.min(100, Math.max(0, Math.round((y / h) * 100))) : 0
		pct.textContent = p + '%'
		fill.style.strokeDashoffset = String(100 - p)
		wrap.classList.toggle('is-visible', y > 320)
	}
	window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update) } }, { passive: true })
	window.addEventListener('resize', update)
	/* Плавна прокрутка нагору з м'яким розгоном і гальмуванням (easeInOutCubic); тривалість залежить від відстані */
	let anim = null
	function scrollTop() {
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		const from = window.scrollY || document.documentElement.scrollTop
		if (reduce || from <= 0) { window.scrollTo(0, 0); return }
		const dur = Math.min(1100, 450 + from / 6)
		const t0 = performance.now()
		const ease = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
		const root = document.documentElement
		const prevBehavior = root.style.scrollBehavior
		root.style.scrollBehavior = 'auto' // інакше CSS scroll-behavior: smooth «гасить» покадрову анімацію
		cancelAnimationFrame(anim)
		const stop = () => { cancelAnimationFrame(anim); root.style.scrollBehavior = prevBehavior; window.removeEventListener('wheel', stop); window.removeEventListener('touchstart', stop) }
		// користувач крутить колесо або торкається екрана - не боремося з ним
		window.addEventListener('wheel', stop, { passive: true, once: true })
		window.addEventListener('touchstart', stop, { passive: true, once: true })
		const step = now => {
			const p = Math.min(1, (now - t0) / dur)
			window.scrollTo(0, Math.round(from * (1 - ease(p))))
			if (p < 1) anim = requestAnimationFrame(step); else stop()
		}
		anim = requestAnimationFrame(step)
	}
	btn.addEventListener('click', () => {
		wrap.classList.remove('is-launch')
		void wrap.offsetWidth // перезапуск анімації при повторному кліку
		wrap.classList.add('is-launch')
		setTimeout(() => wrap.classList.remove('is-launch'), 900)
		scrollTop()
	})
	document.addEventListener('ntu:lang', () => { btn.setAttribute('aria-label', T('Прокрутити сторінку нагору')); btn.title = T('Нагору') })
	update()
}
document.addEventListener('DOMContentLoaded', initToTop)
