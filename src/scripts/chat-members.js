/*
 * Список учасників загального чату (кнопка у шапці чату): пошук, закріплення учасників (📌 - вгорі списку),
 * клік по імені - картка профілю. Закріплення зберігає NTU_CHATPREFS (chat-prefs.js).
 * Дані: users/{uid} = {n, a, s} (s = остання активність; 0, якщо статус приховано). Потрібен вхід.
 * window.NTU_CHATMEMBERS = { mount(panel, button), close(silent), isOpen() }
 */
;(function () {
	'use strict'
	var RELOAD_MS = 120000
	var MAX_ROWS = 300
	var UID_RE = /^[A-Za-z0-9]{20,64}$/

	function t(s) { return typeof T === 'function' ? T(s) : s }
	function el(tag, cls, text) {
		var e = document.createElement(tag)
		if (cls) e.className = cls
		if (text != null) e.textContent = text
		return e
	}
	function A() { return window.NTU_AUTH }
	function CP() { return window.NTU_CHATPREFS }

	var box = null, btn = null, listEl = null, searchIn = null, people = [], loadedAt = 0, loading = false, opened = false, limitNote = false

	function build(panel) {
		box = el('section', 'chat-members')
		box.hidden = true
		box.setAttribute('aria-label', t('Учасники'))
		var head = el('div', 'chat-members__head')
		head.appendChild(el('strong', null, t('Учасники')))
		var x = el('button', 'chat-members__close', '✕')
		x.type = 'button'
		x.setAttribute('aria-label', t('Закрити список учасників'))
		x.addEventListener('click', function () { close() })
		head.appendChild(x)
		box.appendChild(head)
		searchIn = el('input', 'chat-members__search')
		searchIn.type = 'search'
		searchIn.placeholder = t('Пошук учасника…')
		searchIn.setAttribute('aria-label', t('Пошук учасника'))
		searchIn.addEventListener('input', render)
		box.appendChild(searchIn)
		listEl = el('div', 'chat-members__list')
		box.appendChild(listEl)
		panel.appendChild(box)
	}

	function load(force) {
		var a = A()
		if (!a || !a.remote || !a.user) { people = []; render(); return }
		if (loading || (!force && Date.now() - loadedAt < RELOAD_MS)) return
		loading = true
		a.db('GET', 'users', undefined, true).then(function (d) {
			var bad = window.NTU_isProfane || function () { return false }
			people = Object.keys(d || {}).filter(function (uid) { return UID_RE.test(uid) && d[uid] && typeof d[uid].n === 'string' && !bad(d[uid].n) })
				.map(function (uid) { var u = d[uid]; return { uid: uid, n: u.n.slice(0, 40), a: typeof u.a === 'string' ? u.a : '', s: typeof u.s === 'number' ? u.s : 0 } })
			loadedAt = Date.now()
		}, function () { people = people || [] }).then(function () { loading = false; render() })
	}

	function avatar(p) {
		var a = A()
		if (p.a && /^(https:|data:image\/)/.test(p.a)) { var img = el('img', 'uavatar'); img.src = p.a; img.alt = ''; return img }
		return el('span', 'uavatar uavatar--ph', a && a.initials ? a.initials(p.n) : p.n.charAt(0))
	}

	function row(p, me) {
		var cp = CP(), a = A()
		var pinned = cp.isPinned(p.uid)
		var r = el('div', 'chat-members__row' + (pinned ? ' is-pinned' : ''))
		var who = el('button', 'chat-members__who')
		who.type = 'button'
		var av = el('span', 'chat-members__av')
		av.appendChild(avatar(p))
		if (a.isOnline(p.s)) av.appendChild(el('span', 'online-dot is-on'))
		who.appendChild(av)
		var nm = el('span', 'chat-members__name', p.n)
		if (p.uid === me) nm.appendChild(el('span', 'chat-members__me', t('ви')))
		who.appendChild(nm)
		who.title = t('Відкрити профіль')
		who.addEventListener('click', function (e) { e.stopPropagation(); if (window.NTU_PROFILE) window.NTU_PROFILE.show(p.uid, who) })
		r.appendChild(who)
		if (p.uid !== me) {
			var pin = el('button', 'chat-members__pin' + (pinned ? ' is-on' : ''))
			pin.type = 'button'
			pin.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5M5 17h14l-2-4V5h1V3H6v2h1v8z"/></svg>'
			var label = pinned ? t('Відкріпити') : t('Закріпити')
			pin.setAttribute('aria-label', label + ': ' + p.n)
			pin.setAttribute('aria-pressed', pinned ? 'true' : 'false')
			pin.title = label
			pin.addEventListener('click', function (e) {
				e.stopPropagation()
				if (cp.togglePin(p.uid) === null) { limitNote = true; render() }
				var again = listEl.querySelector('[data-pin="' + p.uid + '"]')
				if (again) again.focus()
			})
			pin.setAttribute('data-pin', p.uid)
			r.appendChild(pin)
		}
		return r
	}

	function render() {
		if (!listEl || !opened) return
		var a = A(), cp = CP()
		listEl.textContent = ''
		if (!a || !a.user) { listEl.appendChild(el('p', 'chat-members__hint', t('Увійдіть, щоб бачити учасників і закріплювати їх.'))); return }
		if (!a.remote) { listEl.appendChild(el('p', 'chat-members__hint', t('Список учасників доступний лише онлайн.'))); return }
		if (!people.length) { listEl.appendChild(el('p', 'chat-members__hint', loading ? t('Завантаження…') : t('Нікого не знайдено.'))); return }
		var q = (searchIn.value || '').trim().toLowerCase(), me = a.user.uid
		var rows = people.filter(function (p) { return !q || p.n.toLowerCase().indexOf(q) >= 0 })
		rows.sort(function (x, y) {
			var px = cp.isPinned(x.uid) ? 1 : 0, py = cp.isPinned(y.uid) ? 1 : 0
			if (px !== py) return py - px
			var ox = a.isOnline(x.s) ? 1 : 0, oy = a.isOnline(y.s) ? 1 : 0
			if (ox !== oy) return oy - ox
			return x.n.localeCompare(y.n)
		})
		if (limitNote) { listEl.appendChild(el('p', 'chat-members__hint chat-members__hint--warn', t('Можна закріпити не більше 50 учасників.'))); limitNote = false }
		var pinnedRows = rows.filter(function (p) { return cp.isPinned(p.uid) })
		var rest = rows.filter(function (p) { return !cp.isPinned(p.uid) }).slice(0, MAX_ROWS)
		if (pinnedRows.length) {
			listEl.appendChild(el('p', 'chat-members__group', '📌 ' + t('Закріплені')))
			pinnedRows.forEach(function (p) { listEl.appendChild(row(p, me)) })
			if (rest.length) listEl.appendChild(el('p', 'chat-members__group', t('Усі учасники')))
		}
		rest.forEach(function (p) { listEl.appendChild(row(p, me)) })
		if (!rows.length) listEl.appendChild(el('p', 'chat-members__hint', t('Нікого не знайдено.')))
	}

	function open() {
		opened = true
		box.hidden = false
		btn.setAttribute('aria-expanded', 'true')
		load(false)
		render()
		setTimeout(function () { searchIn.focus() }, 30)
	}
	function close(silent) {
		if (!opened) return
		opened = false
		box.hidden = true
		btn.setAttribute('aria-expanded', 'false')
		if (silent !== true) btn.focus()
	}

	window.NTU_CHATMEMBERS = {
		mount: function (panel, button) {
			if (box || !CP()) return
			btn = button
			build(panel)
			btn.addEventListener('click', function (e) { e.stopPropagation(); opened ? close() : open() })
			CP().onChange(render)
			if (A()) A().onChange(function () { loadedAt = 0; if (opened) { load(true); render() } })
		},
		close: close,
		isOpen: function () { return opened }
	}
})()
