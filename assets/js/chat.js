/* Плаваючий чат студентської платформи. Усі повідомлення зберігаються (Firebase RTDB або localStorage). */
(function () {
	'use strict'
	var cfg = window.NTU_CHAT || {}
	var DB = (cfg.databaseURL || '').replace(/\/+$/, '')
	var KEY_MSGS = 'ntu-chat-messages'
	var KEY_NAME = 'ntu-chat-name'
	var KEY_UID = 'ntu-chat-uid'
	var MAX_LEN = 500
	var POLL_MS = 4000

	function t(s) { return typeof T === 'function' ? T(s) : s }
	function ls(k, v) {
		try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v) } catch (e) { return null }
	}


	/* ---------- фільтр нецензурної лексики (укр / рос / англ) ---------- */
	var LAT2CYR = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', i: 'і', k: 'к', m: 'м', t: 'т', b: 'в', h: 'н', '0': 'о', '3': 'з', '@': 'а', '$': 'с' }
	var PFX = '(?:на|по|за|ви|до|роз|з|с|пере|при|під|об|від|не|о|у|від)?'
	var RU_UA = [
		new RegExp('^' + PFX + 'ху[йяеєюїиі]'),
		/пізд|пизд|пезд/,
		new RegExp('^' + PFX + '[еєїи]б(?:а[нтлвшк]|у|ну|ля|ло|ли|ь)'),
		/^[еєїи]бл[оа]н?/,
		/^(?:за|на|по|ви|до|роз)?йоб/,
		/^у[еёє]б(?:ок|ан|ки)/,
		/^бл(?:я|ят|яд|ять|ядь|ядс|яди|яха)$|^бл(?:ят|яд)/,
		/^су(?:ка|ки|ку|кою|ці|ко|ків)$|^су(?:чар|чк)/,
		/^муд(?:ак|ач|ил|ень|озвон)/,
		/^(?:на|по|за)?хер(?:ня|ню|ні|ово|овий|ова)?$/,
		/^г[ао]ндон/,
		/^залуп/,
		/^п[іи]д[оа]р(?:а|и|у|ом|ас|ами|ів)?$/,
		/^п[іи]дар(?:ас|аз)/,
		/^шлюх/,
		/^курв/,
		/^дроч/,
		/^мраз[ьіи]$/,
		/^долбо[её]б/,
		/^довбо[еєї]б/
	]
	var EN = /fuck|shit|bitch|cunt|asshole|whore|slut|blyat|blyad|dick(?:head)?s?$|nigg/
	function squash(s) { return s.replace(/(.)\1+/g, '$1') }
	function isProfane(text) {
		var raw = String(text).toLowerCase()
		if (EN.test(squash(raw.replace(/[^a-z]+/g, ' '))) || /f+u+c+k|sh+i+t/.test(raw.replace(/[^a-z]/g, ''))) return true
		var mapped = raw.replace(/[a-z0-9@$]/g, function (ch) { return LAT2CYR[ch] || ch })
		var words = mapped.split(/[^а-яіїєґё]+/).filter(Boolean).map(squash)
		for (var i = 0; i < words.length; i++)
			for (var j = 0; j < RU_UA.length; j++) if (RU_UA[j].test(words[i])) return true
		// літери через пробіли/крапки: «х у й», «п.і.з.д.а»
		var glued = squash(mapped.replace(/[^а-яіїєґё]/g, ''))
		return /хуй|хуя|пізд|пизд|[еєїи]бат|бляд|блят|блять|залуп/.test(glued)
	}

	var uid = ls(KEY_UID)
	if (!uid) { uid = 'v' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); ls(KEY_UID, uid) }

	function me() { return window.NTU_AUTH ? window.NTU_AUTH.user : null }
	function myUid() { var u = me(); return u ? u.uid : uid }
	var profiles = {} // uid -> {n, a} | null (loading)
	var renderTimer = null
	function profileFor(u) {
		if (!u || !window.NTU_AUTH) return null
		var mu = me()
		if (mu && mu.uid === u) return { n: mu.name, a: mu.avatar || '' }
		if (profiles[u] === undefined) {
			profiles[u] = null
			window.NTU_AUTH.profile(u).then(function (p) {
				profiles[u] = p || {}
				clearTimeout(renderTimer)
				renderTimer = setTimeout(render, 80)
			}, function () { profiles[u] = {} })
		}
		return profiles[u]
	}
	var messages = []
	var seen = {}
	var lastSent = 0
	var unread = 0
	var isOpen = false

	function el(tag, cls, text) {
		var e = document.createElement(tag)
		if (cls) e.className = cls
		if (text != null) e.textContent = text
		return e
	}

	/* ---------- UI ---------- */
	var root = el('div', 'chat')
	var fab = el('button', 'chat-fab')
	fab.type = 'button'
	fab.setAttribute('aria-label', t('Відкрити чат'))
	fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.7 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12Z"/><path d="M8.5 11h7M8.5 14h4"/></svg>'
	var badge = el('span', 'chat-fab__badge')
	badge.hidden = true
	fab.appendChild(badge)

	var panel = el('section', 'chat-panel')
	panel.hidden = true
	panel.setAttribute('role', 'dialog')
	panel.setAttribute('aria-label', t('Студентський чат'))

	var head = el('header', 'chat-head')
	var headText = el('div', 'chat-head__text')
	headText.appendChild(el('strong', null, t('Студентський чат')))
	var status = el('span', 'chat-head__status')
	headText.appendChild(status)
	var close = el('button', 'chat-head__close', '✕')
	close.type = 'button'
	close.setAttribute('aria-label', t('Закрити чат'))
	head.appendChild(headText)
	head.appendChild(close)

	var list = el('div', 'chat-list')
	list.setAttribute('aria-live', 'polite')
	var empty = el('p', 'chat-empty', t('Поки що тут тихо. Напиши перше повідомлення!'))

	var form = el('form', 'chat-form')
	form.autocomplete = 'off'
	var row = el('div', 'chat-form__row')
	var msgIn = el('input', 'chat-text')
	msgIn.type = 'text'
	msgIn.maxLength = MAX_LEN
	msgIn.placeholder = t('Напишіть повідомлення…')
	msgIn.setAttribute('aria-label', t('Повідомлення'))
	var send = el('button', 'chat-send')
	send.type = 'submit'
	send.setAttribute('aria-label', t('Надіслати'))
	send.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'
	row.appendChild(msgIn)
	row.appendChild(send)
	var note = el('p', 'chat-note')
	var asLine = el('p', 'chat-as')
	form.appendChild(asLine)
	form.appendChild(row)
	form.appendChild(note)

	var gate = el('div', 'chat-gate')
	gate.appendChild(el('p', 'chat-gate__text', t('Щоб писати в чаті, потрібно увійти або зареєструватися. Читати повідомлення можна без акаунта.')))
	var gateBtns = el('div', 'chat-gate__btns')
	var gLogin = el('a', 'btn btn-primary', t('Увійти'))
	gLogin.href = 'login.html'
	var gReg = el('a', 'btn btn-secondary', t('Зареєструватися'))
	gReg.href = 'register.html'
	gateBtns.appendChild(gLogin)
	gateBtns.appendChild(gReg)
	gate.appendChild(gateBtns)

	panel.appendChild(head)
	panel.appendChild(list)
	panel.appendChild(form)
	panel.appendChild(gate)
	root.appendChild(panel)
	root.appendChild(fab)

	/* ---------- rendering ---------- */
	function fmt(ts) {
		var d = new Date(ts)
		var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)
		var today = new Date()
		if (d.toDateString() === today.toDateString()) return hm
		return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + ' ' + hm
	}
	function colorFor(s) {
		var h = 0
		for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
		return 'hsl(' + h + ',55%,42%)'
	}
	function render() {
		var atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60
		list.textContent = ''
		if (!messages.length) list.appendChild(empty)
		messages.forEach(function (m) {
			var mine = m.u === myUid()
			var bad = isProfane(m.t) || isProfane(m.n || '')
			var prof = profileFor(m.u)
			var shownName = bad ? t('Гість') : (m.n || (prof && prof.n) || t('Гість'))
			var rowEl = el('div', 'chat-row' + (mine ? ' is-mine' : ''))
			var av
			if (prof && prof.a && !bad) { av = el('img', 'chat-avatar'); av.src = prof.a; av.alt = '' } else {
				av = el('span', 'chat-avatar chat-avatar--ph', (window.NTU_AUTH ? window.NTU_AUTH.initials(shownName) : shownName.charAt(0)))
				av.style.background = colorFor(shownName)
			}
			var b = el('div', 'chat-msg' + (mine ? ' is-mine' : ''))
			var who = el('span', 'chat-msg__who', shownName)
			who.style.color = mine ? '' : colorFor(shownName)
			b.appendChild(who)
			var txt = el('p', 'chat-msg__text', bad ? t('Повідомлення приховано: нецензурна лексика') : m.t)
			if (bad) txt.classList.add('is-hidden')
			b.appendChild(txt)
			b.appendChild(el('time', 'chat-msg__time', fmt(m.ts)))
			rowEl.appendChild(av)
			rowEl.appendChild(b)
			list.appendChild(rowEl)
		})
		if (atBottom || isOpen && messages.length && messages[messages.length - 1].u === myUid()) list.scrollTop = list.scrollHeight
	}
	function add(incoming) {
		var added = 0
		incoming.forEach(function (m) {
			if (!m || !m.id || seen[m.id] || typeof m.t !== 'string') return
			seen[m.id] = 1
			messages.push(m)
			added++
			if (!isOpen && m.u !== myUid()) unread++
		})
		if (!added) return
		messages.sort(function (a, b) { return a.ts - b.ts })
		if (messages.length > 300) messages = messages.slice(-300)
		badge.hidden = !unread
		badge.textContent = unread > 9 ? '9+' : unread
		render()
	}

	/* ---------- storage backends ---------- */
	var backend
	if (DB) {
		backend = {
			remote: true,
			load: function () {
				return fetch(DB + '/chat/messages.json?orderBy=%22$key%22&limitToLast=200').then(function (r) {
					if (!r.ok) throw new Error(r.status)
					return r.json()
				}).then(function (data) {
					return Object.keys(data || {}).map(function (k) {
						var v = data[k]
						return { id: k, n: v.n, t: v.t, ts: v.ts, u: v.u }
					})
				})
			},
			save: function (m) {
				var tk = window.NTU_AUTH && window.NTU_AUTH.remote ? window.NTU_AUTH.token() : Promise.resolve(null)
				return tk.then(function (token) {
					return fetch(DB + '/chat/messages.json' + (token ? '?auth=' + encodeURIComponent(token) : ''), {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ n: m.n, t: m.t, ts: m.ts, u: m.u })
					})
				}).then(function (r) {
					if (!r.ok) throw new Error(r.status)
					return r.json()
				}).then(function (res) { return res.name })
			}
		}
	} else {
		backend = {
			remote: false,
			load: function () {
				try { return Promise.resolve(JSON.parse(ls(KEY_MSGS) || '[]')) } catch (e) { return Promise.resolve([]) }
			},
			save: function (m) {
				var all = []
				try { all = JSON.parse(ls(KEY_MSGS) || '[]') } catch (e) {}
				all.push({ id: m.id, n: m.n, t: m.t, ts: m.ts, u: m.u })
				ls(KEY_MSGS, JSON.stringify(all.slice(-500)))
				return Promise.resolve(m.id)
			}
		}
		window.addEventListener('storage', function (e) { if (e.key === KEY_MSGS) refresh() })
	}

	function setStatus(online) {
		status.textContent = backend.remote
			? (online ? t('на зв’язку · повідомлення зберігаються') : t('немає зв’язку, пробуємо ще…'))
			: t('локальний режим · лише на цьому пристрої')
		status.classList.toggle('is-off', backend.remote && !online)
	}
	function refresh() {
		return backend.load().then(function (list) { setStatus(true); add(list) }, function () { setStatus(false) })
	}

	function syncGate() {
		var u = me()
		form.hidden = !u
		gate.hidden = !!u
		asLine.textContent = u ? t('Ви пишете як') + ' ' + u.name : ''
		render()
	}
	if (window.NTU_AUTH) window.NTU_AUTH.onChange(syncGate)
	else { form.hidden = true }

	/* ---------- events ---------- */
	function open(kind) {
		isOpen = true
		panel.hidden = false
		root.classList.add('is-open')
		unread = 0
		badge.hidden = true
		list.scrollTop = list.scrollHeight
		if (me() && kind === 'help' && !msgIn.value) msgIn.value = t('Потрібна допомога з предметом: ')
		setTimeout(function () {
			if (!me()) { gLogin.focus(); return }
			msgIn.focus()
			msgIn.setSelectionRange(msgIn.value.length, msgIn.value.length)
		}, 50)
	}
	function shut() {
		isOpen = false
		panel.hidden = true
		root.classList.remove('is-open')
		fab.focus()
	}
	fab.addEventListener('click', function () { isOpen ? shut() : open() })
	close.addEventListener('click', shut)
	document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) shut() })
	document.addEventListener('click', function (e) {
		var o = e.target.closest && e.target.closest('[data-open-chat]')
		if (o) { e.preventDefault(); open(o.getAttribute('data-open-chat')) }
	})

	form.addEventListener('submit', function (e) {
		e.preventDefault()
		var text = msgIn.value.trim().replace(/\s+/g, ' ')
		var u = me()
		note.textContent = ''
		if (!u) { note.textContent = t('Щоб писати в чаті, потрібно увійти.'); return }
		var name = u.name
		if (!text) return
		if (isProfane(text) || isProfane(name)) { note.textContent = t('Нецензурна лексика заборонена. Будь ласка, спілкуйтеся ввічливо.'); return }
		if (Date.now() - lastSent < 2000) { note.textContent = t('Не так швидко - зачекайте секунду'); return }
		lastSent = Date.now()
		var m = { n: name.slice(0, 40), t: text.slice(0, MAX_LEN), ts: Date.now(), u: u.uid, id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }
		send.disabled = true
		backend.save(m).then(function (id) {
			m.id = id || m.id
			msgIn.value = ''
			add([m])
		}, function (err) {
			note.textContent = t('Не вдалося надіслати. Перевірте з’єднання й спробуйте ще раз.')
		}).then(function () { send.disabled = false; msgIn.focus() })
	})

	function mount() {
		document.body.appendChild(root)
		setStatus(true)
		refresh()
		setInterval(function () { if (!document.hidden) refresh() }, POLL_MS)
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
	else mount()
})()
