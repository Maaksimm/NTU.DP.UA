/*
 * Кнопка «Увійти через Google» на login.html і register.html.
 * Працює, коли в chat-config.js вказано googleClientId (Web client ID провайдера Google з Firebase Console)
 * і увімкнено справжні акаунти Firebase. Інакше блок [data-google-signin] лишається прихованим.
 * Google Identity Services повертає ID-токен Google, який NTU_AUTH.signInWithGoogle обмінює на сесію Firebase.
 */
(function () {
	'use strict'
	var box = document.querySelector('[data-google-signin]')
	var cfg = window.NTU_CHAT || {}
	var A = window.NTU_AUTH
	if (!box || !cfg.googleClientId || !A || !A.remote) return

	var GIS_SRC = 'https://accounts.google.com/gsi/client'
	var slot = box.querySelector('[data-google-btn]')
	var form = box.closest('form')
	var status = form && form.querySelector('[data-form-status]')
	function t(s) { return typeof T === 'function' ? T(s) : s }
	function say(msg) { if (status) { status.textContent = msg; status.classList.remove('is-ok') } }

	// На реєстрації Google-кнопка активна лише після згоди з правилами чату (як і звичайна форма)
	var consent = form && form.elements.consent
	function consentOk() { return !consent || consent.checked }
	function syncConsent() {
		box.classList.toggle('is-locked', !consentOk())
		box.setAttribute('aria-disabled', consentOk() ? 'false' : 'true')
	}
	if (consent) {
		consent.addEventListener('change', function () { syncConsent(); if (consentOk()) say('') })
		// клік по заблокованій кнопці - пояснюємо, чого бракує
		box.addEventListener('click', function () {
			if (!consentOk()) { say(t('Потрібна згода з правилами чату.')); consent.focus() }
		})
		syncConsent()
	}

	function onCredential(resp) {
		if (!consentOk()) { say(t('Потрібна згода з правилами чату.')); if (consent) consent.focus(); return }
		var role = form && form.elements.role ? form.elements.role.value : 's'
		say(t('Зачекайте...'))
		A.signInWithGoogle(resp && resp.credential, role).then(function () {
			location.replace('personal-area.html')
		}).catch(function (err) {
			say(err && err.message ? err.message : t('Не вдалося увійти через Google. Спробуйте ще раз.'))
		})
	}

	function render() {
		var g = window.google && google.accounts && google.accounts.id
		if (!g) return say(t('Не вдалося завантажити вхід через Google. Перевірте інтернет.'))
		g.initialize({ client_id: cfg.googleClientId, callback: onCredential, ux_mode: 'popup', context: form && form.getAttribute('data-auth-form') === 'register' ? 'signup' : 'signin' })
		var dark = document.documentElement.getAttribute('data-theme') === 'dark'
		g.renderButton(slot, {
			type: 'standard', theme: dark ? 'filled_black' : 'outline', size: 'large', shape: 'pill',
			text: form && form.getAttribute('data-auth-form') === 'register' ? 'signup_with' : 'signin_with',
			locale: document.documentElement.lang === 'en' ? 'en' : 'uk',
			width: Math.min(400, Math.max(200, slot.clientWidth || 320))
		})
		box.hidden = false
	}

	box.hidden = false
	var s = document.createElement('script')
	s.src = GIS_SRC
	s.async = true
	s.defer = true
	s.onload = render
	s.onerror = function () { box.hidden = true }
	document.head.appendChild(s)
})()
