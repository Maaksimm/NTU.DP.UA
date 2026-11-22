/* personal-area.html: панель суперадміна «Модерація» (admins/{uid} = true).
   - Скарги: reports/{kind_id}/{uid} = {k: chat|story|tale, id, o: автор, x: уривок, r: причина, ts}.
     «Видалити запис» прибирає сам запис (повідомлення / сторіз + лайки / історію) і скаргу; «Залишити» - лише скаргу.
   - Журнал дій: adminLog (останні записи, «Показати ще» підвантажує старіші).
   - Файли на сервері: api/cleanup.php (scan -> clean). */
;(function () {
	var A = window.NTU_AUTH
	var root = document.querySelector('[data-admin-tools]')
	if (!A || !root || !A.isAdmin || !A.remote) return
	var T = window.T || function (s) { return s }
	var $ = function (s) { return root.querySelector(s) }
	var repBox = $('[data-at-reports]'), repCount = $('[data-at-rcount]')
	var logBox = $('[data-at-log]'), moreBtn = $('[data-at-more]')
	var filesBox = $('[data-at-files]'), scanBtn = $('[data-at-scan]'), cleanBtn = $('[data-at-clean]'), status = $('[data-at-status]')
	var PAGE = 30
	var KIND = { chat: 'Повідомлення в чаті', story: 'Сторіз', tale: 'Історія студента' }
	var ACT = {
		'role.approve': 'надав роль викладача', 'role.reject': 'відхилив запит на роль викладача', 'role.remove': 'зняв роль викладача',
		'chat.delete': 'видалив повідомлення в чаті', 'story.delete': 'видалив сторіз', 'tale.delete': 'видалив історію студента',
		'material.approve': 'схвалив матеріал', 'material.reject': 'відхилив матеріал', 'material.remove': 'прибрав матеріал із сайту',
		'report.delete': 'видалив запис за скаргою', 'report.dismiss': 'відхилив скаргу', 'files.clean': 'очистив файли на сервері'
	}
	var names = {}
	var shownFor = null

	function el(tag, cls, text) {
		var e = document.createElement(tag)
		if (cls) e.className = cls
		if (text != null) e.textContent = text
		return e
	}
	function when(ms) {
		try { return new Date(ms).toLocaleString(document.documentElement.lang === 'en' ? 'en-GB' : 'uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch (e) { return '' }
	}
	function nameOf(uid) {
		if (!uid) return Promise.resolve('')
		if (!names[uid]) names[uid] = A.profile(uid).then(function (p) { return (p && p.n) || T('Користувач') }, function () { return T('Користувач') })
		return names[uid]
	}
	function who(uid, fallback) {
		var b = el('button', 'role-admin__name', fallback || '…')
		b.type = 'button'
		b.addEventListener('click', function () { if (window.NTU_PROFILE && uid) window.NTU_PROFILE.show(uid) })
		if (!fallback) nameOf(uid).then(function (n) { b.textContent = n })
		return b
	}
	function ask(msg, ok) { return A.confirm ? A.confirm(msg, ok) : Promise.resolve(window.confirm(msg)) }
	function mb(n) { return (n / 1048576).toFixed(1) + ' ' + T('МБ') }

	/* ---------------- скарги ---------------- */
	function loadReports() {
		return A.db('GET', 'reports').then(function (d) {
			var groups = Object.keys(d || {}).filter(function (k) { return d[k] && typeof d[k] === 'object' }).map(function (key) {
				var byUser = d[key], uids = Object.keys(byUser).filter(function (u) { return byUser[u] && typeof byUser[u] === 'object' })
				var first = byUser[uids[0]] || {}
				return {
					key: key, k: first.k, id: first.id, o: first.o, x: first.x || '', n: uids.length,
					ts: Math.max.apply(null, uids.map(function (u) { return byUser[u].ts || 0 })),
					reasons: uids.map(function (u) { return byUser[u].r }).filter(Boolean)
				}
			}).filter(function (g) { return KIND[g.k] && g.id }).sort(function (a, b) { return b.n - a.n || b.ts - a.ts })
			repCount.textContent = groups.length ? String(groups.length) : ''
			repBox.textContent = ''
			if (!groups.length) return repBox.appendChild(el('p', 'account__hint', T('Нових скарг немає.')))
			groups.forEach(function (g) { repBox.appendChild(reportRow(g)) })
		}).catch(function () { repBox.textContent = ''; repBox.appendChild(el('p', 'account__hint', T('Не вдалося завантажити скарги.'))) })
	}
	function targetPath(g) {
		var id = encodeURIComponent(g.id)
		return g.k === 'chat' ? ['chat/reactions/' + id, 'chat/messages/' + id] : g.k === 'story' ? ['storyLikes/' + id, 'stories/' + id] : ['tales/' + id]
	}
	function reportRow(g) {
		var row = el('div', 'role-admin__row')
		var info = el('div', 'role-admin__info')
		var head = el('span', 'role-admin__meta', T(KIND[g.k]) + ' · ' + T('скарг') + ': ' + g.n + ' · ' + when(g.ts))
		info.appendChild(head)
		if (g.o) { var a = el('span', 'role-admin__meta', T('Автор') + ': '); a.appendChild(who(g.o)); info.appendChild(a) }
		// показуємо сам запис з бази, а не уривок зі скарги (його пише той, хто скаржиться)
		var xEl = el('p', 'admin-rep__x', T('Завантажуємо…'))
		info.appendChild(xEl)
		var src = g.k === 'chat' ? 'chat/messages/' : g.k === 'story' ? 'stories/' : 'tales/'
		A.db('GET', src + encodeURIComponent(g.id)).then(function (r) {
			if (!r || typeof r !== 'object') { xEl.textContent = T('Запис уже видалено.'); g.gone = true; del.textContent = T('Закрити скаргу'); return }
			var body = g.k === 'chat' ? (r.t || (r.f && r.f.name) || '') : g.k === 'story' ? (r.c || T('(сторіз без підпису)')) : (r.ti || '')
			xEl.textContent = (r.n ? r.n + ': ' : '') + body
			g.x = xEl.textContent.slice(0, 200)
		}, function () { xEl.textContent = g.x || '' })
		var why = {}
		g.reasons.forEach(function (r) { why[r] = (why[r] || 0) + 1 })
		info.appendChild(el('span', 'admin-rep__why', Object.keys(why).map(function (r) { return r + (why[r] > 1 ? ' ×' + why[r] : '') }).join(' · ')))
		row.appendChild(info)
		var acts = el('div', 'role-admin__acts')
		var del = el('button', 'btn btn-primary', T('Видалити запис'))
		var keep = el('button', 'btn btn-secondary', T('Залишити'))
		del.type = keep.type = 'button'
		function busy(on) { del.disabled = keep.disabled = on }
		del.addEventListener('click', function () {
			ask(T('Видалити цей запис для всіх? Скаргу буде закрито.'), T('Видалити')).then(function (ok) {
				if (!ok) return
				busy(true)
				var paths = g.gone ? [] : targetPath(g)
				// лайки сторіз - не критично (могли вже зникнути разом зі сторіз), сам запис - обов'язково
				var chain = paths.reduce(function (p, path, i) {
					return p.then(function () { return A.db('DELETE', path).catch(function (e) { if (i === paths.length - 1) throw e }) })
				}, Promise.resolve())
				chain.then(function () { return A.db('DELETE', 'reports/' + encodeURIComponent(g.key)) })
					.then(function () { return A.adminLog('report.delete', g.o, T(KIND[g.k]) + ': ' + g.x) })
					.then(function () { status.textContent = T('Запис видалено, скаргу закрито.'); loadReports(); loadLog(true) })
					.catch(function (e) { busy(false); status.textContent = (e && e.message) || T('Не вдалося виконати дію.') })
			})
		})
		keep.addEventListener('click', function () {
			ask(T('Залишити запис і закрити скаргу?'), T('Залишити')).then(function (ok) {
				if (!ok) return
				busy(true)
				A.db('DELETE', 'reports/' + encodeURIComponent(g.key))
					.then(function () { return A.adminLog('report.dismiss', g.o, T(KIND[g.k]) + ': ' + g.x) })
					.then(function () { status.textContent = T('Скаргу відхилено.'); loadReports(); loadLog(true) })
					.catch(function (e) { busy(false); status.textContent = (e && e.message) || T('Не вдалося виконати дію.') })
			})
		})
		acts.appendChild(del)
		acts.appendChild(keep)
		row.appendChild(acts)
		return row
	}

	/* ---------------- журнал дій ---------------- */
	var oldest = null
	function loadLog(reset) {
		if (reset) { oldest = null; logBox.textContent = '' }
		var q = 'adminLog?orderBy=%22ts%22&limitToLast=' + (PAGE + 1) + (oldest ? '&endAt=' + (oldest - 1) : '')
		return A.db('GET', q).then(function (d) {
			var rows = Object.keys(d || {}).map(function (k) { return d[k] }).filter(function (r) { return r && typeof r.ts === 'number' })
				.sort(function (a, b) { return b.ts - a.ts })
			var more = rows.length > PAGE
			rows = rows.slice(0, PAGE)
			if (!rows.length && !oldest) logBox.appendChild(el('p', 'admin-log__empty', T('Записів поки немає.')))
			rows.forEach(function (r) {
				var line = el('div', 'admin-log__row')
				line.appendChild(el('span', 'admin-log__when', when(r.ts)))
				var what = el('span', 'admin-log__what')
				what.appendChild(el('b', null, r.n || '…'))
				if (!r.n) nameOf(r.a).then(function (n) { what.firstChild.textContent = n })
				what.appendChild(document.createTextNode(' ' + T(ACT[r.act] || r.act)))
				if (r.t) { what.appendChild(document.createTextNode(' · ')); what.appendChild(who(r.t)) }
				line.appendChild(what)
				if (r.d) line.appendChild(el('span', 'admin-log__d', r.d))
				logBox.appendChild(line)
			})
			if (rows.length) oldest = rows[rows.length - 1].ts
			moreBtn.hidden = !more
		}).catch(function () { logBox.textContent = ''; logBox.appendChild(el('p', 'admin-log__empty', T('Не вдалося завантажити журнал.'))) })
	}
	moreBtn.addEventListener('click', function () { loadLog(false) })

	/* ---------------- файли на сервері ---------------- */
	var ERR = { FORBIDDEN: 'Цей акаунт не має прав адміністратора.', TOKEN: 'Сесія застаріла - увійдіть ще раз.', NOT_CONFIGURED: 'На сервері не налаштовано ключ доступу до бази.', UPSTREAM: 'База даних не відповіла - нічого не видалено. Спробуйте пізніше.', TOO_MANY_ATTEMPTS: 'Забагато спроб - спробуйте пізніше.' }
	function cleanup(action) {
		return A.token().then(function (tk) {
			return fetch('api/cleanup.php', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify({ action: action }) })
		}).then(function (r) {
			return r.json().catch(function () { return {} }).then(function (d) {
				if (!r.ok || !d.ok) throw new Error(T(ERR[d.error] || 'Помилка сервера.'))
				return d
			})
		})
	}
	function chips(d) {
		filesBox.textContent = ''
		;[[T('Усього файлів'), d.files + ' · ' + mb(d.bytes)], [T('Без посилань'), d.orphans + ' · ' + mb(d.orphanBytes)],
			[T('Прострочених сторіз'), d.expiredStories], [T('Нових (не чіпаємо)'), d.young]].forEach(function (c) {
			filesBox.appendChild(el('span', null, c[0] + ': ' + c[1]))
		})
	}
	scanBtn.addEventListener('click', function () {
		scanBtn.disabled = cleanBtn.disabled = true
		status.textContent = T('Перевіряємо…')
		cleanup('scan').then(function (d) {
			chips(d)
			status.textContent = ''
			cleanBtn.disabled = !(d.orphans || d.expiredStories)
		}, function (e) { status.textContent = e.message }).then(function () { scanBtn.disabled = false })
	})
	cleanBtn.addEventListener('click', function () {
		ask(T('Видалити прострочені сторіз і файли без посилань? Це не можна скасувати.'), T('Очистити')).then(function (ok) {
			if (!ok) return
			scanBtn.disabled = cleanBtn.disabled = true
			status.textContent = T('Очищаємо…')
			cleanup('clean').then(function (d) {
				status.textContent = T('Готово. Видалено файлів') + ': ' + d.deleted + ' (' + mb(d.freed) + '), ' + T('сторіз') + ': ' + d.removedStories + '.'
				filesBox.textContent = ''
				loadLog(true)
			}, function (e) { status.textContent = e.message }).then(function () { scanBtn.disabled = false })
		})
	})

	A.onChange(function (u) {
		if (!u) { root.hidden = true; shownFor = null; return }
		A.isAdmin().then(function (yes) {
			root.hidden = !yes
			if (yes && shownFor !== u.uid) { shownFor = u.uid; loadReports(); loadLog(true) }
			if (!yes) shownFor = null
		})
	})
})()
