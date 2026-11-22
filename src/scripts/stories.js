/*
 * Сторіз (як в Instagram) та розділ «Історії студентів».
 *  - [data-stories]  стрічка кружечків: фото або відео, підпис, музика, лайки; живуть 24 години.
 *                    RTDB stories/{id} = {u, n, img | v, c, mu + mt (свій трек), ts}, storyLikes/{id}/{uid} = true
 *  - [data-tales]    стрічка історій студентів: заголовок, текст, фото.   RTDB tales/{id}   = {u, n, ti, b, img, cat, ts}
 * Файли вантажаться через NTU_AUTH.upload (api/upload.php, kind story), фото перед цим стискаються до 1440 px JPEG.
 */
(function () {
	'use strict'
	var A = window.NTU_AUTH
	if (!A) return
	// суперадмін може видаляти чужі сторіз та історії (правила бази теж це дозволяють лише йому)
	var isAdmin = false
	if (A.isAdmin) A.onChange(function () {
		A.isAdmin().then(function (v) { if (v !== isAdmin) { isAdmin = v; document.dispatchEvent(new Event('ntu:admin')) } })
	})
	var DAY = 24 * 60 * 60 * 1000
	var STORY_MS = 6000
	var MAX_CAPTION = 200
	var MAX_TITLE = 120
	var MAX_BODY = 4000
	var MAX_PHOTO = 1440
	var LS_SEEN = 'ntu-stories-seen'
	var CATS = ['Навчання', 'Кар’єра', 'Наука', 'Закордон', 'Студентське життя', 'Інше']

	function t(s) { return typeof T === 'function' ? T(s) : s }
	function el(tag, cls, text) {
		var e = document.createElement(tag)
		if (cls) e.className = cls
		if (text != null) e.textContent = text
		return e
	}
	function newId() {
		var r = Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(6)), function (x) { return ('0' + x.toString(16)).slice(-2) }).join('')
		return Date.now().toString(36) + r
	}
	function ago(ts) {
		var m = Math.floor((Date.now() - ts) / 60000)
		if (m < 1) return t('щойно')
		if (m < 60) return m + ' ' + t('хв тому')
		var h = Math.floor(m / 60)
		if (h < 24) return h + ' ' + t('год тому')
		return new Date(ts).toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'uk-UA')
	}
	function safeImg(u) { return typeof u === 'string' && /^https:\/\/ntu\.dp\.ua\/uploads\//.test(u) ? u : '' }
	function profane(s) { return typeof window.NTU_isProfane === 'function' && window.NTU_isProfane(s) }
	function seenSet() { try { return JSON.parse(localStorage.getItem(LS_SEEN) || '{}') } catch (e) { return {} } }
	function markSeen(id) {
		var s = seenSet()
		s[id] = Date.now()
		Object.keys(s).forEach(function (k) { if (Date.now() - s[k] > 2 * DAY) delete s[k] })
		try { localStorage.setItem(LS_SEEN, JSON.stringify(s)) } catch (e) {}
	}

	/* ---------- профілі авторів (аватарки) ---------- */
	var profCache = {}
	function profileOf(uid) {
		if (!profCache[uid]) profCache[uid] = A.db('GET', 'users/' + encodeURIComponent(uid), undefined, false).catch(function () { return null })
		return profCache[uid]
	}
	function avatar(uid, name, cls) {
		var ph = el('span', cls + ' ' + cls + '--ph', A.initials ? A.initials(name || '?') : (name || '?').charAt(0))
		profileOf(uid).then(function (p) {
			if (!p || !p.a) return
			var img = el('img', cls)
			img.src = p.a
			img.alt = ''
			if (ph.parentNode) ph.parentNode.replaceChild(img, ph)
		})
		return ph
	}

	/* ---------- стиснення фото ---------- */
	function compress(file) {
		return new Promise(function (res, rej) {
			if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return rej(new Error(t('Оберіть фото у форматі JPG, PNG або WebP.')))
			if (file.size > 15 * 1024 * 1024) return rej(new Error(t('Фото завелике (максимум 15 МБ).')))
			var url = URL.createObjectURL(file)
			var img = new Image()
			img.onload = function () {
				var k = Math.min(1, MAX_PHOTO / Math.max(img.width, img.height))
				var c = document.createElement('canvas')
				c.width = Math.round(img.width * k)
				c.height = Math.round(img.height * k)
				var g = c.getContext('2d')
				g.fillStyle = '#fff' // прозорий PNG у JPEG інакше стає чорним
				g.fillRect(0, 0, c.width, c.height)
				g.drawImage(img, 0, 0, c.width, c.height)
				URL.revokeObjectURL(url)
				c.toBlob(function (b) {
					if (!b) return rej(new Error(t('Не вдалося прочитати зображення.')))
					res(new File([b], 'photo.jpg', { type: 'image/jpeg' }))
				}, 'image/jpeg', 0.85)
			}
			img.onerror = function () { URL.revokeObjectURL(url); rej(new Error(t('Не вдалося прочитати зображення.'))) }
			img.src = url
		})
	}
	function uploadPhoto(file) {
		return compress(file).then(function (f) { return A.upload(f, 'chat') }).then(function (r) {
			if (!safeImg(r && r.url)) throw new Error(t('Не вдалося завантажити файл.'))
			return r.url
		})
	}
	function canPost() {
		var u = A.user
		if (!u) return t('Увійдіть, щоб публікувати.')
		if (!A.remote) return t('Публікувати можна лише після підключення сервера.')
		if (!u.verified) return t('Підтвердьте пошту, щоб публікувати.')
		return ''
	}
	function toList(obj) {
		// не-об'єкти пропускаємо до присвоєння id: у strict mode true.id = k кидає TypeError і ламає всю стрічку
		return Object.keys(obj || {}).filter(function (k) { var x = obj[k]; return x && typeof x === 'object' && typeof x.u === 'string' && typeof x.ts === 'number' })
			.map(function (k) { var x = obj[k]; x.id = k; return x })
	}

	/* =================== СТОРІЗ =================== */
	var MAX_VIDEO_MB = 25
	var MAX_VIDEO_SEC = 60
	var MAX_AUDIO_MB = 10

	function videoMeta(file) {
		return new Promise(function (res, rej) {
			if (!/^video\/(mp4|webm|quicktime)$/.test(file.type)) return rej(new Error(t('Відео має бути у форматі MP4, MOV або WebM.')))
			if (file.size > MAX_VIDEO_MB * 1024 * 1024) return rej(new Error(t('Відео завелике (максимум 25 МБ).')))
			var v = document.createElement('video')
			v.preload = 'metadata'
			v.onloadedmetadata = function () {
				URL.revokeObjectURL(v.src)
				if (v.duration > MAX_VIDEO_SEC + 0.5) return rej(new Error(t('Відео задовге (максимум 60 секунд).')))
				res(file)
			}
			v.onerror = function () { URL.revokeObjectURL(v.src); rej(new Error(t('Не вдалося прочитати відео.'))) }
			v.src = URL.createObjectURL(file)
		})
	}
	function uploadStoryFile(file) {
		return A.upload(file, 'story').then(function (r) {
			if (!safeImg(r && r.url)) throw new Error(t('Не вдалося завантажити файл.'))
			return r.url
		})
	}
	function uploadAudio(file) {
		if (!/^audio\/(mpeg|mp3|mp4|x-m4a|ogg)$/.test(file.type) && !/\.(mp3|m4a|ogg)$/i.test(file.name)) return Promise.reject(new Error(t('Музика має бути у форматі MP3, M4A або OGG.')))
		if (file.size > MAX_AUDIO_MB * 1024 * 1024) return Promise.reject(new Error(t('Трек завеликий (максимум 10 МБ).')))
		return uploadStoryFile(file)
	}
	function musicTitle(s) {
		if (safeImg(s.mu)) return s.mt || t('Свій трек')
		return ''
	}
	/* програє музику сторіз; повертає stop() */
	function playMusic(s) {
		if (safeImg(s.mu)) {
			var a = new Audio(s.mu)
			a.loop = true
			a.volume = 0.7
			a.play().catch(function () {})
			return function () { a.pause(); a.src = '' }
		}
		return function () {}
	}

	function initStories(bar) {
		var groups = [] // [{u, n, items:[...]}]
		var viewer = null

		function load() {
			var since = Date.now() - DAY
			return A.db('GET', 'stories?orderBy=%22ts%22&startAt=' + since, undefined, false).then(function (d) {
				var by = {}
				toList(d).filter(function (s) { return s.ts > since && (safeImg(s.img) || safeImg(s.v)) }).sort(function (a, b) { return a.ts - b.ts }).forEach(function (s) {
					if (!by[s.u]) by[s.u] = { u: s.u, n: s.n, items: [] }
					by[s.u].items.push(s)
				})
				var me = A.user && A.user.uid
				groups = Object.keys(by).map(function (k) { return by[k] }).sort(function (a, b) {
					if (a.u === me) return -1
					if (b.u === me) return 1
					return b.items[b.items.length - 1].ts - a.items[a.items.length - 1].ts
				})
				render()
			}).catch(function () { render() })
		}

		function render() {
			bar.textContent = ''
			var add = el('button', 'stories__item stories__item--add')
			add.type = 'button'
			var plus = el('span', 'stories__ring stories__ring--add')
			plus.appendChild(el('span', 'stories__plus', '+'))
			add.appendChild(plus)
			add.appendChild(el('span', 'stories__name', t('Твоя сторіз')))
			add.addEventListener('click', openComposer)
			bar.appendChild(add)
			var seen = seenSet()
			groups.forEach(function (g, gi) {
				var b = el('button', 'stories__item')
				b.type = 'button'
				var unseen = g.items.some(function (s) { return !seen[s.id] })
				var ring = el('span', 'stories__ring' + (unseen ? '' : ' is-seen'))
				ring.appendChild(avatar(g.u, g.n, 'stories__ava'))
				b.appendChild(ring)
				b.appendChild(el('span', 'stories__name', g.n || '?'))
				b.setAttribute('aria-label', t('Сторіз') + ': ' + (g.n || ''))
				b.addEventListener('click', function () { openViewer(gi) })
				bar.appendChild(b)
			})
			if (!groups.length) bar.appendChild(el('p', 'stories__empty', t('Сторіз ще немає - будь першим!')))
		}

		/* ---------- перегляд ---------- */
		var VIEW_HTML = '<div class="story-view__box"><div class="story-view__bars"></div>' +
			'<div class="story-view__head"><span class="story-view__who"></span><span class="story-view__time"></span>' +
			'<button type="button" class="story-view__mute" hidden></button>' +
			'<button type="button" class="story-view__rep" hidden>⚑</button>' +
			'<button type="button" class="story-view__del" hidden></button><button type="button" class="story-view__close">✕</button></div>' +
			'<div class="story-view__media"></div><p class="story-view__music" hidden></p><p class="story-view__cap"></p>' +
			'<button type="button" class="story-view__like"><span class="story-view__heart" aria-hidden="true">♡</span><span class="story-view__likes"></span></button>' +
			'<span class="story-view__burst" aria-hidden="true">❤</span>' +
			'<button type="button" class="story-view__nav story-view__nav--prev"></button>' +
			'<button type="button" class="story-view__nav story-view__nav--next"></button></div>'

		function openViewer(gi) {
			var g = groups[gi]
			if (!g) return
			var seen = seenSet()
			var si = g.items.findIndex(function (s) { return !seen[s.id] })
			viewer = { gi: gi, si: si < 0 ? 0 : si, timer: null, start: 0, left: STORY_MS, total: STORY_MS, paused: false, stopMusic: null, video: null, muted: false, lastTap: 0 }
			var ov = el('div', 'story-view')
			ov.setAttribute('role', 'dialog')
			ov.setAttribute('aria-modal', 'true')
			ov.innerHTML = VIEW_HTML
			ov.querySelector('.story-view__close').setAttribute('aria-label', t('Закрити'))
			ov.querySelector('.story-view__del').textContent = t('Видалити')
			ov.querySelector('.story-view__rep').setAttribute('aria-label', t('Поскаржитись на сторіз'))
			ov.querySelector('.story-view__rep').title = t('Поскаржитись')
			ov.querySelector('.story-view__like').setAttribute('aria-label', t('Подобається'))
			ov.querySelector('.story-view__nav--prev').setAttribute('aria-label', t('Попередня'))
			ov.querySelector('.story-view__nav--next').setAttribute('aria-label', t('Наступна'))
			ov.addEventListener('click', function (e) {
				if (e.target === ov || e.target.closest('.story-view__close')) return closeViewer()
				if (e.target.closest('.story-view__like')) return toggleLike()
				if (e.target.closest('.story-view__mute')) return toggleMute()
				if (e.target.closest('.story-view__del')) return removeCurrent()
				if (e.target.closest('.story-view__rep')) return reportCurrent()
				var nav = e.target.closest('.story-view__nav')
				if (!nav) return
				var now = Date.now()
				if (now - viewer.lastTap < 300) { clearTimeout(viewer.tapTimer); return likeBurst() } // подвійний тап = ❤
				viewer.lastTap = now
				var d = nav.classList.contains('story-view__nav--prev') ? -1 : 1
				viewer.tapTimer = setTimeout(function () { step(d) }, 250)
			})
			var box = ov.querySelector('.story-view__box')
			box.addEventListener('pointerdown', function (e) { if (!e.target.closest('button:not(.story-view__nav)')) pause() })
			box.addEventListener('pointerup', resume)
			box.addEventListener('pointerleave', resume)
			document.addEventListener('keydown', onKey)
			document.body.appendChild(ov)
			document.body.style.overflow = 'hidden'
			viewer.ov = ov
			show()
			ov.querySelector('.story-view__close').focus()
		}
		function onKey(e) {
			if (!viewer || document.querySelector('.modal--confirm')) return // відкрите вікно скарги/підтвердження
			if (e.key === 'Escape') closeViewer()
			else if (e.key === 'ArrowRight') step(1)
			else if (e.key === 'ArrowLeft') step(-1)
		}
		function stopMedia() {
			clearTimeout(viewer.timer)
			if (viewer.stopMusic) { viewer.stopMusic(); viewer.stopMusic = null }
			if (viewer.video) { viewer.video.pause(); viewer.video.removeAttribute('src'); viewer.video.load(); viewer.video = null }
		}
		function show() {
			stopMedia()
			var g = groups[viewer.gi], s = g.items[viewer.si], ov = viewer.ov
			var bars = ov.querySelector('.story-view__bars')
			bars.textContent = ''
			g.items.forEach(function (x, i) {
				var b = el('span', 'story-view__bar' + (i < viewer.si ? ' is-done' : ''))
				b.appendChild(el('i'))
				bars.appendChild(b)
			})
			var who = ov.querySelector('.story-view__who')
			who.textContent = ''
			who.appendChild(avatar(g.u, g.n, 'story-view__ava'))
			who.appendChild(el('b', null, g.n || '?'))
			ov.querySelector('.story-view__time').textContent = ago(s.ts)
			var cap = ov.querySelector('.story-view__cap')
			cap.textContent = s.c || ''
			cap.hidden = !s.c
			var mt = musicTitle(s), mus = ov.querySelector('.story-view__music')
			mus.textContent = mt ? '♪ ' + mt : ''
			mus.hidden = !mt
			ov.querySelector('.story-view__del').hidden = !(A.user && (A.user.uid === s.u || isAdmin))
			ov.querySelector('.story-view__rep').hidden = !(A.user && A.user.uid !== s.u && !isAdmin)
			var hasSound = !!mt || !!safeImg(s.v)
			var muteBtn = ov.querySelector('.story-view__mute')
			muteBtn.hidden = !hasSound
			syncMuteBtn()
			markSeen(s.id)
			loadLikes(s)
			// таймер цієї сторіз ще не запущено (відео чекає метаданих): пауза до старту не повинна «з'їсти» час
			viewer.start = 0
			viewer.ready = false
			viewer.paused = false

			var media = ov.querySelector('.story-view__media')
			media.textContent = ''
			if (safeImg(s.v)) {
				var v = el('video', 'story-view__img')
				v.playsInline = true
				v.setAttribute('playsinline', '')
				v.muted = viewer.muted || !!mt // музика замість звуку відео
				v.src = s.v
				media.appendChild(v)
				viewer.video = v
				v.addEventListener('loadedmetadata', function () {
					if (viewer && viewer.video === v) {
						var dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 6
						viewer.total = viewer.left = Math.min(MAX_VIDEO_SEC, dur) * 1000
						if (viewer.paused) return // натиснули й тримають - стартуємо після відпускання (resume)
						v.play().catch(function () { v.muted = true; v.play().catch(function () {}) })
						run()
					}
				})
				v.addEventListener('error', function () { if (viewer && viewer.video === v) { viewer.total = viewer.left = STORY_MS; if (!viewer.paused) run() } })
			} else {
				var im = el('img', 'story-view__img')
				im.alt = ''
				im.src = s.img
				media.appendChild(im)
				viewer.total = viewer.left = STORY_MS
				run()
			}
			if (mt && !viewer.muted) viewer.stopMusic = playMusic(s)
		}
		function run() {
			clearTimeout(viewer.timer)
			var bar = viewer.ov.querySelectorAll('.story-view__bar i')[viewer.si]
			if (bar) {
				bar.style.transition = 'none'
				bar.style.width = ((1 - viewer.left / viewer.total) * 100) + '%'
				void bar.offsetWidth
				bar.style.transition = 'width ' + viewer.left + 'ms linear'
				bar.style.width = '100%'
			}
			viewer.start = Date.now()
			viewer.ready = true
			viewer.timer = setTimeout(function () { step(1) }, viewer.left)
		}
		function pause() {
			if (!viewer || viewer.paused) return
			viewer.paused = true
			clearTimeout(viewer.timer)
			if (viewer.ready && viewer.start) viewer.left = Math.max(0, viewer.left - (Date.now() - viewer.start))
			if (viewer.video) viewer.video.pause()
			var bar = viewer.ov.querySelectorAll('.story-view__bar i')[viewer.si]
			if (bar) { bar.style.width = getComputedStyle(bar).width; bar.style.transition = 'none' }
		}
		function resume() {
			if (!viewer || !viewer.paused) return
			viewer.paused = false
			if (viewer.video) {
				if (!(viewer.video.readyState >= 1)) return // метадані ще не прийшли - run() запустить loadedmetadata
				viewer.video.play().catch(function () {})
			}
			run()
		}
		function step(d) {
			if (!viewer) return
			var g = groups[viewer.gi]
			viewer.si += d
			if (viewer.si >= g.items.length) { viewer.gi++; viewer.si = 0 }
			else if (viewer.si < 0) { viewer.gi--; viewer.si = viewer.gi >= 0 ? groups[viewer.gi].items.length - 1 : 0 }
			if (viewer.gi < 0 || viewer.gi >= groups.length) return closeViewer()
			show()
		}
		function closeViewer() {
			if (!viewer) return
			stopMedia()
			viewer.ov.remove()
			viewer = null
			document.body.style.overflow = ''
			document.removeEventListener('keydown', onKey)
			render()
		}
		function current() { return groups[viewer.gi].items[viewer.si] }

		/* ---------- звук ---------- */
		function syncMuteBtn() {
			var b = viewer.ov.querySelector('.story-view__mute')
			b.textContent = viewer.muted ? '🔇' : '🔊'
			b.setAttribute('aria-label', viewer.muted ? t('Увімкнути звук') : t('Вимкнути звук'))
		}
		function toggleMute() {
			viewer.muted = !viewer.muted
			var s = current()
			if (viewer.stopMusic) { viewer.stopMusic(); viewer.stopMusic = null }
			if (!viewer.muted && musicTitle(s)) viewer.stopMusic = playMusic(s)
			if (viewer.video) viewer.video.muted = viewer.muted || !!musicTitle(s)
			syncMuteBtn()
		}

		/* ---------- лайки: storyLikes/{id}/{uid} = true ---------- */
		function paintLikes(n, mine) {
			var b = viewer.ov.querySelector('.story-view__like')
			b.classList.toggle('is-liked', !!mine)
			b.setAttribute('aria-pressed', mine ? 'true' : 'false')
			viewer.ov.querySelector('.story-view__heart').textContent = mine ? '❤' : '♡'
			viewer.ov.querySelector('.story-view__likes').textContent = n ? String(n) : ''
		}
		function loadLikes(s) {
			var id = s.id
			viewer.likes = { id: id, n: 0, mine: false }
			paintLikes(0, false)
			A.db('GET', 'storyLikes/' + encodeURIComponent(id), undefined, false).then(function (d) {
				if (!viewer || current().id !== id) return
				var uids = Object.keys(d || {})
				viewer.likes = { id: id, n: uids.length, mine: !!(A.user && d && d[A.user.uid]) }
				paintLikes(viewer.likes.n, viewer.likes.mine)
			}).catch(function () {})
		}
		function setLike(on) {
			var why = canPost()
			if (why) { if (!A.user) location.href = 'login.html'; return }
			var L = viewer.likes, id = L.id
			if (L.mine === on) return
			L.mine = on
			L.n += on ? 1 : -1
			paintLikes(L.n, L.mine)
			A.db(on ? 'PUT' : 'DELETE', 'storyLikes/' + encodeURIComponent(id) + '/' + encodeURIComponent(A.user.uid), on ? true : undefined).catch(function () {
				if (!viewer || viewer.likes.id !== id) return
				L.mine = !on
				L.n += on ? -1 : 1
				paintLikes(L.n, L.mine)
			})
		}
		function toggleLike() { setLike(!viewer.likes.mine) }
		function likeBurst() {
			var b = viewer.ov.querySelector('.story-view__burst')
			b.classList.remove('is-on')
			void b.offsetWidth
			b.classList.add('is-on')
			setLike(true)
		}

		function reportCurrent() {
			var s = current(), g = groups[viewer.gi]
			pause()
			A.report('story', s.id, s.u, (g.n || '') + (s.c ? ': ' + s.c : '')).then(function () { resume() }, function (e) { window.alert(e.message); resume() })
		}
		function removeCurrent() {
			var s = current()
			var owner = groups[viewer.gi] ? groups[viewer.gi].n : ''
			pause()
			if (!window.confirm(t('Видалити цю сторіз?'))) return resume()
			// спершу лайки (правила дозволяють це автору, поки сторіз існує), потім саму сторіз
			A.db('DELETE', 'storyLikes/' + encodeURIComponent(s.id)).catch(function () {}).then(function () {
				return A.db('DELETE', 'stories/' + encodeURIComponent(s.id))
			}).then(function () {
				if (A.user && s.u !== A.user.uid && A.adminLog) A.adminLog('story.delete', s.u, (owner || '') + (s.c ? ': ' + s.c : ''))
				closeViewer()
				load()
			}).catch(function (e) { window.alert(e.message); resume() })
		}

		/* ---------- публікація ---------- */
		function openComposer() {
			var why = canPost()
			if (why && !A.user) { location.href = 'login.html'; return }
			var m = el('div', 'modal')
			m.setAttribute('role', 'dialog')
			m.setAttribute('aria-modal', 'true')
			var box = el('div', 'modal__box modal__box--sm story-compose')
			var close = el('button', 'modal__close', '✕')
			close.type = 'button'
			close.setAttribute('aria-label', t('Закрити'))
			box.appendChild(close)
			box.appendChild(el('h2', 'story-compose__title', t('Нова сторіз')))
			var pick = el('label', 'story-compose__pick')
			var input = el('input')
			input.type = 'file'
			input.accept = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime'
			var prev = el('div', 'story-compose__preview')
			prev.hidden = true
			var pickText = el('span', null, t('Обрати фото або відео'))
			pick.appendChild(input)
			pick.appendChild(pickText)
			pick.appendChild(prev)
			box.appendChild(pick)

			var cap = el('textarea', 'story-compose__cap')
			cap.maxLength = MAX_CAPTION
			cap.rows = 2
			cap.placeholder = t('Підпис (необов’язково)')
			box.appendChild(cap)

			// музика
			var mrow = el('div', 'story-compose__music')
			var mlab = el('label', null, t('Музика'))
			var sel = el('select')
			sel.id = 'storyMusic'
			mlab.htmlFor = 'storyMusic'
			var opts = [['', t('Без музики')], ['own', t('Свій трек (MP3)…')]]
			opts.forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; sel.appendChild(op) })
			var play = el('button', 'story-compose__play')
			play.type = 'button'
			play.setAttribute('aria-label', t('Прослухати'))
			play.disabled = true
			var audioIn = el('input')
			audioIn.type = 'file'
			audioIn.accept = 'audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,.mp3,.m4a,.ogg'
			audioIn.hidden = true
			mrow.appendChild(mlab)
			mrow.appendChild(sel)
			mrow.appendChild(play)
			box.appendChild(mrow)
			box.appendChild(audioIn)
			var ownName = el('button', 'story-compose__own')
			ownName.type = 'button'
			ownName.hidden = true
			ownName.title = t('Змінити трек')
			ownName.addEventListener('click', function () { audioIn.click() }) // інакше вибрати інший трек не можна: select уже «Свій трек»
			box.appendChild(ownName)

			var msg = el('p', 'form-note-status', why)
			box.appendChild(msg)
			var send = el('button', 'btn btn-primary', t('Опублікувати'))
			send.type = 'button'
			send.disabled = !!why
			box.appendChild(send)
			m.appendChild(box)
			document.body.appendChild(m)
			document.body.style.overflow = 'hidden'

			var file = null, isVideo = false, ownTrack = null, stopPreview = null, previewUrl = '', closed = false
			function stopPrev() {
				if (stopPreview) { stopPreview(); stopPreview = null }
				play.classList.remove('is-playing')
				play.setAttribute('aria-label', t('Прослухати'))
			}
			function done() {
				closed = true
				stopPrev()
				if (previewUrl) URL.revokeObjectURL(previewUrl)
				m.remove()
				document.body.style.overflow = ''
			}
			m.addEventListener('click', function (e) { if (e.target === m || e.target === close) done() })
			m.addEventListener('keydown', function (e) { if (e.key === 'Escape') done() })

			input.addEventListener('change', function () {
				var f = input.files && input.files[0]
				if (!f) return
				isVideo = /^video\//.test(f.type)
				var check = isVideo ? videoMeta(f) : Promise.resolve(f)
				check.then(function (ok) {
					file = ok
					msg.textContent = why
					if (previewUrl) URL.revokeObjectURL(previewUrl)
					previewUrl = URL.createObjectURL(ok)
					prev.textContent = ''
					var p = el(isVideo ? 'video' : 'img')
					p.src = previewUrl
					if (isVideo) { p.muted = true; p.loop = true; p.autoplay = true; p.setAttribute('playsinline', '') } else p.alt = ''
					prev.appendChild(p)
					prev.hidden = false
					pickText.textContent = t('Змінити')
				}).catch(function (e) {
					// нове фото/відео не підійшло - прибираємо і старий прев'ю, щоб не здавалося, що він ще обраний
					file = null
					prev.textContent = ''
					prev.hidden = true
					pickText.textContent = t('Обрати фото або відео')
					input.value = ''
					msg.textContent = e.message
				})
			})
			sel.addEventListener('change', function () {
				stopPrev()
				if (sel.value === 'own') { audioIn.click(); return }
				ownTrack = null
				ownName.hidden = true
				play.disabled = !sel.value
			})
			audioIn.addEventListener('change', function () {
				var f = audioIn.files && audioIn.files[0]
				if (!f) { if (!ownTrack) sel.value = ''; return }
				if ((!/^audio\/(mpeg|mp3|mp4|x-m4a|ogg)$/.test(f.type) && !/\.(mp3|m4a|ogg)$/i.test(f.name)) || f.size > MAX_AUDIO_MB * 1024 * 1024) {
					msg.textContent = t('Музика: MP3, M4A або OGG до 10 МБ.')
					audioIn.value = ''
					if (!ownTrack) { sel.value = ''; play.disabled = true }
					return
				}
				msg.textContent = why
				ownTrack = f
				ownName.textContent = '♪ ' + f.name
				ownName.hidden = false
				play.disabled = false
			})
			play.addEventListener('click', function () {
				if (stopPreview) return stopPrev()
				if (sel.value === 'own' && ownTrack) {
					var a = new Audio(URL.createObjectURL(ownTrack))
					a.play().catch(function () {})
					stopPreview = function () { a.pause(); URL.revokeObjectURL(a.src) }
				} else return
				play.classList.add('is-playing')
				play.setAttribute('aria-label', t('Зупинити'))
			})

			send.addEventListener('click', function () {
				var c = cap.value.trim().slice(0, MAX_CAPTION)
				if (!file) { msg.textContent = t('Оберіть фото або відео.'); return }
				if (profane(c)) { msg.textContent = t('Підпис містить недопустимі слова.'); return }
				if (sel.value === 'own' && !ownTrack) { msg.textContent = t('Оберіть файл з музикою.'); return }
				stopPrev()
				send.disabled = true
				msg.textContent = t('Завантажуємо…')
				var u = A.user
				var data = { u: u.uid, n: String(u.name || '').slice(0, 40), c: c, ts: { '.sv': 'timestamp' } }
				var media = isVideo
					? uploadStoryFile(file).then(function (url) { data.v = url })
					: compress(file).then(uploadStoryFile).then(function (url) { data.img = url })
				media.then(function () {
					if (sel.value === 'own') return uploadAudio(ownTrack).then(function (url) { data.mu = url; data.mt = ownTrack.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 80) })
				}).then(function () {
					// вікно закрили під час завантаження - вважаємо це скасуванням і не публікуємо
					if (closed) return
					return A.db('PUT', 'stories/' + newId(), data).then(function () { done(); load() })
				}).catch(function (e) {
					msg.textContent = e.message
					send.disabled = false
				})
			})
			setTimeout(function () { close.focus() }, 30)
		}

		A.onChange(function () { render() })
		load()
		setInterval(function () { if (!viewer && !document.hidden) load() }, 60000)
	}

	/* =================== ІСТОРІЇ СТУДЕНТІВ =================== */
	function initTales(root) {
		var list = root.querySelector('[data-tales-list]')
		var form = root.querySelector('[data-tales-form]')
		var gate = root.querySelector('[data-tales-gate]')
		var filter = root.querySelector('[data-tales-filter]')
		var all = []
		var cat = ''

		if (filter) {
			var chips = [''].concat(CATS)
			chips.forEach(function (c) {
				var b = el('button', 'tales__chip' + (c === '' ? ' is-active' : ''), c ? t(c) : t('Усі'))
				b.type = 'button'
				b.addEventListener('click', function () {
					cat = c
					filter.querySelectorAll('.tales__chip').forEach(function (x) { x.classList.toggle('is-active', x === b) })
					render()
				})
				filter.appendChild(b)
			})
		}
		if (form) {
			var sel = form.querySelector('[name=cat]')
			CATS.forEach(function (c) { var o = el('option', null, t(c)); o.value = c; sel.appendChild(o) })
		}

		function load() {
			return A.db('GET', 'tales?orderBy=%22ts%22&limitToLast=60', undefined, false).then(function (d) {
				all = toList(d).filter(function (x) { return typeof x.ti === 'string' && typeof x.b === 'string' }).sort(function (a, b) { return b.ts - a.ts })
				render()
			}).catch(function () { all = []; render() })
		}

		function card(x) {
			var a = el('article', 'tale card')
			var img = safeImg(x.img)
			if (img) {
				var im = el('img', 'tale__img')
				im.src = img
				im.alt = ''
				im.loading = 'lazy'
				a.appendChild(im)
			}
			var head = el('div', 'tale__head')
			head.appendChild(avatar(x.u, x.n, 'tale__ava'))
			var meta = el('div', 'tale__meta')
			meta.appendChild(el('b', null, x.n || '?'))
			meta.appendChild(el('span', null, ago(x.ts) + (x.cat ? ' · ' + t(x.cat) : '')))
			head.appendChild(meta)
			a.appendChild(head)
			a.appendChild(el('h3', 'tale__title', x.ti))
			var body = el('p', 'tale__body', x.b)
			a.appendChild(body)
			if (x.b.length > 320) {
				body.classList.add('is-clamped')
				var more = el('button', 'tale__more', t('Читати далі'))
				more.type = 'button'
				more.addEventListener('click', function () {
					var open = body.classList.toggle('is-clamped')
					more.textContent = open ? t('Читати далі') : t('Згорнути')
				})
				a.appendChild(more)
			}
			if (A.user && (A.user.uid === x.u || isAdmin)) {
				var del = el('button', 'tale__del', t('Видалити'))
				del.type = 'button'
				del.addEventListener('click', function () {
					A.confirm(t('Видалити цю історію?'), t('Видалити')).then(function (ok) {
						if (!ok) return
						del.disabled = true
						A.db('DELETE', 'tales/' + encodeURIComponent(x.id)).then(function () {
							if (A.user && x.u !== A.user.uid && A.adminLog) A.adminLog('tale.delete', x.u, (x.n || '') + ': ' + x.ti)
							return load()
						}).catch(function (e) { del.disabled = false; window.alert(e.message) })
					})
				})
				a.appendChild(del)
			}
			if (A.user && A.user.uid !== x.u && !isAdmin) {
				var rep = el('button', 'tale__rep', '⚑ ' + t('Поскаржитись'))
				rep.type = 'button'
				rep.addEventListener('click', function () {
					A.report('tale', x.id, x.u, (x.n || '') + ': ' + x.ti).then(function (sent) {
						if (sent) { rep.textContent = '✓ ' + t('Скаргу надіслано'); rep.disabled = true }
					}, function (e) { window.alert(e.message) })
				})
				a.appendChild(rep)
			}
			return a
		}

		function render() {
			list.textContent = ''
			var shown = all.filter(function (x) { return !cat || x.cat === cat })
			if (!shown.length) list.appendChild(el('p', 'tales__empty', t('Тут ще немає історій. Розкажи свою першим!')))
			shown.forEach(function (x) { list.appendChild(card(x)) })
		}

		function syncGate() {
			if (!form || !gate) return
			var why = canPost()
			form.hidden = !!why
			gate.hidden = !why
			var p = gate.querySelector('[data-tales-why]')
			if (p) p.textContent = why
			var login = gate.querySelector('a')
			if (login) login.hidden = !!A.user
		}

		if (form) {
			var msg = form.querySelector('.form-note-status')
			form.addEventListener('submit', function (e) {
				e.preventDefault()
				var ti = form.ti.value.trim().slice(0, MAX_TITLE)
				var b = form.b.value.trim().slice(0, MAX_BODY)
				var c = form.cat.value
				var file = form.photo.files && form.photo.files[0]
				if (ti.length < 3 || b.length < 30) { msg.textContent = t('Додай заголовок і хоча б кілька речень.'); return }
				if (profane(ti) || profane(b)) { msg.textContent = t('Текст містить недопустимі слова.'); return }
				var btn = form.querySelector('[type=submit]')
				btn.disabled = true
				msg.textContent = t('Публікуємо…')
				var up = file ? uploadPhoto(file) : Promise.resolve('')
				up.then(function (url) {
					var u = A.user
					if (!u) throw new Error(t('Увійдіть, щоб публікувати.'))
					var data = { u: u.uid, n: String(u.name || '').slice(0, 40), ti: ti, b: b, cat: c, ts: { '.sv': 'timestamp' } }
					if (url) data.img = url
					return A.db('PUT', 'tales/' + newId(), data)
				}).then(function () {
					form.reset()
					msg.textContent = t('Історію опубліковано!')
					btn.disabled = false
					load()
				}).catch(function (er) {
					msg.textContent = er.message
					btn.disabled = false
				})
			})
		}

		A.onChange(function () { syncGate(); render() })
		document.addEventListener('ntu:admin', render)
		window.addEventListener('ntu:lang', render)
		load()
	}

	function boot() {
		document.querySelectorAll('[data-stories]').forEach(initStories)
		document.querySelectorAll('[data-tales]').forEach(initTales)
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
	else boot()
})()
