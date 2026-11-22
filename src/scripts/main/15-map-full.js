/* ===== Карта на сторінці контактів: кнопка «На весь екран», закриття на Esc =====
   Коли браузер підтримує Fullscreen API - справжній повноекранний режим (Esc закриває сам браузер, навіть коли фокус у карті).
   Інакше (iPhone) - накладка на весь вікно з класом .is-full, закривається кнопкою або Esc. */
function initMapFull() {
	document.querySelectorAll('[data-map-full]').forEach(function (wrap) {
		const btn = wrap.querySelector('[data-map-toggle]')
		if (!btn) return
		const label = btn.querySelector('span')
		const native = !!(wrap.requestFullscreen && document.fullscreenEnabled)
		// fallback = true, коли відкрито накладкою (.is-full): API немає або requestFullscreen() відхилено
		let fallback = false
		function isOpen() { return fallback || (native && document.fullscreenElement === wrap) }
		function sync() {
			const open = isOpen()
			wrap.classList.toggle('is-full', open)
			document.documentElement.classList.toggle('map-full-open', open && fallback)
			btn.setAttribute('aria-label', T(open ? 'Закрити карту (Esc)' : 'Відкрити карту на весь екран'))
			btn.title = btn.getAttribute('aria-label')
			if (label) label.textContent = T(open ? 'Згорнути' : 'На весь екран')
		}
		function open() {
			if (native) wrap.requestFullscreen().catch(function () { fallback = true; sync() })
			else { fallback = true; sync() }
		}
		function close() {
			if (native && document.fullscreenElement === wrap) document.exitFullscreen().catch(function () {})
			fallback = false
			sync()
			btn.focus()
		}
		btn.addEventListener('click', function () { isOpen() ? close() : open() })
		document.addEventListener('fullscreenchange', sync)
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && fallback) close()
		})
		document.addEventListener('ntu:lang', sync)
	})
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMapFull)
else initMapFull()
