(function () {
	document.body.classList.add('loading')
	const t0 = performance.now(), MIN = 1700
	let loaded = false, shown = 0, finished = false
	window.addEventListener('load', () => (loaded = true))
	const bar = () => document.getElementById('plBar'), num = () => document.getElementById('plNum')
	function finish() {
		if (finished) return
		finished = true
		const p = document.querySelector('.preloader')
		setTimeout(() => {
			if (p) p.classList.add('hide')
			document.body.classList.remove('loading')
		}, 260)
	}
	function tick() {
		const el = performance.now() - t0
		const target = loaded && el >= MIN ? 100 : Math.min(88, (el / MIN) * 88)
		shown += (target - shown) * 0.1
		if (target === 100 && shown > 99.4) shown = 100
		if (bar()) bar().style.width = shown + '%'
		if (num()) num().textContent = Math.round(shown)
		if (shown >= 100) return finish()
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
	initResourceFilter()
	initMediaFilter()
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
		group.forEach(item => {
			item.addEventListener('click', () => {
				const visible = group.filter(i => !i.hidden)
				open(visible, visible.indexOf(item))
			})
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
        b.setAttribute('aria-label', T('Слайд') + ' ' + (i + 1));
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
// Сувора перевірка email: локальна частина, домен з крапкою, TLD від 2 літер, без подвійних крапок
const EMAIL_RE = /^(?!.*\.\.)[A-Za-z0-9](?:[A-Za-z0-9._%+\-]{0,62}[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/
function isValidEmail(value) {
	const v = String(value).trim()
	return v.length <= 254 && EMAIL_RE.test(v)
}
function initContactForm() {
	const form = document.getElementById('contactForm')
	if (!form) return
	const statusEl = form.querySelector('[data-form-status]')
	const submitBtn = form.querySelector('[data-submit]')

	const patternMessages = {
		phone: T('Формат номера: +380XXXXXXXXX (12 цифр після коду країни)'),
	}
	const typeMessages = {
		email: T('Введіть коректну email-адресу, наприклад student@example.com'),
	}

	// Власні regex-перевірки: не покладаємось лише на нативний checkValidity(),
	// бо Safari (в т.ч. iOS) не завжди застосовує pattern до input[type="tel"],
	// а нативна email-валідація по специфікації занадто лояльна (пропускає адреси без домену верхнього рівня).
	const customValidators = {
		phone: value => /^\+380\d{9}$/.test(value.trim()),
		email: value => isValidEmail(value),
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
		let msg = T('Перевірте правильність заповнення поля')
		const customCheck = customValidators[field.name]
		if (field.required && !field.value.trim()) {
			msg =
				field.tagName === 'SELECT'
					? T('Будь ласка, оберіть варіант зі списку')
					: T("Це поле обов'язкове для заповнення")
		} else if (customCheck && field.value.trim() && !customCheck(field.value)) {
			msg = patternMessages[field.name] || typeMessages[field.type] || T('Некоректний формат значення')
		} else if (field.validity.valueMissing) {
			msg =
				field.tagName === 'SELECT'
					? T('Будь ласка, оберіть варіант зі списку')
					: T("Це поле обов'язкове для заповнення")
		} else if (field.validity.typeMismatch) {
			msg = typeMessages[field.type] || T('Некоректне значення поля')
		} else if (field.validity.patternMismatch) {
			msg = patternMessages[field.name] || T('Некоректний формат значення')
		} else if (field.validity.tooShort) {
			msg = T('Замало символів: мінімум') + ' ' + field.minLength
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

	form.querySelectorAll('input, select, textarea').forEach(field => {
		if (field.type === 'checkbox') {
			field.addEventListener('invalid', e => {
				e.preventDefault()
				statusEl.style.color = '#c0392b'
				statusEl.textContent = T('Потрібна згода на обробку персональних даних')
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
		form.querySelectorAll('input, select, textarea').forEach(field => {
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
				statusEl.textContent = T('Будь ласка, виправте помилки у формі вище')
			}
			return
		}
		if (form.querySelector('[name="_gotcha"]')?.value) return // honeypot triggered, silently stop

		if (statusEl) statusEl.textContent = ''
		const originalText = submitBtn.textContent
		submitBtn.disabled = true
		submitBtn.textContent = T('Надсилання...')

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
						T('Дякуємо! Повідомлення надіслано, ми відповімо найближчим часом.')
				}
			} else {
				if (statusEl) {
					statusEl.style.color = '#c0392b'
					statusEl.textContent =
						T('Не вдалося надіслати форму. Спробуйте ще раз або напишіть на пошту напряму.')
				}
			}
		} catch (err) {
			if (statusEl) {
				statusEl.style.color = '#c0392b'
				statusEl.textContent =
					T("Немає з'єднання із сервером. Перевірте інтернет і спробуйте ще раз.")
			}
		} finally {
			submitBtn.disabled = false
			submitBtn.textContent = originalText
		}
	})
}
function demoEmailError(form) {
	const bad = [...form.querySelectorAll('input[type="email"]')].find(i => !isValidEmail(i.value))
	if (!bad) return false
	bad.focus()
	let note = form.querySelector('[data-note]')
	if (!note) {
		note = document.createElement('p')
		note.setAttribute('data-note', '')
		form.appendChild(note)
	}
	note.style.display = 'block'
	note.style.color = '#c0392b'
	note.textContent = T('Введіть коректну email-адресу, наприклад student@example.com')
	return true
}
function demoSubmit(event, text = T('Дані збережено в демо-режимі.')) {
	event.preventDefault()
	if (demoEmailError(event.currentTarget)) return
	const note = event.currentTarget.querySelector('[data-note]')
	if (note) {
		note.style.color = ''
		note.textContent = text
	}
}
function demoLogin(event) {
	event.preventDefault()
	if (demoEmailError(event.currentTarget)) return
	const btn = event.currentTarget.querySelector('button')
	btn.textContent = T('Вхід...')
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

function T(s) {
	return (document.documentElement.lang === 'en' && window.I18N_EN && window.I18N_EN[s]) || s
}
/* ===== Theme switcher + language switcher (UA / EN) ===== */
const I18N = { orig: new WeakMap(), attrs: ['alt', 'title', 'placeholder', 'aria-label'] }
function i18nNorm(s) { return s.replace(/\s+/g, ' ').trim() }
function applyLang(lang) {
	const dict = window.I18N_EN || {}
	const en = lang === 'en'
	document.documentElement.lang = en ? 'en' : 'uk'
	const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
		acceptNode: n => (n.parentElement && /^(SCRIPT|STYLE|NOSCRIPT)$/.test(n.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
	})
	let n
	while ((n = w.nextNode())) {
		if (!I18N.orig.has(n)) I18N.orig.set(n, n.nodeValue)
		const base = I18N.orig.get(n), key = i18nNorm(base)
		if (!key) continue
		const tr = en && dict[key]
		n.nodeValue = tr ? base.match(/^\s*/)[0] + tr + base.match(/\s*$/)[0] : base
	}
	document.querySelectorAll('[alt],[title],[placeholder],[aria-label]').forEach(el => {
		I18N.attrs.forEach(a => {
			if (!el.hasAttribute(a)) return
			const k = 'i18nOrig' + a.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())
			if (!(k in el.dataset)) el.dataset[k] = el.getAttribute(a)
			const t = en && dict[i18nNorm(el.dataset[k])]
			el.setAttribute(a, t || el.dataset[k])
		})
	})
	if (!document.documentElement.dataset.titleUk) document.documentElement.dataset.titleUk = document.title
	const tt = en && dict[i18nNorm(document.documentElement.dataset.titleUk)]
	document.title = tt || document.documentElement.dataset.titleUk
	const md = document.querySelector('meta[name="description"]')
	if (md) {
		if (!md.dataset.uk) md.dataset.uk = md.content
		md.content = (en && dict[i18nNorm(md.dataset.uk)]) || md.dataset.uk
	}
	document.querySelectorAll('[data-lang-toggle]').forEach(b => b.setAttribute('aria-checked', en ? 'true' : 'false'))
	const tb = document.querySelector('[data-theme-toggle]')
	if (tb) tb.setAttribute('aria-label', en ? 'Toggle theme' : T('Змінити тему'))
}
function setTheme(t) {
	document.documentElement.setAttribute('data-theme', t)
	try { sessionStorage.setItem('ntu-theme', t); localStorage.removeItem('ntu-theme') } catch (e) {}
}
document.addEventListener('DOMContentLoaded', () => {
	document.querySelectorAll('[data-theme-toggle]').forEach(b =>
		b.addEventListener('click', () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')))
	document.querySelectorAll('[data-lang-toggle]').forEach(b =>
		b.addEventListener('click', () => {
			const next = document.documentElement.lang === 'en' ? 'uk' : 'en'
			try { localStorage.setItem('ntu-lang', next) } catch (e) {}
			applyLang(next)
		}))
	let l = 'uk'
	try { l = localStorage.getItem('ntu-lang') || 'uk' } catch (e) {}
	applyLang(l)
})

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


/* ===== Materials: search + type filter ===== */
function initResourceFilter() {
	const grid = document.getElementById('resGrid')
	if (!grid) return
	const cards = Array.from(grid.querySelectorAll('.res-card'))
	const search = document.getElementById('resSearch')
	const empty = document.getElementById('resEmpty')
	const chips = document.querySelectorAll('.res-chip')
	let type = 'all'
	function apply() {
		const q = search.value.trim().toLowerCase()
		let shown = 0
		cards.forEach(c => {
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
