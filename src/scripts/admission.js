/* Калькулятор конкурсного бала та каталог освітніх програм. Дані - window.NTU_ADMISSION (admission-data.js).
   Формула (Правила прийому 2025–2026): КБ = (К1·П1 + К2·П2 + К3·П3 + К4·П4) / (К1 + К2 + К3 + (К4max + К4) / 2) × ГК
   НМТ 2024: знаменник К1 + К2 + К3 + К4; НМТ 2023: лише три предмети. ГК = 1,02 для спеціальностей із галузевою
   підтримкою при пріоритеті 1–2. Бонус 10 балів за підготовчі курси - лише НМТ 2026 і спеціальності з підтримкою. */
;(function () {
	'use strict'
	var D = window.NTU_ADMISSION
	if (!D) return
	function t(s) { return typeof T === 'function' ? T(s) : s }
	function el(tag, cls, text) {
		var e = document.createElement(tag)
		if (cls) e.className = cls
		if (text != null) e.textContent = text
		return e
	}
	var FOURTH = ['english', 'literature', 'physics', 'chemistry', 'biology', 'geography']
	var SECTOR = 1.02, COURSE_BONUS = 10
	function specBy(code) { for (var i = 0; i < D.specs.length; i++) if (D.specs[i].code === code) return D.specs[i]; return null }
	function progsFor(code) {
		var base = code.split('.')[0]
		return D.programs.filter(function (p) { return p.c === code || p.c === base })
	}
	function fmt(n) { return (Math.round(n * 1000) / 1000).toFixed(3).replace('.', ',') }

	/* ================= calculator ================= */
	var calc = document.querySelector('[data-calc]')
	if (calc) (function () {
		var form = calc.querySelector('form')
		var sel = form.elements.spec
		var status = calc.querySelector('[data-calc-status]')
		var scoreEl = calc.querySelector('[data-calc-score]')
		var gauge = calc.querySelector('.gauge__fg')
		var empty = calc.querySelector('[data-calc-empty]')
		var explain = calc.querySelector('[data-calc-explain]')
		var progBox = calc.querySelector('[data-calc-progs]')
		var fourthRow = calc.querySelector('[data-calc-fourth]')

		function fillSpecs() {
			var keep = sel.value
			sel.length = 1
			sel.options[0].textContent = t('Оберіть спеціальність')
			var groups = {}
			D.specs.forEach(function (s) {
				var g = s.code[0]
				if (!groups[g]) {
					groups[g] = el('optgroup')
					groups[g].label = g + ' · ' + t(D.fields[g] || '')
					sel.appendChild(groups[g])
				}
				var o = el('option', null, s.code + ' ' + t(s.name))
				o.value = s.code
				groups[g].appendChild(o)
			})
			sel.value = keep
		}
		fillSpecs()
		document.addEventListener('ntu:lang', function () { fillSpecs(); if (!explain.hidden) compute(true) })
		var q = new URLSearchParams(location.search).get('specialty')
		if (q && specBy(q)) sel.value = q

		function fieldErr(input, msg) {
			var w = input.closest('.field')
			if (!w) return
			w.classList.toggle('field--invalid', !!msg)
			var e = w.querySelector('.field-error')
			if (e) e.textContent = msg || ''
		}
		function readScore(input) {
			var v = String(input.value).trim()
			if (!/^\d{3}$/.test(v) || +v < 100 || +v > 200) return null
			return +v
		}
		function syncFourth() {
			var y = +form.elements.year.value
			fourthRow.hidden = y === 2023
			form.elements.fourth.required = y !== 2023
			var s = specBy(sel.value)
			Array.prototype.forEach.call(form.elements.subj4.options, function (o) {
				var k = s ? +s.k[o.value] || 0 : 1
				o.disabled = !k
				o.textContent = o.textContent.replace(/ \(.*\)$/, '') + (s && !k ? ' (' + t('Цей предмет не враховується для обраної спеціальності') + ')' : '')
			})
			if (form.elements.subj4.selectedOptions[0] && form.elements.subj4.selectedOptions[0].disabled) {
				var first = Array.prototype.find.call(form.elements.subj4.options, function (o) { return !o.disabled })
				if (first) form.elements.subj4.value = first.value
			}
		}
		sel.addEventListener('change', syncFourth)
		form.elements.year.addEventListener('change', syncFourth)
		syncFourth()

		function setGauge(score) {
			var p = Math.max(0, Math.min(100, score - 100))
			gauge.style.strokeDashoffset = String(100 - p)
			var t0 = performance.now(), from = +(scoreEl.dataset.v || 100)
			scoreEl.dataset.v = score
			var step = function (now) {
				var k = Math.min(1, (now - t0) / 900), v = from + (score - from) * (1 - Math.pow(1 - k, 3))
				scoreEl.textContent = fmt(v)
				if (k < 1) requestAnimationFrame(step)
			}
			requestAnimationFrame(step)
		}

		function compute(silent) {
			status.textContent = ''
			var ok = true, first = null
			var s = specBy(sel.value)
			fieldErr(sel, s ? '' : t('Оберіть спеціальність'))
			if (!s) { ok = false; first = first || sel }
			var year = +form.elements.year.value
			var names = ['ukrainian', 'math', 'history'].concat(year === 2023 ? [] : ['fourth'])
			var sc = {}
			names.forEach(function (n) {
				var inp = form.elements[n], v = readScore(inp)
				fieldErr(inp, v == null ? t('Введіть бал від 100 до 200') : '')
				if (v == null) { ok = false; first = first || inp }
				sc[n] = v
			})
			if (!ok) {
				if (!silent && first) first.focus()
				return
			}
			var k = s.k, k1 = +k.ukrainian || 0, k2 = +k.math || 0, k3 = +k.history || 0
			var subj = form.elements.subj4.value, k4 = +k[subj] || 0
			var num, den, parts
			if (year === 2023) {
				num = k1 * sc.ukrainian + k2 * sc.math + k3 * sc.history
				den = k1 + k2 + k3
				parts = '(' + [k1 + '·' + sc.ukrainian, k2 + '·' + sc.math, k3 + '·' + sc.history].join(' + ') + ') / ' + fmt(den)
			} else {
				num = k1 * sc.ukrainian + k2 * sc.math + k3 * sc.history + k4 * sc.fourth
				var k4max = Math.max.apply(null, FOURTH.map(function (f) { return +k[f] || 0 }))
				den = year === 2024 ? k1 + k2 + k3 + k4 : k1 + k2 + k3 + (k4max + k4) / 2
				parts = '(' + [k1 + '·' + sc.ukrainian, k2 + '·' + sc.math, k3 + '·' + sc.history, k4 + '·' + sc.fourth].join(' + ') + ') / ' + fmt(den)
			}
			var base = den > 0 ? num / den : 0
			var prio = form.elements.prio.value
			var gk = s.sp && (prio === '1' || prio === '2') ? SECTOR : 1
			var bonus = year === 2026 && s.sp && form.elements.courses.checked ? COURSE_BONUS : 0
			var total = Math.min(200, base * gk + bonus)

			empty.hidden = true
			setGauge(total)
			explain.hidden = false
			explain.textContent = ''
			explain.appendChild(el('p', null, s.code + ' ' + t(s.name)))
			explain.appendChild(el('code', null, parts + ' = ' + fmt(base)))
			var extra = [t('коефіцієнти') + ': К1 ' + k1 + ', К2 ' + k2 + ', К3 ' + k3 + (year === 2023 ? '' : ', К4 ' + k4)]
			if (gk !== 1) extra.push(t('галузевий коефіцієнт') + ' × ' + gk)
			if (bonus) extra.push(t('бонус за підготовчі курси') + ' +' + bonus)
			if (year === 2023) extra.push(t('Для НМТ 2023 враховуються три предмети без четвертого.'))
			explain.appendChild(el('p', 'calc__small', extra.join(' · ')))

			var list = progsFor(s.code)
			var ul = progBox.querySelector('ul')
			ul.textContent = ''
			list.forEach(function (p) {
				var li = el('li')
				var a = el('a', null, t(p.p))
				a.href = 'programs.html?q=' + encodeURIComponent(p.c)
				li.appendChild(a)
				li.appendChild(el('span', null, t(p.l) + ' · ' + t(p.d)))
				ul.appendChild(li)
			})
			progBox.hidden = !list.length
		}
		form.addEventListener('submit', function (e) { e.preventDefault(); compute(false) })
		form.addEventListener('input', function (e) { if (e.target.closest('.field--invalid')) fieldErr(e.target, '') })
		form.addEventListener('reset', function () {
			setTimeout(function () {
				Array.prototype.forEach.call(form.querySelectorAll('.field--invalid'), function (w) { w.classList.remove('field--invalid') })
				Array.prototype.forEach.call(form.querySelectorAll('.field-error'), function (w) { w.textContent = '' })
				scoreEl.textContent = '-'
				scoreEl.dataset.v = 100
				gauge.style.strokeDashoffset = '100'
				empty.hidden = false
				explain.hidden = true
				progBox.hidden = true
				syncFourth()
			})
		})
	})()

	/* ================= programme catalogue ================= */
	var cat = document.querySelector('[data-catalog]')
	if (cat) (function () {
		var qIn = cat.querySelector('[data-cat-q]'), lvl = cat.querySelector('[data-cat-level]'), fld = cat.querySelector('[data-cat-field]')
		var grid = cat.querySelector('[data-cat-grid]'), count = cat.querySelector('[data-cat-count]')
		var fields = {}
		D.programs.forEach(function (p) { fields[p.f] = 1 })
		function fillFields() {
			var keep = fld.value
			fld.length = 1
			fld.options[0].textContent = t('Усі галузі')
			Object.keys(fields).sort().forEach(function (f) { var o = el('option', null, t(f)); o.value = f; fld.appendChild(o) })
			fld.value = keep
			Array.prototype.forEach.call(lvl.options, function (o, i) { if (i) { o.value = o.value || o.dataset.v || o.textContent; } })
		}
		Array.prototype.forEach.call(lvl.options, function (o, i) { if (i) o.value = ['Бакалавр', 'Магістр'][i - 1] })
		fillFields()
		var params = new URLSearchParams(location.search)
		if (params.get('q')) qIn.value = params.get('q')

		// long list: show the first PAGE cards, the rest on «Показати всі»; resets when the filters change
		var PAGE = 12, showAll = false
		function norm(s) { return String(s || '').toLowerCase().replace(/[’'ʼ]/g, '') }
		function render() {
			var q = norm(qIn.value.trim()), L = lvl.value, F = fld.value
			var rows = D.programs.filter(function (p) {
				if (L && p.l !== L) return false
				if (F && p.f !== F) return false
				if (!q) return true
				var hay = norm([p.c, p.s, p.p, p.d, p.f, t(p.s), t(p.p), t(p.d)].join(' '))
				return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0 })
			})
			count.textContent = t('Знайдено програм') + ': ' + rows.length + ' / ' + D.programs.length
			grid.textContent = ''
			if (!rows.length) { grid.appendChild(el('p', 'catalog__empty', t('Нічого не знайдено. Змініть пошук або фільтри.'))); return }
			var total = rows.length
			if (!showAll && total > PAGE) rows = rows.slice(0, PAGE)
			rows.forEach(function (p, i) {
				var c = el('article', 'pcard')
				c.style.setProperty('--i', Math.min(i, 12))
				var top = el('div', 'pcard__top')
				top.appendChild(el('span', 'pcard__code', p.c))
				top.appendChild(el('span', 'pcard__lvl pcard__lvl--' + (p.l === 'Магістр' ? 'm' : 'b'), t(p.l)))
				c.appendChild(top)
				c.appendChild(el('h3', null, t(p.p)))
				c.appendChild(el('p', 'pcard__spec', t(p.s)))
				var meta = el('p', 'pcard__meta')
				meta.appendChild(el('span', null, t('Кафедра') + ': ' + p.d.split(' · ').map(t).join(', ')))
				c.appendChild(meta)
				var a = el('a', 'pcard__calc', t('Розрахувати бал для цієї спеціальності') + ' →')
				var sub = D.specs.filter(function (s) { return s.code === p.c || s.code.split('.')[0] === p.c })[0]
				a.href = 'calculator.html' + (sub ? '?specialty=' + encodeURIComponent(sub.code) : '')
				c.appendChild(a)
				grid.appendChild(c)
			})
			if (rows.length < total) {
				var more = el('div', 'catalog__more')
				var b = el('button', 'btn btn-secondary', t('Показати всі програми') + ' (' + total + ')')
				b.type = 'button'
				b.addEventListener('click', function () {
					showAll = true
					render()
					var next = grid.children[PAGE]
					if (next) { next.setAttribute('tabindex', '-1'); next.focus({ preventScroll: false }) }
				})
				more.appendChild(b)
				grid.appendChild(more)
			}
		}
		function reRender() { showAll = false; render() }
		var timer = null
		qIn.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(reRender, 120) })
		lvl.addEventListener('change', reRender)
		fld.addEventListener('change', reRender)
		cat.querySelector('[data-cat-reset]').addEventListener('click', function () { qIn.value = ''; lvl.value = ''; fld.value = ''; reRender(); qIn.focus() })
		document.addEventListener('ntu:lang', function () { fillFields(); render() })
		render()
	})()
})()
