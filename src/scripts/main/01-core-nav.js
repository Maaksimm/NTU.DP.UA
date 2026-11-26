(function () {
	// Прелоадер - лише при першому відкритті сайту; на наступних сторінках візиту його ховає клас no-pl (скрипт у <head>)
	if (document.documentElement.classList.contains('no-pl')) {
		const p = document.querySelector('.preloader')
		if (p) p.remove()
		return
	}
	try { sessionStorage.setItem('ntu-pl', '1') } catch (e) {}
	document.body.classList.add('loading')
	const t0 = performance.now(), MIN = 1700
	const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
	let loaded = false, shown = 0, finished = false
	window.addEventListener('load', () => (loaded = true))
	const bar = () => document.getElementById('plBar'), num = () => document.getElementById('plNum')
	function finish() {
		if (finished) return
		finished = true
		const p = document.querySelector('.preloader')
		const n = num()
		if (n) n.className = 'pl-num'
		// 100 % stays a moment, the number lifts out of its mask, then the panel slides up
		setTimeout(() => { if (p) p.classList.add('done') }, 320)
		setTimeout(() => {
			if (p) p.classList.add('hide')
			document.body.classList.remove('loading')
		}, 820)
	}
	// while counting, the digits switch between typefaces (Manrope, mono, serif italic, Onest)
	let lastFont = 0, fontIdx = 0
	function swapFont(now) {
		if (now - lastFont < 140) return
		lastFont = now
		fontIdx = (fontIdx + 1 + Math.floor(Math.random() * 3)) % 4
		const n = num()
		if (n) n.className = 'pl-num' + (fontIdx ? ' f' + fontIdx : '')
	}
	function tick() {
		const el = performance.now() - t0
		const target = loaded && el >= MIN ? 100 : Math.min(88, (el / MIN) * 88)
		shown += (target - shown) * 0.1
		if (target === 100 && shown > 99.4) shown = 100
		if (bar()) bar().style.width = shown + '%'
		if (num()) num().textContent = Math.round(shown)
		if (shown >= 100) return finish()
		if (!reduce) swapFont(performance.now())
		requestAnimationFrame(tick)
	}
	requestAnimationFrame(tick)
	setTimeout(() => { loaded = true }, 7000)
})()
function updateMobileNavOffset() {
	const header = document.querySelector('.header')
	if (!header) return
	const bottom = Math.round(header.getBoundingClientRect().bottom)
	document.documentElement.style.setProperty('--mobile-nav-top', bottom + 'px')
}
window.addEventListener('load', updateMobileNavOffset)
window.addEventListener('resize', updateMobileNavOffset)
window.addEventListener('orientationchange', updateMobileNavOffset)
document.addEventListener('DOMContentLoaded', updateMobileNavOffset)

function toggleMenu() {
	const nav = document.getElementById('mobileNav')
	const burger = document.querySelector('.burger')
	updateMobileNavOffset()
	if (nav) nav.classList.toggle('open')
	if (burger) {
		burger.classList.toggle('is-open')
		burger.setAttribute('aria-expanded', String(burger.classList.contains('is-open')))
	}
	document.body.classList.toggle('nav-open', nav && nav.classList.contains('open'))
}
document.addEventListener('DOMContentLoaded', () => {
	const page = document.body.dataset.page
	document.querySelectorAll('[data-nav]').forEach(a => {
		// anchors to sections of the same page (international.html#grants...) are not separate pages - do not highlight them
		if (a.dataset.nav === page && !(a.getAttribute('href') || '').includes('#')) a.classList.add('active')
	})
	// threshold 0 + a bottom margin instead of a percentage: a very tall block (e.g. the list of 114 programs
	// on a phone) can never be 12% visible, so it used to stay invisible and left a big empty area
	const observer = new IntersectionObserver(
		entries =>
			entries.forEach(e => {
				if (e.isIntersecting) {
					e.target.classList.add('visible')
					observer.unobserve(e.target)
				}
			}),
		{ threshold: 0, rootMargin: '0px 0px -40px 0px' },
	)
	document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
	document.querySelectorAll('.lib-progress').forEach(el => observer.observe(el))
	document
		.querySelectorAll('[data-faq]')
		.forEach(item =>
			item.addEventListener('click', () =>
				item.closest('.faq-item').classList.toggle('open'),
			),
		)
	const y = document.getElementById('year')
	if (y) y.textContent = new Date().getFullYear()
	window.addEventListener('scroll', () => {
		const winScroll =
			document.documentElement.scrollTop || document.body.scrollTop
		const height =
			document.documentElement.scrollHeight -
			document.documentElement.clientHeight
		const scrolled = height > 0 ? (winScroll / height) * 100 : 0
		const progressBar = document.getElementById('scrollProgress')
		if (progressBar) progressBar.style.width = scrolled + '%'
	})
	initContactForm()
	initSliders()
	initInstituteBlocks()
	initAuthorsPage()
	initGalleryLightbox()
	initResourceFilter()
	initAlumni()
	initAdmissionTable()
	initDormSlider()
	initMediaFilter()
	initBgVideo()
	document.querySelectorAll('.mobile-nav a').forEach(a => {
		a.addEventListener('click', () => {
			document.getElementById('mobileNav')?.classList.remove('open')
			document.querySelector('.burger')?.classList.remove('is-open')
			document.querySelector('.burger')?.setAttribute('aria-expanded', 'false')
			document.body.classList.remove('nav-open')
		})
	})
})
