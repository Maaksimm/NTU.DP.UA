/* broadcast.html: керування розсилкою новин (api/broadcast.php). Сервер сам перевіряє, що акаунт - із команди;
   тут лише інтерфейс: статус, тестовий лист, надсилання пачками до кінця. */
;(function () {
	var root = document.querySelector('[data-bc]')
	var A = window.NTU_AUTH
	if (!root || !A) return
	var T = window.T || function (s) { return s }
	var API = 'api/broadcast.php'
	var busy = false

	var $ = function (sel) { return root.querySelector(sel) }
	var msg = function (text) { $('[data-bc-msg]').textContent = text }
	var ERRORS = {
		NOT_CONFIGURED: 'Розсилка не налаштована на сервері (немає сервісного ключа або mail()).',
		FORBIDDEN: 'Цей акаунт не входить до команди платформи.',
		TOKEN: 'Сесія застаріла - увійдіть ще раз.',
		BUSY: 'Розсилка вже йде в іншій вкладці.',
		TOO_MANY_ATTEMPTS: 'Забагато тестових листів - спробуйте пізніше.',
		UPSTREAM: 'Firebase не віддав список користувачів.',
		STORAGE: 'Сервер не може зберегти прогрес розсилки.',
		MAIL: 'Сервер не зміг надіслати лист.'
	}

	function call(body) {
		return A.token().then(function (tk) {
			return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify(body) })
		}).then(function (r) {
			return r.json().catch(function () { return { error: 'HTTP ' + r.status } }).then(function (d) {
				if (!r.ok || !d.ok) throw new Error(T(ERRORS[d.error] || 'Помилка сервера: ') + (ERRORS[d.error] ? '' : (d.error || r.status)))
				return d
			})
		})
	}

	function showStatus(d) {
		$('[data-bc-stats]').hidden = false
		$('[data-bc-total]').textContent = d.total
		$('[data-bc-sent]').textContent = d.sent
		$('[data-bc-unsub]').textContent = d.unsubscribed
		$('[data-bc-left]').textContent = d.remaining
	}

	function setBusy(on) {
		busy = on
		root.querySelectorAll('[data-bc-do]').forEach(function (b) { b.disabled = on })
	}

	function run(promise) {
		setBusy(true)
		return promise.catch(function (e) { msg(e.message) }).then(function () { setBusy(false) })
	}

	function status() {
		msg(T('Завантаження…'))
		return call({ action: 'status' }).then(function (d) {
			showStatus(d)
			msg(d.remaining ? T('Готово до розсилки.') : T('Усім уже надіслано.'))
			return d
		})
	}

	// пачками, доки сервер не скаже, що нікого не лишилось
	function sendAll(totalSent, totalFailed) {
		return call({ action: 'send', confirm: 'SEND' }).then(function (d) {
			totalSent += d.sent
			totalFailed += d.failed
			msg(T('Надіслано: ') + totalSent + (totalFailed ? T(', помилок: ') + totalFailed : '') + T('. Залишилось: ') + d.remaining)
			if (d.remaining > 0 && d.sent + d.failed > 0) return sendAll(totalSent, totalFailed)
			return status().then(function () {
				msg(T('Розсилку завершено. Надіслано: ') + totalSent + (totalFailed ? T(', помилок: ') + totalFailed : ''))
			})
		})
	}

	// CSV з BOM і роздільником «;», щоб Excel одразу відкривав кирилицю й колонки
	function csvCell(v) {
		var s = String(v == null ? '' : v)
		if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
		return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
	}
	function when(ms) {
		if (!ms) return ''
		var d = new Date(ms), p = function (n) { return (n < 10 ? '0' : '') + n }
		return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
	}
	var ROLES = { a: 'суперадмін', s: 'студент', t: 'викладач' }
	var REQ = { pending: 'на розгляді', rejected: 'відхилено' }
	function exportUsers() {
		msg(T('Завантаження…'))
		return call({ action: 'export' }).then(function (d) {
			var head = ['uid', 'Нікнейм', 'Email', 'Пошту підтверджено', 'Заблоковано', 'Роль', 'Предмет', 'Запит на роль викладача', 'Зареєстровано', 'Останній вхід', 'Востаннє онлайн', 'Відписався від новин']
			var lines = [head.map(csvCell).join(';')].concat(d.users.map(function (u) {
				return [u.uid, u.name, u.email, u.verified ? 'так' : 'ні', u.disabled ? 'так' : 'ні', ROLES[u.role] || '', u.subject || '', REQ[u.teacherRequest] || '',
					when(u.created), when(u.lastLogin), when(u.lastSeen), u.unsubscribed ? 'так' : 'ні'].map(csvCell).join(';')
			}))
			var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
			var a = document.createElement('a')
			a.href = URL.createObjectURL(blob)
			a.download = 'ntu-users-' + when(Date.now()).slice(0, 10) + '.csv'
			document.body.appendChild(a)
			a.click()
			a.remove()
			setTimeout(function () { URL.revokeObjectURL(a.href) }, 1000)
			msg(T('Вивантажено користувачів: ') + d.count)
		})
	}

	root.addEventListener('click', function (e) {
		var b = e.target.closest('[data-bc-do]')
		if (!b || busy) return
		var what = b.getAttribute('data-bc-do')
		if (what === 'status') return run(status())
		if (what === 'export') return run(exportUsers())
		if (what === 'test') return run(call({ action: 'test' }).then(function (d) { msg(T('Тестовий лист надіслано на ') + d.to) }))
		if (what === 'send') {
			var left = $('[data-bc-left]').textContent
			if (!window.confirm(T('Надіслати лист усім отримувачам, що залишились') + ' (' + left + ')?')) return
			run(sendAll(0, 0))
		}
	})

	// доступ: бейдж команди (chat-config.js) або суперадмін (admins/{uid}); остаточно перевіряє сервер
	A.onChange(function (user) {
		var check = !user ? Promise.resolve(false) : A.staff && A.staff(user.uid) ? Promise.resolve(true) : A.isAdmin ? A.isAdmin() : Promise.resolve(false)
		check.then(function (staff) {
			$('[data-bc-actions]').hidden = !staff
			if (!user) return msg(T('Увійдіть в акаунт команди, щоб керувати розсилкою.'))
			if (!staff) return msg(T('Цей акаунт не входить до команди платформи.'))
			if (!A.remote) return msg(T('Розсилка працює лише на сайті з підключеною базою.'))
			run(status())
		})
	})
})()
