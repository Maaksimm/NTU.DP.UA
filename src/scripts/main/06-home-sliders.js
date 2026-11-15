/* ===== Home: before / after slider + news slider ===== */
function whenPageReady(cb) {
	if (!document.body.classList.contains('loading')) return cb()
	const mo = new MutationObserver(() => {
		if (!document.body.classList.contains('loading')) {
			mo.disconnect()
			cb()
		}
	})
	mo.observe(document.body, { attributes: true, attributeFilter: ['class'] })
}
function initBeforeAfter() {
	const ba = document.querySelector('[data-ba]')
	if (!ba) return
	const handle = ba.querySelector('.ba__handle')
	let raf = 0, dragging = false
	const set = v => {
		v = Math.max(0, Math.min(100, v))
		ba.style.setProperty('--pos', v + '%')
		handle.setAttribute('aria-valuenow', Math.round(v))
	}
	const fromEvent = e => {
		const r = ba.getBoundingClientRect()
		set(((e.clientX - r.left) / r.width) * 100)
	}
	const stopAuto = () => {
		cancelAnimationFrame(raf)
		ba.classList.add('is-touched')
	}
	ba.addEventListener('pointerdown', e => {
		stopAuto()
		dragging = true
		ba.classList.add('is-drag')
		ba.setPointerCapture(e.pointerId)
		fromEvent(e)
	})
	ba.addEventListener('pointermove', e => dragging && fromEvent(e))
	const end = () => {
		dragging = false
		ba.classList.remove('is-drag')
	}
	ba.addEventListener('pointerup', end)
	ba.addEventListener('pointercancel', end)
	handle.addEventListener('keydown', e => {
		const cur = parseFloat(handle.getAttribute('aria-valuenow'))
		const step = e.shiftKey ? 15 : 5
		const map = { ArrowLeft: cur - step, ArrowDown: cur - step, ArrowRight: cur + step, ArrowUp: cur + step, Home: 0, End: 100 }
		if (!(e.key in map)) return
		e.preventDefault()
		stopAuto()
		set(map[e.key])
	})
	// intro sweep: 50 -> 12 -> 88 -> 50 when the block first scrolls into view
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
	const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
	const legs = [[50, 12, 800], [12, 88, 1300], [88, 50, 900]]
	function sweep() {
		let i = 0, t0 = performance.now()
		const step = now => {
			const [a, b, d] = legs[i]
			const k = Math.min(1, (now - t0) / d)
			set(a + (b - a) * ease(k))
			if (k < 1) raf = requestAnimationFrame(step)
			else if (++i < legs.length) {
				t0 = now
				raf = requestAnimationFrame(step)
			}
		}
		raf = requestAnimationFrame(step)
	}
	const io = new IntersectionObserver(entries => {
		if (!entries[0].isIntersecting) return
		io.disconnect()
		whenPageReady(() => setTimeout(() => !ba.classList.contains('is-touched') && sweep(), 350))
	}, { threshold: 0.45 })
	io.observe(ba)
}
/* Smooth slider: eased slide, finger/mouse drag that follows the pointer, optional autoplay */
function makeSlider(o) {
	const { root, track, slides, prev, next, dots } = o
	let i = 0, timer = 0, startX = null, dx = 0, w = 1, moved = false
	function go(n, instant) {
		i = Math.max(0, Math.min(slides.length - 1, n))
		track.style.transition = instant ? 'none' : ''
		track.style.transform = 'translate3d(' + -100 * i + '%,0,0)'
		if (prev) prev.disabled = i === 0
		if (next) next.disabled = i === slides.length - 1
		dots.forEach((d, k) => d.classList.toggle('is-active', k === i))
		slides.forEach((sl, k) => {
			sl.classList.toggle('is-current', k === i)
			sl.setAttribute('aria-hidden', k === i ? 'false' : 'true')
		})
	}
	const loop = n => go(n >= slides.length ? 0 : n < 0 ? slides.length - 1 : n)
	function play() {
		if (!o.autoplay) return
		clearInterval(timer)
		timer = setInterval(() => !document.hidden && loop(i + 1), o.autoplay)
	}
	const stop = () => clearInterval(timer)
	const step = d => { loop(i + d); play() }
	if (prev) prev.addEventListener('click', () => (o.loop ? step(-1) : (go(i - 1), play())))
	if (next) next.addEventListener('click', () => (o.loop ? step(1) : (go(i + 1), play())))
	dots.forEach((d, k) => d.addEventListener('click', () => (go(k), play())))
	root.addEventListener('pointerdown', e => {
		if (e.pointerType === 'mouse' && e.button !== 0) return
		if (e.target.closest('a, button')) return
		startX = e.clientX
		dx = 0
		moved = false
		w = root.getBoundingClientRect().width || 1
		stop()
	})
	root.addEventListener('pointermove', e => {
		if (startX === null) return
		dx = e.clientX - startX
		if (!moved && Math.abs(dx) < 6) return
		moved = true
		let d = dx
		if ((i === 0 && d > 0) || (i === slides.length - 1 && d < 0)) d *= 0.35 // rubber band at the ends
		track.style.transition = 'none'
		track.style.transform = 'translate3d(calc(' + -100 * i + '% + ' + d + 'px),0,0)'
	})
	const release = () => {
		if (startX === null) return
		const d = dx
		startX = null
		if (moved && Math.abs(d) > Math.min(90, w * 0.12)) go(i + (d < 0 ? 1 : -1))
		else go(i)
		play()
	}
	root.addEventListener('pointerup', release)
	root.addEventListener('pointercancel', release)
	root.addEventListener('pointerleave', e => e.pointerType === 'mouse' && release())
	root.addEventListener('dragstart', e => e.preventDefault())
	root.addEventListener('mouseenter', stop)
	root.addEventListener('mouseleave', play)
	root.addEventListener('focusin', stop)
	root.addEventListener('focusout', play)
	go(0, true)
	requestAnimationFrame(() => (track.style.transition = ''))
	play()
}
function initNewsSlider() {
	const root = document.querySelector('[data-news-slider]')
	if (!root) return
	makeSlider({
		root,
		track: root.querySelector('.news-track'),
		slides: [...root.querySelectorAll('.news-slide')],
		prev: root.querySelector('.news-prev'),
		next: root.querySelector('.news-next'),
		dots: [...root.querySelectorAll('.news-dots button')],
		autoplay: 7000,
		loop: false,
	})
}
function initFactsSlider() {
	const root = document.querySelector('[data-facts-slider]')
	if (!root) return
	makeSlider({
		root,
		track: root.querySelector('.facts-track'),
		slides: [...root.querySelectorAll('.facts-slide')],
		prev: root.querySelector('.facts-prev'),
		next: root.querySelector('.facts-next'),
		dots: [...root.querySelectorAll('.facts-dots button')],
		autoplay: 6000,
		loop: true,
	})
}
document.addEventListener('DOMContentLoaded', () => {
	initBeforeAfter()
	initNewsSlider()
	initFactsSlider()
})
