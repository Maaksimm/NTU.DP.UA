/* Особисте листування на сайті (учень - учень, учень - викладач).
   Дані: dm/{cid}/msgs/{id} = {u, t?, f?: {url,name,size,type}, ts}; cid = два uid через «_» у порядку сортування.
   Список розмов: inbox/{uid}/{cid} = {w: співрозмовник, l: останнє повідомлення, ts, lu: хто писав останнім, r: коли я прочитав}.
   Файли завантажуються на сервер сайту (NTU_AUTH.upload), GIF зберігаються як «[gif:ID]».
   Статуси: dm/{cid}/st/{uid} = {d: доставлено до (час сервера), r: прочитано до, c: змінюється, поки людина друкує}.
   Реакції: dm/{cid}/rx/{msgId}/{uid} = емодзі (символ або «:id:» з власного набору). Подвійний клік - ❤️. */
;(function () {
	'use strict'
	var A = window.NTU_AUTH
	var modal = document.getElementById('dmModal')
	if (!A || !modal) return
	function t(s) { return typeof T === 'function' ? T(s) : s }
	function $(sel, root) { return (root || document).querySelector(sel) }
	function el(tag, cls, text) {
		var e = document.createElement(tag)
		if (cls) e.className = cls
		if (text != null) e.textContent = text
		return e
	}
	var isBad = window.NTU_isProfane || function () { return false }
	var MEDIA = window.NTU_MEDIA || { EMOJI: [], GIFS: [], gifUrl: function () { return '' }, GIF_RE: /^\[gif:([A-Za-z0-9]{6,40})\]$/ }
	var MAX_LEN = 2000

	var listBox = $('[data-dm-list]', modal), search = $('[data-dm-search]', modal)
	var conv = $('[data-dm-conv]', modal), placeholder = $('[data-dm-placeholder]', modal)
	var peerBox = $('[data-dm-peer]', modal), msgsBox = $('[data-dm-msgs]', modal), form = $('[data-dm-form]', modal)
	var badge = document.querySelector('[data-dm-badge]')
	var inbox = {}, people = {}, cur = null, msgs = [], seenIds = {}, pollTimer = null, inboxTimer = null, peerTimer = null, lastSent = 0
	var inboxLoaded = false
	var peerSt = {}, stPrevC = null, peerTyping = false, stKey = '', delivMarked = {}, readMarked = 0, myTypingAt = 0
	var SV = { '.sv': 'timestamp' }
	var rx = {}, rxKey = '', lastTap = { id: null, ts: 0 }
	var QUICK = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏']
	function emo(code) { return MEDIA.emojiNode ? MEDIA.emojiNode(code) : document.createTextNode(code) }
	function allowed(code) {
		if (typeof code !== 'string' || !code || code.length > 40) return false
		if (MEDIA.isCustom && MEDIA.isCustom(code)) return true
		if (QUICK.indexOf(code) >= 0) return true
		return MEDIA.EMOJI.some(function (g) { return g[1].split(' ').indexOf(code) >= 0 })
	}

	function me() { return A.user }
	function cidFor(a, b) { return [a, b].sort().join('_') }
	function enc(s) { return encodeURIComponent(s) }
	function initials(n) { return A.initials ? A.initials(n || '?') : (n || '?').charAt(0) }
	function avatar(p, cls) {
		var a
		if (p && p.a) { a = el('img', cls); a.src = p.a; a.alt = '' } else { a = el('span', cls + ' ' + cls + '--ph', initials(p && p.n)) }
		return a
	}
	function fmtTime(ts) {
		var d = new Date(ts), now = new Date()
		var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)
		return d.toDateString() === now.toDateString() ? hm : ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + ' ' + hm
	}
	function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB' }
	function preview(m) {
		if (m.f) return '📎 ' + m.f.name
		if (MEDIA.GIF_RE.test(m.t || '')) return 'GIF'
		return (m.t || '').slice(0, 110)
	}

	/* ---------- профілі співрозмовників ---------- */
	function loadPerson(uid, force) {
		if (people[uid] && !force) return Promise.resolve(people[uid])
		return Promise.all([A.db('GET', 'users/' + enc(uid), undefined, true).catch(function () { return null }), A.db('GET', 'profiles/' + enc(uid), undefined, true).catch(function () { return null })])
			.then(function (r) {
				var u = r[0] || {}, p = r[1] || {}
				people[uid] = { uid: uid, n: u.n || t('Користувач'), a: u.a || '', s: u.s || 0, hide: !!p.hide, role: p.role === 't' ? 't' : 's', subj: p.subj || '' }
				return people[uid]
			})
	}
	function statusText(p) {
		if (!p) return ''
		if (p.hide) return t('Статус «в мережі» приховано')
		return A.lastSeen ? A.lastSeen(p.s) : ''
	}

	/* ---------- список розмов ---------- */
	function unreadCount() {
		var u = me(), n = 0
		Object.keys(inbox).forEach(function (cid) { var x = inbox[cid]; if (x.lu && x.lu !== u.uid && x.ts > (x.r || 0)) n++ })
		return n
	}
	function syncBadge() {
		if (!badge) return
		var n = unreadCount()
		badge.hidden = !n
		badge.textContent = n > 9 ? '9+' : String(n)
	}
	function loadInbox() {
		var u = me()
		if (!u || !A.remote) return Promise.resolve()
		return A.db('GET', 'inbox/' + enc(u.uid), undefined, true).then(function (d) {
			var prevInbox = inbox, first = !inboxLoaded
			inboxLoaded = true
			inbox = d || {}
			// новий вхідний лист - звук / сповіщення (згідно з налаштуваннями)
			if (!first && A.alertNew) Object.keys(inbox).some(function (cid) {
				var x = inbox[cid], p = prevInbox[cid]
				if (!x || !x.lu || x.lu === u.uid || (p && p.ts >= x.ts)) return false
				var who = people[x.w] && people[x.w].n
				A.alertNew((who || t('Нове повідомлення')), x.l, !modal.hidden && cur && cur.cid === cid)
				return true
			})
			syncBadge()
			// повідомлення від співрозмовників дійшли до мене - позначаємо «доставлено»
			Object.keys(inbox).forEach(function (cid) {
				var x = inbox[cid]
				if (!x || !x.lu || x.lu === u.uid || !(x.ts > (delivMarked[cid] || 0))) return
				delivMarked[cid] = x.ts
				A.db('PATCH', 'dm/' + enc(cid) + '/st/' + enc(u.uid), { d: SV }, true).catch(function () {})
			})
			var ids = Object.keys(inbox).map(function (c) { return inbox[c].w })
			return Promise.all(ids.map(function (id) { return loadPerson(id) }))
		}).then(renderInbox).catch(function () {})
	}
	function renderInbox() {
		if (modal.hidden) return
		var u = me()
		var q = (search.value || '').trim().toLowerCase()
		var rows = Object.keys(inbox).map(function (cid) { return { cid: cid, x: inbox[cid], p: people[inbox[cid].w] } })
			.filter(function (r) { return r.p && (!q || r.p.n.toLowerCase().indexOf(q) >= 0) })
			.sort(function (a, b) {
				var pa = CP && CP.isPinned(a.x.w) ? 1 : 0, pb = CP && CP.isPinned(b.x.w) ? 1 : 0
				return pb - pa || b.x.ts - a.x.ts
			})
		listBox.textContent = ''
		if (!rows.length) {
			listBox.appendChild(el('p', 'dm__hint', q ? t('Нічого не знайдено.') : t('Розмов поки немає. Відкрийте профіль користувача в «Списку користувачів» і натисніть «Написати тут».')))
			return
		}
		rows.forEach(function (r) {
			var b = el('button', 'dm__item' + (cur && cur.cid === r.cid ? ' is-active' : ''))
			b.type = 'button'
			var av = el('span', 'dm__av')
			av.appendChild(avatar(r.p, 'uavatar'))
			if (!r.p.hide && A.isOnline(r.p.s)) av.appendChild(el('span', 'online-dot is-on'))
			b.appendChild(av)
			var info = el('span', 'dm__info')
			var top = el('span', 'dm__top')
			var nm = el('strong', null, r.p.n)
			if (CP && CP.isPinned(r.x.w)) {
				b.classList.add('is-pinned')
				var pinMark = el('span', 'dm__pinmark', '📌')
				pinMark.title = t('Закріплено')
				nm.insertBefore(pinMark, nm.firstChild)
			}
			top.appendChild(nm)
			top.appendChild(el('time', null, fmtTime(r.x.ts)))
			info.appendChild(top)
			var unread = r.x.lu && r.x.lu !== u.uid && r.x.ts > (r.x.r || 0)
			var last = el('span', 'dm__last' + (unread ? ' is-unread' : ''))
			var lastText = (r.x.lu === u.uid ? t('Ви') + ': ' : '') + (r.x.l || '')
			if (MEDIA.appendRich) MEDIA.appendRich(last, lastText); else last.textContent = lastText
			info.appendChild(last)
			b.appendChild(info)
			if (unread) b.appendChild(el('span', 'dm__dot', '●'))
			b.addEventListener('click', function () { openConv(r.x.w) })
			listBox.appendChild(b)
		})
	}
	search.addEventListener('input', renderInbox)

	/* ---------- закріплення співрозмовника і локальна тема розмови (chat-prefs.js) ---------- */
	var CP = window.NTU_CHATPREFS
	var PIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5M5 17h14l-2-4V5h1V3H6v2h1v8z"/></svg>'
	var THEME_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 22 9.8C22 6 17.5 3 12 3Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15.5" cy="7.5" r="1.2"/></svg>'
	var convTools = el('span', 'dm__tools')
	var pinBtn = el('button', 'dm__tool')
	pinBtn.type = 'button'
	pinBtn.innerHTML = PIN_SVG
	var themeBtn = el('button', 'dm__tool')
	themeBtn.type = 'button'
	themeBtn.innerHTML = THEME_SVG
	themeBtn.setAttribute('aria-label', t('Тема чату'))
	themeBtn.title = t('Тема чату')
	themeBtn.setAttribute('aria-expanded', 'false')
	convTools.appendChild(pinBtn)
	convTools.appendChild(themeBtn)
	if (CP) {
		peerBox.parentNode.appendChild(convTools)
		pinBtn.addEventListener('click', function () {
			if (cur && CP.togglePin(cur.peer) === null) pinBtn.title = t('Можна закріпити не більше 50 учасників.')
		})
		themeBtn.addEventListener('click', function (e) { e.stopPropagation(); if (cur) CP.picker(themeBtn, cur.cid) })
		CP.onChange(function () { syncConvPrefs(); renderInbox() })
	}
	function syncConvPrefs() {
		if (!CP) return
		CP.apply(conv, cur && cur.cid)
		var on = !!(cur && CP.isPinned(cur.peer))
		var label = on ? t('Відкріпити') : t('Закріпити')
		pinBtn.classList.toggle('is-on', on)
		pinBtn.setAttribute('aria-pressed', on ? 'true' : 'false')
		pinBtn.setAttribute('aria-label', label)
		pinBtn.title = label
	}

	/* ---------- розмова ---------- */
	function renderPeer() {
		var p = cur && people[cur.peer]
		peerBox.textContent = ''
		if (!p) return
		peerBox.appendChild(avatar(p, 'uavatar'))
		var info = el('span', 'dm__peer-info')
		var nm = el('strong', null, p.n)
		if (p.role === 't') nm.appendChild(el('span', 'role-badge role-badge--t', t('Викладач')))
		var ab = A.authorBadge && A.authorBadge(cur.peer)
		if (ab) nm.appendChild(ab)
		info.appendChild(nm)
		var st
		if (peerTyping) {
			st = el('span', 'dm__peer-status is-typing')
			st.appendChild(el('span', 'chat-dots'))
			st.appendChild(document.createTextNode(t('друкує…')))
		} else st = el('span', 'dm__peer-status' + (!p.hide && A.isOnline(p.s) ? ' is-on' : ''), statusText(p) + (p.role === 't' && p.subj ? ' · ' + t(p.subj) : ''))
		info.appendChild(st)
		peerBox.appendChild(info)
	}
	// клік по співрозмовнику у шапці - картка профілю
	peerBox.classList.add('is-clickable')
	peerBox.setAttribute('role', 'button')
	peerBox.tabIndex = 0
	peerBox.title = t('Відкрити профіль')
	function openPeerProfile() { if (cur && window.NTU_PROFILE) window.NTU_PROFILE.show(cur.peer, peerBox) }
	peerBox.addEventListener('click', openPeerProfile)
	peerBox.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPeerProfile() } })

	/* ---------- статуси моїх повідомлень ---------- */
	function msgState(m) {
		if (m.pending) return 'pending'
		var p = cur && people[cur.peer]
		if (typeof peerSt.r === 'number' && peerSt.r >= m.ts) return 'read'
		if ((typeof peerSt.d === 'number' && peerSt.d >= m.ts) || (p && !p.hide && p.s >= m.ts)) return 'delivered'
		return 'sent'
	}
	var STATE = {
		pending: ['🕓', 'Надсилається…'], sent: ['✓', 'Надіслано'], delivered: ['✓✓', 'Доставлено'], read: ['✓✓', 'Прочитано']
	}
	function msgNode(m) {
		var mine = m.u === me().uid
		var row = el('div', 'dm-msg' + (mine ? ' is-mine' : ''))
		var b = el('div', 'dm-msg__bubble')
		var g = m.t && MEDIA.GIF_RE.exec(m.t)
		if (m.f) {
			var isImg = /^image\//.test(m.f.type || '')
			var a = el('a', 'dm-file' + (isImg ? ' dm-file--img' : ''))
			a.href = m.f.url
			a.target = '_blank'
			a.rel = 'noopener noreferrer'
			if (isImg) { var im = el('img'); im.src = m.f.url; im.alt = m.f.name; im.loading = 'lazy'; a.appendChild(im) }
			else {
				a.appendChild(el('span', 'dm-file__ic', /pdf/.test(m.f.type || m.f.name) ? 'PDF' : '📎'))
				var fi = el('span', 'dm-file__info')
				fi.appendChild(el('strong', null, m.f.name))
				if (m.f.size) fi.appendChild(el('small', null, fmtSize(m.f.size)))
				a.appendChild(fi)
			}
			b.appendChild(a)
		}
		if (g) {
			var gi = el('img', 'dm-gif')
			gi.src = MEDIA.gifUrl(g[1])
			gi.alt = 'GIF'
			gi.loading = 'lazy'
			b.appendChild(gi)
			b.classList.add('has-gif')
		} else if (m.t) {
			if (isBad(m.t)) b.appendChild(el('p', 'dm-msg__text is-hidden', t('Повідомлення приховано: нецензурна лексика')))
			else {
				var tx = el('p', 'dm-msg__text')
				if (MEDIA.appendRich) MEDIA.appendRich(tx, m.t); else tx.textContent = m.t
				b.appendChild(tx)
			}
		}
		var summary = reactSummary(m.id)
		if (summary.length) {
			var bar = el('div', 'dm-reacts')
			summary.forEach(function (r) {
				var c = el('button', 'dm-react' + (r.mine ? ' is-mine' : ''))
				c.type = 'button'
				var e = el('span', 'dm-react__e')
				e.appendChild(emo(r.e))
				c.appendChild(e)
				if (r.n > 1) c.appendChild(el('span', 'dm-react__n', String(r.n)))
				c.title = r.who
				c.setAttribute('aria-pressed', r.mine ? 'true' : 'false')
				c.addEventListener('click', function () { toggleReact(m.id, r.e) })
				bar.appendChild(c)
			})
			b.appendChild(bar)
		}
		var meta = el('span', 'dm-msg__meta')
		meta.appendChild(el('time', 'dm-msg__time', fmtTime(m.ts)))
		if (mine) {
			var stt = msgState(m), sd = STATE[stt]
			var tk = el('span', 'dm-tick is-' + stt, sd[0])
			tk.title = t(sd[1])
			tk.setAttribute('aria-label', t(sd[1]))
			meta.appendChild(tk)
		}
		b.appendChild(meta)
		if (!m.pending && m.id) {
			b.setAttribute('data-mid', m.id)
			var add = el('button', 'dm-msg__add')
			add.type = 'button'
			add.setAttribute('aria-label', t('Додати реакцію'))
			add.title = t('Реакція · подвійний клік - ❤️')
			add.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/></svg>'
			add.addEventListener('click', function (e) { e.stopPropagation(); openPicker(m.id, add) })
			b.appendChild(add)
			b.addEventListener('dblclick', function (e) {
				if (e.target.closest('a,button')) return
				e.preventDefault()
				if (window.getSelection) window.getSelection().removeAllRanges()
				heart(m.id)
			})
			b.addEventListener('touchend', function (e) {
				if (e.target.closest('a,button') || e.touches.length) return
				var now = Date.now()
				if (lastTap.id === m.id && now - lastTap.ts < 320) { e.preventDefault(); lastTap.id = null; heart(m.id) }
				else { lastTap.id = m.id; lastTap.ts = now }
			})
		}
		row.appendChild(b)
		return row
	}

	/* ---------- реакції ---------- */
	function reactSummary(mid) {
		var r = rx[mid]
		if (!r) return []
		var u = me(), by = {}, order = []
		Object.keys(r).forEach(function (uid) {
			var e = r[uid]
			if (!allowed(e)) return
			if (!by[e]) { by[e] = { e: e, n: 0, mine: false, names: [] }; order.push(e) }
			by[e].n++
			if (u && uid === u.uid) by[e].mine = true
			by[e].names.push(u && uid === u.uid ? t('Ви') : ((people[uid] && people[uid].n) || t('Користувач')))
		})
		return order.map(function (e) { var x = by[e]; x.who = x.names.join(', '); return x })
	}
	function setReact(mid, code) {
		var u = me()
		if (!cur || !u || !mid) return
		if (u.verified === false) { note.textContent = t('Підтвердьте пошту, щоб ставити реакції.'); return }
		var cid = cur.cid, prev = rx[mid] && rx[mid][u.uid]
		if (!rx[mid]) rx[mid] = {}
		if (code) rx[mid][u.uid] = code
		else delete rx[mid][u.uid]
		renderMsgs(false)
		var path = 'dm/' + enc(cid) + '/rx/' + enc(mid) + '/' + enc(u.uid)
		;(code ? A.db('PUT', path, code, true) : A.db('DELETE', path, undefined, true)).then(function () { rxKey = '' }, function () {
			if (prev) rx[mid][u.uid] = prev
			else delete rx[mid][u.uid]
			renderMsgs(false)
			note.textContent = t('Не вдалося зберегти реакцію. Спробуйте ще раз.')
		})
	}
	function toggleReact(mid, code) {
		var u = me()
		if (!u || !allowed(code)) return
		setReact(mid, rx[mid] && rx[mid][u.uid] === code ? null : code)
	}
	function heart(mid) {
		var u = me()
		if (!u) return
		if (!(rx[mid] && rx[mid][u.uid] === '❤️')) setReact(mid, '❤️')
		var b = msgsBox.querySelector('[data-mid="' + (window.CSS && CSS.escape ? CSS.escape(mid) : mid) + '"]')
		if (!b) return
		var h = el('span', 'chat-heart', '❤️')
		h.setAttribute('aria-hidden', 'true')
		b.appendChild(h)
		setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h) }, 900)
	}

	/* --- вибір реакції: 8 швидких + усі емодзі (стандартні та власні) --- */
	var picker = el('div', 'dm-rpick')
	picker.hidden = true
	picker.setAttribute('role', 'dialog')
	picker.setAttribute('aria-label', t('Реакція на повідомлення'))
	var pQuick = el('div', 'chat-rpick__quick'), pMore = el('div', 'chat-rpick__more')
	pMore.hidden = true
	var pickMid = null
	function pbtn(code, cls) {
		var b = el('button', cls)
		b.type = 'button'
		b.appendChild(emo(code))
		b.setAttribute('aria-label', code)
		b.addEventListener('click', function () { var mid = pickMid; closePicker(); toggleReact(mid, code) })
		return b
	}
	QUICK.forEach(function (e) { pQuick.appendChild(pbtn(e, 'chat-rpick__e')) })
	var pPlus = el('button', 'chat-rpick__plus', '+')
	pPlus.type = 'button'
	pPlus.setAttribute('aria-label', t('Більше емодзі'))
	pPlus.addEventListener('click', function (e) { e.stopPropagation(); pMore.hidden = !pMore.hidden; placePicker() })
	pQuick.appendChild(pPlus)
	MEDIA.EMOJI.forEach(function (g) {
		pMore.appendChild(el('p', 'chat-pop__label', t(g[0])))
		var grid = el('div', 'chat-emoji-grid')
		g[1].split(' ').forEach(function (e) { grid.appendChild(pbtn(e, 'chat-emoji')) })
		pMore.appendChild(grid)
	})
	if (MEDIA.onCustom) MEDIA.onCustom(function (list) {
		pMore.appendChild(el('p', 'chat-pop__label', t('Kawaii')))
		var grid = el('div', 'chat-emoji-grid chat-emoji-grid--custom')
		list.forEach(function (c) { grid.appendChild(pbtn(':' + c.id + ':', 'chat-emoji chat-emoji--img')) })
		pMore.appendChild(grid)
		if (cur) renderMsgs(false)
	})
	picker.appendChild(pQuick)
	picker.appendChild(pMore)
	conv.appendChild(picker)
	var pickAnchor = null
	function placePicker() {
		if (picker.hidden || !pickAnchor) return
		var cr = conv.getBoundingClientRect(), ar = pickAnchor.getBoundingClientRect()
		var w = picker.offsetWidth, h = picker.offsetHeight
		var left = Math.max(8, Math.min(ar.left - cr.left - w / 2, cr.width - w - 8))
		var top = ar.top - cr.top - h - 8
		if (top < 8) top = Math.min(ar.bottom - cr.top + 8, cr.height - h - 8)
		picker.style.left = left + 'px'
		picker.style.top = Math.max(8, top) + 'px'
	}
	function openPicker(mid, anchor) {
		if (!picker.hidden && pickMid === mid) { closePicker(); return }
		closePops()
		pickMid = mid
		pickAnchor = anchor
		pMore.hidden = true
		picker.hidden = false
		placePicker()
		var f = picker.querySelector('button')
		if (f) f.focus()
	}
	function closePicker() { picker.hidden = true; pickMid = null; pickAnchor = null }
	msgsBox.addEventListener('scroll', closePicker)
	document.addEventListener('click', function (e) {
		if (!picker.hidden && !picker.contains(e.target) && !(e.target.closest && e.target.closest('.dm-msg__add'))) closePicker()
	})
	document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !picker.hidden) { e.stopPropagation(); closePicker() } }, true)
	function renderMsgs(stick) {
		var atBottom = stick || msgsBox.scrollHeight - msgsBox.scrollTop - msgsBox.clientHeight < 80
		msgsBox.textContent = ''
		if (!msgs.length) msgsBox.appendChild(el('p', 'dm__hint', t('Тут поки порожньо. Напишіть перше повідомлення!')))
		var lastDay = ''
		msgs.forEach(function (m) {
			var day = new Date(m.ts).toDateString()
			if (day !== lastDay) { lastDay = day; msgsBox.appendChild(el('p', 'dm__day', new Date(m.ts).toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'uk-UA', { day: 'numeric', month: 'long' }))) }
			msgsBox.appendChild(msgNode(m))
		})
		if (peerTyping) {
			var ty = el('div', 'chat-typing dm-typing')
			ty.setAttribute('aria-hidden', 'true')
			var bub = el('span', 'chat-typing__bubble')
			bub.appendChild(el('i')); bub.appendChild(el('i')); bub.appendChild(el('i'))
			ty.appendChild(bub)
			msgsBox.appendChild(ty)
		}
		if (atBottom) msgsBox.scrollTop = msgsBox.scrollHeight
	}
	function loadMsgs(stick) {
		if (!cur) return Promise.resolve()
		var cid = cur.cid, peer = cur.peer
		return Promise.all([
			A.db('GET', 'dm/' + enc(cid) + '/msgs?orderBy=%22$key%22&limitToLast=150', undefined, true),
			A.db('GET', 'dm/' + enc(cid) + '/st', undefined, true).catch(function () { return null }),
			A.db('GET', 'dm/' + enc(cid) + '/rx', undefined, true).catch(function () { return null })
		]).then(function (r) {
			var rk = JSON.stringify(r[2] || {})
			var rxChanged = rk !== rxKey
			if (rxChanged) { rxKey = rk; rx = r[2] || {} }
			if (!cur || cur.cid !== cid) return
			var d = r[0], st = r[1] || {}
			var list = Object.keys(d || {}).map(function (k) { var v = d[k]; v.id = k; return v }).sort(function (a, b) { return a.ts - b.ts })
			var changed = list.length !== msgs.length || msgs.some(function (m) { return m.pending }) || (list.length && msgs.length && list[list.length - 1].id !== msgs[msgs.length - 1].id)
			msgs = list
			// співрозмовник друкує, якщо його лічильник c змінився з минулого опитування
			var ps = st[peer] || {}
			var typing = stPrevC !== null && ps.c && ps.c !== stPrevC
			stPrevC = ps.c || ''
			var k = JSON.stringify([ps.d || 0, ps.r || 0])
			var stChanged = k !== stKey || typing !== peerTyping
			stKey = k
			peerSt = ps
			if (typing !== peerTyping) { peerTyping = typing; renderPeer() }
			if ((changed || stick || stChanged || rxChanged) && picker.hidden) renderMsgs(stick)
			markRead()
		}).catch(function () {})
	}
	function markRead() {
		var u = me(), x = cur && inbox[cur.cid]
		if (!msgs.length || document.hidden || modal.hidden) return
		// позначка для співрозмовника: «прочитано» до останнього повідомлення
		var lastPeer = 0
		msgs.forEach(function (m) { if (m.u !== u.uid && m.ts > lastPeer) lastPeer = m.ts })
		if (lastPeer > readMarked) {
			readMarked = lastPeer
			A.db('PATCH', 'dm/' + enc(cur.cid) + '/st/' + enc(u.uid), { d: SV, r: SV }, true).catch(function () { readMarked = 0 })
		}
		if (!x) return
		var lastTs = msgs[msgs.length - 1].ts
		if ((x.r || 0) >= lastTs) return
		x.r = lastTs
		A.db('PATCH', 'inbox/' + enc(u.uid) + '/' + enc(cur.cid), { w: cur.peer, ts: x.ts || lastTs, r: lastTs }, true).catch(function () {})
		syncBadge()
		renderInbox()
	}
	function openConv(peer) {
		var u = me()
		if (!u || peer === u.uid) return
		cur = { peer: peer, cid: cidFor(u.uid, peer) }
		msgs = []
		peerSt = {}; stPrevC = null; peerTyping = false; stKey = ''; readMarked = 0; rx = {}; rxKey = ''
		closePicker()
		modal.classList.add('is-conv')
		if (CP) CP.closePicker()
		syncConvPrefs()
		conv.hidden = false
		placeholder.hidden = true
		msgsBox.textContent = ''
		msgsBox.appendChild(el('p', 'dm__hint', t('Завантажуємо...')))
		loadPerson(peer, true).then(function () { renderPeer(); renderInbox() })
		loadMsgs(true)
		clearInterval(pollTimer)
		pollTimer = setInterval(function () { if (!document.hidden && !modal.hidden) loadMsgs(false) }, 2500)
		clearInterval(peerTimer)
		peerTimer = setInterval(function () { if (!document.hidden && !modal.hidden && cur) loadPerson(cur.peer, true).then(renderPeer) }, 30000)
		setTimeout(function () { var i = form.querySelector('.dm__input'); if (i) i.focus() }, 60)
	}
	$('[data-dm-back]', modal).addEventListener('click', function () {
		cur = null
		if (CP) CP.closePicker()
		syncConvPrefs()
		clearInterval(pollTimer)
		modal.classList.remove('is-conv')
		conv.hidden = true
		placeholder.hidden = false
		renderInbox()
	})

	/* ---------- форма: текст, емодзі, GIF, файл ---------- */
	function toolBtn(cls, label, html) {
		var b = el('button', 'chat-tool ' + cls)
		b.type = 'button'
		b.setAttribute('aria-label', label)
		b.title = label
		b.innerHTML = html
		return b
	}
	var input = el('textarea', 'dm__input')
	input.rows = 1
	input.maxLength = MAX_LEN
	input.placeholder = t('Напишіть повідомлення…')
	input.setAttribute('aria-label', t('Повідомлення'))
	var fileIn = el('input')
	fileIn.type = 'file'
	fileIn.hidden = true
	fileIn.accept = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.docx,.xlsx,.pptx,.zip'
	var attach = toolBtn('chat-tool--file', t('Надіслати файл'), '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 11-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5"/></svg>')
	var emojiBtn = toolBtn('chat-tool--emoji', t('Емодзі'), '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/></svg>')
	var gifBtn = toolBtn('chat-tool--gif', t('GIF-анімації'), '<span aria-hidden="true">GIF</span>')
	var send = el('button', 'chat-send')
	send.type = 'submit'
	send.setAttribute('aria-label', t('Надіслати'))
	send.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'
	var note = el('p', 'chat-note')
	var progress = el('div', 'dm__progress')
	progress.hidden = true
	progress.appendChild(el('span'))

	var emojiPop = el('div', 'chat-pop chat-pop--emoji')
	emojiPop.hidden = true
	MEDIA.EMOJI.forEach(function (g) {
		emojiPop.appendChild(el('p', 'chat-pop__label', t(g[0])))
		var grid = el('div', 'chat-emoji-grid')
		g[1].split(' ').forEach(function (e) {
			var b = el('button', 'chat-emoji', e)
			b.type = 'button'
			b.addEventListener('click', function () { insert(e) })
			grid.appendChild(b)
		})
		emojiPop.appendChild(grid)
	})
	if (MEDIA.onCustom) MEDIA.onCustom(function (list) {
		emojiPop.appendChild(el('p', 'chat-pop__label', t('Kawaii')))
		var grid = el('div', 'chat-emoji-grid chat-emoji-grid--custom')
		list.forEach(function (c) {
			var b = el('button', 'chat-emoji chat-emoji--img')
			b.type = 'button'
			b.setAttribute('aria-label', c.name || c.id)
			b.appendChild(MEDIA.emojiNode(':' + c.id + ':'))
			b.addEventListener('click', function () { insert(':' + c.id + ':') })
			grid.appendChild(b)
		})
		emojiPop.appendChild(grid)
	})
	var gifPop = el('div', 'chat-pop chat-pop--gif')
	gifPop.hidden = true
	var gifCats = el('div', 'chat-gif-cats'), gifGrid = el('div', 'chat-gif-grid')
	gifPop.appendChild(gifCats)
	gifPop.appendChild(gifGrid)
	function showGifs(ids) {
		gifGrid.textContent = ''
		ids.forEach(function (id) {
			var b = el('button', 'chat-gif-pick')
			b.type = 'button'
			b.setAttribute('aria-label', t('Надіслати GIF'))
			var im = el('img'); im.src = MEDIA.gifUrl(id); im.alt = ''; im.loading = 'lazy'
			b.appendChild(im)
			b.addEventListener('click', function () { closePops(); deliver({ t: '[gif:' + id + ']' }, 'GIF') })
			gifGrid.appendChild(b)
		})
	}
	MEDIA.GIFS.forEach(function (g, i) {
		var c = el('button', 'chat-gif-cat' + (i === 0 ? ' is-active' : ''), t(g[0]))
		c.type = 'button'
		c.addEventListener('click', function () {
			Array.prototype.forEach.call(gifCats.children, function (x) { x.classList.remove('is-active') })
			c.classList.add('is-active')
			showGifs(g[1].split(' '))
		})
		gifCats.appendChild(c)
	})
	if (MEDIA.GIFS.length) showGifs(MEDIA.GIFS[0][1].split(' '))

	var row = el('div', 'chat-form__row')
	;[attach, emojiBtn, gifBtn, input, send].forEach(function (x) { row.appendChild(x) })
	;[emojiPop, gifPop, progress, row, note, fileIn].forEach(function (x) { form.appendChild(x) })

	function closePops() { emojiPop.hidden = true; gifPop.hidden = true; emojiBtn.classList.remove('is-active'); gifBtn.classList.remove('is-active') }
	function toggle(pop, btn) { var open = pop.hidden; closePops(); if (open) { pop.hidden = false; btn.classList.add('is-active') } }
	emojiBtn.addEventListener('click', function () { toggle(emojiPop, emojiBtn) })
	gifBtn.addEventListener('click', function () { toggle(gifPop, gifBtn) })
	modal.addEventListener('click', function (e) {
		if (!e.target.closest('.chat-pop') && !e.target.closest('.chat-tool--emoji') && !e.target.closest('.chat-tool--gif')) closePops()
	})
	function insert(s) {
		var a = input.selectionStart || input.value.length, b = input.selectionEnd || input.value.length
		if (input.value.length - (b - a) + s.length > MAX_LEN) return
		input.value = input.value.slice(0, a) + s + input.value.slice(b)
		input.focus()
		input.setSelectionRange(a + s.length, a + s.length)
	}
	input.addEventListener('keydown', function (e) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })) }
	})
	input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px' })
	input.addEventListener('input', function () {
		var u = me()
		if (!cur || !u || u.verified === false || !input.value.trim() || Date.now() - myTypingAt < 1500 || (A.pref && !A.pref('typing'))) return
		myTypingAt = Date.now()
		A.db('PATCH', 'dm/' + enc(cur.cid) + '/st/' + enc(u.uid), { c: Math.random().toString(36).slice(2, 10) }, true).catch(function () {})
	})

	function canWrite() {
		var u = me()
		if (!u) return false
		if (u.verified === false) { note.textContent = t('Підтвердьте пошту, щоб писати повідомлення.'); return false }
		return true
	}
	function deliver(payload, prev) {
		var u = me()
		note.textContent = ''
		if (!cur || !canWrite()) return Promise.resolve(false)
		if (Date.now() - lastSent < 800) { note.textContent = t('Не так швидко - зачекайте секунду'); return Promise.resolve(false) }
		lastSent = Date.now()
		var msg = { u: u.uid, ts: { '.sv': 'timestamp' } }
		if (payload.t) msg.t = payload.t
		if (payload.f) msg.f = payload.f
		send.disabled = true
		var cid = cur.cid, peer = cur.peer, now = Date.now()
		var temp = { u: u.uid, ts: now, pending: true, id: 'tmp' + now }
		if (payload.t) temp.t = payload.t
		if (payload.f) temp.f = payload.f
		msgs.push(temp)
		renderMsgs(true)
		var lp = String(prev || preview(payload)).slice(0, 110)
		return A.db('POST', 'dm/' + enc(cid) + '/msgs', msg, true).then(function () {
			inbox[cid] = { w: peer, l: lp, ts: now, lu: u.uid, r: now }
			return Promise.all([
				A.db('PATCH', 'inbox/' + enc(u.uid) + '/' + enc(cid), inbox[cid], true),
				A.db('PATCH', 'inbox/' + enc(peer) + '/' + enc(cid), { w: u.uid, l: lp, ts: now, lu: u.uid }, true)
			])
		}).then(function () {
			loadMsgs(true)
			renderInbox()
			return true
		}, function (e) {
			note.textContent = e && e.code === 'PERMISSION' ? t('Сервер не прийняв повідомлення. Підтвердьте пошту або увійдіть знову.') : t('Не вдалося надіслати. Перевірте з’єднання й спробуйте ще раз.')
			msgs = msgs.filter(function (m) { return m !== temp })
			renderMsgs(false)
			return false
		}).then(function (ok) { send.disabled = false; return ok })
	}
	form.addEventListener('submit', function (e) {
		e.preventDefault()
		closePops()
		var text = input.value.trim()
		if (!text) { input.focus(); return }
		if (isBad(text)) { note.textContent = t('Нецензурна лексика заборонена. Будь ласка, спілкуйтеся ввічливо.'); return }
		deliver({ t: text.slice(0, MAX_LEN) }).then(function (ok) { if (ok) { input.value = ''; input.style.height = '' } input.focus() })
	})
	attach.addEventListener('click', function () { if (canWrite()) fileIn.click() })
	fileIn.addEventListener('change', function () {
		var f = fileIn.files && fileIn.files[0]
		fileIn.value = ''
		if (!f || !cur) return
		note.textContent = ''
		if (f.size > 10 * 1024 * 1024) { note.textContent = t('Файл завеликий (максимум 10 МБ).'); return }
		progress.hidden = false
		progress.firstChild.style.width = '4%'
		attach.disabled = true
		A.upload(f, 'chat', function (p) { progress.firstChild.style.width = p + '%' }).then(function (r) {
			return deliver({ f: { url: r.url, name: r.name, size: r.size, type: r.type } }, '📎 ' + r.name)
		}).catch(function (e) { note.textContent = e.message || t('Не вдалося завантажити файл.') })
			.then(function () { progress.hidden = true; attach.disabled = false })
	})

	/* ---------- відкриття ---------- */
	function openModal(peer) {
		if (!me()) { location.href = 'login.html'; return }
		if (!A.remote) {
			modal.hidden = false
			listBox.textContent = ''
			listBox.appendChild(el('p', 'dm__hint', t('Листування працює лише після підключення сервера.')))
			return
		}
		document.querySelectorAll('.modal:not([hidden])').forEach(function (m) { if (m !== modal) m.hidden = true })
		modal.hidden = false
		document.body.style.overflow = 'hidden'
		listBox.textContent = ''
		listBox.appendChild(el('p', 'dm__hint', t('Завантажуємо...')))
		loadInbox()
		if (peer) openConv(peer)
	}
	window.NTU_DM = { open: openModal }
	document.addEventListener('click', function (e) {
		var b = e.target.closest && e.target.closest('[data-dm-open]')
		if (b) { e.preventDefault(); openModal(b.getAttribute('data-dm-open') || '') }
	})
	// закриття вікна зупиняє опитування сервера
	new MutationObserver(function () {
		if (modal.hidden) { clearInterval(pollTimer); clearInterval(peerTimer); closePops() }
	}).observe(modal, { attributes: true, attributeFilter: ['hidden'] })
	document.addEventListener('ntu:lang', function () { if (!modal.hidden) { renderInbox(); renderPeer(); renderMsgs(false) } })

	var started = false
	A.onChange(function (u) {
		if (!u || !A.remote || started) return
		started = true
		loadInbox()
		inboxTimer = setInterval(function () { if (!document.hidden) loadInbox() }, 20000)
		var q = new URLSearchParams(location.search).get('dm')
		if (q && /^[A-Za-z0-9]{6,64}$/.test(q)) setTimeout(function () { openModal(q) }, 300)
	})
})()
