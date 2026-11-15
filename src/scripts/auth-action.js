/* Обробник посилань із листів Firebase Authentication (auth-action.html):
 * ?mode=verifyEmail | verifyAndChangeEmail | recoverEmail | resetPassword & oobCode=...
 * Щоб листи вели сюди, у Firebase Console → Authentication → Templates → «Customize action URL»
 * вкажіть https://ntu.dp.ua/auth-action.html */
(function () {
	'use strict'
	var root = document.querySelector('[data-action-root]')
	if (!root) return
	var KEY = (window.NTU_CHAT || {}).apiKey || ''
	var q = new URLSearchParams(location.search)
	var mode = q.get('mode') || ''
	var code = q.get('oobCode') || ''
	function t(s) { return typeof T === 'function' ? T(s) : s }

	function show(name, email) {
		Array.prototype.forEach.call(root.querySelectorAll('[data-state]'), function (el) { el.hidden = el.getAttribute('data-state') !== name })
		if (email) Array.prototype.forEach.call(root.querySelectorAll('[data-email]'), function (b) { b.textContent = email })
		var st = root.querySelector('[data-state="' + name + '"]')
		var h = st && st.querySelector('.act__title')
		if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }) }
	}
	var ERR = {
		EXPIRED_OOB_CODE: ['Строк дії посилання минув', 'Посилання діє обмежений час. Надішліть новий лист і перейдіть за посиланням одразу.'],
		INVALID_OOB_CODE: ['Посилання вже використано або воно недійсне', 'Можливо, ви вже перейшли за ним раніше (тоді все гаразд) або в листі прийшов новіший лист. Спробуйте увійти.'],
		USER_DISABLED: ['Акаунт вимкнено', 'Зверніться до команди платформи через сторінку «Контакти».'],
		EMAIL_NOT_FOUND: ['Акаунт не знайдено', 'Можливо, його було видалено. Зареєструйтеся ще раз.'],
		USER_NOT_FOUND: ['Акаунт не знайдено', 'Можливо, його було видалено. Зареєструйтеся ще раз.'],
		EMAIL_EXISTS: ['Ця адреса вже зайнята', 'Іншим акаунтом уже використовується ця пошта.'],
		NETWORK: ['Немає з’єднання', 'Перевірте інтернет і оновіть сторінку.'],
		BAD_LINK: ['Неповне посилання', 'Відкрийте посилання з листа повністю. Якщо поштова програма розірвала його на кілька рядків, скопіюйте його цілком.']
	}
	function fail(codeName) {
		var e = ERR[codeName] || ['Не вдалося виконати дію', 'Спробуйте ще раз трохи пізніше.']
		root.querySelector('[data-err-title]').textContent = t(e[0])
		root.querySelector('[data-err-text]').textContent = t(e[1])
		var A = window.NTU_AUTH
		var canResend = (mode === 'verifyEmail') && A && A.user && A.user.verified === false && codeName !== 'INVALID_OOB_CODE'
		root.querySelector('[data-resend]').hidden = !canResend
		root.querySelector('[data-err-login]').hidden = !!(A && A.user)
		show('error')
	}
	function call(path, body) {
		return fetch('https://identitytoolkit.googleapis.com/v1/accounts:' + path + '?key=' + encodeURIComponent(KEY), {
			method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
		}).catch(function () { throw { code: 'NETWORK' } }).then(function (r) {
			return r.json().catch(function () { return {} }).then(function (d) {
				if (!r.ok) throw { code: String((d.error && d.error.message) || 'ERR').split(/[\s:]/)[0] }
				return d
			})
		})
	}

	var resend = root.querySelector('[data-resend]')
	resend.addEventListener('click', function () {
		var st = root.querySelector('[data-resend-status]')
		resend.disabled = true
		window.NTU_AUTH.resendVerification().then(function () {
			st.textContent = t('Новий лист надіслано. Перевірте пошту (і папку «Спам»).')
		}, function () {
			st.textContent = t('Не вдалося надіслати лист. Спробуйте пізніше.')
			resend.disabled = false
		})
	})

	// Повернення зі стандартної сторінки Firebase (кнопка «Продовжити»): дію вже виконано, показуємо результат
	var done = q.get('done') || ''
	if (!code && done) {
		var A0 = window.NTU_AUTH
		var em = A0 && A0.user ? A0.user.email : ''
		if (done === 'verifyEmail') {
			show('verified', em || t('вашу пошту'))
			if (A0 && A0.refreshVerified) A0.refreshVerified().catch(function () {})
			confetti()
		} else if (done === 'resetPassword') show('reset-done')
		else if (done === 'verifyAndChangeEmail') {
			show('email-changed', t('нову адресу'))
			// the old session still carries the old address: forget it, the user signs in with the new one.
			// No A.user check: this script runs before auth.js restores the session (DOMContentLoaded), so A.user is still empty here
			if (A0 && A0.signOut) try { A0.signOut() } catch (er) {}
		} else fail('BAD_LINK')
		return
	}
	if (!KEY || !code || !/^(verifyEmail|verifyAndChangeEmail|recoverEmail|resetPassword)$/.test(mode)) { fail('BAD_LINK'); return }

	if (mode === 'resetPassword') {
		call('resetPassword', { oobCode: code }).then(function (d) {
			show('reset', d.email)
			setupReset()
		}, function (e) { fail(e.code) })
		return
	}
	call('update', { oobCode: code }).then(function (d) {
		var A = window.NTU_AUTH
		if (mode === 'verifyEmail') {
			show('verified', d.email)
			if (A && A.refreshVerified) A.refreshVerified().catch(function () {})
			confetti()
		} else if (mode === 'verifyAndChangeEmail') {
			show('email-changed', d.email)
			// the old session still carries the old address: forget it, the user signs in with the new one.
			// No A.user check: this script runs before auth.js restores the session (DOMContentLoaded), so A.user is still empty here
			if (A && A.signOut) try { A.signOut() } catch (er) {}
		} else show('recovered', d.email)
	}, function (e) { fail(e.code) })

	function setupReset() {
		var form = root.querySelector('[data-state="reset"]')
		var p1 = form.querySelector('#act-pass'), p2 = form.querySelector('#act-pass2')
		var meter = form.querySelector('[data-meter]'), status = form.querySelector('[data-form-status]')
		form.querySelector('[data-show-pass]').addEventListener('change', function (e) {
			p1.type = p2.type = e.target.checked ? 'text' : 'password'
		})
		p1.addEventListener('input', function () {
			var v = p1.value, sc = 0
			if (v.length >= 6) sc++
			if (v.length >= 10) sc++
			if (/[a-zа-яіїєґ]/.test(v) && /[A-ZА-ЯІЇЄҐ]/.test(v)) sc++
			if (/\d/.test(v)) sc++
			if (/[^\wа-яіїєґА-ЯІЇЄҐ]/.test(v)) sc++
			meter.style.width = Math.min(100, sc * 20) + '%'
			meter.className = sc <= 1 ? 'is-weak' : sc <= 3 ? 'is-mid' : 'is-strong'
		})
		form.addEventListener('submit', function (e) {
			e.preventDefault()
			status.textContent = ''
			status.className = 'form-note-status'
			p1.removeAttribute('aria-invalid'); p2.removeAttribute('aria-invalid')
			function err(msg, field) {
				status.textContent = msg
				status.className = 'form-note-status is-error'
				if (field) { field.setAttribute('aria-invalid', 'true'); field.focus() }
			}
			if (p1.value.length < 6) return err(t('Пароль має містити щонайменше 6 символів.'), p1)
			if (p1.value !== p2.value) return err(t('Паролі не збігаються.'), p2)
			var btn = form.querySelector('button[type=submit]')
			btn.disabled = true
			call('resetPassword', { oobCode: code, newPassword: p1.value }).then(function () {
				show('reset-done')
			}, function (er) {
				btn.disabled = false
				if (er.code === 'WEAK_PASSWORD') return err(t('Пароль занадто простий. Спробуйте довший.'), p1)
				fail(er.code)
			})
		})
	}

	function confetti() {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
		var box = document.createElement('div')
		box.className = 'act-confetti'
		box.setAttribute('aria-hidden', 'true')
		var colors = ['#1a6fc4', '#4fc3f7', '#f0a500', '#4ade80', '#e5484d', '#ffd43b']
		for (var i = 0; i < 70; i++) {
			var p = document.createElement('i')
			p.style.left = Math.random() * 100 + '%'
			p.style.background = colors[i % colors.length]
			p.style.animationDelay = (Math.random() * 0.6) + 's'
			p.style.animationDuration = (1.8 + Math.random() * 1.4) + 's'
			p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px')
			p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg')
			box.appendChild(p)
		}
		document.body.appendChild(box)
		setTimeout(function () { box.remove() }, 4200)
	}
})()
