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
	var COURSES = ['1', '2', '3', '4', '5', '6', 'Магістратура', 'Аспірантура', 'Абітурієнт', 'Випускник', 'Не з університету']
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
		// для якої теми зараз редагується фон; за замовчуванням - поточна тема сайту
		var bgMode = A.isDarkTheme() ? 'dark' : 'light'
		var modeBtns = bgBox.querySelectorAll('[data-bg-mode]')
		var bgOf = function (u) { return !u ? '' : bgMode === 'dark' ? (u.bgd || '') : (u.bg || '') }
		var paintBg = function () {
			var u = A.user
			// у картці - фон саме тієї теми, яку редагують (для темної без власного фону - як його бачитимуть інші)
			A.applyBackground(cardEl, u ? (bgMode === 'dark' ? A.darkBg(u) : u.bg) : '')
			Array.prototype.forEach.call(modeBtns, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-bg-mode') === bgMode ? 'true' : 'false') })
			var cur = bgOf(u)
			Array.prototype.forEach.call(sw.children, function (b) { b.classList.toggle('is-active', b.getAttribute('data-bg') === cur) })
		}
		Array.prototype.forEach.call(modeBtns, function (b) {
			b.addEventListener('click', function () { bgMode = b.getAttribute('data-bg-mode'); bgs.textContent = ''; paintBg() })
		})
		var modeName = function () { return bgMode === 'dark' ? t('для темної теми') : t('для світлої теми') }
		Object.keys(A.BG_PRESETS).forEach(function (id) {
			var b = el('button', 'bgpick__sw')
			b.type = 'button'
			b.setAttribute('data-bg', id)
			b.style.background = A.BG_PRESETS[id].css
			b.setAttribute('aria-label', t('Фон') + ' ' + id.replace('p', ''))
			b.addEventListener('click', function () {
				A.setBackground(id, bgMode).then(function () { say(bgs, t('Фон збережено') + ' ' + modeName() + '.', true) }, function (e) { say(bgs, e.message) })
			})
			sw.appendChild(b)
		})
		document.addEventListener('ntu:theme', function (e) { bgMode = e.detail === 'dark' ? 'dark' : 'light'; paintBg() })
		// панель вибору фону відкривається кнопкою «Фон профілю»
		var bgToggle = $('[data-bg-toggle]')
		if (bgToggle) bgToggle.addEventListener('click', function () {
			var open = bgBox.hidden
			bgBox.hidden = !open
			bgToggle.setAttribute('aria-expanded', open ? 'true' : 'false')
			bgToggle.classList.toggle('is-active', open)
			if (open) { var f = bgBox.querySelector('[data-bg-mode][aria-pressed=true]'); if (f) f.focus() }
		})
		var bgFile = $('#bgFile')
		$('[data-bg-pick]').addEventListener('click', function () { bgFile.click() })
		bgFile.addEventListener('change', function () {
			var f = bgFile.files && bgFile.files[0]
			if (!f) return
			say(bgs, t('Збереження...'), true)
			(A.fileToBackground || A.fileToCover)(f).then(function (d) { return A.setBackground(d, bgMode) })
				.then(function () { say(bgs, t('Фон збережено') + ' ' + modeName() + '.', true) }, function (e) { say(bgs, e.message) })
			bgFile.value = ''
		})
		$('[data-bg-reset]').addEventListener('click', function () {
			A.confirm(t('Прибрати фон профілю') + ' ' + modeName() + '?', t('Прибрати')).then(function (ok) {
				if (!ok) return
				A.setBackground('', bgMode).then(function () { say(bgs, t('Фон прибрано') + ' ' + modeName() + '.', true) }, function (e) { say(bgs, e.message) })
			})
		})
		A.onChange(paintBg)
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
	// Повідомлення про успіх зникають через 5 с; помилки та «Збереження...» лишаються, доки їх не замінять
	function say(node, msg, ok) {
		if (!node) return
		clearTimeout(node._sayTimer)
		node.style.color = ok ? '#2D9B70' : '#c0392b'
		node.textContent = msg
		if (ok && msg && !/(\.\.\.|…)$/.test(msg)) node._sayTimer = setTimeout(function () { node.textContent = '' }, 5000)
	}

	function loadOwnExtra(u) {
		A.getExtra(u.uid).then(function (x) {
			x = x || {}
			var f = extraForm.elements
			f.gender.value = x.g || ''
			f.age.value = x.age || ''
			f.course.value = x.c || ''
			f.faculty.value = x.f || ''
			f.tg.value = x.tg ? '@' + x.tg : ''
			var filled = hasExtra(x)
			setEditing(!filled)
			placeExtra(filled)
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

	/* «Про мене»: після збереження - режим перегляду з кнопкою «Відредагувати»;
	   заповнені дані переїжджають у Налаштування → «Персональні дані». */
	var extraPanel = $('[data-extra-panel]')
	var extraHint = $('[data-extra-hint]')
	var personalSec = $('[data-personal-sec]')
	var personalSlot = $('[data-personal-slot]')
	var extraBtn = extraForm ? extraForm.querySelector('button[type=submit]') : null
	var editing = true
	var moveTimer = null
	function hasExtra(x) { return !!(x && (x.g || x.age || x.c || x.f || x.tg)) }
	function setEditing(on) {
		editing = on
		if (!extraForm) return
		Array.prototype.forEach.call(extraForm.querySelectorAll('input, select'), function (fl) { fl.disabled = !on })
		extraForm.classList.toggle('is-locked', !on)
		extraBtn.textContent = on ? t('Зберегти') : t('Відредагувати')
		extraBtn.className = 'btn ' + (on ? 'btn-primary' : 'btn-secondary')
	}
	function placeExtra(filled) {
		if (!extraForm || !personalSlot || !extraPanel) return
		clearTimeout(moveTimer)
		if (filled) {
			if (extraHint) personalSlot.appendChild(extraHint)
			personalSlot.appendChild(extraForm)
			extraPanel.hidden = true
			personalSec.hidden = false
		} else {
			if (extraHint) extraPanel.appendChild(extraHint)
			extraPanel.appendChild(extraForm)
			extraPanel.hidden = false
			personalSec.hidden = true
		}
		var grid = extraPanel.parentNode
		if (grid) grid.classList.toggle('account__grid--single', !!filled)
	}

	if (extraForm) {
		var xs = $('[data-extra-status]')
		extraForm.addEventListener('submit', function (e) {
			e.preventDefault()
			if (!editing) {
				clearTimeout(moveTimer)
				setEditing(true)
				say(xs, '')
				extraForm.elements.gender.focus()
				return
			}
			var f = extraForm.elements
			var ageRaw = String(f.age.value || '').trim()
			// type=number повертає '' для нечислового вводу - перевіряємо і validity.badInput
			if (f.age.validity && f.age.validity.badInput) { f.age.focus(); return say(xs, t('Вік має бути цілим числом від 10 до 99.')) }
			if (ageRaw && !/^\d{1,2}$/.test(ageRaw)) { f.age.focus(); return say(xs, t('Вік має бути цілим числом від 10 до 99.')) }
			var age = ageRaw ? parseInt(ageRaw, 10) : null
			if (age != null && (age < 10 || age > 99)) { f.age.focus(); return say(xs, t('Вік має бути від 10 до 99.')) }
			var tg = f.tg.value.trim().replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '')
			if (tg && !/^[A-Za-z][A-Za-z0-9_]{3,30}[A-Za-z0-9]$/.test(tg)) { f.tg.focus(); return say(xs, t('Telegram: від 5 до 32 символів — латинські літери, цифри та підкреслення; починається з літери.')) }
			var data = { g: f.gender.value || '', c: f.course.value || '', f: f.faculty.value || '', tg: tg || null, age: age != null ? age : null }
			f.tg.value = tg ? '@' + tg : ''
			say(xs, t('Збереження...'), true)
			extraBtn.disabled = true
			A.saveExtra(data).then(function () {
				var filled = hasExtra(data)
				setEditing(false)
				var inSettings = extraPanel && extraPanel.hidden
				if (filled && !inSettings) {
					say(xs, t('Дані збережено. Тепер вони в Налаштуваннях → «Персональні дані».'), true)
					// даємо прочитати повідомлення, потім блок переїжджає в налаштування
					moveTimer = setTimeout(function () { if (!editing) placeExtra(true) }, 5000)
				} else {
					say(xs, t('Дані збережено.'), true)
					if (!filled && inSettings) { placeExtra(false); setEditing(true) }
				}
			}, function (er) { say(xs, er.message) }).then(function () { extraBtn.disabled = false })
		})
	}

	/* Незаповнені персональні дані: червоний «!» (банер, шестерня, «Персональні дані», «Про мене») і підсвічені поля */
	var fillAlert = $('[data-fill-alert]')
	var FILL_LBL = { g: 'стать', age: 'вік', c: 'курс', f: 'факультет' }
	var FILL_FIELD = { g: 'gender', age: 'age', c: 'course', f: 'faculty' }
	function fillMissing() { return A.missingInfo ? A.missingInfo() : [] }
	function syncFill() {
		var miss = fillMissing()
		if (fillAlert) {
			fillAlert.hidden = !miss.length
			var l = $('[data-fill-list]')
			if (l) l.textContent = miss.length ? t('Не вказано') + ': ' + miss.map(function (k) { return t(FILL_LBL[k]) }).join(', ') + '.' : ''
		}
		Array.prototype.forEach.call(document.querySelectorAll('[data-fill-dot]'), function (d) { d.hidden = !miss.length })
		if (extraForm) Object.keys(FILL_FIELD).forEach(function (k) {
			var fl = extraForm.elements[FILL_FIELD[k]], w = fl && fl.closest('.field')
			if (w) w.classList.toggle('field--missing', miss.indexOf(k) > -1)
		})
	}
	document.addEventListener('ntu:lang', syncFill)
	var fillGo = $('[data-fill-go]')
	if (fillGo && extraForm) fillGo.addEventListener('click', function () {
		var miss = fillMissing()
		var focusFirst = function () {
			setEditing(true)
			var fl = miss.length ? extraForm.elements[FILL_FIELD[miss[0]]] : null
			if (fl) fl.focus({ preventScroll: true })
			if (fl && fl.scrollIntoView) fl.scrollIntoView({ block: 'center', behavior: 'smooth' })
		}
		if (extraPanel && !extraPanel.hidden) return focusFirst()
		var gear = $('.account__gear')
		if (gear) gear.click()
		var grp = personalSec && personalSec.closest('[data-setgroup]')
		if (grp && grp._set) grp._set(true)
		setTimeout(focusFirst, 80)
	})

	var loadedExtraFor = null
	A.onChange(function (u) {
		if (!extraForm) return
		syncVerify(u)
		syncFill()
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
		/* Розділи налаштувань: форма з'являється лише після «Змінити ...» */
		var folds = setModal.querySelectorAll('[data-fold]')
		Array.prototype.forEach.call(folds, function (sec) {
			var open = sec.querySelector('[data-fold-open]'), body = sec.querySelector('.setsec__body')
			var set = function (on, focus) {
				body.hidden = !on
				open.hidden = on
				open.setAttribute('aria-expanded', on ? 'true' : 'false')
				sec.classList.toggle('is-open', on)
				if (on) {
					var f = body.querySelector('input:not([type=file]):not([type=radio]),select,input[type=radio]:checked,button')
					if (f) f.focus()
				} else if (focus) open.focus()
			}
			open.addEventListener('click', function () { set(true) })
			Array.prototype.forEach.call(body.querySelectorAll('[data-fold-close]'), function (b) { b.addEventListener('click', function () { set(false, true) }) })
			sec.addEventListener('fold:close', function () { set(false, true) })
			sec._fold = set
		})
		/* Групи налаштувань (Персональні дані, Приватність, Безпека): розгортаються по кліку на заголовок */
		var groups = setModal.querySelectorAll('[data-setgroup]')
		Array.prototype.forEach.call(groups, function (g) {
			var h = g.querySelector('.setgroup__head'), b = g.querySelector('.setgroup__body')
			g._set = function (on) {
				b.hidden = !on
				h.setAttribute('aria-expanded', on ? 'true' : 'false')
				g.classList.toggle('is-open', on)
			}
			h.addEventListener('click', function () { g._set(b.hidden) })
		})
		// закрили вікно налаштувань - усі розділи знову згорнуті
		new MutationObserver(function () {
			if (!setModal.hidden) return
			Array.prototype.forEach.call(folds, function (s) { if (s._fold) s._fold(false) })
			Array.prototype.forEach.call(groups, function (g) { g._set(false) })
		}).observe(setModal, { attributes: true, attributeFilter: ['hidden'] })

		/* Локальні вподобання: «друкую», звук, сповіщення браузера */
		Array.prototype.forEach.call(setModal.querySelectorAll('[data-pref]'), function (cb) {
			var k = cb.getAttribute('data-pref')
			cb.checked = A.pref(k)
			cb.addEventListener('change', function () {
				if (k === 'notify' && cb.checked) {
					if (!('Notification' in window)) { cb.checked = false; say(setStatus, t('Цей браузер не підтримує сповіщення.')); return }
					Notification.requestPermission().then(function (r) {
						if (r !== 'granted') { cb.checked = false; A.setPref(k, false); say(setStatus, t('Сповіщення заблоковано в налаштуваннях браузера.')); return }
						A.setPref(k, true)
						say(setStatus, t('Збережено.'), true)
					})
					return
				}
				A.setPref(k, cb.checked)
				if (k === 'sound' && cb.checked && A.ding) A.ding()
				say(setStatus, t('Збережено.'), true)
			})
		})

		/* Безпека: лист для зміни пароля */
		var secStatus = $('[data-sec-status]')
		var passBtn = $('[data-pass-reset]')
		if (passBtn) passBtn.addEventListener('click', function () {
			var u = A.user
			if (!u || !u.email) return
			passBtn.disabled = true
			A.resetPassword(u.email).then(function () {
				say(secStatus, t('Лист для зміни пароля надіслано на') + ' ' + u.email + '. ' + t('Перевірте також папку «Спам».'), true)
			}, function (e) { say(secStatus, e.message) }).then(function () { setTimeout(function () { passBtn.disabled = false }, 30000) })
		})
		A.onChange(function (u) {
			if (!u) return
			var cn = $('[data-cur-name]'), ce = $('[data-cur-email]'), ca = $('[data-cur-avatar]')
			if (cn) cn.textContent = u.name
			if (ce) ce.textContent = u.email
			if (ca) {
				ca.textContent = ''
				var im
				if (u.avatar) { im = el('img', 'uavatar'); im.src = u.avatar; im.alt = '' } else im = el('span', 'uavatar uavatar--ph', A.initials(u.name))
				ca.appendChild(im)
				ca.appendChild(el('span', null, u.avatar ? t('Фото встановлено') : t('Без фото')))
			}
			$('[data-set-verified]').textContent = !A.remote || u.verified !== false ? t('Підтверджено') : t('Не підтверджено')
			setCheck.checked = !!u.hideOnline // чек-бокс «Приховати статус»
		})
		setCheck.addEventListener('change', function () {
			A.setHideOnline(setCheck.checked).then(function () { say(setStatus, t('Збережено.'), true) }, function (e) {
				setCheck.checked = !setCheck.checked
				say(setStatus, e.message)
			})
		})
	}

	/* ================= роль, записи уроків викладача ================= */
	var SUBJ = A.SUBJECTS || []
	var roleLine = $('[data-account-role]')
	var teacherPanel = $('[data-teacher-panel]')
	var lessonForm = $('[data-lesson-form]')
	var myLessons = $('[data-my-lessons]')
	function roleText(role, subj, req) {
		if (role === 't') return t('Викладач') + (subj ? ' · ' + t(subj) : '')
		if (req) return t('Учень') + ' · ' + (req.rejected ? t('запит на роль викладача відхилено') : t('запит на роль викладача на розгляді'))
		return t('Учень')
	}
	function fmtDate(ts) { var d = new Date(ts); return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear() }
	function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB' }
	/* Картка запису уроку (для кабінету викладача та профілю) */
	function lessonNode(id, l, onDelete) {
		var n = el('article', 'lrec')
		var h = el('div', 'lrec__head')
		h.appendChild(el('h4', null, l.title))
		h.appendChild(el('time', null, fmtDate(l.ts)))
		n.appendChild(h)
		if (l.d) n.appendChild(el('p', 'lrec__desc', l.d))
		var links = el('div', 'lrec__links')
		if (l.v && /^https:\/\//.test(l.v)) {
			var v = el('a', 'lrec__video', '▶ ' + t('Дивитися запис уроку'))
			v.href = l.v; v.target = '_blank'; v.rel = 'noopener noreferrer'
			links.appendChild(v)
		}
		;(l.files || []).forEach(function (f) {
			if (!f || !/^https:\/\/ntu\.dp\.ua\/uploads\//.test(f.url || '')) return
			var a = el('a', 'lrec__file')
			a.href = f.url; a.target = '_blank'; a.rel = 'noopener noreferrer'
			a.appendChild(el('span', 'dm-file__ic', 'PDF'))
			a.appendChild(el('span', null, f.name + (f.size ? ' · ' + fmtSize(f.size) : '')))
			links.appendChild(a)
		})
		if (links.children.length) n.appendChild(links)
		if (onDelete) {
			var del = el('button', 'btn btn-secondary lrec__del', t('Видалити запис'))
			del.type = 'button'
			del.addEventListener('click', function () { onDelete(id) })
			n.appendChild(del)
		}
		return n
	}
	function renderLessons(box, data, onDelete) {
		box.textContent = ''
		var ids = Object.keys(data || {}).sort(function (a, b) { return (data[b].ts || 0) - (data[a].ts || 0) })
		if (!ids.length) { box.appendChild(el('p', 'pf__hint', t('Записів уроків поки немає.'))); return }
		ids.forEach(function (id) { box.appendChild(lessonNode(id, data[id], onDelete)) })
	}
	var ls = $('[data-lesson-status]')
	function loadMyLessons() {
		var u = A.user
		if (!u || !A.remote || !myLessons) return
		A.db('GET', 'lessons/' + encodeURIComponent(u.uid), undefined, true).then(function (d) {
			renderLessons(myLessons, d, function (id) {
				A.confirm(t('Видалити цей запис уроку?'), t('Видалити')).then(function (ok) {
					if (!ok) return
					A.db('DELETE', 'lessons/' + encodeURIComponent(u.uid) + '/' + encodeURIComponent(id), undefined, true).then(loadMyLessons, function (e) { say(ls, e.message) })
				})
			})
		}).catch(function () {})
	}
	if (lessonForm) lessonForm.addEventListener('submit', function (e) {
		e.preventDefault()
		var f = lessonForm.elements, u = A.user
		var btn = lessonForm.querySelector('button[type=submit]')
		if (btn.disabled || !u) return
		if (!A.remote) return say(ls, t('Записи уроків працюють лише після підключення сервера.'))
		var title = f.title.value.trim().replace(/\s+/g, ' '), video = f.video.value.trim(), desc = f.desc.value.trim()
		if (title.length < 3) { f.title.focus(); return say(ls, t('Вкажіть тему уроку (щонайменше 3 символи).')) }
		if (isBad(title) || isBad(desc)) return say(ls, t('Нецензурна лексика заборонена. Будь ласка, спілкуйтеся ввічливо.'))
		if (video && !/^https:\/\/[^\s]+\.[^\s]+$/.test(video)) { f.video.focus(); return say(ls, t('Посилання на запис має починатися з https://')) }
		var files = Array.prototype.slice.call(f.files.files || [])
		if (files.length > 5) return say(ls, t('Можна додати до 5 PDF-файлів.'))
		for (var i = 0; i < files.length; i++) {
			if (!/\.pdf$/i.test(files[i].name)) return say(ls, t('Можна додавати лише PDF-файли.'))
			if (files[i].size > 20 * 1024 * 1024) return say(ls, t('Файл завеликий (максимум 20 МБ).') + ' ' + files[i].name)
		}
		if (!video && !files.length && !desc) return say(ls, t('Додайте посилання на запис, опис або PDF-файл.'))
		btn.disabled = true
		var uploaded = []
		var chain = Promise.resolve()
		files.forEach(function (file, k) {
			chain = chain.then(function () {
				say(ls, t('Завантаження файлів...') + ' ' + (k + 1) + '/' + files.length, true)
				return A.upload(file, 'lesson').then(function (r) { uploaded.push({ url: r.url, name: r.name, size: r.size }) })
			})
		})
		chain.then(function () {
			var data = { title: title, ts: { '.sv': 'timestamp' } }
			if (desc) data.d = desc.slice(0, 2000)
			if (video) data.v = video
			if (uploaded.length) data.files = uploaded
			return A.db('POST', 'lessons/' + encodeURIComponent(u.uid), data, true)
		}).then(function () {
			lessonForm.reset()
			say(ls, t('Запис опубліковано.'), true)
			loadMyLessons()
		}, function (er) { say(ls, er.message) }).then(function () { btn.disabled = false })
	})

	var roleForm = $('[data-role-form]')
	if (roleForm) {
		var rs = $('[data-role-status]'), rSubj = $('[data-role-subj]'), rWrap = $('[data-role-subj-wrap]')
		SUBJ.forEach(function (sj) { var o = el('option', null, t(sj)); o.value = sj; rSubj.appendChild(o) })
		var syncR = function () { rWrap.hidden = (roleForm.querySelector('input[name=role]:checked') || {}).value !== 't' }
		Array.prototype.forEach.call(roleForm.querySelectorAll('input[name=role]'), function (r) { r.addEventListener('change', syncR) })
		roleForm.addEventListener('submit', function (e) {
			e.preventDefault()
			var r = (roleForm.querySelector('input[name=role]:checked') || {}).value || 's'
			if (r === 't' && !rSubj.value) { rSubj.focus(); return say(rs, t('Оберіть предмет, який ви викладаєте.')) }
			var u = A.user || {}
			var sub = roleForm.querySelector('[type=submit]')
			if (sub && sub.disabled) return
			// нічого не змінилось - не шлемо запит (і не створюємо повторний запит на роль)
			if (r === (u.role || 's') && (r === 's' ? !u.roleReq : rSubj.value === (u.subj || ''))) return say(rs, t('Роль не змінилась.'), true)
			// такий самий запит уже чекає на розгляд - не витрачаємо ліміт (2 запити на добу)
			if (r === 't' && u.role !== 't' && u.roleReq && !u.roleReq.rejected && u.roleReq.subj === rSubj.value) return say(rs, t('Ваш запит уже на розгляді.'), true)
			// викладач, що обирає «Учень», втрачає роль назавжди (повернути її може лише адміністратор); так само скасовується запит
			var warn = r === 's' && u.role === 't' ? t('Зняти з себе роль викладача? Повернути її зможе лише адміністратор.')
				: r === 's' && u.roleReq ? t('Скасувати ваш запит на роль викладача?') : ''
			var go = warn ? A.confirm(warn, t('Так, змінити')) : Promise.resolve(true)
			go.then(function (ok) {
				if (!ok) return
				if (sub) sub.disabled = true
				return A.setRole(r, rSubj.value).then(function (res) {
					say(rs, res && res.pending ? t('Запит надіслано. Роль викладача з’явиться після підтвердження адміністратором.') : t('Роль збережено.'), true)
					roleForm.closest('[data-fold]') && roleForm.closest('[data-fold]').dispatchEvent(new CustomEvent('fold:close'))
				}, function (er) { say(rs, er.message) })
			}).then(function () { if (sub) sub.disabled = false })
		})
	}
	var lessonsLoadedFor = null
	A.onChange(function (u) {
		if (!u) return
		var tch = u.role === 't'
		if (roleLine) {
			roleLine.textContent = roleText(u.role, u.subj, u.roleReq)
			var ab = A.authorBadge && A.authorBadge(u.uid)
			if (ab) { roleLine.appendChild(document.createTextNode(' ')); roleLine.appendChild(ab) }
		}
		var cr = $('[data-cur-role]')
		if (cr) cr.textContent = roleText(u.role, u.subj, u.roleReq)
		if (teacherPanel) teacherPanel.hidden = !tch
		if (roleForm) {
			Array.prototype.forEach.call(roleForm.querySelectorAll('input[name=role]'), function (r) { r.checked = r.value === (tch ? 't' : 's') })
			$('[data-role-subj]').value = u.subj || ''
			$('[data-role-subj-wrap]').hidden = !tch
		}
		if (tch && lessonsLoadedFor !== u.uid) { lessonsLoadedFor = u.uid; loadMyLessons() }
	})

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
		faculty: $('[data-f=faculty]', modal), contact: $('[data-f=contact]', modal), rating: $('[data-f=rating]', modal), sort: $('[data-f=sort]', modal),
		subj: $('[data-f=subj]', modal)
	}
	SUBJ.forEach(function (sj) { var o = el('option', null, t(sj)); o.value = sj; F.subj.appendChild(o) })
	var roleTab = 's'
	Array.prototype.forEach.call(modal.querySelectorAll('[data-role-tab]'), function (b) {
		b.addEventListener('click', function () {
			roleTab = b.getAttribute('data-role-tab')
			Array.prototype.forEach.call(modal.querySelectorAll('[data-role-tab]'), function (x) {
				var on = x === b
				x.classList.toggle('is-active', on)
				x.setAttribute('aria-selected', on ? 'true' : 'false')
			})
			// для викладачів - фільтр за предметом; курс стосується лише учнів
			F.subj.hidden = roleTab !== 't'
			F.course.hidden = roleTab === 't'
			if (roleTab === 't') F.course.value = ''; else F.subj.value = ''
			if (!profView.hidden) showList()
			render()
		})
	})
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
				return { uid: uid, n: u.n || t('Гість'), a: u.a || '', s: p.hide ? 0 : (u.s || 0), hide: !!p.hide, g: p.g || '', age: p.age || null, c: p.c || '', f: p.f || '', tg: p.tg || '', avg: st.avg, count: st.count, role: p.role === 't' ? 't' : 's', subj: p.subj || '' }
			})
			loaded = true
			render()
		}).catch(function (e) {
			resultsBox.textContent = ''
			resultsBox.appendChild(el('p', 'users__msg', (e && e.code === 'PERMISSION') ? t('Список доступний зареєстрованим користувачам.') : t('Не вдалося завантажити список. Спробуйте пізніше.')))
		})
	}
	function passes(u) {
		if (u.role !== roleTab) return false
		var q = F.q.value.trim().toLowerCase()
		if (q && u.n.toLowerCase().indexOf(q) < 0 && (u.subj || '').toLowerCase().indexOf(q) < 0 && t(u.subj || '').toLowerCase().indexOf(q) < 0) return false
		if (F.subj.value && u.subj !== F.subj.value) return false
		if (F.status.value === 'on' && !online(u.s)) return false
		if (F.status.value === 'off' && online(u.s)) return false
		if (F.gender.value && u.g !== F.gender.value) return false
		var mn = parseInt(F.ageMin.value, 10), mx = parseInt(F.ageMax.value, 10)
		if (!isNaN(mn) && !isNaN(mx) && mn > mx) { var sw = mn; mn = mx; mx = sw } // «від» більше за «до» - міняємо місцями
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
		countEl.textContent = t('Знайдено') + ': ' + rows.length + ' ' + t('з') + ' ' + all.filter(function (x) { return x.role === roleTab }).length
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
			var nmEl = el('strong', null, u.n)
			var ab = A.authorBadge && A.authorBadge(u.uid)
			if (ab) { nmEl.appendChild(document.createTextNode(' ')); nmEl.appendChild(ab) }
			info.appendChild(nmEl)
			var meta = []
			if (u.role === 't') meta.push(t('Викладач') + (u.subj ? ': ' + t(u.subj) : ''))
			if (u.c) meta.push(courseText(u.c))
			if (u.f) meta.push(u.f)
			if (u.age) meta.push(u.age + ' ' + t('р.'))
			if (u.g) meta.push(t(GENDER[u.g]))
			info.appendChild(el('span', 'ucard__meta', meta.join(' · ') || t('Профіль не заповнено')))
			if (!u.hide) info.appendChild(el('span', 'ucard__seen' + (online(u.s) ? ' is-on' : ''), A.lastSeen(u.s)))
			else if (A.revealHidden) { var hs = el('span', 'ucard__seen'); info.appendChild(hs); A.revealHidden(u.uid, hs, d) }
			b.appendChild(av)
			b.appendChild(info)
			if (u.tg) { var tb = el('span', 'tgbadge', 'Telegram'); tb.title = t('Можна зв’язатися в Telegram'); b.appendChild(tb) }
			b.appendChild(ratingEl(u.avg, u.count))
			b.addEventListener('click', function () { openProfile(u.uid) })
			resultsBox.appendChild(b)
		})
	}
	Object.keys(F).forEach(function (k) { F[k].addEventListener(k === 'q' || k === 'ageMin' || k === 'ageMax' ? 'input' : 'change', render) })
	document.addEventListener('ntu:lang', function () { if (loaded && !modal.hidden) render() })
	$('[data-f-reset]', modal).addEventListener('click', function () {
		Object.keys(F).forEach(function (k) { if (k !== 'sort') F[k].value = '' })
		render()
	})

	/* ---------- profile view ---------- */
	var profBox = $('[data-profile-box]', modal)
	var profHead = null // шапка відкритого профілю: фон перемальовується при зміні теми
	document.addEventListener('ntu:theme', function () { if (profHead) A.applyBackground(profHead.node, A.themeBg(profHead.p)) })
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
		var on = self || (!p.hide && online(u.s))
		var stDot = dot(on), stTxt = el('span', null, self ? t('В мережі') : p.hide ? t('Статус «в мережі» приховано') : A.lastSeen(u.s))
		st.appendChild(stDot)
		st.appendChild(stTxt)
		if (!self && p.hide && A.revealHidden) A.revealHidden(uid, stTxt, stDot)
		hi.appendChild(st)
		var rl = el('p', 'pf__role')
		rl.appendChild(el('span', 'role-badge' + (p.role === 't' ? ' role-badge--t' : ''), p.role === 't' ? t('Викладач') : t('Учень')))
		if (p.role === 't' && p.subj) rl.appendChild(document.createTextNode(' ' + t(p.subj)))
		var ab = A.authorBadge && A.authorBadge(uid)
		if (ab) { rl.appendChild(document.createTextNode(' ')); rl.appendChild(ab) }
		hi.appendChild(rl)
		var s = stat(rev)
		hi.appendChild(ratingEl(s.avg, s.count))
		head.appendChild(hi)
		A.applyBackground(head, A.themeBg(p))
		profHead = { node: head, p: p }
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
				var prev = el('a', 'btn tgbtn', t('Зв’язатися в Telegram'))
				prev.href = 'https://t.me/' + p.tg
				prev.target = '_blank'
				prev.rel = 'noopener noreferrer'
				cbox.appendChild(prev)
				cbox.appendChild(el('p', 'pf__hint', t('Так вашу кнопку бачать інші користувачі. Ваш Telegram') + ': @' + p.tg))
			} else {
				cbox.appendChild(el('p', 'pf__hint', t('Ви не вказали Telegram. Додайте його в розділі «Про мене» у кабінеті, і тут з’явиться кнопка «Зв’язатися в Telegram» для інших користувачів.')))
			}
		} else {
			var btns = el('div', 'pf__btns')
			var dmb = el('button', 'btn btn-primary dmbtn', t('Написати тут'))
			dmb.type = 'button'
			dmb.setAttribute('data-dm-open', uid)
			btns.appendChild(dmb)
			if (hasTg) {
				var a = el('a', 'btn tgbtn', t('Зв’язатися в Telegram'))
				a.href = 'https://t.me/' + p.tg
				a.target = '_blank'
				a.rel = 'noopener noreferrer'
				btns.appendChild(a)
			}
			cbox.appendChild(btns)
			if (me && me.verified === false) cbox.appendChild(el('p', 'pf__hint', t('Підтвердьте пошту, щоб писати повідомлення.')))
		}
		profBox.appendChild(cbox)

		// записи уроків викладача
		if (p.role === 't') {
			var lb = el('div', 'pf__lessons')
			var lbtn = el('button', 'btn btn-secondary', t('Переглянути записи'))
			lbtn.type = 'button'
			var lbox = el('div', 'lesson-list')
			lbox.hidden = true
			lbtn.addEventListener('click', function () {
				if (!lbox.hidden) { lbox.hidden = true; lbtn.textContent = t('Переглянути записи'); return }
				lbox.hidden = false
				lbtn.textContent = t('Сховати записи')
				lbox.textContent = ''
				lbox.appendChild(el('p', 'pf__hint', t('Завантажуємо...')))
				A.db('GET', 'lessons/' + encodeURIComponent(uid), undefined, true).then(function (d) { renderLessons(lbox, d) }, function () { lbox.textContent = ''; lbox.appendChild(el('p', 'pf__hint', t('Не вдалося завантажити записи.'))) })
			})
			lb.appendChild(el('h4', null, t('Записи уроків')))
			lb.appendChild(lbtn)
			lb.appendChild(lbox)
			profBox.appendChild(lb)
		}

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
