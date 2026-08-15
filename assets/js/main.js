document.body.classList.add('loading')
window.addEventListener('load', () => {
	setTimeout(() => {
		const p = document.querySelector('.preloader')
		if (p) p.classList.add('hide')
		document.body.classList.remove('loading')
	}, 420)
})
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
	if (burger) burger.classList.toggle('is-open')
	document.body.classList.toggle('nav-open', nav && nav.classList.contains('open'))
}
document.addEventListener('DOMContentLoaded', () => {
	const page = document.body.dataset.page
	document.querySelectorAll('[data-nav]').forEach(a => {
		if (a.dataset.nav === page) a.classList.add('active')
	})
	const observer = new IntersectionObserver(
		entries =>
			entries.forEach(e => {
				if (e.isIntersecting) e.target.classList.add('visible')
			}),
		{ threshold: 0.12 },
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
	document.querySelectorAll('.mobile-nav a').forEach(a => {
		a.addEventListener('click', () => {
			document.getElementById('mobileNav')?.classList.remove('open')
			document.querySelector('.burger')?.classList.remove('is-open')
			document.body.classList.remove('nav-open')
		})
	})
})


function initGalleryLightbox() {
	const lightbox = document.getElementById('lifeLightbox')
	if (!lightbox) return

	const img = document.getElementById('lightboxImg')
	const caption = document.getElementById('lightboxCaption')
	const closeBtn = document.getElementById('lightboxClose')
	const prevBtn = document.getElementById('lightboxPrev')
	const nextBtn = document.getElementById('lightboxNext')

	let currentGroup = []
	let currentIndex = 0

	function show(index) {
		currentIndex = (index + currentGroup.length) % currentGroup.length
		const item = currentGroup[currentIndex]
		const itemImg = item.querySelector('img')
		img.src = itemImg.src
		img.alt = itemImg.alt
		caption.textContent = itemImg.alt
	}

	function open(group, index) {
		currentGroup = group
		show(index)
		lightbox.classList.add('is-open')
		lightbox.setAttribute('aria-hidden', 'false')
		document.body.style.overflow = 'hidden'
	}

	function close() {
		lightbox.classList.remove('is-open')
		lightbox.setAttribute('aria-hidden', 'true')
		document.body.style.overflow = ''
	}

	const groupsMap = {}
	document.querySelectorAll('.gallery-item[data-lightbox-group]').forEach(item => {
		const key = item.dataset.lightboxGroup
		if (!groupsMap[key]) groupsMap[key] = []
		groupsMap[key].push(item)
	})
	Object.values(groupsMap).forEach(group => {
		group.forEach((item, index) => {
			item.addEventListener('click', () => open(group, index))
		})
	})

	closeBtn.addEventListener('click', close)
	nextBtn.addEventListener('click', () => show(currentIndex + 1))
	prevBtn.addEventListener('click', () => show(currentIndex - 1))
	lightbox.addEventListener('click', e => {
		if (e.target === lightbox) close()
	})
	document.addEventListener('keydown', e => {
		if (!lightbox.classList.contains('is-open')) return
		if (e.key === 'Escape') close()
		if (e.key === 'ArrowRight') show(currentIndex + 1)
		if (e.key === 'ArrowLeft') show(currentIndex - 1)
	})
}

function initSliders() {
  document.querySelectorAll('.slider').forEach(slider => {
    const slides = Array.from(slider.querySelectorAll('.slider__slide'));
    if (slides.length <= 1) return;
    
    const dotsWrap = slider.querySelector('.slider__dots');
    let dots = [];
    if (dotsWrap) {
      dotsWrap.innerHTML = ''; 
      dots = slides.map((_, i) => {
        const b = document.createElement('button');
        b.className = 'slider__dot' + (i === 0 ? ' is-active' : '');
        b.setAttribute('aria-label', `Слайд ${i + 1}`);
        b.addEventListener('click', () => restart(() => go(i)));
        dotsWrap.appendChild(b);
        return b;
      });
    }
    
    let current = 0;
    let timer = null;

    function go(i) {
      slides[current].classList.remove('is-active');
      if (dots[current]) dots[current].classList.remove('is-active');
      
      current = (i + slides.length) % slides.length;
      
      slides[current].classList.add('is-active');
      if (dots[current]) dots[current].classList.add('is-active');
    }

    function next() {
      go(current + 1);
    }
    function prev() {
      go(current - 1);
    }

    const nextBtn = slider.querySelector('.slider__arrow--next');
    const prevBtn = slider.querySelector('.slider__arrow--prev');
    if (nextBtn) nextBtn.addEventListener('click', () => restart(next));
    if (prevBtn) prevBtn.addEventListener('click', () => restart(prev));

    function restart(action) {
      action();
      if (timer) clearInterval(timer);
      timer = setInterval(next, 5500);
    }

    if (timer) clearInterval(timer);
    timer = setInterval(next, 5500);
  });
}

function initInstituteBlocks() {
	document.querySelectorAll('.institute-block__head').forEach(head => {
		head.addEventListener('click', () => {
			head.closest('.institute-block').classList.toggle('is-open')
		})
	})
	initKafedraSelect()
}

function initKafedraSelect() {
	const root = document.getElementById('kafedraSelect')
	if (!root) return

	const toggle = document.getElementById('kafedraSelectToggle')
	const panel = document.getElementById('kafedraSelectPanel')
	const input = document.getElementById('kafedraSelectInput')
	const valueEl = document.getElementById('kafedraSelectValue')
	const empty = document.getElementById('kafedraSelectEmpty')
	const groups = Array.from(panel.querySelectorAll('.kafedra-select__group'))

	function openPanel() {
		root.classList.add('is-open')
		toggle.setAttribute('aria-expanded', 'true')
		input.value = ''
		filterOptions('')
		setTimeout(() => input.focus(), 10)
	}
	function closePanel() {
		root.classList.remove('is-open')
		toggle.setAttribute('aria-expanded', 'false')
	}

	toggle.addEventListener('click', () => {
		root.classList.contains('is-open') ? closePanel() : openPanel()
	})
	document.addEventListener('click', e => {
		if (!root.contains(e.target)) closePanel()
	})
	document.addEventListener('keydown', e => {
		if (e.key === 'Escape') closePanel()
	})

	function filterOptions(query) {
		const q = query.trim().toLowerCase()
		let anyVisible = false
		groups.forEach(group => {
			let groupHasMatch = false
			group.querySelectorAll('.kafedra-select__option').forEach(opt => {
				const match = !q || opt.textContent.trim().toLowerCase().includes(q)
				opt.style.display = match ? '' : 'none'
				if (match) groupHasMatch = true
			})
			group.style.display = groupHasMatch ? '' : 'none'
			if (groupHasMatch) anyVisible = true
		})
		if (empty) empty.hidden = anyVisible
	}

	input.addEventListener('input', () => filterOptions(input.value))

	panel.querySelectorAll('.kafedra-select__option').forEach(opt => {
		opt.addEventListener('click', () => {
			const val = opt.textContent.trim()
			valueEl.textContent = val
			valueEl.classList.remove('is-placeholder')
			panel.querySelectorAll('.kafedra-select__option').forEach(o => o.classList.remove('is-active'))
			opt.classList.add('is-active')
			closePanel()
			highlightKafedra(val)
		})
	})

	function highlightKafedra(val) {
		document.querySelectorAll('.kafedra-list li').forEach(li => li.classList.remove('is-highlighted'))
		const match = Array.from(document.querySelectorAll('.kafedra-list li')).find(
			li => li.textContent.trim() === val,
		)
		if (!match) return
		const block = match.closest('.institute-block')
		if (block) block.classList.add('is-open')
		match.classList.add('is-highlighted')
		setTimeout(() => match.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
		setTimeout(() => match.classList.remove('is-highlighted'), 1700)
	}

	document.querySelectorAll('.kafedra-list li').forEach(li => {
		li.style.cursor = 'pointer'
		li.addEventListener('click', () => {
			const val = li.textContent.trim()
			valueEl.textContent = val
			valueEl.classList.remove('is-placeholder')
			highlightKafedra(val)
		})
	})
}

/* ===== Сторінка "Автори": флип-картки, фільтри, лічильники в шапці ===== */
function initAuthorsPage() {
	const grid = document.getElementById('authorsGrid')
	if (!grid) return

	const cards = grid.querySelectorAll('.author-card')
	cards.forEach(card => {
		card.setAttribute('tabindex', '0')
		card.addEventListener('click', () => card.classList.toggle('is-flipped'))
		card.addEventListener('keydown', e => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				card.classList.toggle('is-flipped')
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

/* ===== Contact form: validation (UA messages) + Formspree submit ===== */
function initContactForm() {
	const form = document.getElementById('contactForm')
	if (!form) return
	const statusEl = form.querySelector('[data-form-status]')
	const submitBtn = form.querySelector('[data-submit]')

	const patternMessages = {
		phone: 'Формат номера: +380XXXXXXXXX (12 цифр після коду країни)',
	}
	const typeMessages = {
		email: 'Введіть коректну email-адресу, наприклад student@example.com',
	}

	// Власні regex-перевірки: не покладаємось лише на нативний checkValidity(),
	// бо Safari (в т.ч. iOS) не завжди застосовує pattern до input[type="tel"],
	// а нативна email-валідація по специфікації занадто лояльна (пропускає адреси без домену верхнього рівня).
	const customValidators = {
		phone: value => /^\+380\d{9}$/.test(value.trim()),
		email: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()),
	}

	function fieldWrap(field) {
		return field.closest('.field')
	}

	function isFieldValid(field) {
		if (field.required && !field.value.trim()) return false
		const customCheck = customValidators[field.name]
		if (customCheck && field.value.trim() && !customCheck(field.value)) return false
		return field.checkValidity()
	}

	function showError(field) {
		const wrap = fieldWrap(field)
		if (!wrap) return
		const errEl = wrap.querySelector('.field-error')
		let msg = 'Перевірте правильність заповнення поля'
		const customCheck = customValidators[field.name]
		if (field.required && !field.value.trim()) {
			msg =
				field.tagName === 'SELECT'
					? 'Будь ласка, оберіть варіант зі списку'
					: "Це поле обов'язкове для заповнення"
		} else if (customCheck && field.value.trim() && !customCheck(field.value)) {
			msg = patternMessages[field.name] || typeMessages[field.type] || 'Некоректний формат значення'
		} else if (field.validity.valueMissing) {
			msg =
				field.tagName === 'SELECT'
					? 'Будь ласка, оберіть варіант зі списку'
					: "Це поле обов'язкове для заповнення"
		} else if (field.validity.typeMismatch) {
			msg = typeMessages[field.type] || 'Некоректне значення поля'
		} else if (field.validity.patternMismatch) {
			msg = patternMessages[field.name] || 'Некоректний формат значення'
		} else if (field.validity.tooShort) {
			msg = `Замало символів: мінімум ${field.minLength}`
		}
		if (errEl) errEl.textContent = msg
		wrap.classList.add('field--invalid')
	}

	function clearError(field) {
		const wrap = fieldWrap(field)
		if (!wrap) return
		wrap.classList.remove('field--invalid')
		const errEl = wrap.querySelector('.field-error')
		if (errEl) errEl.textContent = ''
	}

	form.querySelectorAll('input, select').forEach(field => {
		if (field.type === 'checkbox') {
			field.addEventListener('invalid', e => {
				e.preventDefault()
				statusEl.style.color = '#c0392b'
				statusEl.textContent = 'Потрібна згода на обробку персональних даних'
			})
			field.addEventListener('change', () => {
				if (field.checked && statusEl) statusEl.textContent = ''
			})
			return
		}
		field.addEventListener('invalid', e => {
			e.preventDefault()
			showError(field)
		})
		field.addEventListener('input', () => {
			if (isFieldValid(field)) {
				clearError(field)
			} else if (fieldWrap(field)?.classList.contains('field--invalid')) {
				showError(field)
			}
		})
		field.addEventListener('change', () => {
			if (isFieldValid(field)) clearError(field)
		})
		field.addEventListener('blur', () => {
			if (field.value.trim() && !isFieldValid(field)) showError(field)
		})
	})

	form.addEventListener('submit', async e => {
		e.preventDefault()
		let firstInvalid = null
		form.querySelectorAll('input, select').forEach(field => {
			if (field.name === '_gotcha') return
			if (!isFieldValid(field)) {
				if (field.type !== 'checkbox') showError(field)
				if (!firstInvalid) firstInvalid = field
			}
		})
		if (firstInvalid) {
			firstInvalid.focus()
			if (statusEl) {
				statusEl.style.color = '#c0392b'
				statusEl.textContent = 'Будь ласка, виправте помилки у формі вище'
			}
			return
		}
		if (form.querySelector('[name="_gotcha"]')?.value) return // honeypot triggered, silently stop

		if (statusEl) statusEl.textContent = ''
		const originalText = submitBtn.textContent
		submitBtn.disabled = true
		submitBtn.textContent = 'Надсилання...'

		try {
			const data = new FormData(form)
			const res = await fetch(form.action, {
				method: 'POST',
				body: data,
				headers: { Accept: 'application/json' },
			})
			if (res.ok) {
				form.reset()
				if (statusEl) {
					statusEl.style.color = '#2D9B70'
					statusEl.textContent =
						'Дякуємо! Повідомлення надіслано, ми відповімо найближчим часом.'
				}
			} else {
				if (statusEl) {
					statusEl.style.color = '#c0392b'
					statusEl.textContent =
						'Не вдалося надіслати форму. Спробуйте ще раз або напишіть на пошту напряму.'
				}
			}
		} catch (err) {
			if (statusEl) {
				statusEl.style.color = '#c0392b'
				statusEl.textContent =
					"Немає з'єднання із сервером. Перевірте інтернет і спробуйте ще раз."
			}
		} finally {
			submitBtn.disabled = false
			submitBtn.textContent = originalText
		}
	})
}
function demoSubmit(event, text = 'Дані збережено в демо-режимі.') {
	event.preventDefault()
	const note = event.currentTarget.querySelector('[data-note]')
	if (note) note.textContent = text
}
function demoLogin(event) {
	event.preventDefault()
	const btn = event.currentTarget.querySelector('button')
	btn.textContent = 'Вхід...'
	setTimeout(() => (window.location.href = 'personal-area.html'), 650)
}
function saveProfile(event) {
	event.preventDefault()
	const note = event.currentTarget.querySelector('[data-note]')
	if (note) {
		note.style.display = 'block'
		setTimeout(() => {
			note.style.display = 'none'
		}, 3000)
	}
}

function showDay(btn, day) {
	document
		.querySelectorAll('.day-tab')
		.forEach(t => t.classList.remove('active'))
	btn.classList.add('active')
	document
		.querySelectorAll('.schedule-list')
		.forEach(el => (el.style.display = 'none'))
	document.getElementById('day-' + day).style.display = 'grid'
}

function filterTasks(btn, filter) {
	document
		.querySelectorAll('.filter-btn')
		.forEach(b => b.classList.remove('active'))
	btn.classList.add('active')
	document.querySelectorAll('.task-card').forEach(card => {
		if (filter === 'all' || card.dataset.status === filter) {
			card.style.display = ''
		} else {
			card.style.display = 'none'
		}
	})
}
function toggleCheck(el) {
	el.classList.toggle('checked')
	const card = el.closest('.task-card')
	card.classList.toggle('done')
}
