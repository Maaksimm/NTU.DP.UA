/*
 * Акаунти користувачів платформи World Students.
 *  - Якщо в assets/js/chat-config.js вказано apiKey і databaseURL - справжні акаунти Firebase Authentication
 *    (email + пароль), профіль (ім'я, аватар) зберігається в Realtime Database за адресою users/{uid}.
 *  - Інакше - демо-режим: акаунти лише в цьому браузері (localStorage), без перевірки на сервері.
 */
(function () {
	'use strict'
	var cfg = window.NTU_CHAT || {}
	var DB = (cfg.databaseURL || '').replace(/\/+$/, '')
	var KEY = cfg.apiKey || ''
	var REMOTE = !!(DB && KEY)
	var LS_SESSION = 'ntu-auth'
	var LS_USERS = 'ntu-demo-users'

	function t(s) { return typeof T === 'function' ? T(s) : s }
	function lsGet(k) { try { return localStorage.getItem(k) } catch (e) { return null } }
	function lsSet(k, v) { try { localStorage.setItem(k, v) } catch (e) {} }
	function lsDel(k) { try { localStorage.removeItem(k) } catch (e) {} }
	function json(r) { return r.json().catch(function () { return {} }) }

	var listeners = []
	var state = { user: null, remote: REMOTE }

	function emit() {
		listeners.slice().forEach(function (f) { try { f(state.user) } catch (e) {} })
		renderHeader()
	}

	/* ---------- ERROR TEXTS ---------- */
	var ERR = {
		EMAIL_EXISTS: 'Акаунт з такою адресою вже існує. Спробуйте увійти.',
		INVALID_EMAIL: 'Введіть коректну email-адресу.',
		WEAK_PASSWORD: 'Пароль занадто простий: потрібно щонайменше 6 символів.',
		INVALID_LOGIN_CREDENTIALS: 'Невірна пошта або пароль.',
		INVALID_PASSWORD: 'Невірна пошта або пароль.',
		EMAIL_NOT_FOUND: 'Невірна пошта або пароль.',
		USER_DISABLED: 'Цей акаунт вимкнено.',
		TOO_MANY_ATTEMPTS_TRY_LATER: 'Забагато спроб. Спробуйте трохи пізніше.',
		OPERATION_NOT_ALLOWED: 'Вхід за поштою ще не ввімкнено в налаштуваннях проєкту.',
		NETWORK: 'Немає зв’язку з сервером. Перевірте інтернет і спробуйте ще раз.',
		TOO_MANY_ATTEMPTS: 'Забагато спроб. Спробуйте трохи пізніше.',
		PERMISSION: 'Сервер не прийняв зміни. Вийдіть і увійдіть знову або спробуйте пізніше.'
	}
	function fail(code) {
		var key = String(code || '').split(' ')[0].split(':')[0]
		var e = new Error(t(ERR[key] || 'Не вдалося виконати дію. Спробуйте ще раз.'))
		e.code = key
		return e
	}
	function post(url, body) {
		return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
			.catch(function () { throw fail('NETWORK') })
			.then(function (r) {
				return json(r).then(function (d) {
					if (!r.ok) throw fail((d.error && d.error.message) || 'ERR')
					return d
				})
			})
	}

	/* ---------- REMOTE (Firebase) ---------- */
	var session = null // {uid, email, idToken, refreshToken, exp}
	function saveSession() { if (session) lsSet(LS_SESSION, JSON.stringify(session)); else lsDel(LS_SESSION) }
	function idp(path, body) { return post('https://identitytoolkit.googleapis.com/v1/accounts:' + path + '?key=' + encodeURIComponent(KEY), body) }

	function setSessionFrom(d) {
		session = {
			uid: d.localId || d.user_id,
			email: d.email || (session && session.email) || '',
			idToken: d.idToken || d.id_token,
			refreshToken: d.refreshToken || d.refresh_token,
			exp: Date.now() + (parseInt(d.expiresIn || d.expires_in, 10) || 3600) * 1000 - 60000
		}
		saveSession()
	}
	function jwtPayload(tk) {
		try {
			var b = tk.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
			b += '==='.slice((b.length + 3) % 4)
			return JSON.parse(decodeURIComponent(escape(atob(b))))
		} catch (e) { return {} }
	}
	function token(force) {
		if (!REMOTE) return Promise.resolve(null)
		if (!session) return Promise.resolve(null)
		if (!force && Date.now() < session.exp) return Promise.resolve(session.idToken)
		return post('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(KEY), { grant_type: 'refresh_token', refresh_token: session.refreshToken })
			.then(function (d) { setSessionFrom(d); return session.idToken })
			.catch(function (e) { if (e.code !== 'NETWORK') { session = null; saveSession(); state.user = null; emit() } throw e })
	}
	function dbCall(method, path, body, needAuth) {
		var tk = needAuth ? token() : Promise.resolve(null)
		return tk.then(function (tok) {
			var url = DB + '/' + path + '.json' + (tok ? '?auth=' + encodeURIComponent(tok) : '')
			return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
		}).then(function (r) {
			if (!r.ok) throw fail(r.status === 401 || r.status === 403 ? 'PERMISSION' : 'ERR')
			return r.json()
		})
	}
	function profileGet(uid) {
		return fetch(DB + '/users/' + encodeURIComponent(uid) + '.json').then(function (r) { return r.ok ? r.json() : null }).catch(function () { return null })
	}
	function profilePut(uid, data) {
		return dbCall('PATCH', 'users/' + encodeURIComponent(uid), data, true)
	}
	function loadRemoteUser() {
		return profileGet(session.uid).then(function (p) {
			p = p || {}
			state.user = { uid: session.uid, email: session.email, name: p.n || (session.email || '').split('@')[0], avatar: p.a || '', bg: '', verified: !!jwtPayload(session.idToken).email_verified }
			return dbCall('GET', 'profiles/' + encodeURIComponent(session.uid), undefined, true).then(function (x) {
				if (x && x.bg) state.user.bg = x.bg
			}).catch(function () {})
		})
	}

	/* ---------- LOCAL DEMO ---------- */
	function users() { try { return JSON.parse(lsGet(LS_USERS) || '{}') } catch (e) { return {} } }
	function saveUsers(u) { lsSet(LS_USERS, JSON.stringify(u)) }
	function hash(s) {
		if (window.crypto && crypto.subtle && window.TextEncoder) {
			return crypto.subtle.digest('SHA-256', new TextEncoder().encode('ntu:' + s)).then(function (b) {
				return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2) }).join('')
			})
		}
		var h = 5381
		for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
		return Promise.resolve('x' + h)
	}

	/* ---------- PUBLIC API ---------- */
	function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) }
	var api = {
		remote: REMOTE,
		get user() { return state.user },
		onChange: function (f) { listeners.push(f); f(state.user) },
		token: token,
		profile: function (uid) {
			if (REMOTE) return profileGet(uid)
			var u = users()
			for (var k in u) if (u[k].uid === uid) return Promise.resolve({ n: u[k].name, a: u[k].avatar || '' })
			return Promise.resolve(null)
		},
		signUp: function (name, email, pass) {
			name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40)
			email = String(email || '').trim().toLowerCase()
			if (name.length < 2) return Promise.reject(new Error(t('Вкажіть ім’я (щонайменше 2 символи).')))
			if (!validEmail(email)) return Promise.reject(fail('INVALID_EMAIL'))
			if (String(pass || '').length < 6) return Promise.reject(fail('WEAK_PASSWORD'))
			if (REMOTE) {
				return idp('signUp', { email: email, password: pass, returnSecureToken: true }).then(function (d) {
					setSessionFrom(d)
					return profilePut(session.uid, { n: name, ts: Date.now() })
				}).then(function () {
					return idp('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: session.idToken }).catch(function () {})
				}).then(function () { return loadRemoteUser() }).then(function () { startPresence(); emit() })
			}
			var u = users()
			if (u[email]) return Promise.reject(fail('EMAIL_EXISTS'))
			return hash(pass).then(function (h) {
				var uid = 'l' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
				u[email] = { uid: uid, name: name, pass: h, avatar: '' }
				saveUsers(u)
				lsSet(LS_SESSION, JSON.stringify({ local: true, email: email }))
				state.user = { uid: uid, email: email, name: name, avatar: '', verified: true }
				emit()
			})
		},
		signIn: function (email, pass) {
			email = String(email || '').trim().toLowerCase()
			if (!validEmail(email)) return Promise.reject(fail('INVALID_EMAIL'))
			if (REMOTE) {
				return idp('signInWithPassword', { email: email, password: pass, returnSecureToken: true })
					.then(function (d) { setSessionFrom(d); return loadRemoteUser() }).then(function () { startPresence(); emit() })
			}
			var u = users()
			var rec = u[email]
			return hash(pass).then(function (h) {
				if (!rec || rec.pass !== h) throw fail('INVALID_LOGIN_CREDENTIALS')
				lsSet(LS_SESSION, JSON.stringify({ local: true, email: email }))
				state.user = { uid: rec.uid, email: email, name: rec.name, avatar: rec.avatar || '', bg: rec.bg || '', verified: true }
				emit()
			})
		},
		signOut: function () {
			session = null
			lsDel(LS_SESSION)
			state.user = null
			emit()
		},
		resetPassword: function (email) {
			email = String(email || '').trim().toLowerCase()
			if (!validEmail(email)) return Promise.reject(fail('INVALID_EMAIL'))
			if (!REMOTE) return Promise.reject(new Error(t('У демо-режимі відновлення пароля недоступне.')))
			return idp('sendOobCode', { requestType: 'PASSWORD_RESET', email: email })
		},
		resendVerification: function () {
			if (!REMOTE || !session) return Promise.reject(new Error('no user'))
			return token().then(function (tk) { return idp('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: tk }) })
		},
		refreshVerified: function () {
			if (!REMOTE || !session) return Promise.resolve(false)
			return token(true).then(function (tk) {
				var v = !!jwtPayload(tk).email_verified
				if (state.user) state.user.verified = v
				emit()
				return v
			})
		},
		db: function (method, path, body, needAuth) { return REMOTE ? dbCall(method, path, body, needAuth !== false) : Promise.reject(fail('ERR')) },
		getExtra: function (uid) { return REMOTE ? dbCall('GET', 'profiles/' + encodeURIComponent(uid), undefined, true) : Promise.resolve(null) },
		saveExtra: function (data) {
			if (!REMOTE || !state.user) return Promise.reject(fail('ERR'))
			return dbCall('PATCH', 'profiles/' + encodeURIComponent(state.user.uid), data, true)
		},
		setBackground: function (value) {
			if (!state.user) return Promise.reject(new Error('no user'))
			if (REMOTE) {
				return dbCall('PATCH', 'profiles/' + encodeURIComponent(state.user.uid), { bg: value || '' }, true).then(function () {
					state.user.bg = value || ''
					emit()
				})
			}
			var u = users()
			if (u[state.user.email]) { u[state.user.email].bg = value || ''; saveUsers(u) }
			state.user.bg = value || ''
			emit()
			return Promise.resolve()
		},
		setAvatar: function (dataUrl) {
			if (!state.user) return Promise.reject(new Error('no user'))
			if (REMOTE) {
				return profilePut(state.user.uid, { n: state.user.name, a: dataUrl, ts: Date.now() }).then(function () {
					state.user.avatar = dataUrl
					emit()
				})
			}
			var u = users()
			if (u[state.user.email]) { u[state.user.email].avatar = dataUrl; saveUsers(u) }
			state.user.avatar = dataUrl
			emit()
			return Promise.resolve()
		}
	}
	window.NTU_AUTH = api

	/* ---------- avatar helper: center-crop to 128x128 JPEG ---------- */
	api.fileToAvatar = function (file) {
		return new Promise(function (res, rej) {
			if (!file || !/^image\//.test(file.type)) return rej(new Error(t('Оберіть файл зображення (JPG, PNG або WebP).')))
			if (file.size > 8 * 1024 * 1024) return rej(new Error(t('Файл завеликий (максимум 8 МБ).')))
			var url = URL.createObjectURL(file)
			var img = new Image()
			img.onload = function () {
				var S = 128, c = document.createElement('canvas')
				c.width = c.height = S
				var side = Math.min(img.width, img.height)
				c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S)
				URL.revokeObjectURL(url)
				res(c.toDataURL('image/jpeg', 0.82))
			}
			img.onerror = function () { URL.revokeObjectURL(url); rej(new Error(t('Не вдалося прочитати зображення.'))) }
			img.src = url
		})
	}


	/* ---------- profile background ---------- */
	api.BG_PRESETS = {
		p1: { css: 'linear-gradient(120deg,#1a6fc4,#4fc3f7)', dark: true },
		p2: { css: 'linear-gradient(120deg,#0b2545,#1a6fc4)', dark: true },
		p3: { css: 'linear-gradient(120deg,#7c3aed,#ec4899)', dark: true },
		p4: { css: 'linear-gradient(120deg,#047857,#34d399)', dark: true },
		p5: { css: 'linear-gradient(120deg,#f59e0b,#ef4444)', dark: true },
		p6: { css: 'linear-gradient(120deg,#e0f2fe,#fef9c3)', dark: false },
		p7: { css: 'linear-gradient(120deg,#fce7f3,#ede9fe)', dark: false },
		p8: { css: 'linear-gradient(120deg,#dcfce7,#e0f2fe)', dark: false }
	}
	api.applyBackground = function (node, bg) {
		if (!node) return
		node.classList.remove('has-bg', 'is-dark-bg', 'has-bg-img')
		node.style.background = ''
		node.style.backgroundImage = ''
		if (!bg) return
		var pr = api.BG_PRESETS[bg]
		if (pr) {
			node.style.background = pr.css
			node.classList.add('has-bg')
			if (pr.dark) node.classList.add('is-dark-bg')
		} else if (/^data:image\/(jpeg|png|webp);base64,/.test(bg)) {
			node.style.backgroundImage = 'url("' + bg + '")'
			node.classList.add('has-bg', 'has-bg-img')
		}
	}
	api.fileToCover = function (file) {
		return new Promise(function (res, rej) {
			if (!file || !/^image\//.test(file.type)) return rej(new Error(t('Оберіть файл зображення (JPG, PNG або WebP).')))
			if (file.size > 12 * 1024 * 1024) return rej(new Error(t('Файл завеликий (максимум 8 МБ).')))
			var url = URL.createObjectURL(file)
			var img = new Image()
			img.onload = function () {
				var W = 960, H = 320, c = document.createElement('canvas')
				c.width = W; c.height = H
				var k = Math.max(W / img.width, H / img.height)
				var w = W / k, h = H / k
				c.getContext('2d').drawImage(img, (img.width - w) / 2, (img.height - h) / 2, w, h, 0, 0, W, H)
				URL.revokeObjectURL(url)
				var q = 0.72, out = c.toDataURL('image/jpeg', q)
				while (out.length > 110000 && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q) }
				res(out)
			}
			img.onerror = function () { URL.revokeObjectURL(url); rej(new Error(t('Не вдалося прочитати зображення.'))) }
			img.src = url
		})
	}

	/* ---------- keep "verified" fresh after the user clicks the link in the mail ---------- */
	var verifyTries = 0
	function watchVerified() {
		if (!REMOTE || !state.user || state.user.verified !== false) return
		var iv = setInterval(function () {
			if (!state.user || state.user.verified !== false || ++verifyTries > 40) return clearInterval(iv)
			api.refreshVerified().catch(function () {})
		}, 20000)
		api.refreshVerified().catch(function () {})
	}
	api.onChange(function () { if (!api._watching && state.user && state.user.verified === false && REMOTE) { api._watching = true; watchVerified() } })

	/* ---------- presence (online status) ---------- */
	var presenceTimer = null
	function beat() {
		if (!REMOTE || !state.user || document.hidden) return
		dbCall('PATCH', 'users/' + encodeURIComponent(state.user.uid), { s: { '.sv': 'timestamp' } }, true).catch(function () {})
	}
	function startPresence() {
		if (presenceTimer || !REMOTE) return
		beat()
		presenceTimer = setInterval(beat, 60000)
		document.addEventListener('visibilitychange', function () { if (!document.hidden) beat() })
	}
	api.isOnline = function (seen) { return !!seen && Date.now() - seen < 150000 }

	/* ---------- header button ---------- */
	function initials(n) { return (n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0] }).join('').toUpperCase() }
	api.initials = initials
	function renderHeader() {
		var a = document.querySelector('[data-acct]')
		if (!a) return
		var u = state.user
		a.textContent = ''
		if (u) {
			a.href = 'personal-area.html'
			a.classList.add('is-in')
			a.setAttribute('aria-label', t('Особистий кабінет') + ': ' + u.name)
			var av = document.createElement(u.avatar ? 'img' : 'span')
			av.className = 'acct-btn__avatar'
			if (u.avatar) { av.src = u.avatar; av.alt = '' } else av.textContent = initials(u.name)
			var nm = document.createElement('span')
			nm.className = 'acct-btn__label'
			nm.textContent = u.name.split(' ')[0]
			a.appendChild(av)
			a.appendChild(nm)
		} else {
			a.href = 'login.html'
			a.classList.remove('is-in')
			a.setAttribute('aria-label', t('Увійти'))
			a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg><span class="acct-btn__label">' + t('Увійти') + '</span>'
		}
	}

	/* ---------- restore session ---------- */
	function restore() {
		var raw = lsGet(LS_SESSION)
		if (!raw) return emit()
		var s
		try { s = JSON.parse(raw) } catch (e) { return emit() }
		if (REMOTE && s.refreshToken) {
			session = s
			return token().then(loadRemoteUser).then(function () { startPresence(); emit() }, function () { emit() })
		}
		if (!REMOTE && s.local) {
			var rec = users()[s.email]
			if (rec) state.user = { uid: rec.uid, email: s.email, name: rec.name, avatar: rec.avatar || '', bg: rec.bg || '', verified: true }
		}
		emit()
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restore)
	else restore()
})()


/* ---------- page logic: login / register / forgot / personal area ---------- */
document.addEventListener('DOMContentLoaded', function () {
	var A = window.NTU_AUTH
	function t(s) { return typeof T === 'function' ? T(s) : s }
	function say(el, msg, ok) {
		if (!el) return
		el.style.color = ok ? '#2D9B70' : '#c0392b'
		el.textContent = msg
	}

	document.querySelectorAll('[data-auth-form]').forEach(function (form) {
		var kind = form.getAttribute('data-auth-form')
		var status = form.querySelector('[data-form-status]')
		var btn = form.querySelector('button[type=submit]')
		if (kind !== 'forgot') A.onChange(function (u) { if (u) location.replace('personal-area.html') })
		form.addEventListener('submit', function (e) {
			e.preventDefault()
			say(status, '')
			var f = form.elements
			if (kind === 'register' && !f.consent.checked) return say(status, t('Потрібна згода з правилами чату.'))
			var label = btn.textContent
			btn.disabled = true
			btn.textContent = t('Зачекайте...')
			var job
			if (kind === 'login') job = A.signIn(f.email.value, f.password.value)
			else if (kind === 'register') job = A.signUp(f.name.value, f.email.value, f.password.value)
			else job = A.resetPassword(f.email.value).then(function () {
				say(status, t('Якщо така пошта зареєстрована, лист для відновлення вже надіслано.'), true)
			})
			job.then(function () {
				if (kind !== 'forgot') location.replace('personal-area.html')
			}).catch(function (err) {
				say(status, err && err.message ? err.message : t('Не вдалося виконати дію. Спробуйте ще раз.'))
			}).then(function () { btn.disabled = false; btn.textContent = label })
		})
	})

	var guest = document.querySelector('[data-account-guest]')
	var userBox = document.querySelector('[data-account-user]')
	if (guest && userBox) {
		var img = document.querySelector('[data-account-avatar]')
		var ph = document.querySelector('[data-account-initials]')
		var status = document.querySelector('[data-account-status]')
		var file = document.getElementById('avatarFile')
		var pick = document.querySelector('[data-avatar-pick]')
		var rm = document.querySelector('[data-avatar-remove]')
		A.onChange(function (u) {
			guest.hidden = !!u
			userBox.hidden = !u
			if (!u) return
			document.querySelector('[data-account-name]').textContent = u.name
			document.querySelector('[data-account-email]').textContent = u.email
			ph.textContent = A.initials(u.name)
			img.hidden = !u.avatar
			ph.hidden = !!u.avatar
			if (u.avatar) img.src = u.avatar
			rm.hidden = !u.avatar
		})
		pick.addEventListener('click', function () { file.click() })
		file.addEventListener('change', function () {
			var f = file.files && file.files[0]
			if (!f) return
			say(status, t('Завантаження...'), true)
			A.fileToAvatar(f).then(function (d) { return A.setAvatar(d) }).then(function () {
				say(status, t('Фото профілю оновлено.'), true)
			}).catch(function (err) { say(status, err.message || t('Не вдалося зберегти фото.')) })
			file.value = ''
		})
		rm.addEventListener('click', function () {
			A.setAvatar('').then(function () { say(status, t('Фото видалено.'), true) }, function () { say(status, t('Не вдалося зберегти фото.')) })
		})
		document.querySelector('[data-signout]').addEventListener('click', function () {
			A.signOut()
			location.href = 'index.html'
		})
	}
})
