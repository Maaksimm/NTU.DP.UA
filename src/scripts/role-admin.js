/* personal-area.html: панель суперадміна (admins/{uid} = true) - запити на роль викладача й поточні викладачі.
   Роль 't' у профілі може поставити лише адмін (правила бази); користувач лише надсилає запит roleRequests/{uid}. */
;(function () {
	var A = window.NTU_AUTH
	var root = document.querySelector('[data-role-admin]')
	if (!A || !root || !A.isAdmin) return
	var T = window.T || function (s) { return s }
	var reqBox = root.querySelector('[data-ra-requests]')
	var tchBox = root.querySelector('[data-ra-teachers]')
	var status = root.querySelector('[data-ra-status]')
	var shownFor = null

	function el(tag, cls, text) {
		var e = document.createElement(tag)
		if (cls) e.className = cls
		if (text != null) e.textContent = text
		return e
	}
	function when(ms) { try { return new Date(ms).toLocaleDateString('uk-UA') } catch (e) { return '' } }
	function entries(obj) {
		return Object.keys(obj || {}).filter(function (k) { return /^[A-Za-z0-9]{10,64}$/.test(k) && obj[k] })
			.map(function (k) { var x = obj[k]; x.uid = k; return x })
	}
	function btn(text, cls, onClick) {
		var b = el('button', 'btn ' + cls, text)
		b.type = 'button'
		b.addEventListener('click', onClick)
		return b
	}
	// ім'я: клік відкриває картку профілю
	function who(uid, name) {
		var n = el('button', 'role-admin__name', name || T('Гість'))
		n.type = 'button'
		n.addEventListener('click', function () { if (window.NTU_PROFILE) window.NTU_PROFILE.show(uid) })
		return n
	}
	function act(promise, okText) {
		status.textContent = T('Зачекайте…')
		return promise.then(function () { status.textContent = okText; load() }, function (e) { status.textContent = e.message })
	}

	function requestRow(x) {
		var row = el('div', 'role-admin__row')
		var info = el('div', 'role-admin__info')
		info.appendChild(who(x.uid, x.n))
		info.appendChild(el('span', 'role-admin__meta', (x.subj ? T(x.subj) + ' · ' : '') + when(x.ts) + (x.st === 'no' ? ' · ' + T('відхилено') : '')))
		row.appendChild(info)
		var acts = el('div', 'role-admin__acts')
		var subj = el('select', 'role-admin__subj')
		subj.setAttribute('aria-label', T('Предмет'))
		;[''].concat(A.SUBJECTS || []).forEach(function (s) {
			var o = el('option', null, s ? T(s) : T('Оберіть предмет'))
			o.value = s
			subj.appendChild(o)
		})
		subj.value = x.subj || ''
		acts.appendChild(subj)
		acts.appendChild(btn(T('Підтвердити'), 'btn-primary', function () {
			if (!subj.value) { subj.focus(); status.textContent = T('Оберіть предмет, який ви викладаєте.'); return }
			act(A.approveTeacher(x.uid, subj.value), T('Роль викладача підтверджено.'))
		}))
		if (x.st !== 'no') acts.appendChild(btn(T('Відхилити'), 'btn-secondary', function () { act(A.rejectTeacher(x.uid), T('Запит відхилено.')) }))
		row.appendChild(acts)
		return row
	}
	function teacherRow(x) {
		var row = el('div', 'role-admin__row')
		var info = el('div', 'role-admin__info')
		info.appendChild(who(x.uid, x.name))
		info.appendChild(el('span', 'role-admin__meta', x.subj ? T(x.subj) : ''))
		row.appendChild(info)
		var acts = el('div', 'role-admin__acts')
		acts.appendChild(btn(T('Зняти роль'), 'btn-secondary', function () {
			if (!window.confirm(T('Зняти роль викладача з цього користувача?'))) return
			act(A.demoteTeacher(x.uid), T('Роль викладача знято.'))
		}))
		row.appendChild(acts)
		return row
	}
	function fill(box, items, make, emptyText) {
		box.textContent = ''
		if (!items.length) return box.appendChild(el('p', 'account__hint', emptyText))
		items.forEach(function (x) { box.appendChild(make(x)) })
	}

	function load() {
		return Promise.all([A.roleRequests(), A.teachers()]).then(function (r) {
			var reqs = entries(r[0]).sort(function (a, b) { return (a.st === 'no') - (b.st === 'no') || (b.ts || 0) - (a.ts || 0) })
			var tchs = entries(r[1])
			return Promise.all(tchs.map(function (x) {
				return A.profile(x.uid).then(function (p) { x.name = p && p.n }, function () {})
			})).then(function () {
				fill(reqBox, reqs, requestRow, T('Нових запитів немає.'))
				fill(tchBox, tchs, teacherRow, T('Викладачів поки немає.'))
			})
		}).catch(function () { status.textContent = T('Не вдалося завантажити дані.') })
	}

	A.onChange(function (u) {
		A.isAdmin().then(function (yes) {
			root.hidden = !yes
			if (yes && shownFor !== u.uid) { shownFor = u.uid; load() }
			if (!yes) shownFor = null
		})
	})
})()
