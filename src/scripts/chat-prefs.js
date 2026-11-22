/*
 * Особисті налаштування чатів (бачить лише сам користувач):
 *  - закріплені учасники: pins = {uid: ts} - показуються першими в списку учасників загального чату та в списку розмов;
 *  - локальна тема чату: themes = {'chat' | <cid розмови>: id теми} - фон і колір моїх повідомлень;
 *  - своя тема (id 'custom'): custom = {bg: фото фону на сервері (api/upload.php), c: '#rrggbb' колір моїх повідомлень}.
 * Зберігається в localStorage (ntu-chat-prefs) і, коли користувач увійшов, синхронізується з RTDB prefs/{uid}.
 * window.NTU_CHATPREFS = { THEMES, isPinned, togglePin (null = ліміт), pins, theme, setTheme, apply, picker, closePicker, onChange }
 */
;(function () {
	'use strict'
	var LS_KEY = 'ntu-chat-prefs'
	var MAX_PINS = 50
	var UID_RE = /^[A-Za-z0-9]{20,64}$/
	var KEY_RE = /^(chat|[A-Za-z0-9]{20,64}_[A-Za-z0-9]{20,64})$/

	/* id - лише латиниця (так перевіряють правила бази) */
	var THEMES = [
		{ id: 'base', name: 'Стандартна', sw: ['#eef5fd', '#1a6fc4'] },
		{ id: 'ocean', name: 'Океан', sw: ['#d9f3fb', '#0e8fb5'] },
		{ id: 'sunset', name: 'Захід сонця', sw: ['#ffe6d5', '#e8590c'] },
		{ id: 'forest', name: 'Ліс', sw: ['#e1f4e5', '#2f8f4e'] },
		{ id: 'lavender', name: 'Лаванда', sw: ['#efe7fd', '#7c4ddb'] },
		{ id: 'candy', name: 'Цукерка', sw: ['#fde4f1', '#d63384'] },
		{ id: 'night', name: 'Ніч', sw: ['#17233a', '#4f7cff'] },
		{ id: 'gold', name: 'Золото', sw: ['#fdf3d8', '#c48a00'] },
		{ id: 'custom', name: 'Своя', sw: ['#ffffff', '#1a6fc4'] }
	]
	var BG_RE = /^https:\/\/ntu\.dp\.ua\/uploads\/\d{4}\/\d{2}\/[a-f0-9]{16,64}\.(jpg|jpeg|png|webp)$/
	var COLOR_RE = /^#[0-9a-f]{6}$/
	var DEFAULT_COLOR = '#1a6fc4'
	var BG_MAX_PX = 1600
	var BG_MAX_MB = 15
	var THEME_IDS = THEMES.map(function (x) { return x.id })

	function t(s) { return typeof T === 'function' ? T(s) : s }
	function A() { return window.NTU_AUTH }
	function clean(d) {
		var out = { uid: '', pins: {}, themes: {}, custom: null }
		if (!d || typeof d !== 'object') return out
		if (typeof d.uid === 'string' && UID_RE.test(d.uid)) out.uid = d.uid
		Object.keys(d.pins || {}).forEach(function (u) { if (UID_RE.test(u) && typeof d.pins[u] === 'number') out.pins[u] = d.pins[u] })
		Object.keys(d.themes || {}).forEach(function (k) { if (KEY_RE.test(k) && THEME_IDS.indexOf(d.themes[k]) > 0) out.themes[k] = d.themes[k] })
		out.custom = cleanCustom(d.custom)
		return out
	}
	function cleanCustom(c) {
		if (!c || typeof c !== 'object') return null
		var bg = typeof c.bg === 'string' && BG_RE.test(c.bg) ? c.bg : ''
		var col = typeof c.c === 'string' && COLOR_RE.test(c.c) ? c.c : ''
		if (!bg && !col) return null
		var out = {}
		if (bg) out.bg = bg
		if (col) out.c = col
		return out
	}
	function readLocal() {
		try { return clean(JSON.parse(localStorage.getItem(LS_KEY) || 'null')) } catch (e) { return clean(null) }
	}
	function writeLocal() {
		try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch (e) { /* приватний режим - лише в пам'яті */ }
	}

	var state = readLocal()
	var listeners = []
	var syncedUid = null
	var pending = null // зміни, зроблені поки йде запит GET - накладаємо їх на відповідь сервера
	function emit() { listeners.forEach(function (f) { try { f(state) } catch (e) { if (window.console) console.error(e) } }) }

	function remoteOk() { var a = A(); return !!(a && a.remote && a.user) }
	function save(path, value) {
		if (pending) pending.push([path, value])
		if (!remoteOk()) return
		var a = A()
		var req = value == null ? a.db('DELETE', 'prefs/' + a.user.uid + '/' + path, undefined, true) : a.db('PUT', 'prefs/' + a.user.uid + '/' + path, value, true)
		req.catch(function () { /* правила ще не опубліковані або немає мережі - лишається локальна копія */ })
	}
	/* Після входу. Локальна копія належить акаунту state.uid:
	   - той самий акаунт - сервер головний (видалення з інших пристроїв не повертаються);
	   - копія без власника (налаштування до входу) - дописуємо їх на сервер;
	   - інший акаунт - локальну копію відкидаємо, щоб чужі закріплення не потрапили в цей акаунт. */
	function setPath(obj, path, value) {
		if (path === 'custom') { obj.custom = cleanCustom(value); return }
		var k = path.split('/'), box = obj[k[0]]
		if (!box || k.length !== 2) return
		if (value == null) delete box[k[1]]; else box[k[1]] = value
	}
	function pull() {
		var a = A()
		if (!remoteOk() || syncedUid === a.user.uid) return
		var uid = a.user.uid
		syncedUid = uid
		var owner = state.uid
		if (owner && owner !== uid) { state = clean(null); writeLocal(); emit() }
		pending = []
		a.db('GET', 'prefs/' + uid, undefined, true).then(function (d) {
			var srv = clean(d)
			if (!owner) {
				Object.keys(state.pins).forEach(function (u) { if (!(u in srv.pins)) { srv.pins[u] = state.pins[u]; save('pins/' + u, state.pins[u]) } })
				Object.keys(state.themes).forEach(function (k) { if (!(k in srv.themes)) { srv.themes[k] = state.themes[k]; save('themes/' + k, state.themes[k]) } })
				if (!srv.custom && state.custom) { srv.custom = state.custom; save('custom', state.custom) }
			}
			;(pending || []).forEach(function (op) { setPath(srv, op[0], op[1]) })
			pending = null
			srv.uid = uid
			state = srv
			writeLocal()
			emit()
		}, function () { pending = null; syncedUid = null })
	}
	/* вихід з акаунта: на спільному комп'ютері наступний користувач не бачить чужих закріплень */
	function signedOut() {
		syncedUid = null
		if (!state.uid) return
		state = clean(null)
		writeLocal()
		emit()
	}

	function isPinned(uid) { return !!state.pins[uid] }
	function togglePin(uid) {
		if (!UID_RE.test(uid || '')) return false
		if (state.pins[uid]) {
			delete state.pins[uid]
			save('pins/' + uid, null)
		} else {
			if (Object.keys(state.pins).length >= MAX_PINS) return null // ліміт - інтерфейс показує підказку
			state.pins[uid] = Date.now()
			save('pins/' + uid, state.pins[uid])
		}
		writeLocal()
		emit()
		return isPinned(uid)
	}
	function theme(key) { return state.themes[key] || 'base' }
	function setTheme(key, id) {
		if (!KEY_RE.test(key || '') || THEME_IDS.indexOf(id) < 0) return
		if (id === 'base') { delete state.themes[key]; save('themes/' + key, null) } else { state.themes[key] = id; save('themes/' + key, id) }
		writeLocal()
		emit()
	}
	function shade(hex, k) {
		var n = parseInt(hex.slice(1), 16)
		var ch = [n >> 16, (n >> 8) & 255, n & 255].map(function (v) { return Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k))) })
		return '#' + ch.map(function (v) { return ('0' + v.toString(16)).slice(-2) }).join('')
	}
	function apply(node, key) {
		if (!node) return
		var id = key ? theme(key) : 'base'
		if (id === 'base') node.removeAttribute('data-ctheme'); else node.setAttribute('data-ctheme', id)
		if (id !== 'custom') { ['--ct-bg', '--ct-own', '--ct-own2'].forEach(function (v) { node.style.removeProperty(v) }); return }
		var c = state.custom || {}, col = c.c || DEFAULT_COLOR
		// URL перевірений BG_RE (лише латиниця, цифри, / . -), тож у CSS його можна вставити без екранування
		var dark = document.documentElement.getAttribute('data-theme') === 'dark'
		var tint = dark ? [shade(col, 0.22), shade(col, 0.14)] : [shade(col, 1.9), shade(col, 1.8)]
		// фото: cover по центру - підлаштовується під будь-який розмір панелі (телефон, зміна розміру, повний екран);
		// у темній темі поверх фото - напівпрозора темна вуаль, щоб світле фото не сліпило і бульбашки читались
		var veil = dark ? 'linear-gradient(rgba(8,16,30,.46),rgba(8,16,30,.46)), ' : 'linear-gradient(rgba(255,255,255,.08),rgba(255,255,255,.08)), '
		node.style.setProperty('--ct-bg', c.bg ? veil + 'url("' + c.bg + '") center / cover no-repeat ' + tint[1] : 'linear-gradient(160deg,' + tint[0] + ',' + tint[1] + ')')
		node.style.setProperty('--ct-own', col)
		node.style.setProperty('--ct-own2', shade(col, 0.78))
	}

	/* ---------- своя тема: фото фону (стискаємо до 1600 px JPEG і вантажимо на сервер) + колір ---------- */
	function compressBg(file) {
		return new Promise(function (res, rej) {
			if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return rej(new Error(t('Оберіть фото у форматі JPG, PNG або WebP.')))
			if (file.size > BG_MAX_MB * 1024 * 1024) return rej(new Error(t('Фото завелике (максимум 15 МБ).')))
			var url = URL.createObjectURL(file)
			var img = new Image()
			img.onload = function () {
				var k = Math.min(1, BG_MAX_PX / Math.max(img.width, img.height))
				var cv = document.createElement('canvas')
				cv.width = Math.round(img.width * k)
				cv.height = Math.round(img.height * k)
				cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
				URL.revokeObjectURL(url)
				cv.toBlob(function (b) { b ? res(new File([b], 'chat-bg.jpg', { type: 'image/jpeg' })) : rej(new Error(t('Не вдалося прочитати зображення.'))) }, 'image/jpeg', 0.82)
			}
			img.onerror = function () { URL.revokeObjectURL(url); rej(new Error(t('Не вдалося прочитати зображення.'))) }
			img.src = url
		})
	}
	function setCustom(next, persist) {
		state.custom = cleanCustom(next)
		if (persist) save('custom', state.custom)
		writeLocal()
		emit()
	}
	function uploadBg(file, onStatus) {
		var a = A()
		if (!a || !a.remote || !a.user) return Promise.reject(new Error(t('Увійдіть, щоб завантажити свій фон.')))
		onStatus(t('Завантажуємо…'))
		return compressBg(file).then(function (f) {
			return a.upload(f, 'chat', function (pc) { onStatus(t('Завантажуємо…') + ' ' + pc + '%') })
		}).then(function (r) {
			if (!r || !BG_RE.test(r.url || '')) throw new Error(t('Не вдалося завантажити файл.'))
			var c = state.custom || {}
			setCustom({ bg: r.url, c: c.c || '' }, true)
		})
	}

	/* ---------- вибір теми: спливаюча панель біля кнопки ---------- */
	var pop = null, popKey = null, popAnchor = null
	function closePicker(restoreFocus) {
		if (!pop) return
		pop.remove()
		pop = null
		if (popAnchor) { popAnchor.setAttribute('aria-expanded', 'false'); if (restoreFocus === true) popAnchor.focus() }
		popKey = popAnchor = null
	}
	function picker(anchor, key) {
		if (pop && popKey === key) { closePicker(true); return }
		closePicker()
		popKey = key
		popAnchor = anchor
		pop = document.createElement('div')
		pop.className = 'ctheme-pop'
		pop.setAttribute('role', 'dialog')
		pop.setAttribute('aria-label', t('Тема чату'))
		var h = document.createElement('p')
		h.className = 'ctheme-pop__title'
		h.textContent = t('Тема чату')
		pop.appendChild(h)
		var grid = document.createElement('div')
		grid.className = 'ctheme-pop__grid'
		THEMES.forEach(function (th) {
			var b = document.createElement('button')
			b.type = 'button'
			b.className = 'ctheme-sw' + (theme(key) === th.id ? ' is-active' : '')
			b.setAttribute('data-id', th.id)
			b.setAttribute('aria-pressed', theme(key) === th.id ? 'true' : 'false')
			b.style.setProperty('--sw-a', th.sw[0])
			b.style.setProperty('--sw-b', th.sw[1])
			var dot = document.createElement('span')
			dot.className = 'ctheme-sw__dot'
			b.appendChild(dot)
			b.appendChild(document.createTextNode(t(th.name)))
			b.addEventListener('click', function () { setTheme(key, th.id); closePicker(true) })

			grid.appendChild(b)
		})
		pop.appendChild(grid)
		pop.appendChild(customSection(key))
		var note = document.createElement('p')
		note.className = 'ctheme-pop__note'
		note.textContent = t('Тему бачите лише ви.')
		pop.appendChild(note)
		// фокус пішов за межі панелі (Tab) - закриваємо
		pop.addEventListener('focusout', function (e) { if (pop && e.relatedTarget && !pop.contains(e.relatedTarget) && e.relatedTarget !== popAnchor) closePicker() })
		document.body.appendChild(pop)
		markActive()
		anchor.setAttribute('aria-expanded', 'true')
		place()
		var first = pop.querySelector('.is-active') || pop.querySelector('button')
		if (first) first.focus()
	}
	function customSection(key) {
		var box = document.createElement('div')
		box.className = 'ctheme-own'
		var title = document.createElement('p')
		title.className = 'ctheme-own__title'
		title.textContent = t('Своя тема')
		box.appendChild(title)
		var row = document.createElement('div')
		row.className = 'ctheme-own__row'
		var file = document.createElement('input')
		file.type = 'file'
		file.accept = 'image/jpeg,image/png,image/webp'
		file.hidden = true
		var up = document.createElement('button')
		up.type = 'button'
		up.className = 'ctheme-own__btn'
		up.textContent = state.custom && state.custom.bg ? t('Змінити фон') : t('Завантажити фон')
		var colLab = document.createElement('label')
		colLab.className = 'ctheme-own__color'
		colLab.title = t('Колір моїх повідомлень')
		var col = document.createElement('input')
		col.type = 'color'
		col.value = (state.custom && state.custom.c) || DEFAULT_COLOR
		col.setAttribute('aria-label', t('Колір моїх повідомлень'))
		colLab.appendChild(col)
		colLab.appendChild(document.createTextNode(t('Колір')))
		row.appendChild(up)
		row.appendChild(colLab)
		box.appendChild(row)
		box.appendChild(file)
		var status = document.createElement('p')
		status.className = 'ctheme-own__status'
		status.setAttribute('aria-live', 'polite')
		box.appendChild(status)
		if (state.custom && state.custom.bg) {
			var rm = document.createElement('button')
			rm.type = 'button'
			rm.className = 'ctheme-own__rm'
			rm.textContent = t('Прибрати фон')
			rm.addEventListener('click', function () {
				(window.NTU_AUTH && window.NTU_AUTH.confirm ? window.NTU_AUTH.confirm(t('Прибрати свій фон чату?'), t('Прибрати')) : Promise.resolve(window.confirm(t('Прибрати свій фон чату?')))).then(function (ok) {
					if (!ok) return
					setCustom({ c: (state.custom && state.custom.c) || '' }, true)
					if (rm.parentNode) rm.remove()
					up.textContent = t('Завантажити фон')
				})
			})
			box.appendChild(rm)
		}
		function useCustom() { if (theme(key) !== 'custom') setTheme(key, 'custom') }
		up.addEventListener('click', function () { file.click() })
		file.addEventListener('change', function () {
			var f = file.files && file.files[0]
			if (!f) return
			up.disabled = true
			uploadBg(f, function (msg) { status.textContent = msg }).then(function () {
				status.textContent = t('Фон збережено.')
				up.textContent = t('Змінити фон')
				useCustom()
			}, function (e) { status.textContent = e.message }).then(function () { up.disabled = false; file.value = '' })
		})
		// під час вибору кольору - лише перегляд, зберігаємо, коли вибір завершено
		function pickColor(persist) {
			var c = state.custom || {}
			setCustom({ bg: c.bg || '', c: col.value.toLowerCase() }, persist)
			useCustom()
		}
		col.addEventListener('input', function () { pickColor(false) })
		col.addEventListener('change', function () { pickColor(true) })
		return box
	}
	/* позначка вибраної теми і кружечок «Своя» оновлюються одразу, без перебудови панелі */
	function markActive() {
		if (!pop) return
		var cur = theme(popKey), cc = state.custom || {}
		Array.prototype.forEach.call(pop.querySelectorAll('.ctheme-sw'), function (b) {
			var on = b.getAttribute('data-id') === cur
			b.classList.toggle('is-active', on)
			b.setAttribute('aria-pressed', on ? 'true' : 'false')
			if (b.getAttribute('data-id') !== 'custom') return
			b.style.setProperty('--sw-b', cc.c || DEFAULT_COLOR)
			b.querySelector('.ctheme-sw__dot').style.backgroundImage = cc.bg ? 'url("' + cc.bg + '")' : ''
		})
	}
	listeners.push(markActive)
	// перемкнули світлу/темну тему сайту - перераховуємо кольори своєї теми
	document.addEventListener('ntu:theme', emit)
	function place() {
		if (!pop || !popAnchor) return
		var r = popAnchor.getBoundingClientRect(), w = pop.offsetWidth, hgt = pop.offsetHeight
		var left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8)
		var top = r.bottom + 8
		if (top + hgt > window.innerHeight - 8) top = Math.max(8, r.top - hgt - 8)
		pop.style.left = left + 'px'
		pop.style.top = top + 'px'
	}
	document.addEventListener('click', function (e) {
		if (pop && !pop.contains(e.target) && popAnchor && !popAnchor.contains(e.target)) closePicker()
	})
	document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop) { e.stopPropagation(); closePicker(true) } }, true)
	document.addEventListener('ntu:panel', function () { closePicker() })
	window.addEventListener('resize', place)

	window.addEventListener('storage', function (e) { if (e.key === LS_KEY) { state = readLocal(); emit() } })

	window.NTU_CHATPREFS = {
		THEMES: THEMES,
		isPinned: isPinned,
		togglePin: togglePin,
		pins: function () { return Object.keys(state.pins) },
		theme: theme,
		setTheme: setTheme,
		apply: apply,
		picker: picker,
		closePicker: closePicker,
		MAX_PINS: MAX_PINS,
		onChange: function (f) { listeners.push(f) }
	}

	if (A()) A().onChange(function (u) { if (u) pull(); else signedOut() })
})()
