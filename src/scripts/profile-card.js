/* Картка користувача: відкривається по кліку на аватар або ім'я в загальному чаті та в особистому листуванні.
   window.NTU_PROFILE.show(uid). Дані: users/{uid} (публічно: ім'я, фото, остання активність),
   profiles/{uid} та reviews/{uid} (лише для тих, хто увійшов). */
;(function () {
	'use strict'
	var A = window.NTU_AUTH
	if (!A) return
	function t(s) { return typeof T === 'function' ? T(s) : s }
	function el(tag, cls, text) {
		var e = document.createElement(tag)
		if (cls) e.className = cls
		if (text != null) e.textContent = text
		return e
	}
	var COURSE_LABEL = { '1': '1 курс', '2': '2 курс', '3': '3 курс', '4': '4 курс', '5': '5 курс', '6': '6 курс' }
	var TG = /^[A-Za-z0-9_]{5,32}$/

	var overlay = null, box = null, lastFocus = null, curUid = null, curData = null
	function build() {
		overlay = el('div', 'uprof-overlay')
		overlay.hidden = true
		box = el('div', 'uprof')
		box.setAttribute('role', 'dialog')
		box.setAttribute('aria-modal', 'true')
		box.setAttribute('aria-label', t('Профіль користувача'))
		overlay.appendChild(box)
		overlay.addEventListener('click', function (e) { if (e.target === overlay) close() })
		document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay && !overlay.hidden) { e.stopPropagation(); close() } }, true)
		document.addEventListener('ntu:theme', function () { if (curData) paintBg() })
		document.addEventListener('ntu:lang', function () { if (curData) render() })
		document.body.appendChild(overlay)
	}
	function close() {
		if (!overlay || overlay.hidden) return
		overlay.hidden = true
		curUid = null
		curData = null
		if (lastFocus && lastFocus.focus) lastFocus.focus()
	}
	function avatar(u) {
		var a
		if (u.a) { a = el('img', 'uavatar uavatar--lg'); a.src = u.a; a.alt = '' } else a = el('span', 'uavatar uavatar--lg uavatar--ph', A.initials(u.n || '?'))
		return a
	}
	function stars(avg) {
		var w = el('span', 'stars')
		w.appendChild(el('span', 'stars__bg', '★★★★★'))
		var f = el('span', 'stars__fg', '★★★★★')
		f.style.width = Math.max(0, Math.min(100, avg / 5 * 100)) + '%'
		w.appendChild(f)
		return w
	}
	var headNode = null
	function paintBg() { if (headNode && A.applyBackground) A.applyBackground(headNode, A.themeBg ? A.themeBg(curData.p) : curData.p.bg) }
	function render() {
		var d = curData, u = d.u, p = d.p, me = A.user
		var self = me && me.uid === d.uid
		box.textContent = ''
		var x = el('button', 'uprof__close', '✕')
		x.type = 'button'
		x.setAttribute('aria-label', t('Закрити'))
		x.addEventListener('click', close)
		box.appendChild(x)

		var head = el('div', 'uprof__head')
		headNode = head
		var av = el('div', 'uprof__av')
		av.appendChild(avatar(u))
		var on = self || (!p.hide && A.isOnline(u.s))
		var dot = el('span', 'online-dot' + (on ? ' is-on' : ''))
		dot.setAttribute('aria-hidden', 'true')
		av.appendChild(dot)
		head.appendChild(av)
		var hi = el('div', 'uprof__hi')
		hi.appendChild(el('h3', 'uprof__name', u.n || t('Користувач')))
		hi.appendChild(el('p', 'uprof__status' + (on ? ' is-on' : ''), self ? t('Це ви') : p.hide ? t('Статус «в мережі» приховано') : A.lastSeen(u.s)))
		if (d.full) {
			var rl = el('p', 'uprof__role')
			rl.appendChild(el('span', 'role-badge' + (p.role === 't' ? ' role-badge--t' : ''), p.role === 't' ? t('Викладач') : t('Учень')))
			if (p.role === 't' && p.subj) rl.appendChild(document.createTextNode(' ' + t(p.subj)))
			hi.appendChild(rl)
		}
		var ab = A.authorBadge && A.authorBadge(d.uid)
		if (ab) {
			var al = el('p', 'uprof__role')
			al.appendChild(ab)
			hi.appendChild(al)
		}
		head.appendChild(hi)
		box.appendChild(head)
		paintBg()

		var body = el('div', 'uprof__body')
		if (!d.full) {
			body.appendChild(el('p', 'uprof__hint', t('Увійдіть, щоб бачити профіль, рейтинг і писати повідомлення.')))
			var lg = el('a', 'btn btn-primary', t('Увійти'))
			lg.href = 'login.html'
			body.appendChild(lg)
			box.appendChild(body)
			return
		}
		var vals = Object.keys(d.rev || {}).map(function (k) { return d.rev[k] && d.rev[k].r }).filter(function (r) { return r >= 1 && r <= 5 })
		var rating = el('div', 'uprof__rating')
		if (vals.length) {
			var avg = vals.reduce(function (a, b) { return a + b }, 0) / vals.length
			rating.appendChild(stars(avg))
			rating.appendChild(el('span', null, avg.toFixed(1) + ' · ' + vals.length + ' ' + t('відгуків')))
		} else rating.appendChild(el('span', 'uprof__muted', t('Ще немає відгуків')))
		body.appendChild(rating)

		var dl = el('dl', 'uprof__facts')
		function fact(k, v) { if (!v) return; dl.appendChild(el('dt', null, t(k))); dl.appendChild(el('dd', null, v)) }
		fact('Факультет', p.f ? t(p.f) : '')
		fact('Курс', p.c ? t(COURSE_LABEL[p.c] || p.c) : '')
		fact('Вік', p.age ? String(p.age) : '')
		fact('Telegram', p.tg && TG.test(p.tg) ? '@' + p.tg : '')
		if (dl.children.length) body.appendChild(dl)
		else body.appendChild(el('p', 'uprof__muted', t('Користувач ще не заповнив профіль.')))

		var acts = el('div', 'uprof__actions')
		if (!self) {
			var w = el('button', 'btn btn-primary', t('Написати тут'))
			w.type = 'button'
			w.addEventListener('click', function () {
				var uid = d.uid
				close()
				if (window.NTU_DM && window.NTU_DM.open) window.NTU_DM.open(uid)
				else location.href = 'personal-area.html?dm=' + encodeURIComponent(uid)
			})
			acts.appendChild(w)
		}
		if (p.tg && TG.test(p.tg)) {
			var tg = el('a', 'btn tgbtn', 'Telegram')
			tg.href = 'https://t.me/' + p.tg
			tg.target = '_blank'
			tg.rel = 'noopener noreferrer'
			acts.appendChild(tg)
		}
		if (acts.children.length) body.appendChild(acts)
		box.appendChild(body)
	}

	function show(uid, opener) {
		if (!uid || !/^[A-Za-z0-9_-]{6,64}$/.test(uid)) return
		if (!overlay) build()
		lastFocus = opener || document.activeElement
		curUid = uid
		box.textContent = ''
		box.appendChild(el('p', 'uprof__loading', t('Завантажуємо...')))
		overlay.hidden = false
		var full = !!A.user && A.remote
		var reqs = [A.db('GET', 'users/' + encodeURIComponent(uid), undefined, !!A.user).catch(function () { return null })]
		if (full) {
			reqs.push(A.db('GET', 'profiles/' + encodeURIComponent(uid), undefined, true).catch(function () { return null }))
			reqs.push(A.db('GET', 'reviews/' + encodeURIComponent(uid), undefined, true).catch(function () { return null }))
		}
		Promise.all(reqs).then(function (r) {
			if (curUid !== uid) return
			if (!r[0]) { box.textContent = ''; box.appendChild(el('p', 'uprof__loading', t('Не вдалося завантажити профіль.'))); return }
			curData = { uid: uid, u: r[0] || {}, p: r[1] || {}, rev: r[2] || {}, full: full }
			render()
			var c = box.querySelector('.uprof__close')
			if (c) c.focus()
		})
	}
	window.NTU_PROFILE = { show: show, close: close }
})()
