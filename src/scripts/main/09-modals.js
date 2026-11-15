/* ===== Modals ===== */
;(function () {
	let lastTrigger = null
	function openModal(m, trigger) {
		lastTrigger = trigger
		m.hidden = false
		document.body.style.overflow = 'hidden'
		const f = m.querySelector('input:not([type=hidden]):not(.honeypot-field), textarea')
		if (f) setTimeout(() => f.focus(), 30)
	}
	function closeModal(m) {
		m.hidden = true
		document.body.style.overflow = ''
		if (lastTrigger) lastTrigger.focus()
	}
	document.addEventListener('click', e => {
		const o = e.target.closest && e.target.closest('[data-open-modal]')
		if (o) {
			const m = document.getElementById(o.dataset.openModal)
			if (m) openModal(m, o)
			return
		}
		const m = e.target.closest && e.target.closest('.modal')
		if (m && (e.target === m || e.target.closest('[data-close-modal]'))) closeModal(m)
	})
	document.addEventListener('keydown', e => {
		if (e.key !== 'Escape') return
		document.querySelectorAll('.modal:not([hidden])').forEach(closeModal)
	})
})()
