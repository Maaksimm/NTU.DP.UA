/* ===== Сторінка "Автори": флип-картки, фільтри, лічильники в шапці ===== */
function initAuthorsPage() {
	const grid = document.getElementById('authorsGrid')
	if (!grid) return

	const cards = grid.querySelectorAll('.author-card')

	/* Повноекранний перегляд картки: клік по картці відкриває її на весь екран,
	   кнопка «Дивитись детальніше» перевертає картку на зворотний бік. */
	const modal = document.createElement('div')
	modal.className = 'author-modal'
	modal.hidden = true
	modal.setAttribute('role', 'dialog')
	modal.setAttribute('aria-modal', 'true')
	document.body.appendChild(modal)
	let lastFocus = null

	function closeAuthor() {
		if (modal.hidden) return
		modal.classList.remove('is-open')
		document.body.style.overflow = ''
		setTimeout(() => {
			modal.hidden = true
			modal.innerHTML = ''
		}, 250)
		if (lastFocus) lastFocus.focus()
	}

	function openAuthor(card) {
		lastFocus = card
		const full = card.cloneNode(true)
		full.classList.remove('reveal', 'is-flipped')
		full.classList.add('author-card--full')
		full.removeAttribute('tabindex')
		full.removeAttribute('style')
		const front = full.querySelector('.author-card__front')
		const back = full.querySelector('.author-card__back')
		const hint = front.querySelector('.author-card__hint')
		if (hint) hint.remove()

		const more = document.createElement('button')
		more.type = 'button'
		more.className = 'btn btn-primary author-card__more'
		more.textContent = T('Дивитись детальніше')
		front.appendChild(more)

		const backBtn = document.createElement('button')
		backBtn.type = 'button'
		backBtn.className = 'author-card__back-btn'
		backBtn.textContent = T('← Назад')
		back.appendChild(backBtn)

		const flip = state => {
			full.classList.toggle('is-flipped', state)
			front.setAttribute('aria-hidden', state ? 'true' : 'false')
			back.setAttribute('aria-hidden', state ? 'false' : 'true')
			;(state ? backBtn : more).focus({ preventScroll: true })
		}
		more.addEventListener('click', () => flip(true))
		backBtn.addEventListener('click', () => flip(false))
		back.setAttribute('aria-hidden', 'true')

		const close = document.createElement('button')
		close.type = 'button'
		close.className = 'author-modal__close'
		close.setAttribute('aria-label', T('Закрити'))
		close.textContent = '✕'
		close.addEventListener('click', closeAuthor)

		const name = front.querySelector('h3')
		modal.setAttribute('aria-label', name ? name.textContent.trim() : T('Автори'))
		modal.innerHTML = ''
		modal.append(close, full)
		modal.hidden = false
		document.body.style.overflow = 'hidden'
		requestAnimationFrame(() => {
			modal.classList.add('is-open')
			more.focus({ preventScroll: true })
		})
	}

	modal.addEventListener('click', e => {
		if (e.target === modal) closeAuthor()
	})
	document.addEventListener('keydown', e => {
		if (modal.hidden) return
		if (e.key === 'Escape') closeAuthor()
		if (e.key === 'Tab') {
			const f = [...modal.querySelectorAll('button, a[href]')].filter(el => el.offsetParent !== null && !el.closest('[aria-hidden="true"]'))
			if (!f.length) return
			const first = f[0], last = f[f.length - 1]
			if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
			else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
		}
	})

	cards.forEach(card => {
		card.setAttribute('tabindex', '0')
		card.setAttribute('role', 'button')
		card.addEventListener('click', e => {
			if (e.target.closest('a')) return
			openAuthor(card)
		})
		card.addEventListener('keydown', e => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				openAuthor(card)
			}
		})
	})

	document.querySelectorAll('.authors-filter').forEach(btn => {
		btn.addEventListener('click', () => {
			document.querySelectorAll('.authors-filter').forEach(b => b.classList.remove('is-active'))
			btn.classList.add('is-active')
			const filter = btn.dataset.filter
			cards.forEach(card => {
				const show = filter === 'all' || card.dataset.role === filter
				card.style.display = show ? '' : 'none'
			})
		})
	})

	const ledger = document.querySelector('.authors-ledger')
	if (!ledger) return
	let counted = false
	const counters = ledger.querySelectorAll('[data-count]')
	const ledgerObserver = new IntersectionObserver(
		entries => {
			entries.forEach(entry => {
				if (!entry.isIntersecting || counted) return
				counted = true
				counters.forEach(el => {
					const target = parseInt(el.dataset.count, 10)
					const step = Math.max(1, Math.round(target / 20))
					let current = 0
					const timer = setInterval(() => {
						current += step
						if (current >= target) {
							current = target
							clearInterval(timer)
						}
						el.textContent = current
					}, 40)
				})
			})
		},
		{ threshold: 0.4 },
	)
	ledgerObserver.observe(ledger)
}
