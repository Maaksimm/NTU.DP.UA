/* Сторінка «Рейтинг»: топ викладачів і студентів, оновлюється автоматично.
   Дані: users (ім'я, фото, активність), profiles (роль, предмет, курс), reviews/{uid}/{author} = {r: 1-5}.
   Бал - баєсове середнє: (сума оцінок + m * C) / (кількість + m), m = 3, C - середня оцінка в цій ролі.
   Відгуки опитуються кожні 6 с, профілі - 30 с, користувачі - 60 с (у них фото, тож рідше). */
;(function () {
	'use strict'
	var A = window.NTU_AUTH
	var box = document.querySelector('[data-rank]')
	if (!A || !box) return
	function t(s) { return typeof T === 'function' ? T(s) : s }
	function $(s) { return box.querySelector(s) }
	function el(tag, cls, text) {
		var e = document.createElement(tag)
		if (cls) e.className = cls
		if (text != null) e.textContent = text
		return e
	}
	var M = 3
	var listBox = $('[data-rank-list]'), podium = $('[data-rank-podium]'), empty = $('[data-rank-empty]')
	var liveText = $('[data-rank-live-text]'), live = $('[data-rank-live]'), stats = $('[data-rank-stats]')
	var guest = $('[data-rank-guest]'), filters = $('[data-rank-filters]')
	var fq = $('[data-rank-q]'), fsubj = $('[data-rank-subj]'), fcourse = $('[data-rank-course]')
	var tab = 't'
	var users = null, profs = null, revs = null
	var prevRank = {}, moves = {}, lastKey = ''
	var timers = []

	;(A.SUBJECTS || []).forEach(function (s) { var o = el('option', null, t(s)); o.value = s; fsubj.appendChild(o) })
	;['1', '2', '3', '4', '5', '6'].forEach(function (c) { var o = el('option', null, t(c + ' курс')); o.value = c; fcourse.appendChild(o) })

	Array.prototype.forEach.call(box.querySelectorAll('[data-rank-tab]'), function (b) {
		b.addEventListener('click', function () {
			tab = b.getAttribute('data-rank-tab')
			Array.prototype.forEach.call(box.querySelectorAll('[data-rank-tab]'), function (x) {
				var on = x === b
				x.classList.toggle('is-active', on)
				x.setAttribute('aria-selected', on ? 'true' : 'false')
			})
			fsubj.hidden = tab !== 't'
			fcourse.hidden = tab === 't'
			fq.placeholder = tab === 't' ? t("Пошук за ім'ям або предметом") : t("Пошук за ім'ям")
			moves = {}
			render(true)
		})
	})
	;[fq, fsubj, fcourse].forEach(function (f) { f.addEventListener(f === fq ? 'input' : 'change', function () { render(true) }) })

	function avatar(u) {
		if (u.a) { var i = el('img', 'uavatar'); i.src = u.a; i.alt = ''; i.loading = 'lazy'; return i }
		return el('span', 'uavatar uavatar--ph', A.initials(u.n || '?'))
	}
	function stars(avg) {
		var w = el('span', 'stars')
		w.appendChild(el('span', 'stars__bg', '★★★★★'))
		var f = el('span', 'stars__fg', '★★★★★')
		f.style.width = Math.max(0, Math.min(100, avg / 5 * 100)) + '%'
		w.appendChild(f)
		w.setAttribute('aria-label', avg.toFixed(1) + ' / 5')
		return w
	}
	function plural(n, one, few, many) {
		var a = n % 10, b = n % 100
		return t(a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many)
	}
	function rows() {
		if (!users || !profs || !revs) return null
		var byRole = { t: [], s: [] }, sums = { t: [0, 0], s: [0, 0] }
		Object.keys(users).forEach(function (uid) {
			var u = users[uid] || {}, p = profs[uid] || {}, r = revs[uid] || {}
			var role = p.role === 't' ? 't' : 's'
			var vals = Object.keys(r).map(function (k) { return r[k] && r[k].r }).filter(function (x) { return x >= 1 && x <= 5 })
			var sum = vals.reduce(function (a, b) { return a + b }, 0)
			sums[role][0] += sum
			sums[role][1] += vals.length
			byRole[role].push({ uid: uid, n: u.n || t('Користувач'), a: u.a || '', s: p.hide ? 0 : u.s, role: role, subj: p.subj || '', c: p.c || '', f: p.f || '', count: vals.length, sum: sum, avg: vals.length ? sum / vals.length : 0 })
		})
		;['t', 's'].forEach(function (role) {
			var C = sums[role][1] ? sums[role][0] / sums[role][1] : 3.5
			byRole[role].forEach(function (x) { x.score = x.count ? (x.sum + M * C) / (x.count + M) : 0 })
			byRole[role].sort(function (a, b) { return b.score - a.score || b.count - a.count || b.avg - a.avg || a.n.localeCompare(b.n) })
		})
		return { byRole: byRole, reviews: sums.t[1] + sums.s[1] }
	}
	function meta(x) {
		var m = []
		if (x.role === 't' && x.subj) m.push(t(x.subj))
		if (x.role === 's' && x.c) m.push(t(x.c + ' курс'))
		if (x.f) m.push(t(x.f))
		return m.join(' · ')
	}
	function nameNode(x, tag) {
		var n = el(tag || 'strong', 'rank__name', x.n)
		var ab = A.authorBadge && A.authorBadge(x.uid)
		if (ab) { n.appendChild(document.createTextNode(' ')); n.appendChild(ab) }
		return n
	}
	function moveNode(uid) {
		var mv = moves[uid]
		if (!mv) return null
		var s = el('span', 'rank__move ' + (mv > 0 ? 'is-up' : 'is-down'), (mv > 0 ? '▲' : '▼') + Math.abs(mv))
		s.title = mv > 0 ? t('Піднявся в рейтингу') : t('Опустився в рейтингу')
		return s
	}
	function openProfile(uid, opener) { if (window.NTU_PROFILE) window.NTU_PROFILE.show(uid, opener) }
	function clickable(node, uid) {
		node.tabIndex = 0
		node.setAttribute('role', 'button')
		node.addEventListener('click', function () { openProfile(uid, node) })
		node.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfile(uid, node) } })
	}

	function render(force) {
		var d = rows()
		if (!d) return
		var all = d.byRole[tab]
		var ranked = all.filter(function (x) { return x.count > 0 })
		// місця для стрілок рахуються по всій вкладці, без фільтрів
		var key = tab + '|' + ranked.map(function (x) { return x.uid + ':' + x.score.toFixed(4) }).join(',')
		if (key !== lastKey) {
			var pr = prevRank[tab]
			var now = {}
			ranked.forEach(function (x, i) { now[x.uid] = i + 1 })
			if (pr) ranked.forEach(function (x) { if (pr[x.uid] && pr[x.uid] !== now[x.uid]) moves[x.uid] = pr[x.uid] - now[x.uid] })
			prevRank[tab] = now
			lastKey = key
		} else if (!force) return
		var placeOf = prevRank[tab] || {}

		var q = fq.value.trim().toLowerCase()
		var shown = ranked.filter(function (x) {
			if (q && x.n.toLowerCase().indexOf(q) < 0 && x.subj.toLowerCase().indexOf(q) < 0 && t(x.subj).toLowerCase().indexOf(q) < 0) return false
			if (tab === 't' && fsubj.value && x.subj !== fsubj.value) return false
			if (tab === 's' && fcourse.value && x.c !== fcourse.value) return false
			return true
		})

		stats.textContent = ''
		;[[d.byRole.t.filter(function (x) { return x.count }).length, d.byRole.t.length, 'викладачів'], [d.byRole.s.filter(function (x) { return x.count }).length, d.byRole.s.length, 'студентів']].forEach(function (s) {
			var c = el('div', 'rank__stat')
			c.appendChild(el('strong', null, String(s[0])))
			c.appendChild(el('span', null, t(s[2] === 'викладачів' ? 'викладачів у рейтингу' : 'студентів у рейтингу') + ' · ' + t('усього') + ' ' + s[1]))
			stats.appendChild(c)
		})
		var rc = el('div', 'rank__stat')
		rc.appendChild(el('strong', null, String(d.reviews)))
		rc.appendChild(el('span', null, plural(d.reviews, 'відгук', 'відгуки', 'відгуків') + ' ' + t('на платформі')))
		stats.appendChild(rc)

		podium.textContent = ''
		listBox.textContent = ''
		var filtered = q || fsubj.value || fcourse.value
		var top = filtered ? [] : shown.slice(0, 3)
		var rest = filtered ? shown : shown.slice(3)
		var order = [1, 0, 2]
		order.forEach(function (i) {
			var x = top[i]
			if (!x) return
			var c = el('article', 'rank__pod rank__pod--' + (i + 1))
			c.appendChild(el('span', 'rank__medal', ['🥇', '🥈', '🥉'][i]))
			var av = el('span', 'rank__pav')
			av.appendChild(avatar(x))
			var on = A.isOnline(x.s)
			if (on) { var dt = el('span', 'online-dot is-on'); dt.setAttribute('aria-hidden', 'true'); av.appendChild(dt) }
			c.appendChild(av)
			c.appendChild(nameNode(x))
			var mt = meta(x)
			if (mt) c.appendChild(el('span', 'rank__meta', mt))
			var sc = el('span', 'rank__score')
			sc.appendChild(stars(x.avg))
			sc.appendChild(el('b', null, x.score.toFixed(2)))
			c.appendChild(sc)
			c.appendChild(el('span', 'rank__cnt', x.avg.toFixed(1) + ' ★ · ' + x.count + ' ' + plural(x.count, 'відгук', 'відгуки', 'відгуків')))
			var mv = moveNode(x.uid)
			if (mv) c.appendChild(mv)
			c.appendChild(el('span', 'rank__step', String(i + 1)))
			clickable(c, x.uid)
			podium.appendChild(c)
		})
		podium.hidden = !top.length
		rest.forEach(function (x) {
			var li = el('li', 'rank__row')
			li.appendChild(el('span', 'rank__pos', String(placeOf[x.uid] || '')))
			var av = el('span', 'rank__av')
			av.appendChild(avatar(x))
			li.appendChild(av)
			var info = el('span', 'rank__info')
			info.appendChild(nameNode(x))
			var mt = meta(x)
			if (mt) info.appendChild(el('span', 'rank__meta', mt))
			li.appendChild(info)
			var sc = el('span', 'rank__score')
			sc.appendChild(stars(x.avg))
			sc.appendChild(el('b', null, x.score.toFixed(2)))
			sc.appendChild(el('small', null, x.count + ' ' + plural(x.count, 'відгук', 'відгуки', 'відгуків')))
			li.appendChild(sc)
			var mv = moveNode(x.uid)
			li.appendChild(mv || el('span', 'rank__move'))
			clickable(li, x.uid)
			listBox.appendChild(li)
		})
		var none = all.length - ranked.length
		var msg = ''
		if (!shown.length) msg = filtered ? t('Нікого не знайдено за цими умовами.') : (tab === 't' ? t('Поки що жоден викладач не отримав відгуків. Залиште перший відгук у профілі викладача!') : t('Поки що жоден студент не отримав відгуків. Залиште перший відгук у профілі студента!'))
		if (!filtered && none) msg += (msg ? ' ' : '') + t('Ще без відгуків:') + ' ' + none + '. ' + t('Залиште відгук у профілі користувача, щоб він потрапив у рейтинг.')
		empty.textContent = msg
		empty.hidden = !msg
	}

	function stamp(ok) {
		live.classList.toggle('is-off', !ok)
		var d = new Date()
		liveText.textContent = ok ? t('Наживо') + ' · ' + t('оновлено о') + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2) : t('Немає з’єднання - спробуємо ще раз')
	}
	function get(path) { return A.db('GET', path, undefined, true) }
	function pull(what) {
		if (document.hidden) return Promise.resolve()
		return get(what).then(function (v) {
			if (what === 'users') users = v || {}
			else if (what === 'profiles') profs = v || {}
			else revs = v || {}
			stamp(true)
			render(false)
		}, function (e) {
			stamp(false)
			if (e && e.code === 'PERMISSION') showGuest()
		})
	}
	function showGuest() {
		guest.hidden = false
		filters.hidden = true
		podium.textContent = ''
		listBox.textContent = ''
		stats.textContent = ''
		live.hidden = true
	}
	function stop() { timers.forEach(clearInterval); timers = [] }
	function start() {
		stop()
		guest.hidden = true
		filters.hidden = false
		live.hidden = false
		listBox.textContent = ''
		listBox.appendChild(el('li', 'rank__loading', t('Завантажуємо...')))
		Promise.all([pull('users'), pull('profiles'), pull('reviews')]).then(function () { render(true) })
		timers.push(setInterval(function () { pull('reviews') }, 6000))
		timers.push(setInterval(function () { pull('profiles') }, 30000))
		timers.push(setInterval(function () { pull('users') }, 60000))
	}
	document.addEventListener('visibilitychange', function () { if (!document.hidden && timers.length) pull('reviews') })
	document.addEventListener('ntu:lang', function () { render(true) })

	var started = null
	A.onChange(function (u) {
		var id = u ? u.uid : ''
		if (id === started) return
		started = id
		if (!u) { stop(); showGuest(); return }
		if (!A.remote) {
			showGuest()
			guest.querySelector('h2').textContent = t('Рейтинг працює лише після підключення сервера.')
			return
		}
		start()
	})
})()
