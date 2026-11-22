/* Glassmorphism-ілюстрації: якщо збірка знайшла assets/lottie/glass-NAME.json, у span є data-lottie.
   Тоді підвантажуємо lottie-web і замінюємо статичний SVG анімацією. Якщо в системі ввімкнено «зменшити рух»
   (у Windows - вимкнені «Ефекти анімації»), анімація програється один раз (коротше 5 с, WCAG 2.2.2) і зупиняється,
   а повторюється лише при наведенні - без нескінченного циклу.
   Без файлів анімацій нічого не завантажується - лишається SVG-версія з CSS-анімацією. */
;(function () {
	var LOTTIE_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie_light.min.js'
	var loading = null

	function loadLottie() {
		if (window.lottie) return Promise.resolve(window.lottie)
		if (loading) return loading
		loading = new Promise(function (resolve, reject) {
			var s = document.createElement('script')
			s.src = LOTTIE_SRC
			s.async = true
			s.crossOrigin = 'anonymous'
			s.onload = function () { window.lottie ? resolve(window.lottie) : reject(new Error('lottie missing')) }
			s.onerror = function () { reject(new Error('lottie load failed')) }
			document.head.appendChild(s)
		})
		return loading
	}

	function mount(el, lottie, calm) {
		var box = document.createElement('span')
		box.className = 'glass-lottie'
		var anim = lottie.loadAnimation({ container: box, renderer: 'svg', loop: !calm, autoplay: true, path: el.getAttribute('data-lottie') })
		if (calm) {
			// один прохід, далі - лише на наведення (сама ілюстрація aria-hidden, тому слухаємо всю шапку)
			var hero = el.closest('.page-hero') || el
			hero.addEventListener('mouseenter', function () { if (anim.isPaused) anim.goToAndPlay(0, true) })
		}
		// SVG прибираємо лише коли анімація справді завантажилась; при помилці лишається статична версія
		anim.addEventListener('DOMLoaded', function () {
			var svg = el.querySelector('.glass-svg')
			if (svg) svg.remove()
			el.appendChild(box)
		})
		anim.addEventListener('data_failed', function () { anim.destroy() })
		return anim
	}

	function init() {
		var els = document.querySelectorAll('[data-lottie]')
		if (!els.length) return
		var calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)
		loadLottie().then(function (lottie) {
			Array.prototype.forEach.call(els, function (el) {
				var anim = mount(el, lottie, calm)
				// не крутимо анімацію, коли її не видно (у спокійному режимі вона й так один раз)
				if (!calm && 'IntersectionObserver' in window) {
					new IntersectionObserver(function (entries) {
						entries.forEach(function (e) { e.isIntersecting ? anim.play() : anim.pause() })
					}).observe(el)
				}
			})
		}).catch(function (err) {
			// статичний SVG лишається на місці; помилку видно в консолі для діагностики
			console.warn('[glass-lottie]', err.message)
		})
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
	else init()
})()
