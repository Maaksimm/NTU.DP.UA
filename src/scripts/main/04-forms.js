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
	const NAME_RE = /^[A-Za-zЀ-ӿ][A-Za-zЀ-ӿ'’ʼ\-. ]*$/
	const LETTER_RE = /[A-Za-zЀ-ӿ]/g
	const today = () => {
		const d = new Date()
		return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
	}
	const customValidators = {
		phone: value => /^\+380\d{9}$/.test(value.trim()),
		email: value => isValidEmail(value),
		// Ім'я: літери (укр/лат), пробіл, апостроф, дефіс; щонайменше 2 літери
		name: value => NAME_RE.test(value.trim()) && (value.match(LETTER_RE) || []).length >= 2,
		// Текст має містити осмислені символи, а не лише крапки/пробіли/цифри
		message: value => (value.match(LETTER_RE) || []).length >= 3,
		topic: value => (value.match(LETTER_RE) || []).length >= 2,
		subject: value => (value.match(LETTER_RE) || []).length >= 2,
		// Дата події: коректна, не в минулому і не далі ніж через 2 роки
		date: value => {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
			const d = new Date(value + 'T00:00:00')
			if (isNaN(d)) return false
			const max = new Date()
			max.setFullYear(max.getFullYear() + 2)
			return value >= today() && d <= max
		},
	}
	const customMessages = {
		name: T("Ім'я може містити лише літери, пробіл, апостроф і дефіс (щонайменше 2 літери)"),
		message: T('Опишіть детальніше: текст має містити слова, а не лише символи'),
		topic: T('Вкажіть тему словами'),
		subject: T('Вкажіть назву предмета словами'),
		date: T('Оберіть дату не раніше сьогоднішньої (і не далі ніж через 2 роки)'),
	}
	const dateField = form.querySelector('input[type="date"]')
	if (dateField) {
		dateField.min = today()
		const max = new Date()
		max.setFullYear(max.getFullYear() + 2)
		dateField.max = max.toISOString().slice(0, 10)
	}

	function fieldWrap(field) {
		return field.closest('.field')
	}
	// Довжину рахуємо після обрізання пробілів, щоб «          » не проходило як 10 символів
	function trimmedLen(field) {
		return field.value.trim().replace(/\s+/g, ' ').length
	}
	function lengthProblem(field) {
		const v = field.value.trim()
		if (!v) return ''
		if (field.minLength > 0 && trimmedLen(field) < field.minLength) return 'short'
		if (field.maxLength > 0 && trimmedLen(field) > field.maxLength) return 'long'
		return ''
	}

	function isFieldValid(field) {
		if (field.type === 'checkbox') return !field.required || field.checked
		if (field.required && !field.value.trim()) return false
		if (lengthProblem(field)) return false
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
		const lenProblem = lengthProblem(field)
		if (field.required && !field.value.trim()) {
			msg =
				field.tagName === 'SELECT'
					? T('Будь ласка, оберіть варіант зі списку')
					: T("Це поле обов'язкове для заповнення")
		} else if (lenProblem === 'short') {
			msg = T('Замало символів: мінімум') + ' ' + field.minLength
		} else if (lenProblem === 'long') {
			msg = T('Забагато символів: максимум') + ' ' + field.maxLength
		} else if (customCheck && field.value.trim() && !customCheck(field.value)) {
			msg = patternMessages[field.name] || customMessages[field.name] || typeMessages[field.type] || T('Некоректний формат значення')
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
		if (submitBtn.disabled) return // захист від повторного надсилання
		let firstInvalid = null
		form.querySelectorAll('input, select, textarea').forEach(field => {
			if (field.name === '_gotcha' || field.type === 'hidden') return
			if (!isFieldValid(field)) {
				if (field.type !== 'checkbox') showError(field)
				if (!firstInvalid) firstInvalid = field
			}
		})
		if (firstInvalid) {
			firstInvalid.focus()
			if (statusEl) {
				statusEl.style.color = '#c0392b'
				statusEl.textContent =
					firstInvalid.type === 'checkbox'
						? T('Потрібна згода на обробку персональних даних')
						: T('Будь ласка, виправте помилки у формі вище')
			}
			return
		}
		// Нормалізуємо пробіли перед відправкою
		form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea').forEach(field => {
			if (field.name === '_gotcha') return
			field.value = field.tagName === 'TEXTAREA' ? field.value.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : field.value.trim().replace(/\s+/g, ' ')
		})
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
