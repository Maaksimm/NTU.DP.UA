/* Особистий кабінет: розширений профіль, відгуки із зірками та список користувачів з фільтрами. */
(function () {
	'use strict'
	var A = window.NTU_AUTH
	if (!A) return
	function t(s) { return typeof T === 'function' ? T(s) : s }
	function $(sel, root) { return (root || document).querySelector(sel) }
	function el(tag, cls, text) {
		var e = document.createElement(tag)
		if (cls) e.className = cls
		if (text != null) e.textContent = text
		return e
	}
	function isBad(x) { return window.NTU_isProfane ? window.NTU_isProfane(x) : false }

	var FACULTIES = [
		'Електротехнічний факультет', 'Факультет інформаційних технологій', 'Механіко-машинобудівний факультет',
		'Факультет архітектури, будівництва та землеустрою', 'Фінансово-економічний факультет', 'Факультет менеджменту',
		'Навчально-науковий інститут природокористування', 'Навчально-науковий інститут природничих наук та технологій',
		'Навчально-науковий інститут гуманітарних і соціальних наук', 'Навчально-науковий інститут державного управління',
		'Аспірантура і докторантура', 'Міжгалузевий інститут безперервної освіти'
	]
	var COURSES = ['1', '2', '3', '4', '5', '6', 'Магістратура', 'Аспірантура', 'Абітурієнт', 'Випускник']
	var COURSE_LABEL = { '1': '1 курс', '2': '2 курс', '3': '3 курс', '4': '4 курс', '5': '5 курс', '6': '6 курс' }
	var GENDER = { m: 'Чоловік', f: 'Жінка' }
	function courseText(c) { return t(COURSE_LABEL[c] || c) }

	function fillSelect(sel, items, labelFn) {
		items.forEach(function (v) {
			var o = el('option', null, labelFn ? labelFn(v) : t(v))
			o.value = v
			sel.appendChild(o)
		})
	}
	function initials(n) { return A.initials(n || '?') }
	function avatarEl(prof, cls) {
		var a
		if (prof && prof.a) { a = el('img', cls); a.src = prof.a; a.alt = '' } else {
			a = el('span', cls + ' ' + cls.split(' ')[0] + '--ph', initials(prof && prof.n))
		}
		return a
	}
	function starsEl(avg, big) {
		var w = el('span', 'stars' + (big ? ' stars--lg' : ''))
		w.setAttribute('role', 'img')
		w.setAttribute('aria-label', (avg ? avg.toFixed(1) : '0') + ' / 5')
		w.appendChild(el('span', 'stars__bg', '★★★★★'))
		var fg = el('span', 'stars__fg', '★★★★★')
		fg.style.width = Math.max(0, Math.min(100, avg / 5 * 100)) + '%'
		w.appendChild(fg)
		return w
	}
	function ratingEl(avg, count, big) {
		var w = el('span', 'rating')
		w.appendChild(starsEl(count ? avg : 0, big))
		if (!count) w.appendChild(el('span', 'rating__none', t('Ще немає відгуків')))
		else w.appendChild(el('span', 'rating__num', avg.toFixed(1) + ' (' + count + ')'))
		return w
	}
	function stat(rev) {
		var vals = Object.keys(rev || {}).map(function (k) { return rev[k].r }).filter(function (x) { return x >= 1 && x <= 5 })
		if (!vals.length) return { avg: 0, count: 0 }
		return { avg: vals.reduce(function (a, b) { return a + b }, 0) / vals.length, count: vals.length }
	}
	function online(seen) { return A.isOnline(seen) }
	function dot(on) { var d = el('span', 'online-dot' + (on ? ' is-on' : '')); d.setAttribute('aria-hidden', 'true'); return d }

	/* ================= own cabinet ================= */
	var cardEl = $('.account__card')
	var bgBox = $('[data-bgpick]')
	if (bgBox && cardEl) {
		var sw = $('[data-bg-swatches]')
		var bgs = $('[data-bg-status]')
		Object.keys(A.BG_PRESETS).forEach(function (id) {
			var b = el('button', 'bgpick__sw')
			b.type = 'button'
			b.style.background = A.BG_PRESETS[id].css
			b.setAttribute('aria-label', t('Фон') + ' ' + id.replace('p', ''))
			b.addEventListener('click', function () {
				A.setBackground(id).then(function () { bgs.textContent = '' }, function (e) { say(bgs, e.message) })
			})
			sw.appendChild(b)
		})
		var bgFile = $('#bgFile')
		$('[data-bg-pick]').addEventListener('click', function () { bgFile.click() })
		bgFile.addEventListener('change', function () {
			var f = bgFile.files && bgFile.files[0]
			if (!f) return
			say(bgs, t('Збереження...'), true)
			A.fileToCover(f).then(function (d) { return A.setBackground(d) })
				.then(function () { say(bgs, t('Фон оновлено.'), true) }, function (e) { say(bgs, e.message) })
			bgFile.value = ''
		})
		$('[data-bg-reset]').addEventListener('click', function () {
			A.setBackground('').then(function () { say(bgs, t('Фон прибрано.'), true) }, function (e) { say(bgs, e.message) })
		})
		A.onChange(function (u) { A.applyBackground(cardEl, u && u.bg) })
	}
	var extraForm = $('[data-extra-form]')
	var verifyBox = $('[data-verify-banner]')
	var myRatingBox = $('[data-my-rating]')
	var myReviews = $('[data-my-reviews]')
	var usersBtn = $('[data-users-open]')

	if (extraForm) {
		fillSelect(extraForm.elements.course, COURSES, courseText)
		fillSelect(extraForm.elements.faculty, FACULTIES)
	}
	function say(node, msg, ok) { if (node) { node.style.color = ok ? '#2D9B70' : '#c0392b'; node.textContent = msg } }

	function loadOwnExtra(u) {
		A.getExtra(u.uid).then(function (x) {
			x = x || {}
			var f = extraForm.elements
			f.gender.value = x.g || ''
			f.age.value = x.age || ''
			f.course.value = x.c || ''
			f.faculty.value = x.f || ''
			f.tg.value = x.tg ? '@' + x.tg : ''
		}).catch(function () {})
		A.db('GET', 'reviews/' + encodeURIComponent(u.uid), undefined, true).then(function (rev) { renderOwnReviews(rev || {}) }).catch(function () {})
	}
	function renderOwnReviews(rev) {
		var st = stat(rev)
		myRatingBox.textContent = ''
		myRatingBox.appendChild(ratingEl(st.avg, st.count, true))
		myReviews.textContent = ''
		reviewItems(rev).forEach(function (r) { myReviews.appendChild(reviewNode(r)) })
	}
	function reviewItems(rev) {
		return Object.keys(rev || {}).map(function (k) { var r = rev[k]; r.author = k; return r }).sort(function (a, b) { return (b.ts || 0) - (a.ts || 0) })
	}
	function reviewNode(r) {
		var n = el('div', 'review')
		var head = el('div', 'review__head')
		head.appendChild(el('strong', null, r.n || t('Гість')))
		head.appendChild(starsEl(r.r))
		n.appendChild(head)
		if (r.t) n.appendChild(el('p', 'review__text', isBad(r.t) ? t('Відгук приховано: нецензурна лексика') : r.t))
		return n
	}

	function syncVerify(u) {
		if (!verifyBox) return
		verifyBox.hidden = !(A.remote && u && u.verified === false)
		var em = $('[data-verify-email]')
		if (em && u) em.textContent = u.email
	}
	if (verifyBox) {
		var vs = $('[data-verify-status]')
		$('[data-verify-check]').addEventListener('click', function () {
			say(vs, t('Перевіряємо...'), true)
			A.refreshVerified().then(function (v) {
				say(vs, v ? t('Пошту підтверджено. Дякуємо!') : t('Пошту ще не підтверджено. Перейдіть за посиланням у листі й спробуйте ще раз.'), v)
			}, function (e) { say(vs, e.message) })
		})
		$('[data-verify-resend]').addEventListener('click', function () {
			A.resendVerification().then(function () { say(vs, t('Лист надіслано повторно. Перевірте також папку «Спам».'), true) }, function (e) { say(vs, e.message) })
		})
	}

	if (extraForm) {
		var xs = $('[data-extra-status]')
		extraForm.addEventListener('submit', function (e) {
			e.preventDefault()
			var f = extraForm.elements
			var age = f.age.value ? parseInt(f.age.value, 10) : null
			if (age != null && (isNaN(age) || age < 10 || age > 99)) return say(xs, t('Вік має бути від 10 до 99.'))
			var tg = f.tg.value.trim().replace(/^(https?:\/\/)?(t\.me|telegram\.me)\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '')
			if (tg && !/^[A-Za-z0-9_]{5,32}$/.test(tg)) return say(xs, t('Telegram: від 5 до 32 символів — латинські літери, цифри та підкреслення.'))
			var data = { g: f.gender.value || '', c: f.course.value || '', f: f.faculty.value || '', tg: tg || null, age: age != null ? age : null }
			f.tg.value = tg ? '@' + tg : ''
			say(xs, t('Збереження...'), true)
			A.saveExtra(data).then(function () { say(xs, t('Дані збережено.'), true) }, function (er) { say(xs, er.message) })
		})
	}

	var loadedExtraFor = null
	A.onChange(function (u) {
		if (!extraForm) return
		syncVerify(u)
		if (!u) return
		if (!A.remote) {
			$('[data-community-demo]').hidden = false
			return
		}
		var pr = $('[data-account-presence]')
		if (pr) {
			pr.textContent = ''
			pr.appendChild(dot(!u.hideOnline))
			pr.appendChild(document.createTextNode(u.hideOnline ? t('Статус «в мережі» приховано') : t('В мережі')))
		}
		if (!loadedExtraFor || loadedExtraFor !== u.uid) { loadedExtraFor = u.uid; loadOwnExtra(u) }
	})


	/* ================= settings (gear) ================= */
	var setModal = $('#settingsModal')
	if (setModal) {
		var setCheck = $('#setOnline')
		var setStatus = $('[data-set-status]')
		A.onChange(function (u) {
			if (!u) return
			$('[data-set-email]').textContent = u.email
			$('[data-set-verified]').textContent = !A.remote || u.verified !== false ? t('Підтверджено') : t('Не підтверджено')
			setCheck.checked = !u.hideOnline
		})
		setCheck.addEventListener('change', function () {
			A.setHideOnline(!setCheck.checked).then(function () { say(setStatus, t('Збережено.'), true) }, function (e) {
				setCheck.checked = !setCheck.checked
				say(setStatus, e.message)
			})
		})
	}

	/* ================= users list ================= */
	var modal = $('#usersModal')
	if (!modal) return
	var listView = $('[data-users-list-view]', modal)
	var profView = $('[data-users-profile-view]', modal)
	var resultsBox = $('[data-users-results]', modal)
	var countEl = $('[data-users-count]', modal)
	var F = {
		q: $('[data-f=q]', modal), status: $('[data-f=status]', modal), gender: $('[data-f=gender]', modal),
		ageMin: $('[data-f=ageMin]', modal), ageMax: $('[data-f=ageMax]', modal), course: $('[data-f=course]', modal),
		faculty: $('[data-f=faculty]', modal), contact: $('[data-f=contact]', modal), rating: $('[data-f=rating]', modal), sort: $('[data-f=sort]', modal)
	}
	fillSelect(F.course, COURSES, courseText)
	fillSelect(F.faculty, FACULTIES)
	var all = []
	var loaded = false

	function loadAll() {
		resultsBox.textContent = ''
		resultsBox.appendChild(el('p', 'users__msg', t('Завантажуємо...')))
		return Promise.all([A.db('GET', 'users', undefined, true), A.db('GET', 'profiles', undefined, true), A.db('GET', 'reviews', undefined, true)]).then(function (r) {
			var users = r[0] || {}, profs = r[1] || {}, revs = r[2] || {}
			all = Object.keys(users).map(function (uid) {
				var u = users[uid] || {}, p = profs[uid] || {}, st = stat(revs[uid])
				return { uid: uid, n: u.n || t('Гість'), a: u.a || '', s: u.s || 0, g: p.g || '', age: p.age || null, c: p.c || '', f: p.f || '', tg: p.tg || '', avg: st.avg, count: st.count }
			})
			loaded = true
			render()
		}).catch(function (e) {
			resultsBox.textContent = ''
			resultsBox.appendChild(el('p', 'users__msg', (e && e.code === 'PERMISSION') ? t('Список доступний зареєстрованим користувачам.') : t('Не вдалося завантажити список. Спробуйте пізніше.')))
		})
	}
	function passes(u) {
		var q = F.q.value.trim().toLowerCase()
		if (q && u.n.toLowerCase().indexOf(q) < 0) return false
		if (F.status.value === 'on' && !online(u.s)) return false
		if (F.status.value === 'off' && online(u.s)) return false
		if (F.gender.value && u.g !== F.gender.value) return false
		var mn = parseInt(F.ageMin.value, 10), mx = parseInt(F.ageMax.value, 10)
		if (!isNaN(mn) && !(u.age && u.age >= mn)) return false
		if (!isNaN(mx) && !(u.age && u.age <= mx)) return false
		if (F.course.value && u.c !== F.course.value) return false
		if (F.faculty.value && u.f !== F.faculty.value) return false
		if (F.contact.value === 'yes' && !u.tg) return false
		if (F.contact.value === 'no' && u.tg) return false
		var rt = parseFloat(F.rating.value)
		if (rt && !(u.count && u.avg >= rt)) return false
		return true
	}
	function render() {
		if (!loaded) return
		var rows = all.filter(passes)
		var by = F.sort.value
		rows.sort(function (a, b) {
			if (by === 'rating') return (b.avg - a.avg) || (b.count - a.count)
			if (by === 'reviews') return b.count - a.count
			if (by === 'online') return (online(b.s) - online(a.s)) || a.n.localeCompare(b.n, 'uk')
			return a.n.localeCompare(b.n, 'uk')
		})
		countEl.textContent = t('Знайдено') + ': ' + rows.length + ' ' + t('з') + ' ' + all.length
		resultsBox.textContent = ''
		if (!rows.length) { resultsBox.appendChild(el('p', 'users__msg', t('Нікого не знайдено. Змініть фільтри.'))); return }
		rows.forEach(function (u) {
			var b = el('button', 'ucard')
			b.type = 'button'
			var av = el('span', 'ucard__av')
			av.appendChild(avatarEl(u, 'uavatar'))
			var d = dot(online(u.s))
			av.appendChild(d)
			var info = el('span', 'ucard__info')
			info.appendChild(el('strong', null, u.n))
			var meta = []
			if (u.c) meta.push(courseText(u.c))
			if (u.f) meta.push(u.f)
			if (u.age) meta.push(u.age + ' ' + t('р.'))
			if (u.g) meta.push(t(GENDER[u.g]))
			info.appendChild(el('span', 'ucard__meta', meta.join(' · ') || t('Профіль не заповнено')))
			b.appendChild(av)
			b.appendChild(info)
			if (u.tg) { var tb = el('span', 'tgbadge', 'Telegram'); tb.title = t('Можна зв’язатися в Telegram'); b.appendChild(tb) }
			b.appendChild(ratingEl(u.avg, u.count))
			b.addEventListener('click', function () { openProfile(u.uid) })
			resultsBox.appendChild(b)
		})
	}
	Object.keys(F).forEach(function (k) { F[k].addEventListener(k === 'q' || k === 'ageMin' || k === 'ageMax' ? 'input' : 'change', render) })
	$('[data-f-reset]', modal).addEventListener('click', function () {
		Object.keys(F).forEach(function (k) { if (k !== 'sort') F[k].value = '' })
		render()
	})

	/* ---------- profile view ---------- */
	var profBox = $('[data-profile-box]', modal)
	function showList() { profView.hidden = true; listView.hidden = false }
	$('[data-profile-back]', modal).addEventListener('click', function () { showList(); loadAll() })

	function openProfile(uid) {
		listView.hidden = true
		profView.hidden = false
		profBox.textContent = ''
		profBox.appendChild(el('p', 'users__msg', t('Завантажуємо...')))
		var enc = encodeURIComponent(uid)
		Promise.all([A.db('GET', 'users/' + enc, undefined, true), A.db('GET', 'profiles/' + enc, undefined, true), A.db('GET', 'reviews/' + enc, undefined, true)])
			.then(function (r) { renderProfile(uid, r[0] || {}, r[1] || {}, r[2] || {}) })
			.catch(function () { profBox.textContent = ''; profBox.appendChild(el('p', 'users__msg', t('Не вдалося завантажити профіль.'))) })
	}
	function renderProfile(uid, u, p, rev) {
		var me = A.user
		var self = me && me.uid === uid
		profBox.textContent = ''
		var head = el('div', 'pf__head')
		var av = el('span', 'pf__av')
		av.appendChild(avatarEl({ n: u.n, a: u.a }, 'uavatar uavatar--lg'))
		head.appendChild(av)
		var hi = el('div', 'pf__hi')
		hi.appendChild(el('h3', null, u.n || t('Гість')))
		var st = el('p', 'pf__status')
		var on = self || online(u.s)
		st.appendChild(dot(on))
		st.appendChild(document.createTextNode(on ? t('В мережі') : t('Не в мережі')))
		hi.appendChild(st)
		var s = stat(rev)
		hi.appendChild(ratingEl(s.avg, s.count))
		head.appendChild(hi)
		A.applyBackground(head, p.bg)
		profBox.appendChild(head)

		var dl = el('dl', 'pf__facts')
		function fact(k, v) { if (!v) return; dl.appendChild(el('dt', null, t(k))); dl.appendChild(el('dd', null, v)) }
		fact('Факультет', p.f)
		fact('Курс', p.c ? courseText(p.c) : '')
		fact('Вік', p.age ? String(p.age) : '')
		fact('Стать', p.g ? t(GENDER[p.g]) : '')
		fact('Telegram', p.tg && /^[A-Za-z0-9_]{5,32}$/.test(p.tg) ? '@' + p.tg : '')
		if (!dl.children.length) dl.appendChild(el('dd', 'pf__empty', t('Користувач ще не заповнив профіль.')))
		profBox.appendChild(dl)

		// contact via Telegram
		var cbox = el('div', 'pf__contact')
		var hasTg = p.tg && /^[A-Za-z0-9_]{5,32}$/.test(p.tg)
		if (self) {
			if (hasTg) {
				var prev = el('span', 'btn tgbtn is-preview', t('Зв’язатися в Telegram'))
				prev.setAttribute('aria-disabled', 'true')
				cbox.appendChild(prev)
				cbox.appendChild(el('p', 'pf__hint', t('Так вашу кнопку бачать інші користувачі. Ваш Telegram') + ': @' + p.tg))
			} else {
				cbox.appendChild(el('p', 'pf__hint', t('Ви не вказали Telegram. Додайте його в розділі «Про мене» у кабінеті, і тут з’явиться кнопка «Зв’язатися в Telegram» для інших користувачів.')))
			}
		} else if (hasTg) {
			var a = el('a', 'btn tgbtn', t('Зв’язатися в Telegram'))
			a.href = 'https://t.me/' + p.tg
			a.target = '_blank'
			a.rel = 'noopener noreferrer'
			cbox.appendChild(a)
		} else {
			cbox.appendChild(el('p', 'pf__hint', t('Користувач не вказав Telegram, тому зв’язатися з ним тут не можна.')))
		}
		profBox.appendChild(cbox)

		// review form
		var box = el('div', 'pf__review')
		box.appendChild(el('h4', null, t('Відгуки')))
		var canReview = me && !self && me.verified !== false
		if (canReview) {
			var mine = rev[me.uid] || null
			var form = el('form', 'rform')
			var chosen = mine ? mine.r : 0
			var starRow = el('div', 'rform__stars')
			starRow.setAttribute('role', 'radiogroup')
			starRow.setAttribute('aria-label', t('Оцінка від 1 до 5'))
			var btns = []
			for (var i = 1; i <= 5; i++) (function (n) {
				var b = el('button', 'rform__star', '★')
				b.type = 'button'
				b.setAttribute('role', 'radio')
				b.setAttribute('aria-label', n + ' / 5')
				b.addEventListener('click', function () { chosen = n; paint(n) })
				b.addEventListener('mouseenter', function () { paint(n) })
				btns.push(b)
				starRow.appendChild(b)
			})(i)
			function paint(n) { btns.forEach(function (b, idx) { b.classList.toggle('is-on', idx < n); b.setAttribute('aria-checked', idx + 1 === chosen ? 'true' : 'false') }) }
			starRow.addEventListener('mouseleave', function () { paint(chosen) })
			paint(chosen)
			var ta = el('textarea')
			ta.rows = 3
			ta.maxLength = 300
			ta.placeholder = t('Напишіть відгук (необов’язково, до 300 символів)')
			ta.setAttribute('aria-label', t('Текст відгуку'))
			if (mine) ta.value = mine.t || ''
			var note = el('p', 'form-note-status')
			var row = el('div', 'rform__row')
			var sub = el('button', 'btn btn-primary', mine ? t('Оновити відгук') : t('Залишити відгук'))
			sub.type = 'submit'
			row.appendChild(sub)
			if (mine) {
				var del = el('button', 'btn btn-secondary', t('Видалити мій відгук'))
				del.type = 'button'
				del.addEventListener('click', function () {
					A.confirm(t('Видалити ваш відгук?'), t('Видалити')).then(function (ok) {
						if (!ok) return
						A.db('DELETE', 'reviews/' + encodeURIComponent(uid) + '/' + encodeURIComponent(me.uid), undefined, true).then(function () { openProfile(uid) }, function (e) { say(note, e.message) })
					})
				})
				row.appendChild(del)
			}
			form.appendChild(starRow)
			form.appendChild(ta)
			form.appendChild(row)
			form.appendChild(note)
			form.addEventListener('submit', function (ev) {
				ev.preventDefault()
				var text = ta.value.trim().replace(/\s+/g, ' ')
				if (!chosen) return say(note, t('Оберіть оцінку від 1 до 5 зірок.'))
				if (isBad(text)) return say(note, t('Нецензурна лексика заборонена. Будь ласка, спілкуйтеся ввічливо.'))
				sub.disabled = true
				A.db('PUT', 'reviews/' + encodeURIComponent(uid) + '/' + encodeURIComponent(me.uid), { r: chosen, t: text, n: me.name, ts: Date.now() }, true)
					.then(function () { openProfile(uid) }, function (e) { sub.disabled = false; say(note, e.message) })
			})
			box.appendChild(form)
		} else if (!self && me && me.verified === false) {
			box.appendChild(el('p', 'pf__hint', t('Підтвердьте пошту, щоб залишати відгуки.')))
		} else if (self) {
			box.appendChild(el('p', 'pf__hint', t('Це ваш профіль: відгуки про себе залишати не можна.')))
		}
		var list = el('div', 'reviews')
		var items = reviewItems(rev)
		if (!items.length) list.appendChild(el('p', 'pf__hint', t('Відгуків поки немає.')))
		items.forEach(function (r) { list.appendChild(reviewNode(r)) })
		box.appendChild(list)
		profBox.appendChild(box)
	}

	/* open modal => load list (button has data-open-modal handled globally) */
	if (usersBtn) usersBtn.addEventListener('click', function () {
		showList()
		if (!A.remote) { resultsBox.textContent = ''; resultsBox.appendChild(el('p', 'users__msg', t('Список користувачів доступний після підключення сервера.'))); return }
		loadAll()
	})
	setInterval(function () { if (!modal.hidden && !listView.hidden && loaded) loadAll() }, 90000)
})()
