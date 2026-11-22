/* personal-area.html: «Відвідувачі сайту» для суперадмінів (api/visits.php).
   Діапазон дат (до 92 днів), підсумки, графік по днях, топ сторінок/джерел/пристроїв, зареєстровані відвідувачі,
   CSV по днях і CSV з усіма переглядами (BOM + «;», щоб Excel одразу відкривав кирилицю й колонки). */
;(function () {
	var A = window.NTU_AUTH
	var root = document.querySelector('[data-admin-stats]')
	if (!A || !root || !A.isAdmin || !A.remote) return
	var T = window.T || function (s) { return s }
	var $ = function (s) { return root.querySelector(s) }
	var form = $('[data-st-form]'), kpis = $('[data-st-kpis]'), chart = $('[data-st-chart]'), grid = $('[data-st-grid]')
	var usersBox = $('[data-st-users]'), status = $('[data-st-status]')
	var last = null, shownFor = null
	var ERR = { FORBIDDEN: 'Цей акаунт не має прав адміністратора.', TOKEN: 'Сесія застаріла - увійдіть ще раз.', BAD_RANGE: 'Оберіть період до 92 днів.', STORAGE: 'На сервері немає доступу до папки статистики.', TOO_MANY_ATTEMPTS: 'Забагато запитів - спробуйте пізніше.' }

	function el(tag, cls, text) {
		var e = document.createElement(tag)
		if (cls) e.className = cls
		if (text != null) e.textContent = text
		return e
	}
	function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) }
	function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return ymd(d) }
	function when(sec) { try { return new Date(sec * 1000).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch (e) { return '' } }
	function call(body) {
		return A.token().then(function (tk) {
			return fetch('api/visits.php', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify(body) })
		}).then(function (r) {
			return r.json().catch(function () { return {} }).then(function (d) {
				if (!r.ok || !d.ok) throw new Error(T(ERR[d.error] || 'Помилка сервера.'))
				return d
			})
		})
	}
	function range() { return { from: form.from.value, to: form.to.value } }

	function kpi(n, label) { var b = el('div', 'admin-stats__kpi'); b.appendChild(el('b', null, String(n))); b.appendChild(el('span', null, label)); return b }
	function topBox(title, list, total) {
		var box = el('div', 'admin-stats__box')
		box.appendChild(el('h4', null, title))
		if (!list.length) box.appendChild(el('span', 'account__hint', T('Немає даних')))
		var max = list.length ? list[0].n : 1
		list.forEach(function (x) {
			var row = el('div', 'admin-stats__row')
			row.style.setProperty('--w', Math.round(x.n / max * 100) + '%')
			row.appendChild(el('span', null, T(x.k) || '-'))
			row.appendChild(el('b', null, x.n + (total ? ' · ' + Math.round(x.n / total * 100) + '%' : '')))
			box.appendChild(row)
		})
		return box
	}
	function render(d) {
		last = d
		kpis.textContent = ''
		kpis.appendChild(kpi(d.visitors, T('відвідувачів (унікальних за день)')))
		kpis.appendChild(kpi(d.views, T('переглядів сторінок')))
		kpis.appendChild(kpi(d.registered, T('зареєстрованих заходило')))
		kpis.appendChild(kpi(d.visitors ? (d.views / d.visitors).toFixed(1) : '0', T('сторінок на відвідувача')))
		chart.textContent = ''
		var max = Math.max.apply(null, d.days.map(function (x) { return x.visitors }).concat(1))
		d.days.forEach(function (x) {
			var bar = el('div', 'admin-stats__bar')
			bar.title = x.day + ': ' + x.visitors + ' ' + T('відвідувачів') + ', ' + x.views + ' ' + T('переглядів')
			var i = el('i')
			i.style.height = Math.max(2, Math.round(x.visitors / max * 120)) + 'px'
			bar.appendChild(i)
			bar.appendChild(el('small', null, x.day.slice(8) + '.' + x.day.slice(5, 7)))
			chart.appendChild(bar)
		})
		grid.textContent = ''
		grid.appendChild(topBox(T('Сторінки'), d.pages, d.views))
		grid.appendChild(topBox(T('Звідки прийшли'), d.sources, d.views))
		grid.appendChild(topBox(T('Пристрої'), d.devices, d.views))
		grid.appendChild(topBox(T('Системи'), d.os, d.views))
		usersBox.textContent = ''
		if (!d.users.length) usersBox.appendChild(el('p', 'account__hint', T('За цей період зареєстровані користувачі не заходили.')))
		d.users.forEach(function (u) {
			var row = el('div', 'role-admin__row')
			var info = el('div', 'role-admin__info')
			var nm = el('button', 'role-admin__name', u.name || '…')
			nm.type = 'button'
			nm.addEventListener('click', function () { if (window.NTU_PROFILE) window.NTU_PROFILE.show(u.uid) })
			if (!u.name) A.profile(u.uid).then(function (p) { u.name = (p && p.n) || T('Користувач'); nm.textContent = u.name }, function () { nm.textContent = T('Користувач') })
			info.appendChild(nm)
			info.appendChild(el('span', 'role-admin__meta', T('переглядів') + ': ' + u.views + ' · ' + T('днів') + ': ' + u.days + ' · ' + T('останній візит') + ': ' + when(u.last)))
			row.appendChild(info)
			usersBox.appendChild(row)
		})
	}
	function load() {
		var r = range()
		if (!r.from || !r.to) return
		status.textContent = T('Завантажуємо…')
		return call({ action: 'summary', from: r.from, to: r.to }).then(function (d) { status.textContent = ''; render(d) }, function (e) { status.textContent = e.message })
	}

	/* ---------------- CSV ---------------- */
	function cell(v) { v = v == null ? '' : String(v); return /[";\n\r]/.test(v) || /^[=+\-@]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v }
	function save(name, head, rows) {
		var lines = [head.map(cell).join(';')].concat(rows.map(function (r) { return r.map(cell).join(';') }))
		var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
		var a = document.createElement('a')
		a.href = URL.createObjectURL(blob)
		a.download = name
		document.body.appendChild(a)
		a.click()
		setTimeout(function () { URL.revokeObjectURL(a.href); a.remove() }, 1000)
	}
	function nameMap(uids) {
		var m = {}
		return Promise.all(uids.map(function (u) { return A.profile(u).then(function (p) { m[u] = (p && p.n) || '' }, function () { m[u] = '' }) })).then(function () { return m })
	}
	root.addEventListener('click', function (e) {
		var b = e.target.closest('[data-st-csv]')
		if (!b) return
		var r = range(), kind = b.getAttribute('data-st-csv'), tag = r.from + '_' + r.to
		if (kind === 'days') {
			var go = last ? Promise.resolve(last) : call({ action: 'summary', from: r.from, to: r.to })
			go.then(function (d) {
				save('ntu-visitors-' + tag + '.csv', [T('Дата'), T('Відвідувачі'), T('Перегляди'), T('Зареєстровані')], d.days.map(function (x) { return [x.day, x.visitors, x.views, x.users] }))
			}, function (er) { status.textContent = er.message })
			return
		}
		b.disabled = true
		status.textContent = T('Готуємо файл…')
		call({ action: 'raw', from: r.from, to: r.to }).then(function (d) {
			var uids = []
			d.rows.forEach(function (h) { if (h.u && uids.indexOf(h.u) < 0) uids.push(h.u) })
			return nameMap(uids).then(function (names) {
				save('ntu-visits-' + tag + '.csv', [T('Дата і час'), T('Сторінка'), T('Джерело'), T('Пристрій'), T('Система'), T('Відвідувач'), T('Користувач'), 'uid'],
					d.rows.map(function (h) {
						var dt = new Date(h.t * 1000)
						return [ymd(dt) + ' ' + ('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2), h.p, h.r, h.d, h.o, h.u ? '' : T('Гість') + ' #' + String(h.v).slice(0, 6), h.u ? (names[h.u] || h.n || '') : '', h.u || '']
					}))
				status.textContent = d.truncated ? T('Файл обрізано до 50 000 рядків - оберіть коротший період.') : ''
			})
		}).catch(function (er) { status.textContent = er.message }).then(function () { b.disabled = false })
	})

	form.addEventListener('submit', function (e) { e.preventDefault(); last = null; load() })
	root.addEventListener('click', function (e) {
		var q = e.target.closest('[data-st-quick]')
		if (!q) return
		form.from.value = daysAgo(+q.getAttribute('data-st-quick'))
		form.to.value = daysAgo(0)
		last = null
		load()
	})
	form.from.value = daysAgo(6)
	form.to.value = daysAgo(0)

	A.onChange(function (u) {
		if (!u) { root.hidden = true; shownFor = null; return }
		A.isAdmin().then(function (yes) {
			root.hidden = !yes
			if (yes && shownFor !== u.uid) { shownFor = u.uid; load() }
			if (!yes) shownFor = null
		})
	})
})()
