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
		PERMISSION: 'Сервер не прийняв зміни. Вийдіть і увійдіть знову або спробуйте пізніше.',
		CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'З міркувань безпеки вийдіть і увійдіть знову, а потім повторіть зміну пошти.',
		SAME_EMAIL: 'Це ваша поточна пошта.',
		NEED_CONFIRMATION: 'Ця пошта вже зареєстрована з паролем. Увійдіть за поштою й паролем.',
		INVALID_IDP_RESPONSE: 'Google не підтвердив вхід. Спробуйте ще раз.'
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
	var signOuts = 0 // bumped by signOut(); a token refresh started before it must not restore the session
	function saveSession() { if (session) lsSet(LS_SESSION, JSON.stringify(session)); else lsDel(LS_SESSION) }
	function idp(path, body) { return post('https://identitytoolkit.googleapis.com/v1/accounts:' + path + '?key=' + encodeURIComponent(KEY), body) }
	// Листи акаунта. Спершу - наш сервер (api/mail.php): лист у дизайні сайту, посилання веде прямо на auth-action.html.
	// Якщо сервер ще не налаштований (503 NOT_CONFIGURED) або недоступний - стандартний лист Firebase українською
	// з кнопкою «Продовжити» на auth-action.html (шаблони Firebase для цього проєкту змінювати не можна).
	var ACTION_PAGE = 'https://ntu.dp.ua/auth-action.html'
	var PROD = /^https:\/\/(www\.)?ntu\.dp\.ua$/.test(location.origin)
	var MAIL_TYPE = { VERIFY_EMAIL: 'verify', VERIFY_AND_CHANGE_EMAIL: 'change', PASSWORD_RESET: 'reset' }
	function sendOwnMail(body) {
		var tk = body.idToken
		return fetch('/api/mail.php', {
			method: 'POST',
			headers: tk ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk } : { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: MAIL_TYPE[body.requestType], email: body.email, newEmail: body.newEmail })
		}).then(function (r) {
			return json(r).then(function (d) {
				if (r.ok) return d
				if (r.status === 429) throw fail('TOO_MANY_ATTEMPTS')
				if (r.status === 400 && d && /^(INVALID_EMAIL|EMAIL_EXISTS)$/.test(d.error)) throw fail(d.error)
				return null // не налаштовано / тимчасова помилка - спробуємо стандартний лист Firebase
			})
		}, function () { return null })
	}
	function sendOob(body, done) {
		if (!PROD) return sendFirebaseOob(body, done)
		return sendOwnMail(body).then(function (d) { return d || sendFirebaseOob(body, done) })
	}
	function sendFirebaseOob(body, done) {
		if (PROD) body.continueUrl = ACTION_PAGE + '?done=' + done
		return fetch('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=' + encodeURIComponent(KEY), {
			method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Firebase-Locale': 'uk' }, body: JSON.stringify(body)
		}).catch(function () { throw fail('NETWORK') }).then(function (r) {
			return json(r).then(function (d) {
				if (!r.ok) throw fail((d.error && d.error.message) || 'ERR')
				return d
			})
		})
	}

	function setSessionFrom(d) {
		// the token refresh answer has no email: read it from the new ID token, so an email changed
		// via the confirmation link shows up in the profile instead of the old address
		var tk = d.idToken || d.id_token
		session = {
			uid: d.localId || d.user_id,
			email: d.email || jwtPayload(tk).email || (session && session.email) || '',
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
		var g0 = signOuts
		return post('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(KEY), { grant_type: 'refresh_token', refresh_token: session.refreshToken })
			// signed out while the refresh was in flight: do not bring the old session back
			.then(function (d) { if (signOuts !== g0) throw { code: 'SIGNED_OUT' }; setSessionFrom(d); return session.idToken })
			.catch(function (e) { if (e.code !== 'NETWORK' && e.code !== 'SIGNED_OUT') { session = null; saveSession(); state.user = null; emit() } throw e })
	}
	function dbCall(method, path, body, needAuth) {
		var tk = needAuth ? token() : Promise.resolve(null)
		return tk.then(function (tok) {
			// шлях може містити параметри запиту: 'dm/x/msgs?orderBy=%22$key%22&limitToLast=100'
			var qi = path.indexOf('?'), q = qi >= 0 ? path.slice(qi + 1) : ''
			if (qi >= 0) path = path.slice(0, qi)
			var params = [q, tok ? 'auth=' + encodeURIComponent(tok) : ''].filter(Boolean).join('&')
			var url = DB + '/' + path + '.json' + (params ? '?' + params : '')
			return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
		}).then(function (r) {
			if (!r.ok) throw fail(r.status === 401 || r.status === 403 ? 'PERMISSION' : 'ERR')
			return r.json()
		})
	}
	/* Запит на роль викладача: roleRequests/{uid} = {n, subj, ts[, st: 'no']}; роль 't' у профілі ставить лише адмін */
	// Не більше REQ_MAX запитів за 24 години: лічильник roleReqQuota/{uid} = {c, w: початок вікна, ts} пишеться
	// разом із запитом одним PATCH від кореня, а правила бази перевіряють і рахунок, і що обидва записи прийшли разом.
	var REQ_MAX = 2, REQ_WINDOW = 24 * 60 * 60 * 1000
	function requestTeacher(uid, name, subj) {
		var id = encodeURIComponent(uid)
		return dbCall('GET', 'roleReqQuota/' + id, undefined, true).catch(function () { return null }).then(function (q) {
			var fresh = !q || typeof q.w !== 'number' || Date.now() - q.w >= REQ_WINDOW
			if (!fresh && q.c >= REQ_MAX) {
				var at = new Date(q.w + REQ_WINDOW)
				var hm = ('0' + at.getHours()).slice(-2) + ':' + ('0' + at.getMinutes()).slice(-2)
				var day = at.toDateString() === new Date().toDateString() ? t('сьогодні') : t('завтра')
				throw new Error(t('Запит на роль викладача можна надіслати не більше 2 разів на добу. Наступний - ') + day + ' ' + t('о') + ' ' + hm + '.')
			}
			var now = { '.sv': 'timestamp' }
			var patch = {}
			patch['roleRequests/' + uid] = { n: String(name || '').slice(0, 40), subj: String(subj || '').slice(0, 80), ts: Date.now() }
			patch['roleReqQuota/' + uid] = fresh ? { c: 1, w: now, ts: now } : { c: q.c + 1, w: q.w, ts: now }
			return dbCall('PATCH', '', patch, true)
		})
	}
	function profileGet(uid) {
		return fetch(DB + '/users/' + encodeURIComponent(uid) + '.json').then(function (r) { return r.ok ? r.json() : null }).catch(function () { return null })
	}
	function profilePut(uid, data) {
		return dbCall('PATCH', 'users/' + encodeURIComponent(uid), data, true)
	}
	/* Персональні дані («Про мене»): стать, вік, факультет, курс (курс - лише для учнів) */
	function pickInfo(x) { x = x || {}; return { g: x.g || '', age: x.age || null, c: x.c || '', f: x.f || '' } }
	function missingInfo(u) {
		if (!REMOTE || !u || !u.info) return []
		var m = []
		if (!u.info.g) m.push('g')
		if (!u.info.age) m.push('age')
		if (u.role !== 't' && !u.info.c) m.push('c')
		if (!u.info.f) m.push('f')
		return m
	}
	function loadRemoteUser() {
		if (!session) return Promise.reject(fail('ERR'))
		return profileGet(session.uid).then(function (p) {
			if (!session) throw fail('ERR')
			p = p || {}
			state.user = { uid: session.uid, email: session.email, name: p.n || (session.email || '').split('@')[0], avatar: p.a || '', bg: '', verified: !!jwtPayload(session.idToken).email_verified }
			return dbCall('GET', 'profiles/' + encodeURIComponent(session.uid), undefined, true).then(function (x) {
				if (x && x.bg) state.user.bg = x.bg
				if (x && x.bgd) state.user.bgd = x.bgd
				state.user.hideOnline = !!(x && x.hide)
				state.user.role = x && x.role === 't' ? 't' : 's'
				state.user.subj = (x && x.subj) || ''
				state.user.info = pickInfo(x)
			}).catch(function () {}).then(function () {
				return dbCall('GET', 'roleRequests/' + encodeURIComponent(session.uid), undefined, true)
					.then(function (r) { if (state.user) state.user.roleReq = r && r.ts ? { subj: r.subj || '', rejected: r.st === 'no' } : null }, function () {})
			})
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
	// Та сама сувора перевірка, що й у формах зворотного зв'язку (main.js)
	var EMAIL_RE = /^(?!.*\.\.)[A-Za-z0-9](?:[A-Za-z0-9._%+\-]{0,62}[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/
	function validEmail(e) { return e.length <= 254 && EMAIL_RE.test(e) }
	var api = {
		remote: REMOTE,
		validEmail: validEmail,
		get user() { return state.user },
		onChange: function (f) { listeners.push(f); f(state.user) },
		token: token,
		profile: function (uid) {
			if (REMOTE) return profileGet(uid)
			var u = users()
			for (var k in u) if (u[k].uid === uid) return Promise.resolve({ n: u[k].name, a: u[k].avatar || '' })
			return Promise.resolve(null)
		},
		signUp: function (name, email, pass, role, subj) {
			role = role === 't' ? 't' : 's'
			subj = role === 't' ? String(subj || '').trim().slice(0, 80) : ''
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
					return dbCall('PATCH', 'profiles/' + encodeURIComponent(session.uid), { role: 's', subj: '' }, true).catch(function () {})
				}).then(function () {
					return role === 't' ? requestTeacher(session.uid, name, subj).catch(function () {}) : null
				}).then(function () {
					return sendOob({ requestType: 'VERIFY_EMAIL', idToken: session.idToken }, 'verifyEmail').catch(function () {})
				}).then(function () { return loadRemoteUser() }).then(function () { startPresence(); emit() })
			}
			var u = users()
			if (u[email]) return Promise.reject(fail('EMAIL_EXISTS'))
			return hash(pass).then(function (h) {
				var uid = 'l' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
				u[email] = { uid: uid, name: name, pass: h, avatar: '', role: role, subj: subj }
				saveUsers(u)
				lsSet(LS_SESSION, JSON.stringify({ local: true, email: email }))
				state.user = { uid: uid, email: email, name: name, avatar: '', verified: true, role: role, subj: subj }
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
				state.user = { uid: rec.uid, email: email, name: rec.name, avatar: rec.avatar || '', bg: rec.bg || '', bgd: rec.bgd || '', verified: true, role: rec.role === 't' ? 't' : 's', subj: rec.subj || '' }
				emit()
			})
		},
		// Вхід / реєстрація через Google: googleIdToken - credential від Google Identity Services (google-signin.js).
		// Новому користувачу створюється профіль users/{uid} з ім'ям з Google; role - 's' або 't' (зі сторінки реєстрації).
		signInWithGoogle: function (googleIdToken, role) {
			if (!REMOTE) return Promise.reject(new Error(t('У демо-режимі вхід через Google недоступний.')))
			if (!googleIdToken) return Promise.reject(fail('ERR'))
			role = role === 't' ? 't' : 's'
			return idp('signInWithIdp', {
				postBody: 'id_token=' + encodeURIComponent(googleIdToken) + '&providerId=google.com',
				requestUri: location.origin + '/',
				returnSecureToken: true
			}).then(function (d) {
				if (!d.idToken) throw fail('NEED_CONFIRMATION')
				setSessionFrom(d)
				return profileGet(session.uid).then(function (p) {
					if (p && p.n) return null
					var name = String(d.displayName || d.fullName || (d.email || '').split('@')[0]).trim().replace(/\s+/g, ' ').slice(0, 40)
					if (name.length < 2) name = 'Student'
					return profilePut(session.uid, { n: name, ts: Date.now() }).then(function () {
						return dbCall('PATCH', 'profiles/' + encodeURIComponent(session.uid), { role: 's', subj: '' }, true).catch(function () {})
							.then(function () { return role === 't' ? requestTeacher(session.uid, name, '').catch(function () {}) : null })
					})
				})
			}).then(function () { return loadRemoteUser() }).then(function () { startPresence(); emit() })
		},
		signOut: function () {
			signOuts++
			session = null
			lsDel(LS_SESSION)
			state.user = null
			emit()
		},
		resetPassword: function (email) {
			email = String(email || '').trim().toLowerCase()
			if (!validEmail(email)) return Promise.reject(fail('INVALID_EMAIL'))
			if (!REMOTE) return Promise.reject(new Error(t('У демо-режимі відновлення пароля недоступне.')))
			return sendOob({ requestType: 'PASSWORD_RESET', email: email }, 'resetPassword')
		},
		resendVerification: function () {
			if (!REMOTE || !session) return Promise.reject(new Error('no user'))
			return token().then(function (tk) { return sendOob({ requestType: 'VERIFY_EMAIL', idToken: tk }, 'verifyEmail') })
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
			return dbCall('PATCH', 'profiles/' + encodeURIComponent(state.user.uid), data, true).then(function (r) {
				if (state.user) {
					var i = state.user.info || pickInfo(null)
					;['g', 'age', 'c', 'f'].forEach(function (k) { if (k in data) i[k] = data[k] || (k === 'age' ? null : '') })
					state.user.info = i
					emit()
				}
				return r
			})
		},
		/* незаповнені поля персональних даних: 'g' стать, 'age' вік, 'c' курс, 'f' факультет */
		missingInfo: function () { return missingInfo(state.user) },
		setHideOnline: function (hide) {
			if (!state.user) return Promise.reject(new Error('no user'))
			if (REMOTE) {
				var uid = encodeURIComponent(state.user.uid)
				return dbCall('PATCH', 'profiles/' + uid, { hide: !!hide }, true).then(function () {
					return dbCall('PATCH', 'users/' + uid, { s: hide ? 0 : { '.sv': 'timestamp' } }, true)
				}).then(function () {
					// приховали - час активності йде в presence/{uid}; показали знову - прибираємо його
					return (hide ? dbCall('PUT', 'presence/' + uid, { '.sv': 'timestamp' }, true) : dbCall('DELETE', 'presence/' + uid, undefined, true)).catch(function () {})
				}).then(function () {
					state.user.hideOnline = !!hide
					emit()
				})
			}
			var u = users()
			if (u[state.user.email]) { u[state.user.email].hide = !!hide; saveUsers(u) }
			state.user.hideOnline = !!hide
			emit()
			return Promise.resolve()
		},
		/* Фон профілю окремо для світлої (bg) і темної (bgd) теми. mode: 'light' | 'dark' */
		setBackground: function (value, mode) {
			if (!state.user) return Promise.reject(new Error('no user'))
			var key = mode === 'dark' ? 'bgd' : 'bg', patch = {}
			patch[key] = value || ''
			if (REMOTE) {
				return dbCall('PATCH', 'profiles/' + encodeURIComponent(state.user.uid), patch, true).then(function () {
					state.user[key] = value || ''
					emit()
				})
			}
			var u = users()
			if (u[state.user.email]) { u[state.user.email][key] = value || ''; saveUsers(u) }
			state.user[key] = value || ''
			emit()
			return Promise.resolve()
		},
		/* Зміна нікнейма (імені, яке бачать у чаті та списку користувачів) */
		setName: function (name) {
			if (!state.user) return Promise.reject(new Error('no user'))
			name = String(name || '').trim().replace(/\s+/g, ' ')
			var err = api.nameError(name)
			if (err) return Promise.reject(new Error(err))
			if (REMOTE) {
				return profilePut(state.user.uid, { n: name, ts: Date.now() }).then(function () {
					state.user.name = name
					emit()
				})
			}
			var u = users()
			if (u[state.user.email]) { u[state.user.email].name = name; saveUsers(u) }
			state.user.name = name
			emit()
			return Promise.resolve()
		},
		/* Перевірка нікнейма: ті самі правила, що й при реєстрації. Повертає текст помилки або ''. */
		nameError: function (nm) {
			var L = /[A-Za-zЀ-ӿ]/g
			if (nm.length < 2 || nm.length > 40 || !/^[A-Za-zЀ-ӿ][A-Za-zЀ-ӿ0-9'’ʼ\-. _]*$/.test(nm) || (nm.match(L) || []).length < 2)
				return t('Ім’я: від 2 до 40 символів, має починатися з літери (дозволені літери, цифри, пробіл, апостроф, дефіс).')
			if (window.NTU_isProfane && window.NTU_isProfane(nm)) return t('Ім’я містить неприпустимі слова.')
			return ''
		},
		/* Зміна пошти. Firebase: повторний вхід поточним паролем, потім лист підтвердження на нову адресу;
		   пошта зміниться після переходу за посиланням (після цього потрібно увійти з новою адресою). */
		changeEmail: function (newEmail, password) {
			if (!state.user) return Promise.reject(new Error('no user'))
			newEmail = String(newEmail || '').trim().toLowerCase()
			if (!validEmail(newEmail)) return Promise.reject(fail('INVALID_EMAIL'))
			if (newEmail === String(state.user.email || '').toLowerCase()) return Promise.reject(fail('SAME_EMAIL'))
			if (!password) return Promise.reject(new Error(t('Введіть поточний пароль, щоб підтвердити зміну.')))
			if (REMOTE) {
				return idp('signInWithPassword', { email: state.user.email, password: password, returnSecureToken: true })
					.then(function (d) { setSessionFrom(d) })
					.then(function () { return sendOob({ requestType: 'VERIFY_AND_CHANGE_EMAIL', idToken: session.idToken, newEmail: newEmail }, 'verifyAndChangeEmail') })
					.then(function () { return { pending: true } })
			}
			var u = users()
			var rec = u[state.user.email]
			if (u[newEmail]) return Promise.reject(fail('EMAIL_EXISTS'))
			return hash(password).then(function (h) {
				if (!rec || rec.pass !== h) throw fail('INVALID_LOGIN_CREDENTIALS')
				delete u[state.user.email]
				u[newEmail] = rec
				saveUsers(u)
				lsSet(LS_SESSION, JSON.stringify({ local: true, email: newEmail }))
				state.user.email = newEmail
				emit()
				return { pending: false }
			})
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

	/* ---------- статуси команди платформи: «Автор» / «Розробник» - лише акаунти зі списку staff у chat-config.js ---------- */
	var STAFF = (window.NTU_CHAT && window.NTU_CHAT.staff) || {}
	var STAFF_INFO = {
		author: { icon: '★', label: 'Автор', title: 'Автор платформи World Students' },
		dev: { icon: '</>', label: 'Розробник', title: 'Розробник платформи World Students' }
	}
	// {cls, text, title} або null
	api.staff = function (uid) {
		var k = uid && Object.prototype.hasOwnProperty.call(STAFF, uid) ? STAFF[uid] : null
		var i = k && STAFF_INFO[k]
		return i ? { kind: k, text: i.icon + ' ' + t(i.label), title: t(i.title) } : null
	}
	api.isAuthor = function (uid) { return !!api.staff(uid) }
	api.authorBadge = function (uid) {
		var s = api.staff(uid)
		if (!s) return null
		var b = document.createElement('span')
		b.className = 'role-badge role-badge--author role-badge--' + s.kind
		b.textContent = s.text
		b.title = s.title
		return b
	}

	/* ---------- суперадміни: admins/{uid} = true у Realtime Database (додається лише в консолі Firebase).
	   Правила дають їм модерацію: навчальні матеріали, видалення повідомлень чату, сторіз, історій, відгуків. ---------- */
	var adminCache = {}
	api.isAdmin = function (uid) {
		uid = uid || (state.user && state.user.uid)
		if (!uid || !REMOTE || !state.user || state.user.uid !== uid) return Promise.resolve(false)
		if (!adminCache[uid]) {
			adminCache[uid] = dbCall('GET', 'admins/' + encodeURIComponent(uid), undefined, true)
				.then(function (v) { return v === true }, function () { delete adminCache[uid]; return false })
		}
		return adminCache[uid]
	}

	/* ---------- локальні вподобання (налаштування → Приватність і сповіщення) ---------- */
	var PREF_DEF = { typing: true, sound: false, notify: false }
	api.pref = function (k) {
		var v = lsGet('ntu-p-' + k)
		return v == null ? !!PREF_DEF[k] : v === '1'
	}
	api.setPref = function (k, on) { lsSet('ntu-p-' + k, on ? '1' : '0') }
	var audioCtx = null
	// короткий сигнал нового повідомлення (Web Audio, без файлів)
	api.ding = function () {
		try {
			var C = window.AudioContext || window.webkitAudioContext
			if (!C) return
			audioCtx = audioCtx || new C()
			var o = audioCtx.createOscillator(), g = audioCtx.createGain(), now = audioCtx.currentTime
			o.type = 'sine'
			o.frequency.setValueAtTime(880, now)
			o.frequency.exponentialRampToValueAtTime(1320, now + 0.09)
			g.gain.setValueAtTime(0.0001, now)
			g.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
			g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)
			o.connect(g)
			g.connect(audioCtx.destination)
			o.start(now)
			o.stop(now + 0.3)
		} catch (e) {}
	}
	// новий вхідний лист: звук та/або сповіщення браузера згідно з налаштуваннями
	api.alertNew = function (title, body, quietIfVisible) {
		var visible = !document.hidden
		if (api.pref('sound') && !(quietIfVisible && visible)) api.ding()
		if (api.pref('notify') && !visible && 'Notification' in window && Notification.permission === 'granted') {
			try {
				var n = new Notification(title, { body: String(body || '').slice(0, 120), icon: 'assets/img/favicon-192.png', tag: 'ntu-msg' })
				n.onclick = function () { window.focus(); n.close() }
			} catch (e) {}
		}
	}

	/* ---------- avatar helper: center-crop to 128x128 JPEG ---------- */
	/* Предмети, які може обрати викладач */
	api.SUBJECTS = ['Вища математика', 'Фізика', 'Хімія', 'Програмування', 'Комп’ютерні науки', 'Інформаційні технології', 'Кібербезпека',
		'Електротехніка', 'Електроенергетика', 'Автоматизація', 'Машинобудування', 'Гірництво', 'Геологія', 'Екологія', 'Будівництво', 'Архітектура',
		'Геодезія', 'Економіка', 'Фінанси', 'Менеджмент', 'Маркетинг', 'Право', 'Філософія', 'Історія України', 'Українська мова', 'Іноземна мова',
		'Психологія', 'Фізичне виховання', 'Інше']
	/* Роль у кабінеті: 's' - учень, 't' - викладач (з предметом) */
	api.setRole = function (role, subj) {
		if (!state.user) return Promise.reject(new Error('no user'))
		role = role === 't' ? 't' : 's'
		subj = role === 't' ? String(subj || '').trim().slice(0, 80) : ''
		if (role === 't' && !subj) return Promise.reject(new Error(t('Оберіть предмет, який ви викладаєте.')))
		if (REMOTE) {
			var uid = state.user.uid
			// стати викладачем можна лише через підтвердження адміністратора; вже підтверджений викладач може змінити предмет
			if (role === 't' && state.user.role !== 't') {
				return requestTeacher(uid, state.user.name, subj).then(function () {
					state.user.roleReq = { subj: subj, rejected: false }
					emit()
					return { pending: true }
				})
			}
			return dbCall('PATCH', 'profiles/' + encodeURIComponent(uid), { role: role, subj: subj }, true).then(function () {
				state.user.role = role
				state.user.subj = subj
				if (role === 's' && state.user.roleReq) {
					state.user.roleReq = null
					return dbCall('DELETE', 'roleRequests/' + encodeURIComponent(uid), undefined, true).catch(function () {})
				}
			}).then(function () { emit(); return { pending: false } })
		}
		var u = users()
		if (u[state.user.email]) { u[state.user.email].role = role; u[state.user.email].subj = subj; saveUsers(u) }
		state.user.role = role
		state.user.subj = subj
		emit()
		return Promise.resolve()
	}

	/* Завантаження файлу на сервер сайту (api/upload.php) частинами по 1,5 МБ.
	   kind: 'chat' (до 10 МБ: PDF, зображення, документи), 'lesson' (PDF до 20 МБ), 'material' (PDF/документи до 20 МБ) або 'story' (фото, відео, аудіо до 25 МБ). Повертає {url, name, size, type}. */
	var UP_ERR = {
		TOO_LARGE: 'Файл завеликий.', TYPE: 'Такий тип файлу не підтримується.', NOT_VERIFIED: 'Підтвердьте пошту, щоб надсилати файли.',
		TOKEN: 'Сесія застаріла. Оновіть сторінку або увійдіть знову.', EXPIRED: 'Сесія застаріла. Оновіть сторінку або увійдіть знову.',
		NOT_CONFIGURED: 'Завантаження файлів працює лише на сайті ntu.dp.ua.'
	}
	api.upload = function (file, kind, onProgress) {
		if (!REMOTE || !state.user) return Promise.reject(new Error(t('Надсилати файли можна лише після підключення сервера.')))
		var CH = 1536 * 1024
		var total = Math.max(1, Math.ceil(file.size / CH))
		var id = Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(16)), function (x) { return ('0' + x.toString(16)).slice(-2) }).join('')
		var i = 0
		function next(tk) {
			var fd = new FormData()
			fd.append('kind', /^(lesson|story|material)$/.test(kind) ? kind : 'chat')
			fd.append('upload_id', id)
			fd.append('index', String(i))
			fd.append('total', String(total))
			fd.append('size', String(file.size))
			fd.append('name', file.name)
			fd.append('file', file.slice(i * CH, (i + 1) * CH), 'part')
			return fetch('api/upload.php', { method: 'POST', headers: { Authorization: 'Bearer ' + tk }, body: fd })
				.catch(function () { throw fail('NETWORK') })
				.then(function (r) {
					return r.json().catch(function () { return null }).then(function (d) {
						// не JSON (сервер без PHP, помилка хостингу) - зупиняємось, а не шлемо частини без кінця
						if (!d) throw new Error(t('Сервер завантаження недоступний. Спробуйте пізніше.'))
						if (!r.ok) throw new Error(t(UP_ERR[d.error] || 'Не вдалося завантажити файл.'))
						i++
						if (onProgress) onProgress(Math.round(i / total * 100))
						if (d.done) return d
						if (i >= total) throw new Error(t('Не вдалося завантажити файл.'))
						return next(tk)
					})
				})
		}
		return token().then(next)
	}

	/* Дії суперадміна з ролями (правила бази пропускають їх лише для admins/{uid}) */
	api.roleRequests = function () { return dbCall('GET', 'roleRequests', undefined, true) }
	api.teachers = function () { return dbCall('GET', 'profiles?orderBy=%22role%22&equalTo=%22t%22', undefined, true) }
	api.approveTeacher = function (uid, subj) {
		var p = 'profiles/' + encodeURIComponent(uid)
		return dbCall('PUT', p + '/subj', String(subj || '').slice(0, 80), true)
			.then(function () { return dbCall('PUT', p + '/role', 't', true) })
			.then(function () { return dbCall('DELETE', 'roleRequests/' + encodeURIComponent(uid), undefined, true) })
	}
	api.rejectTeacher = function (uid) { return dbCall('PUT', 'roleRequests/' + encodeURIComponent(uid) + '/st', 'no', true) }
	api.demoteTeacher = function (uid) { return dbCall('PUT', 'profiles/' + encodeURIComponent(uid) + '/role', 's', true) }

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



	/* ---------- журнал дій суперадмінів: adminLog/{id} = {a, n, act, t?, d?, ts} ----------
	   act: role.approve | role.reject | role.remove | chat.delete | story.delete | tale.delete | material.remove |
	        report.delete | report.dismiss (material.approve/reject і files.clean пише сервер).
	   Помилка запису журналу не зриває саму дію - лише потрапляє в консоль. */
	api.adminLog = function (act, target, detail) {
		if (!REMOTE || !state.user) return Promise.resolve()
		var row = { a: state.user.uid, n: String(state.user.name || '').slice(0, 40), act: String(act).slice(0, 40), ts: { '.sv': 'timestamp' } }
		if (target) row.t = String(target).slice(0, 64)
		if (detail) row.d = String(detail).replace(/\s+/g, ' ').trim().slice(0, 300)
		return dbCall('POST', 'adminLog', row, true).catch(function (e) { if (window.console) console.warn('[adminLog]', e && e.message) })
	}

	/* ---------- скарги: reports/{kind_id}/{uid} = {k, id, o, x, r, ts} (одна скарга від людини на один запис) ---------- */
	api.REPORT_REASONS = ['Образи або цькування', 'Спам або реклама', 'Неприйнятний вміст', 'Неправдива інформація', 'Інше']
	api.report = function (kind, id, owner, excerpt) {
		if (!state.user) { location.href = 'login.html'; return Promise.resolve(false) }
		if (!REMOTE) return Promise.reject(new Error(t('Скарги працюють лише на сайті ntu.dp.ua.')))
		if (state.user.verified === false) return Promise.reject(new Error(t('Підтвердьте пошту, щоб надсилати скарги.')))
		if (owner && owner === state.user.uid) return Promise.resolve(false)
		return reportDialog().then(function (reason) {
			if (!reason) return false
			var row = { k: kind, id: String(id), ts: { '.sv': 'timestamp' }, r: reason.slice(0, 300) }
			if (owner) row.o = String(owner).slice(0, 64)
			if (excerpt) row.x = String(excerpt).replace(/\s+/g, ' ').trim().slice(0, 200)
			return dbCall('PUT', 'reports/' + encodeURIComponent(kind + '_' + id) + '/' + encodeURIComponent(state.user.uid), row, true)
				.then(function () { return true }, function (e) {
					// правило !data.exists(): повторна скарга на той самий запис
					throw new Error(e && e.code === 'PERMISSION' ? t('Ви вже надіслали скаргу на цей запис.') : t('Не вдалося надіслати скаргу.'))
				})
		})
	}
	function reportDialog() {
		return new Promise(function (resolve) {
			var prev = document.activeElement
			var m = document.createElement('div')
			m.className = 'modal modal--confirm'
			m.setAttribute('role', 'dialog')
			m.setAttribute('aria-modal', 'true')
			m.setAttribute('aria-label', t('Скарга'))
			var box = document.createElement('form')
			box.className = 'modal__box modal__box--sm report-dlg'
			var h = document.createElement('p')
			h.className = 'confirm__text'
			h.textContent = t('Що не так із цим записом?')
			box.appendChild(h)
			var name = 'rep' + Date.now()
			api.REPORT_REASONS.forEach(function (r, i) {
				var l = document.createElement('label')
				l.className = 'report-dlg__opt'
				var inp = document.createElement('input')
				inp.type = 'radio'
				inp.name = name
				inp.value = r
				if (!i) inp.checked = true
				l.appendChild(inp)
				l.appendChild(document.createTextNode(' ' + t(r)))
				box.appendChild(l)
			})
			var note = document.createElement('textarea')
			note.className = 'report-dlg__note'
			note.rows = 2
			note.maxLength = 200
			note.placeholder = t('Коментар (необов’язково)')
			note.setAttribute('aria-label', t('Коментар до скарги'))
			box.appendChild(note)
			var row = document.createElement('div')
			row.className = 'confirm__row'
			var no = document.createElement('button')
			no.type = 'button'
			no.className = 'btn btn-secondary'
			no.textContent = t('Скасувати')
			var yes = document.createElement('button')
			yes.type = 'submit'
			yes.className = 'btn btn-primary'
			yes.textContent = t('Надіслати скаргу')
			row.appendChild(no)
			row.appendChild(yes)
			box.appendChild(row)
			m.appendChild(box)
			document.body.appendChild(m)
			function done(v) {
				document.removeEventListener('keydown', key, true)
				m.remove()
				if (prev && prev.focus) prev.focus()
				resolve(v)
			}
			function key(e) { if (e.key === 'Escape') { e.stopPropagation(); done(null) } }
			document.addEventListener('keydown', key, true)
			no.addEventListener('click', function () { done(null) })
			m.addEventListener('click', function (e) { if (e.target === m) done(null) })
			box.addEventListener('submit', function (e) {
				e.preventDefault()
				var picked = box.querySelector('input[name="' + name + '"]:checked')
				var r = picked ? picked.value : 'Інше'
				var c = note.value.trim()
				done(c ? r + ': ' + c : r)
			})
			box.querySelector('input').focus()
		})
	}

	/* ---------- confirmation dialog ---------- */
	api.confirm = function (message, okLabel, cancelLabel) {
		return new Promise(function (resolve) {
			var prev = document.activeElement
			var m = document.createElement('div')
			m.className = 'modal modal--confirm'
			m.setAttribute('role', 'alertdialog')
			m.setAttribute('aria-modal', 'true')
			var box = document.createElement('div')
			box.className = 'modal__box modal__box--sm'
			var p = document.createElement('p')
			p.className = 'confirm__text'
			p.textContent = message
			var row = document.createElement('div')
			row.className = 'confirm__row'
			var no = document.createElement('button')
			no.type = 'button'
			no.className = 'btn btn-secondary'
			no.textContent = cancelLabel || t('Скасувати')
			var yes = document.createElement('button')
			yes.type = 'button'
			yes.className = 'btn btn-primary confirm__ok'
			yes.textContent = okLabel || t('Так')
			row.appendChild(no)
			row.appendChild(yes)
			box.appendChild(p)
			box.appendChild(row)
			m.appendChild(box)
			document.body.appendChild(m)
			document.body.style.overflow = 'hidden'
			function done(v) {
				document.removeEventListener('keydown', key, true)
				m.remove()
				document.body.style.overflow = ''
				if (prev && prev.focus) prev.focus()
				resolve(v)
			}
			function key(e) {
				if (e.key === 'Escape') { e.stopPropagation(); done(false) }
			}
			document.addEventListener('keydown', key, true)
			no.addEventListener('click', function () { done(false) })
			yes.addEventListener('click', function () { done(true) })
			m.addEventListener('click', function (e) { if (e.target === m) done(false) })
			no.focus()
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
	api.isDarkTheme = function () { return document.documentElement.getAttribute('data-theme') === 'dark' }
	// Фон для темної теми: bgd; якщо його не задано - світлий bg, але лише темний пресет або фото.
	// Світлий пресет (p6-p8) у темній темі не показуємо: на ньому не видно світлого тексту.
	api.darkBg = function (p) {
		if (!p) return ''
		if (p.bgd) return p.bgd
		var pr = p.bg && api.BG_PRESETS[p.bg]
		return pr && !pr.dark ? '' : (p.bg || '')
	}
	// Фон, який бачать інші, для поточної теми сайту
	api.themeBg = function (p) {
		if (!p) return ''
		return api.isDarkTheme() ? api.darkBg(p) : (p.bg || '')
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
		} else if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(bg) || BG_URL_RE.test(bg)) {
			// URL і data: перевірені регулярними виразами (без лапок і дужок), тож їх можна вставити в CSS
			node.style.backgroundImage = 'url("' + bg + '")'
			node.classList.add('has-bg', 'has-bg-img')
		}
	}
	// Фото фону профілю, завантажене на сервер (api/upload.php) - повна якість для широких екранів і телефонів
	var BG_URL_RE = /^https:\/\/ntu\.dp\.ua\/uploads\/\d{4}\/\d{2}\/[a-f0-9]{16,64}\.(jpg|jpeg|png|webp)$/
	var BG_MAX_PX = 1920, BG_DATA_MAX = 115000
	function readImage(file) {
		return new Promise(function (res, rej) {
			if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return rej(new Error(t('Оберіть файл зображення (JPG, PNG або WebP).')))
			if (file.size > 12 * 1024 * 1024) return rej(new Error(t('Файл завеликий (максимум 12 МБ).')))
			var url = URL.createObjectURL(file)
			var img = new Image()
			img.onload = function () { URL.revokeObjectURL(url); res(img) }
			img.onerror = function () { URL.revokeObjectURL(url); rej(new Error(t('Не вдалося прочитати зображення.'))) }
			img.src = url
		})
	}
	// пропорції фото зберігаємо (без обрізання до смужки 3:1) - CSS cover сам підбирає кадр під ширину картки
	function drawScaled(img, maxPx) {
		var k = Math.min(1, maxPx / Math.max(img.width, img.height))
		var c = document.createElement('canvas')
		c.width = Math.max(1, Math.round(img.width * k))
		c.height = Math.max(1, Math.round(img.height * k))
		var g = c.getContext('2d')
		g.fillStyle = '#fff'
		g.fillRect(0, 0, c.width, c.height)
		g.drawImage(img, 0, 0, c.width, c.height)
		return c
	}
	// Запасний варіант (демо-режим або пошта не підтверджена): data: URL у профілі, вкладаємося в ліміт правил (120 000 символів)
	api.fileToCover = function (file) {
		return readImage(file).then(function (img) {
			var px = 1280, q = 0.78, c = drawScaled(img, px), out = c.toDataURL('image/jpeg', q)
			while (out.length > BG_DATA_MAX && px > 480) {
				if (q > 0.5) q -= 0.08
				else { px = Math.round(px * 0.82); c = drawScaled(img, px) }
				out = c.toDataURL('image/jpeg', q)
			}
			if (out.length > BG_DATA_MAX) throw new Error(t('Не вдалося стиснути зображення. Спробуйте інше фото.'))
			return out
		})
	}
	// Основний шлях: фото до 1920 px завантажуємо на сервер і зберігаємо в профілі лише посилання
	api.fileToBackground = function (file) {
		if (!REMOTE || !state.user || !state.user.verified) return api.fileToCover(file)
		return readImage(file).then(function (img) {
			return new Promise(function (res, rej) {
				drawScaled(img, BG_MAX_PX).toBlob(function (b) {
					b ? res(new File([b], 'profile-bg.jpg', { type: 'image/jpeg' })) : rej(new Error(t('Не вдалося прочитати зображення.')))
				}, 'image/jpeg', 0.86)
			})
		}).then(function (f) {
			return api.upload(f, 'chat')
		}).then(function (r) {
			if (!r || !BG_URL_RE.test(r.url || '')) throw new Error(t('Не вдалося завантажити файл.'))
			return r.url
		}, function (e) {
			// сервер недоступний - зберігаємо стиснену копію прямо в профілі, щоб фон усе одно з'явився
			if (window.console) console.warn('[bg upload]', e && e.message)
			return api.fileToCover(file)
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
	// Прихований статус: публічне users/{uid}/s не оновлюємо, а час активності пишемо в presence/{uid},
	// який за правилами бази читають лише суперадміни (і сам власник).
	function beat() {
		if (!REMOTE || !state.user || document.hidden) return
		var uid = encodeURIComponent(state.user.uid), now = { '.sv': 'timestamp' }
		var call = state.user.hideOnline ? dbCall('PUT', 'presence/' + uid, now, true) : dbCall('PATCH', 'users/' + uid, { s: now }, true)
		call.catch(function () {})
	}
	/* Суперадмін бачить реальний статус користувача з прихованим «в мережі».
	   statusEl отримує текст «Був(ла) у мережі ... · приховано від інших», dotEl - зелений індикатор. */
	var presenceCache = null, presenceAt = 0
	api.adminPresence = function () {
		if (!REMOTE || !state.user || !api.isAdmin) return Promise.resolve({})
		return api.isAdmin().then(function (yes) {
			if (!yes) return {}
			if (presenceCache && Date.now() - presenceAt < 30000) return presenceCache
			presenceAt = Date.now()
			presenceCache = dbCall('GET', 'presence', undefined, true).then(function (d) { return d && typeof d === 'object' ? d : {} }, function () { presenceCache = null; return {} })
			return presenceCache
		})
	}
	api.revealHidden = function (uid, statusEl, dotEl) {
		if (!statusEl) return
		api.adminPresence().then(function (all) {
			if (!statusEl.isConnected || !Object.prototype.hasOwnProperty.call(all, uid)) return
			var seen = typeof all[uid] === 'number' ? all[uid] : 0
			var on = api.isOnline(seen)
			statusEl.textContent = api.lastSeen(seen) + ' · ' + t('приховано від інших')
			statusEl.classList.toggle('is-on', on)
			statusEl.title = t('Статус прихований: його бачать лише адміністратори')
			if (dotEl) dotEl.classList.toggle('is-on', on)
		})
	}
	function startPresence() {
		if (presenceTimer || !REMOTE) return
		beat()
		presenceTimer = setInterval(beat, 60000)
		document.addEventListener('visibilitychange', function () { if (!document.hidden) beat() })
	}
	api.isOnline = function (seen) { return !!seen && Date.now() - seen < 150000 }
	/* Текст статусу: «В мережі» або «Був(ла) у мережі 5 хв тому / вчора о 18:20 / 02.11 о 09:15» */
	api.lastSeen = function (seen) {
		if (api.isOnline(seen)) return t('В мережі')
		if (!seen) return t('Не в мережі')
		var d = Date.now() - seen, m = Math.floor(d / 60000)
		var pre = t('Був(ла) у мережі') + ' '
		if (m < 1) return pre + t('щойно')
		if (m < 60) return pre + m + ' ' + t('хв тому')
		var h = Math.floor(m / 60)
		var dt = new Date(seen), now = new Date()
		var hm = ('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2)
		if (dt.toDateString() === now.toDateString()) return pre + h + ' ' + t('год тому')
		var y = new Date(now); y.setDate(now.getDate() - 1)
		if (dt.toDateString() === y.toDateString()) return pre + t('вчора о') + ' ' + hm
		return pre + ('0' + dt.getDate()).slice(-2) + '.' + ('0' + (dt.getMonth() + 1)).slice(-2) + (dt.getFullYear() !== now.getFullYear() ? '.' + dt.getFullYear() : '') + ' ' + t('о') + ' ' + hm
	}

	/* ---------- header button ---------- */
	function initials(n) { return (n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0] }).join('').toUpperCase() }
	api.initials = initials
	function renderHeader() {
		// інші кнопки «Увійти / Особистий кабінет» (головна сторінка)
		Array.prototype.forEach.call(document.querySelectorAll('[data-acct-link]'), function (b) {
			b.href = state.user ? 'personal-area.html' : 'login.html'
			b.textContent = state.user ? t('Особистий кабінет') : t('Увійти')
		})
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
			if (missingInfo(u).length) {
				var w = document.createElement('span')
				w.className = 'warn-badge acct-btn__warn'
				w.textContent = '!'
				w.title = t('Заповніть персональні дані')
				w.setAttribute('aria-hidden', 'true')
				a.appendChild(w)
				a.setAttribute('aria-label', t('Особистий кабінет') + ': ' + u.name + '. ' + t('Заповніть персональні дані'))
			}
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
			if (rec) state.user = { uid: rec.uid, email: s.email, name: rec.name, avatar: rec.avatar || '', bg: rec.bg || '', bgd: rec.bgd || '', verified: true }
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
	function say(el, msg, ok, keep) {
		if (!el) return
		clearTimeout(el._sayTimer)
		el.style.color = ok ? '#2D9B70' : '#c0392b'
		el.textContent = msg
		// повідомлення про успіх зникає через 5 с
		if (ok && msg && !keep && !/(\.\.\.|…)$/.test(msg)) el._sayTimer = setTimeout(function () { el.textContent = '' }, 5000)
	}

	/* Реєстрація: вибір ролі та предмета викладача */
	var subjSel = document.querySelector('[data-subj-select]')
	if (subjSel && A.SUBJECTS) {
		A.SUBJECTS.forEach(function (sj) { var o = document.createElement('option'); o.value = sj; o.textContent = t(sj); subjSel.appendChild(o) })
		var subjWrap = document.querySelector('[data-subj-wrap]')
		var syncRole = function () {
			var tch = (document.querySelector('input[name=role]:checked') || {}).value === 't'
			subjWrap.hidden = !tch
			subjSel.required = tch
		}
		document.querySelectorAll('input[name=role]').forEach(function (r) { r.addEventListener('change', syncRole) })
		syncRole()
	}

	document.querySelectorAll('[data-auth-form]').forEach(function (form) {
		var kind = form.getAttribute('data-auth-form')
		var status = form.querySelector('[data-form-status]')
		var btn = form.querySelector('button[type=submit]')
		if (kind !== 'forgot') A.onChange(function (u) { if (u) location.replace('personal-area.html') })
		form.addEventListener('submit', function (e) {
			e.preventDefault()
			if (btn.disabled) return
			say(status, '')
			var f = form.elements
			Array.prototype.forEach.call(form.querySelectorAll('.field--invalid'), function (x) { x.classList.remove('field--invalid') })
			function bad(input, msg) {
				var w = input.closest('.field')
				if (w) w.classList.add('field--invalid')
				input.setAttribute('aria-invalid', 'true')
				input.focus()
				say(status, msg)
				return true
			}
			Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (x) { x.removeAttribute('aria-invalid') })
			if (kind === 'register') {
				var nm = f.name.value.trim().replace(/\s+/g, ' ')
				f.name.value = nm
				if (!nm) return bad(f.name, t('Вкажіть ім’я (щонайменше 2 символи).'))
				if (nm.length < 2 || nm.length > 40 || !/^[A-Za-zЀ-ӿ][A-Za-zЀ-ӿ0-9'’ʼ\-. _]*$/.test(nm) || (nm.match(/[A-Za-zЀ-ӿ]/g) || []).length < 2)
					return bad(f.name, t('Ім’я: від 2 до 40 символів, має починатися з літери (дозволені літери, цифри, пробіл, апостроф, дефіс).'))
				if (window.NTU_isProfane && window.NTU_isProfane(nm)) return bad(f.name, t('Ім’я містить неприпустимі слова.'))
				if (f.role && f.role.value === 't' && f.subj && !f.subj.value) return bad(f.subj, t('Оберіть предмет, який ви викладаєте.'))
			}
			f.email.value = f.email.value.trim()
			if (!f.email.value) return bad(f.email, t('Вкажіть email.'))
			if (!A.validEmail(f.email.value.toLowerCase())) return bad(f.email, t('Введіть коректну email-адресу, наприклад student@example.com'))
			if (kind !== 'forgot') {
				var pw = f.password.value
				if (!pw) return bad(f.password, t('Введіть пароль.'))
				if (kind === 'register') {
					if (pw.length < 6) return bad(f.password, t('Пароль має містити щонайменше 6 символів.'))
					if (pw.length > 128) return bad(f.password, t('Пароль занадто довгий (максимум 128 символів).'))
					if (pw !== pw.trim()) return bad(f.password, t('Пароль не може починатися або закінчуватися пробілом.'))
					if (!/[A-Za-zЀ-ӿ]/.test(pw) || !/\d/.test(pw)) return bad(f.password, t('Пароль має містити хоча б одну літеру й одну цифру.'))
				}
			}
			if (kind === 'register' && !f.consent.checked) { f.consent.focus(); return say(status, t('Потрібна згода з правилами чату.')) }
			var label = btn.textContent
			btn.disabled = true
			btn.textContent = t('Зачекайте...')
			var job
			if (kind === 'login') job = A.signIn(f.email.value, f.password.value)
			else if (kind === 'register') job = A.signUp(f.name.value, f.email.value, f.password.value, f.role.value, f.subj ? f.subj.value : '')
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
			ph.textContent = A.initials(u.name)
			img.hidden = !u.avatar
			ph.hidden = !!u.avatar
			if (u.avatar) img.src = u.avatar
			rm.hidden = !u.avatar
		})
		// згортає розділ налаштувань після успішного збереження (повідомлення про результат лишається видимим)
		var closeFold = function (node) { var s = node && node.closest && node.closest('[data-fold]'); if (s) s.dispatchEvent(new CustomEvent('fold:close')) }
		pick.addEventListener('click', function () { file.click() })
		file.addEventListener('change', function () {
			var f = file.files && file.files[0]
			if (!f) return
			say(status, t('Завантаження...'), true)
			A.fileToAvatar(f).then(function (d) { return A.setAvatar(d) }).then(function () {
				say(status, t('Фото профілю оновлено.'), true)
				closeFold(pick)
			}).catch(function (err) { say(status, err.message || t('Не вдалося зберегти фото.')) })
			file.value = ''
		})
		rm.addEventListener('click', function () {
			A.confirm(t('Видалити фото профілю?'), t('Видалити')).then(function (ok) {
				if (!ok) return
				A.setAvatar('').then(function () { say(status, t('Фото видалено.'), true); closeFold(pick) }, function () { say(status, t('Не вдалося зберегти фото.')) })
			})
		})
		/* --- нікнейм --- */
		var nameForm = document.querySelector('[data-name-form]')
		if (nameForm) {
			var nameIn = nameForm.elements.name
			var nameSt = document.querySelector('[data-name-status]')
			var nameBtn = nameForm.querySelector('button[type=submit]')
			A.onChange(function (u) { if (u && document.activeElement !== nameIn) nameIn.value = u.name })
			nameForm.addEventListener('submit', function (e) {
				e.preventDefault()
				if (nameBtn.disabled) return
				var nm = nameIn.value.trim().replace(/\s+/g, ' ')
				nameIn.value = nm
				var err = !nm ? t('Вкажіть нікнейм.') : A.nameError(nm)
				if (err) { nameIn.focus(); return say(nameSt, err) }
				if (A.user && nm === A.user.name) return say(nameSt, t('Це ваш поточний нікнейм.'))
				nameBtn.disabled = true
				say(nameSt, t('Збереження...'), true)
				A.setName(nm).then(function () { say(nameSt, t('Нікнейм змінено.'), true); closeFold(nameForm) }, function (er) { say(nameSt, er.message) })
					.then(function () { nameBtn.disabled = false })
			})
		}
		/* --- пошта --- */
		var mailForm = document.querySelector('[data-email-form]')
		if (mailForm) {
			var mailSt = document.querySelector('[data-email-status]')
			var mailBtn = mailForm.querySelector('button[type=submit]')
			mailForm.addEventListener('submit', function (e) {
				e.preventDefault()
				if (mailBtn.disabled) return
				var em = mailForm.elements.email, pw = mailForm.elements.password
				em.value = em.value.trim()
				if (!em.value) { em.focus(); return say(mailSt, t('Вкажіть email.')) }
				if (!A.validEmail(em.value.toLowerCase())) { em.focus(); return say(mailSt, t('Введіть коректну email-адресу, наприклад student@example.com')) }
				if (!pw.value) { pw.focus(); return say(mailSt, t('Введіть поточний пароль, щоб підтвердити зміну.')) }
				mailBtn.disabled = true
				say(mailSt, t('Зачекайте...'), true)
				A.changeEmail(em.value, pw.value).then(function (r) {
					pw.value = ''
					if (r && r.pending) {
						// лист підтвердження: не ховаємо через 5 с - людині треба запам'ятати, що робити далі
						say(mailSt, t('Лист надіслано на') + ' ' + em.value + '. ' + t('Перейдіть за посиланням у листі, а потім увійдіть з новою адресою.'), true, true)
						closeFold(mailForm)
					} else {
						em.value = ''
						say(mailSt, t('Пошту змінено.'), true)
					}
				}, function (er) { say(mailSt, er.message) }).then(function () { mailBtn.disabled = false })
			})
		}
		// two "Вийти" buttons: the icon next to the settings gear and the one at the end of the settings modal
		document.querySelectorAll('[data-signout]').forEach(function (b) {
			b.addEventListener('click', function () {
				A.confirm(t('Вийти з акаунта?'), t('Вийти')).then(function (ok) {
					if (!ok) return
					A.signOut()
					location.href = './'
				})
			})
		})
	}
})
