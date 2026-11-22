/* materials.html: матеріали від студентів.
   - схвалені (materials/approved, читає будь-хто) додаються карточками в #resGrid;
   - форма надсилання: файл через api/upload.php (kind=material) або посилання -> materials/pending/{id};
   - суперадмін (admins/{uid} = true) бачить чергу й схвалює/відхиляє через api/materials.php
     (сервер надсилає автору лист із рішенням). */
;(function () {
	var A = window.NTU_AUTH
	var grid = document.getElementById('resGrid')
	if (!A || !grid) return
	var T = window.T || function (s) { return s }
	var API = 'api/materials.php'

	var ICONS = {
		pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
		link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
		article: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2Z"/><path d="M4 19V5M8 7h6M8 11h6"/></svg>'
	}

	function el(tag, cls, text) {
		var e = document.createElement(tag)
		if (cls) e.className = cls
		if (text != null) e.textContent = text
		return e
	}
	function safeUrl(u) { return /^https:\/\//.test(String(u || '')) ? String(u) : '' }
	function list(obj) {
		return Object.keys(obj || {}).map(function (k) { var x = obj[k]; x.id = k; return x })
			.filter(function (x) { return x && x.ti && safeUrl(x.url) })
			.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0) })
	}
	// тип для фільтра: PDF-файли - «PDF», інші файли видно лише в «Усе»
	function kindOf(x) {
		if (x.type === 'link' || x.type === 'article') return x.type
		return /\.pdf$/i.test(x.url) ? 'pdf' : 'file'
	}
	function tagFor(kind) {
		var label = { pdf: 'PDF', file: T('Файл'), link: T('Посилання'), article: T('Стаття') }[kind]
		var tag = el('span', 'res-tag res-tag--' + (kind === 'file' ? 'pdf' : kind))
		tag.innerHTML = ICONS[kind === 'file' ? 'pdf' : kind]
		tag.appendChild(document.createTextNode(label))
		return tag
	}
	function linkText(kind) {
		return kind === 'pdf' ? T('Завантажити PDF →') : kind === 'file' ? T('Завантажити файл →') : kind === 'article' ? T('Читати статтю →') : T('Відкрити →')
	}

	/* ---------- схвалені матеріали ---------- */
	var adminNow = false
	function card(x) {
		var kind = kindOf(x)
		var c = el('article', 'res-card res-card--student')
		c.dataset.type = kind
		c.dataset.text = [x.subj, x.ti, x.d, x.n].filter(Boolean).join(' ').toLowerCase()
		c.dataset.mid = x.id
		var top = el('div', 'res-card__top')
		top.appendChild(tagFor(kind))
		if (x.subj) top.appendChild(el('span', 'res-subject', x.subj))
		c.appendChild(top)
		c.appendChild(el('h3', '', x.ti))
		if (x.d) c.appendChild(el('p', '', x.d))
		if (x.n) c.appendChild(el('span', 'res-author', T('Від студента: ') + x.n))
		var a = el('a', 'res-link', linkText(kind))
		a.href = safeUrl(x.url)
		a.target = '_blank'
		a.rel = 'noopener'
		c.appendChild(a)
		if (adminNow) {
			var del = el('button', 'res-del', T('Прибрати з сайту'))
			del.type = 'button'
			del.addEventListener('click', function () {
				if (!window.confirm(T('Прибрати цей матеріал із сайту?'))) return
				A.db('DELETE', 'materials/approved/' + encodeURIComponent(x.id)).then(loadApproved).catch(function (e) { window.alert(e.message) })
			})
			c.appendChild(del)
		}
		return c
	}
	function loadApproved() {
		if (!A.remote) return Promise.resolve()
		return A.db('GET', 'materials/approved', undefined, false).then(function (d) {
			grid.querySelectorAll('.res-card--student').forEach(function (n) { n.remove() })
			var first = grid.firstChild
			list(d).forEach(function (x) { grid.insertBefore(card(x), first) })
			grid.dispatchEvent(new Event('ntu:res'))
		}).catch(function () {})
	}

	/* ---------- форма надсилання ---------- */
	var form = document.querySelector('[data-mat-form]')
	var gate = document.querySelector('[data-mat-gate]')
	var why = document.querySelector('[data-mat-why]')
	var login = document.querySelector('[data-mat-login]')
	var status = document.querySelector('[data-mat-status]')
	var busy = false
	function say(text, ok) {
		status.textContent = text
		status.classList.toggle('is-ok', !!ok)
		status.classList.toggle('is-error', !ok && !!text)
	}
	function syncType() {
		var isFile = form.type.value === 'file'
		form.querySelector('[data-mat-file]').hidden = !isFile
		form.querySelector('[data-mat-link]').hidden = isFile
	}
	if (form) {
		form.type.addEventListener('change', syncType)
		form.addEventListener('submit', function (e) {
			e.preventDefault()
			if (busy || !A.user) return
			var ti = form.ti.value.trim()
			var type = form.type.value
			var file = form.file.files[0]
			var link = form.link.value.trim()
			if (ti.length < 3) return say(T('Вкажіть назву (щонайменше 3 символи).'))
			if (type === 'file' && !file) return say(T('Оберіть файл.'))
			if (type === 'file' && file.size > 20 * 1024 * 1024) return say(T('Файл завеликий (максимум 20 МБ).'))
			if (type !== 'file' && !/^https:\/\/[^\s]+\.[^\s]+$/.test(link)) return say(T('Вкажіть посилання, що починається з https://'))
			busy = true
			form.querySelector('[type=submit]').disabled = true
			say(T('Надсилання…'), true)
			var up = type === 'file'
				? A.upload(file, 'material', function (p) { say(T('Завантаження файлу: ') + p + '%', true) })
				: Promise.resolve({ url: link })
			up.then(function (f) {
				var item = {
					u: A.user.uid, n: String(A.user.name || '').slice(0, 40), e: A.user.email,
					ti: ti.slice(0, 150), type: type, url: f.url, ts: Date.now()
				}
				var subj = form.subj.value.trim().slice(0, 80)
				var d = form.d.value.trim().slice(0, 500)
				if (subj) item.subj = subj
				if (d) item.d = d
				if (f.name) item.fn = String(f.name).slice(0, 160)
				return A.db('POST', 'materials/pending', item)
			}).then(function () {
				form.reset()
				syncType()
				say(T('Дякуємо! Матеріал надіслано на перевірку. Рішення прийде на вашу пошту.'), true)
			}).catch(function (err) {
				say(err && err.code === 'PERMISSION' ? T('Не вдалося надіслати: підтвердьте пошту й спробуйте ще раз.') : (err && err.message) || T('Не вдалося надіслати матеріал.'))
			}).then(function () {
				busy = false
				form.querySelector('[type=submit]').disabled = false
			})
		})
	}
	function syncForm(user) {
		if (!form) return
		var can = !!(user && user.verified && A.remote)
		form.hidden = !can
		gate.hidden = can
		login.hidden = !!user
		why.textContent = !A.remote ? T('Надсилання матеріалів тимчасово недоступне.')
			: !user ? T('Увійдіть, щоб надіслати матеріал.')
			: T('Підтвердьте пошту, щоб надсилати матеріали.')
	}

	/* ---------- модерація (лише суперадміни) ---------- */
	var mod = document.querySelector('[data-mod]')
	var modList = document.querySelector('[data-mod-list]')
	var modMsg = document.querySelector('[data-mod-msg]')
	var ERR = {
		FORBIDDEN: 'Цей акаунт не має прав модератора.', TOKEN: 'Сесія застаріла - увійдіть ще раз.',
		NOT_FOUND: 'Матеріал уже розглянуто.', REASON: 'Вкажіть причину відмови (3-500 символів).',
		MAIL: 'Не вдалося надіслати лист автору. Спробуйте ще раз.', NO_EMAIL: 'У заявці немає коректної пошти автора.',
		NOT_CONFIGURED: 'На сервері не налаштована пошта.', UPSTREAM: 'База даних не відповіла. Спробуйте ще раз.',
		TOO_MANY_ATTEMPTS: 'Забагато дій - спробуйте пізніше.'
	}
	function call(body) {
		return A.token().then(function (tk) {
			return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify(body) })
		}).then(function (r) {
			return r.json().catch(function () { return {} }).then(function (d) {
				if (!r.ok || !d.ok) throw new Error(T(ERR[d.error] || 'Помилка сервера.'))
				return d
			})
		})
	}
	function when(ms) { try { return new Date(ms).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' }) } catch (e) { return '' } }
	function modItem(x) {
		var box = el('article', 'mat-mod')
		var head = el('div', 'mat-mod__head')
		head.appendChild(tagFor(kindOf(x)))
		head.appendChild(el('span', 'mat-mod__who', (x.n || T('Гість')) + ' · ' + (x.e || '') + ' · ' + when(x.ts)))
		box.appendChild(head)
		box.appendChild(el('h3', '', x.ti))
		if (x.subj) box.appendChild(el('p', 'mat-mod__subj', x.subj))
		if (x.d) box.appendChild(el('p', '', x.d))
		var open = el('a', 'res-link', x.fn ? T('Відкрити файл: ') + x.fn : T('Відкрити посилання →'))
		open.href = safeUrl(x.url)
		open.target = '_blank'
		open.rel = 'noopener'
		box.appendChild(open)
		var reason = el('textarea', 'mat-mod__reason')
		reason.rows = 2
		reason.maxLength = 500
		reason.placeholder = T('Причина відмови (піде автору на пошту)')
		reason.setAttribute('aria-label', T('Причина відмови'))
		var acts = el('div', 'mat-mod__acts')
		var yes = el('button', 'btn btn-primary', T('Схвалити'))
		var no = el('button', 'btn btn-secondary', T('Відхилити'))
		yes.type = no.type = 'button'
		var note = el('p', 'form-note-status')
		function act(body, okText) {
			yes.disabled = no.disabled = true
			note.textContent = T('Зачекайте…')
			call(body).then(function (d) {
				note.textContent = okText + (d.mailed ? '' : ' ' + T('(лист автору не надіслано)'))
				setTimeout(function () { loadPending(); loadApproved() }, 900)
			}).catch(function (e) {
				note.textContent = e.message
				yes.disabled = no.disabled = false
			})
		}
		yes.addEventListener('click', function () { act({ action: 'approve', id: x.id }, T('Опубліковано.')) })
		no.addEventListener('click', function () {
			var r = reason.value.trim()
			if (r.length < 3) { reason.focus(); note.textContent = T(ERR.REASON); return }
			act({ action: 'reject', id: x.id, reason: r }, T('Відхилено, автору надіслано лист.'))
		})
		acts.appendChild(yes)
		acts.appendChild(no)
		box.appendChild(reason)
		box.appendChild(acts)
		box.appendChild(note)
		return box
	}
	function loadPending() {
		return A.db('GET', 'materials/pending').then(function (d) {
			var items = list(d)
			modList.textContent = ''
			modMsg.textContent = items.length ? T('На розгляді: ') + items.length : T('Нових матеріалів немає.')
			items.forEach(function (x) { modList.appendChild(modItem(x)) })
		}).catch(function () { modMsg.textContent = T('Не вдалося завантажити чергу.') })
	}

	A.onChange(function (user) {
		syncForm(user)
		A.isAdmin().then(function (yes) {
			var changed = yes !== adminNow
			adminNow = yes
			if (mod) mod.hidden = !yes
			if (yes) loadPending()
			if (changed) loadApproved()
		})
	})
	if (form) syncType()
	loadApproved()
})()
