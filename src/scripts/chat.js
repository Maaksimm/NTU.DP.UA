/* Плаваючий чат студентської платформи. Усі повідомлення зберігаються (Firebase RTDB або localStorage). */
(function () {
	'use strict'
	var cfg = window.NTU_CHAT || {}
	var DB = (cfg.databaseURL || '').replace(/\/+$/, '')
	var KEY_MSGS = 'ntu-chat-messages'
	var KEY_NAME = 'ntu-chat-name'
	var KEY_UID = 'ntu-chat-uid'
	var MAX_LEN = 500
	var POLL_MS = 4000
	var GIPHY_KEY = cfg.giphyKey || ''
	// GIF зберігається в тексті повідомлення як «[gif:ID]» (ID з GIPHY), тож правила бази змінювати не треба
	var GIF_RE = /^\[gif:([A-Za-z0-9]{6,40})\]$/
	// @нік у Telegram: 5-32 символи (латиниця, цифри, _), не частина email чи іншого слова
	var MENTION_RE = /(^|[^A-Za-z0-9_@.])@([A-Za-z0-9_]{5,32})(?![A-Za-z0-9_])/g
	function gifUrl(id) { return 'https://media.giphy.com/media/' + id + '/200w.gif' }

	var EMOJI = [
		['Смайли', '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 😎 🤓 🧐 🤔 🤨 😐 😑 🙄 😏 😴 🥱 😮 😲 😳 🥺 😢 😭 😤 😠 😡 🤯 😱 🤗 🤭 🤫 😬 🥳 🤐 🤒'],
		['Жести', '👍 👎 👌 ✌️ 🤞 🤟 🤘 👏 🙌 🤝 🙏 💪 👋 ✍️ 👀 🤙 👆 👉 🖐️'],
		['Серця', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ❣️ 💕 💖 💯'],
		['Навчання', '📚 📖 📝 ✏️ 📐 📏 🧮 💻 🖥️ ⌨️ 🎓 🏫 🔬 🧪 ⏰ 📅 ☕ 🍕 🧠 📎'],
		['Інше', '🔥 ✨ ⭐ 🌟 🎉 🎊 🎁 🏆 ⚽ 🎮 🎧 🎵 🚀 💡 ✅ ❌ ⚡ 🇺🇦 🌈 🍀']
	]
	var GIFS = [
		['Привіт', 'xT9IgG50Fb7Mi0prBC CK0Eg2ymtfzTO2yVJD WS3i2y88foYpE584rI LPFNd1AJBoYcVUExmE Zwkxqa2c6C4avWnrq3 dzaUX7CAG0Ihi qGvmdlfJ0FtBSwxqA3 2oyfwkRTgdfMW7FTHd z2UMlACEJBF8dx58Y4 CKxQOrGaDqC5FhYr9v Sg4DwEJrCpGIU Cmr1OMJ2FN0B2'],
		['Дякую', 'L9Q2rzzBHrfv4a1y4h QmETYSzVOztxgZg3sT MF9wHplBBbqwYiTTEk a3IWyhkEC0p32 3osxYdXvsGw6wT5lIY BYoRqTmcgzHcL9TCy1 uWlpPGquhGZNFzY90z IcGkqdUmYLFGE fWfowxJtHySJ0SGCgN igB2Th9e4nW6s x4dS8uOkeEFdxvV1nz R6gvnAxj2ISzJdbA63'],
		['Сміх', 'aqqUwXz7j0xMOKnJgb XHeLeuirRbwptHhSWd IhyGL914g9ShHdHVFy l0ExayQDzrI2xOb8A iYf6PmiDDGMaSjiZyl GCO5WNzFmlc0vjK8cA BFYLNwlsSNtcc ZqlvCTNHpqrio fUYhyT9IjftxrxJXcE 26n6Gx9moCgs1pUuk 12msOFU8oL1eww KiaU2EUyxjQB2'],
		['Так', 'm745dTCAxerHa 89x4osEodHEoo 10Jpr9KSaXLchW 3ohzdIuqJoo8QdKlnW NEvPzZ8bd1V4Y J336VCs1JC42zGRhjH WQr2txk5iEYUS6Kv3d MNmyTin5qt5LSXirxd KFu7eYekN7pE5ltUhj nFjDu1LjEADh6 RLDl4nXpaKNGtsMRH6 yFs12GkGa4Cpq'],
		['Ні', 'fXnRObM8Q0RkOmR5nf wYyTHMm50f4Dm d2Z4NRCUxsxZBvag L4fOLr8aB3d3BYQUfq JYZ397GsFrFtu NpL4D3Oc2bJUMAXF9P hQWHjq6C0Zb44 PAs2yGkqu2zSmCx0UL STfLOU6iRBRunMciZv 6Q2KA5ly49368 15aGGXfSlat2dP6ohs WTjnWYENpLxS8JQ5rz'],
		['Вау', 'l3q2K5jinAlChoCLS 5VKbvrjxpVJCM aWPGuTlDqq2yc PUBxelwT57jsQ oYtVHSxngR3lC QUENDfi6DEMLzQ0CKt dnMwfGJPdsqYEbmrD5 RLkcGcTtWc7QyQZqSM TIRlx3Fzi1A7L2d5z7 26ufdipQqU2lhNA4g Sqfu14lSonVN219Zb6 M33UV4NDvkTHa'],
		['Навчання', 'fhAwk4DnqNgw8 IPbS5R4fSUl5S vtFZ8O85q8g3MmXK51 xUXCTpkqwLeh2SrZ4T NFA61GS9qKZ68 8dYmJ6Buo3lYY l2YWpf1EMidre0PHa xf9RVHymCWoPm5SZeY 603cLZVdYomSgIBhB0 8t7lXR6Sep8zB6v7El ejKpjEfcPuYve dNgK7Ws7y176U'],
		['Вечірка', 'xT8qAY7e9If38xkrIY blSTtZehjAZ8I xUA7aT1vNqVWHPY1cA IwAZ6dvvvaTtdI8SD5 13Iu9mjLpXF0ek yoJC2GnSClbPOkV0eA LUhUvH4BsfE9USnlPd vyxos9QyesGZalcdX6 s2qXK8wAvkHTO KVT0i8ls6Scp5X2255 NCF5DMDvf9247pmp72 61374X6M1XFHJmWYJG'],
		['Сум', 'P53TSsopKicrm lGBecpB2dIMwt6ohfI Lz6971fkGSgCMOOncl 502lDJxzzfZnfWD5pV Ty9Sg8oHghPWg 3oEjI80DSa1grNPTDq cT2aqexUBF1aTNwVZM AzAa23iNkA5I6jQKmG dJYoOVAWf2QkU HYWRlXalYJzaxfCPFa fhLgA6nJec3Cw TU76e2JHkPchG'],
		['Клас', 'JwjBy94VzDd6 CvZuv5m5cKl8c 111ebonMs90YLu tIeCLkB8geYtW F56tNEGsltde mgqefqwSbToPe XusSPHhxZFrmpeXXHo QyW2vfX8racdS1k4st WoYwgrfZP4yw8 sJrp1Nn3ReSfGo4eKy RMZN4GMUNlryjSb6zS mXnO9IiWWarkI'],
		['Любов', '4N1wOi78ZGzSB6H7vK t8xgPfC5oNIRMrNooe Zl7u48zLVFgLpRwq6f xR5cPyPoL5HVXSphqA s6fnVyWTfM2nUKuMVY FDh2DGsNR4d4TFv890 vaLe6HsREnjYPIYt9A 4asRlBKdJaPeBahjcL 0igHDNPGNJ7jU9xcEZ HSCZMUa1ao17h7l5mg PHiBDPfXs7EBjmxE3B n9HfdJCqnh01e99KtB'],
		['Facepalm', '6yRVg0HWzgS88 XD4qHZpkyUFfq Ra1bmpxpsppNC TJawtKM6OCKkvwCIqX AjYsTtVxEEBPO WrNfErHio7ZAc eH2uOQEmvcqcqgPoH3 xUA7aKWkjTfDUREx8Y vwI4mYEHP8k0w YmszCwM1FV7zCI8sgL whQCarjn5Jv1Ktq2HH 3og0INyCmHlNylks9O'],
		['Іспит', '2EPz0rpGsYQEw v8jUfaclrsG9x8At9Z zP8TbWHidnwjrV6Bf4 10XDnSdnoQHre8 XoM1MOL2PMadEfjN0r rIUjGGqR5akgUB7tXD yFHkrrbfITemc 12vJgj7zMN3jPy Xq13fWGCTzpngSIYi9 J1YFTAeTT3UAxnl6Bx g0cwiu957D1O8 2xkNTl1vFjwDS'],
		['Сон', '7FfUhvnmzsgow ayRF7VrgjtVrvneE5u mF4k0YXIHDHzy h7DyKGq716JMI oh7XlIC2YjEcdLYs7V c1ecqRB9TZsGPsJapk DRIVkLoKs8Gpi8QpXH bEs40jYsdQjmM 5uxD3aVLKTfA6Z2Lvp eoa4dTj13g3Js8qSh3 R54F6kReFBZZO1fSJX JMqAGatY64yq45mBBs'],
		['Кава', 'Lw73Hgs8CS3MtFJrgZ R2QPg2l6AmkIqvURV6 DrJm6F9poo4aA 3lurIRCIRl8Hyl56TQ 4k4pxbTamKLLxE3HXT 3nbxypT20Ulmo Mk1wQ8cH5TtsqafLiX QivRhOwnOaaJVjzjrH qriH9W51oLsL6 zJ8ldRaGLnHTa xUOrwpPFzqDh48XEek M4ecx9P2jI4tq'],
		['Танець', 'ujTVMASREzuRbH6zy5 RLcQGYmQU36d3FceiP H1llKCAzCACXak0x3f tsMAPZ96MHPlvP6OtE SGkufeMafyuBhIw796 1jacd4JEUM03KcdORi b0KqQy2HXjBjFC30Rb V7jkATiqn3mRie2LI2 8m4R4pvViWtRzbloJ1 14qb1Uhf40ndw4 UZxzsNx1kpZZwTCSSp WmkqburJqXziM'],
		['Котики', '774uK11mxE3W0cjE8L jnKo5wjTKRM1FkuFfx GTywSIhrVUo0p5gDJE P9cVQuJXU1dIxRRsS9 GK7dGndK4kyOozR9Xk tphCApwvdtC1VJabZ1 62bRBJV1ccA9nyLmKy 15UbO1LY4O2Fxw8gnI LBb735fuQwRKAVzN23 M9C8PHLkh0hQxraaLG UuzwffmvtBNGjYyEUe gSQp32H82WETR5EFO6'],
		['Песики', 'gKHGnB1ml0moQdjhEJ Kuw5gir5rTnaw HYhn2apjEJhOCIOibB c4mMnJ7K2Q4pUhSQ2N xT9Igg6mMOpkpUIopi My5zUp7tAwTIcStgtJ UxRD5AkpnBoNfwpzt2 Q343jgPdGDu251pGvI Z5xk7fGO5FjjTElnpT ijAp0dXztP6axdYDsQ n5iPVLeA1fvb0IYU5W sWBzg2D15WwQjHcxbt'],
		['Ура', 'lsJCkIKV6AT28 axu6dFuca4HKM artj92V8o75VPL7AeQ doPrWYzSG1Vao U4DswrBiaz0p67ZweH f2jmSnFFSC3vnTNshV BlVnrxJgTGsUw Na33dsU2umStO DJN88m7rzUwpi0pblu geslvCFM31sFW ktU8kAKsyIauRSOoZs l0MYt5jPR6QX5pnqM'],
		['Шок', 'kaAkServkV7P0fRi4h lxxOGaDRk4f7R5TkBd MBchOyOFof4tfmxrD8 Cdkk6wFFqisTe jquDWJfPUMCiI qgRH26FMBoEzm zKBwU2TSfixfz70pJG bGPTxLislwm3u IYjcAIri8C7f8LvLor QOAA3I4EezWzXJNY2M 3o72F8t9TDi2xVnxOE 0tONCfOdU9SW4YTtCk'],
		['Окей', '3ohhwfwxg4d1h82LxS SShJcu4ySty1G6MX9A hqgF0hUBKdcaCp5Mud gRgrJoJHR6fusT6Yry zhS4PEVVuFnbG718kV L3X9GvVhP1nY23Ah6u xSM46ernAUN3y V3KPDF1wg5tkcTDqk5 8Fr8hmVNAg0GiQ6rI4 TQoZGtyAdn6K9Apbg4 G4ZNYMQVMH6us DFNd1yVyRjmF2'],
		['Думаю', 'd3mlE7uhX8KFgEmY Qs1uMrvmHAKIUXxO2g hv53DaYcXWe3nRbR1A TPl5N4Ci49ZQY OuCivbzN4dnk0UJckj W3a0zO282fuBpsqqyD a5viI92PAF89q yZYdkuQsRp8ixIVJQu APqEbxBsVlkWSuFpth 8acGIeFnqLA7S 3oKIPl97G9KsnxS3XG kPtv3UIPrv36cjxqLs'],
		['Злість', 'l1J9u3TZfpmeDLkD6 MLhIi4DoxeUjC 29bKyyjDKX1W8 osd1H6uo3tIeBDMo55 8TT8VjZTZGWQw BT2dqujaEBalMmvfTi y78C7FkjduiHL9hgZN vHcCevWbWkzwk M3KeQ2khSTTrFZZlRI m8fyrgnXwXV5EHw6Lm 10OC47gvP2BKJa RuYPi0HyBnOxy'],
		['Обійми', '7Wcyq7KvKFNTO 2GDHOfqcmYIX6 42YlR8u9gV5Cw VduFvPwm3gfGO8duNN VhRU9RvKZWKujYXhlJ 9TB6BcQ9fXruEzYtXn 5zM3QKTv7F4FsJav9R QwRqwmMp17ULRHuSau bvFS4rALdNDag 5OqXb948EBkyUcnwHt vVGzlimI9KAOQ llmZp6fCVb4ju'],
		['Па-па', 'm9eG1qVjvN56H0MXt8 TOzV4yV9ia78pOr4Bg jUwpNzg9IcyrK 3o7WICht89LQdQZa2A 5BWuICFt68g7AbNMt2 m5B4JzuoIrrcbibbnc PF4NopbRuZj8I kaBU6pgv0OsPHz2yxy Xo2p7ETmZaQdd3MZqv UrcXN0zTfzTPi Ru9sjtZ09XOEg 7DzlajZNY5D0I'],
		['Дедлайн', 'zMWTXLXa0KNek5yDPv Kx92SUYb8m5HINJL8y SwUpEicey6NNtGO4G2 23WkP7BaPCSgvLZYz0 U16OUT29Z6AbNqnqkn vu1TENU3Ymn1jutgaO o2ljIK5nTd55wsP9es a2sx8GRESFjqu4fYoc AspxmCZmV8kEG2VS8M wq1I3ILdsvYJub8Rwx jwxy5MXUWDKlUtQatg 26gsg1S8nihAfr70c'],
		['Удачі', '12XDYvMJNcmLgQ tCxHdMIX3OD8KyNtjx Q2DBslD4yHQx0OPCi9 l3BwSPbqx3QGKEgpp2 3oeSAz6FqXCKuNFX6o EqF5Y99mEH29HcxXnq MYyIPGvh4e4gaXK61S pDgHg2Lcju3Ty UKWxGMEPjRwCA 3gM9hmQeWBLVXXrxvJ LJNP7qXusNsmhRKVUD 10AYkGR9M75nLW'],
		['Вітаю', 'jJQC2puVZpTMO4vUs0 879RsXB8GvEuY95LNl ihef2mzZVbV4FygisP 7jyUZqUSrpyWUm754m 3o6fJ1BM7R2EBRDnxK Ov09jGgEThFKpxZ9eC g9582DNuQppxC AbM71atR2TJQq8c7vw DYPP3JTXIvPT3CPGhE TpNApZpyKgxlhYpXdv NbBJqE9xIoIeG0egGH Wrv5v6egIh7Ww']
	]

	function t(s) { return typeof T === 'function' ? T(s) : s }
	function ls(k, v) {
		try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v) } catch (e) { return null }
	}


	// Спільні набори емодзі та GIF - ними користується й особисте листування (dm.js)
	/* --- власні емодзі-картинки: assets/emoji/custom.json = [{id, src, name}], у тексті й реакціях - код «:id:» --- */
	var CUSTOM = [], CUSTOM_BY = {}, customHooks = []
	var CUSTOM_RE = /:([a-z0-9][a-z0-9_-]{1,31}):/g
	function customImg(c, cls) {
		var im = document.createElement('img')
		im.className = cls || 'cemoji'
		im.src = c.src
		im.alt = ':' + c.id + ':'
		im.title = c.name || c.id
		im.loading = 'lazy'
		im.draggable = false
		return im
	}
	// емодзі для показу: звичайний символ або картинка з власного набору
	function emojiNode(code, cls) {
		var m = /^:([a-z0-9][a-z0-9_-]{1,31}):$/.exec(code || '')
		if (m && CUSTOM_BY[m[1]]) return customImg(CUSTOM_BY[m[1]], cls)
		return document.createTextNode(code)
	}
	// додає текст, замінюючи «:id:» на картинки власних емодзі
	function appendRich(node, text) {
		if (!CUSTOM.length || text.indexOf(':') < 0) { node.appendChild(document.createTextNode(text)); return }
		// лише 1-3 власні емодзі без тексту - показуємо крупно
		if (/^\s*(:[a-z0-9][a-z0-9_-]{1,31}:\s*){1,3}$/.test(text) && node.classList) node.classList.add('is-emoji-only')
		var last = 0, m
		CUSTOM_RE.lastIndex = 0
		while ((m = CUSTOM_RE.exec(text))) {
			if (!CUSTOM_BY[m[1]]) continue
			if (m.index > last) node.appendChild(document.createTextNode(text.slice(last, m.index)))
			node.appendChild(customImg(CUSTOM_BY[m[1]]))
			last = m.index + m[0].length
		}
		if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)))
	}
	// посилання в повідомленнях: http(s)://, www. і голі домени з поширеними зонами (example.com/шлях)
	var URL_RE = /(^|[^A-Za-z0-9_@\/.-])((?:https?:\/\/|www\.)[^\s<>"'«»]+|(?:[A-Za-z0-9-]{1,63}\.)+(?:com|org|net|ua|io|dev|me|app|edu|gov|info|co|ai|gg|tv|eu|pl|de|uk|ly|to|site|online|tech|pro)(?![A-Za-z0-9-])(?:[\/?#][^\s<>"'«»]*)?)/gi
	function cleanUrl(raw) {
		var u = raw.replace(/[.,!?;:…»)\]]+$/, '')
		// закриваюча дужка - частина адреси лише якщо в ній є відкриваюча (вікіпедія)
		if (raw.charAt(u.length) === ')' && u.split('(').length > u.split(')').length) u += ')'
		return u
	}
	function linkNode(text) {
		var href = /^https?:\/\//i.test(text) ? text : 'https://' + text
		var url
		try { url = new URL(href) } catch (e) { return null }
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
		var a = document.createElement('a')
		a.className = 'chat-link'
		a.href = url.href
		a.textContent = text.length > 60 ? text.slice(0, 57) + '…' : text
		a.title = url.href
		if (url.host !== location.host) { a.target = '_blank'; a.rel = 'noopener noreferrer nofollow ugc' }
		return a
	}
	// додає текст із клікабельними посиланнями; решту тексту обробляє inner (емодзі, згадки)
	function appendLinked(node, text, inner) {
		inner = inner || appendRich
		var last = 0, m, found = false
		URL_RE.lastIndex = 0
		while ((m = URL_RE.exec(text))) {
			var start = m.index + m[1].length, raw = m[2], u = cleanUrl(raw)
			var a = u.length > 3 ? linkNode(u) : null
			if (!a) continue
			if (start > last) inner(node, text.slice(last, start))
			node.appendChild(a)
			found = true
			last = start + u.length
			URL_RE.lastIndex = last
		}
		if (!found) return inner(node, text)
		if (last < text.length) inner(node, text.slice(last))
		if (node.classList) node.classList.remove('is-emoji-only')
	}
	function onCustom(fn) { customHooks.push(fn); if (CUSTOM.length) fn(CUSTOM) }
	try {
		fetch('assets/emoji/custom.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : [] }).then(function (list) {
			CUSTOM = (Array.isArray(list) ? list : []).filter(function (c) {
				return c && /^[a-z0-9][a-z0-9_-]{1,31}$/.test(c.id) && typeof c.src === 'string' && /^assets\/emoji\/[A-Za-z0-9_.-]+\.(png|svg|webp|gif)$/.test(c.src)
			}).slice(0, 400)
			CUSTOM.forEach(function (c) { CUSTOM_BY[c.id] = c })
			if (CUSTOM.length) customHooks.forEach(function (fn) { fn(CUSTOM) })
		}, function () {})
	} catch (e) {}

	window.NTU_MEDIA = { EMOJI: EMOJI, GIFS: GIFS, gifUrl: gifUrl, GIF_RE: GIF_RE, emojiNode: emojiNode, appendRich: appendRich, appendLinked: appendLinked, onCustom: onCustom, isCustom: function (code) { var m = /^:([a-z0-9_-]+):$/.exec(code || ''); return !!(m && CUSTOM_BY[m[1]]) } }

	var isProfane = window.NTU_isProfane || function () { return false }

	var uid = ls(KEY_UID)
	if (!uid) { uid = 'v' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); ls(KEY_UID, uid) }

	function me() { return window.NTU_AUTH ? window.NTU_AUTH.user : null }
	function myUid() { var u = me(); return u ? u.uid : uid }
	var profiles = {} // uid -> {n, a} | null (loading)
	var renderTimer = null
	function profileFor(u) {
		if (!u || !window.NTU_AUTH) return null
		var mu = me()
		if (mu && mu.uid === u) return { n: mu.name, a: mu.avatar || '' }
		if (profiles[u] === undefined) {
			profiles[u] = null
			window.NTU_AUTH.profile(u).then(function (p) {
				profiles[u] = p || {}
				clearTimeout(renderTimer)
				renderTimer = setTimeout(render, 80)
			}, function () { profiles[u] = {} })
		}
		return profiles[u]
	}
	var hiddenIds = (cfg.hiddenMessages || [])
	var messages = []
	var seen = {}
	var lastSent = 0
	var unread = 0
	var isOpen = false
	// стан «в мережі» / «друкує» / «переглянули» (використовується вже під час першого render)
	var stats = null, statsAt = 0
	var typers = [], typingPrev = null, typingTimer = null, myTypingAt = 0, myTyping = false
	var seenMap = {}, seenKey = '', seenWritten = 0

	function el(tag, cls, text) {
		var e = document.createElement(tag)
		if (cls) e.className = cls
		if (text != null) e.textContent = text
		return e
	}

	/* ---------- UI ---------- */
	var root = el('div', 'chat')
	var fab = el('button', 'chat-fab')
	fab.type = 'button'
	fab.setAttribute('aria-label', t('Відкрити чат'))
	fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.7 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12Z"/><path d="M8.5 11h7M8.5 14h4"/></svg>'
	var badge = el('span', 'chat-fab__badge')
	badge.hidden = true
	fab.appendChild(badge)

	var panel = el('section', 'chat-panel')
	panel.hidden = true
	panel.setAttribute('role', 'dialog')
	panel.setAttribute('aria-label', t('Студентський чат'))

	var head = el('header', 'chat-head')
	var headText = el('div', 'chat-head__text')
	headText.appendChild(el('strong', null, t('Студентський чат')))
	var status = el('span', 'chat-head__status')
	headText.appendChild(status)
	var close = el('button', 'chat-head__close', '✕')
	close.type = 'button'
	close.setAttribute('aria-label', t('Закрити чат'))
	var ICON_FULL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>'
	var ICON_SMALL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>'
	var fullBtn = el('button', 'chat-head__close chat-head__full')
	fullBtn.type = 'button'
	fullBtn.innerHTML = ICON_FULL
	fullBtn.setAttribute('aria-label', t('На весь екран'))
	fullBtn.title = t('На весь екран')
	fullBtn.setAttribute('aria-pressed', 'false')
	var headBtns = el('div', 'chat-head__btns')
	// учасники (закріплення) і локальна тема чату - chat-members.js / chat-prefs.js
	var CP = window.NTU_CHATPREFS
	var membersBtn = el('button', 'chat-head__close chat-head__members')
	membersBtn.type = 'button'
	membersBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.5a6.5 6.5 0 0 1 3 5.5"/></svg>'
	membersBtn.setAttribute('aria-label', t('Учасники'))
	membersBtn.title = t('Учасники')
	membersBtn.setAttribute('aria-expanded', 'false')
	var themeBtn = el('button', 'chat-head__close chat-head__theme')
	themeBtn.type = 'button'
	themeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 22 9.8C22 6 17.5 3 12 3Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15.5" cy="7.5" r="1.2"/></svg>'
	themeBtn.setAttribute('aria-label', t('Тема чату'))
	themeBtn.title = t('Тема чату')
	themeBtn.setAttribute('aria-expanded', 'false')
	if (CP) {
		themeBtn.addEventListener('click', function (e) { e.stopPropagation(); CP.picker(themeBtn, 'chat') })
		headBtns.appendChild(membersBtn)
		headBtns.appendChild(themeBtn)
	}
	headBtns.appendChild(fullBtn)
	headBtns.appendChild(close)
	head.appendChild(headText)
	head.appendChild(headBtns)
	// Кутик для зміни розміру (панель прив'язана до правого нижнього кута, тож тягнемо за лівий верхній)
	var grip = el('button', 'chat-grip')
	grip.type = 'button'
	grip.setAttribute('aria-label', t('Змінити розмір чату (стрілки на клавіатурі, подвійний клік - стандартний розмір)'))
	grip.title = t('Потягніть, щоб змінити розмір')

	var list = el('div', 'chat-list')
	list.setAttribute('aria-live', 'polite')
	var empty = el('p', 'chat-empty', t('Поки що тут тихо. Напиши перше повідомлення!'))

	var form = el('form', 'chat-form')
	form.autocomplete = 'off'
	var row = el('div', 'chat-form__row')
	var msgIn = el('input', 'chat-text')
	msgIn.type = 'text'
	msgIn.maxLength = MAX_LEN
	msgIn.placeholder = t('Напишіть повідомлення…')
	msgIn.setAttribute('aria-label', t('Повідомлення'))
	var send = el('button', 'chat-send')
	send.type = 'submit'
	send.setAttribute('aria-label', t('Надіслати'))
	send.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'
	function toolBtn(cls, label, html) {
		var b = el('button', 'chat-tool ' + cls)
		b.type = 'button'
		b.setAttribute('aria-label', label)
		b.title = label
		b.setAttribute('aria-expanded', 'false')
		b.innerHTML = html
		return b
	}
	var emojiBtn = toolBtn('chat-tool--emoji', t('Емодзі'), '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/></svg>')
	var gifBtn = toolBtn('chat-tool--gif', t('GIF-анімації'), '<span aria-hidden="true">GIF</span>')
	row.appendChild(emojiBtn)
	row.appendChild(gifBtn)
	row.appendChild(msgIn)
	row.appendChild(send)
	var note = el('p', 'chat-note')
	var asLine = el('p', 'chat-as')

	/* --- панель емодзі --- */
	var emojiPop = el('div', 'chat-pop chat-pop--emoji')
	emojiPop.hidden = true
	emojiPop.setAttribute('role', 'dialog')
	emojiPop.setAttribute('aria-label', t('Емодзі'))
	EMOJI.forEach(function (g) {
		emojiPop.appendChild(el('p', 'chat-pop__label', t(g[0])))
		var grid = el('div', 'chat-emoji-grid')
		g[1].split(' ').forEach(function (e) {
			var b = el('button', 'chat-emoji', e)
			b.type = 'button'
			b.setAttribute('aria-label', e)
			b.addEventListener('click', function () { insertAtCursor(e) })
			grid.appendChild(b)
		})
		emojiPop.appendChild(grid)
	})
	onCustom(function (list) {
		emojiPop.appendChild(el('p', 'chat-pop__label', t('Kawaii')))
		var grid = el('div', 'chat-emoji-grid chat-emoji-grid--custom')
		list.forEach(function (c) {
			var b = el('button', 'chat-emoji chat-emoji--img')
			b.type = 'button'
			b.setAttribute('aria-label', c.name || c.id)
			b.appendChild(customImg(c))
			b.addEventListener('click', function () { insertAtCursor(':' + c.id + ':') })
			grid.appendChild(b)
		})
		emojiPop.appendChild(grid)
	})

	/* --- панель GIF --- */
	var gifPop = el('div', 'chat-pop chat-pop--gif')
	gifPop.hidden = true
	gifPop.setAttribute('role', 'dialog')
	gifPop.setAttribute('aria-label', t('GIF-анімації'))
	var gifSearch = null
	if (GIPHY_KEY) {
		gifSearch = el('input', 'chat-gif-search')
		gifSearch.type = 'search'
		gifSearch.placeholder = t('Пошук GIF…')
		gifSearch.setAttribute('aria-label', t('Пошук GIF…'))
		gifSearch.maxLength = 50
		gifPop.appendChild(gifSearch)
	}
	var gifCats = el('div', 'chat-gif-cats')
	var gifGrid = el('div', 'chat-gif-grid')
	gifPop.appendChild(gifCats)
	gifPop.appendChild(gifGrid)
	gifPop.appendChild(el('p', 'chat-pop__credit', 'Powered by GIPHY'))
	function showGifs(ids) {
		gifGrid.textContent = ''
		if (!ids.length) { gifGrid.appendChild(el('p', 'chat-pop__empty', t('Нічого не знайдено'))); return }
		ids.forEach(function (id) {
			var b = el('button', 'chat-gif-pick')
			b.type = 'button'
			b.setAttribute('aria-label', t('Надіслати GIF'))
			var im = el('img')
			im.src = gifUrl(id)
			im.alt = ''
			im.loading = 'lazy'
			b.appendChild(im)
			b.addEventListener('click', function () { sendGif(id) })
			gifGrid.appendChild(b)
		})
	}
	GIFS.forEach(function (g, i) {
		var c = el('button', 'chat-gif-cat' + (i === 0 ? ' is-active' : ''), t(g[0]))
		c.type = 'button'
		c.addEventListener('click', function () {
			Array.prototype.forEach.call(gifCats.children, function (x) { x.classList.remove('is-active') })
			c.classList.add('is-active')
			if (gifSearch) gifSearch.value = ''
			showGifs(g[1].split(' '))
		})
		gifCats.appendChild(c)
	})
	showGifs(GIFS[0][1].split(' '))
	if (gifSearch) {
		var gifTimer = null
		gifSearch.addEventListener('input', function () {
			clearTimeout(gifTimer)
			var q = gifSearch.value.trim()
			if (!q) return
			gifTimer = setTimeout(function () {
				fetch('https://api.giphy.com/v1/gifs/search?api_key=' + encodeURIComponent(GIPHY_KEY) + '&q=' + encodeURIComponent(q) + '&limit=24&rating=pg-13')
					.then(function (r) { return r.json() })
					.then(function (d) {
						Array.prototype.forEach.call(gifCats.children, function (x) { x.classList.remove('is-active') })
						showGifs((d.data || []).map(function (x) { return x.id }).filter(function (id) { return /^[A-Za-z0-9]{6,40}$/.test(id) }))
					}, function () { showGifs([]) })
			}, 350)
		})
	}

	/* --- підказки для @тегів --- */
	var mentionBox = el('ul', 'chat-mentions')
	mentionBox.hidden = true
	mentionBox.setAttribute('role', 'listbox')
	mentionBox.id = 'chatMentions'
	msgIn.setAttribute('aria-autocomplete', 'list')
	msgIn.setAttribute('aria-controls', 'chatMentions')

	form.appendChild(asLine)
	form.appendChild(emojiPop)
	form.appendChild(gifPop)
	form.appendChild(mentionBox)
	form.appendChild(row)
	form.appendChild(note)
	var mentionHint = el('p', 'chat-hint', t('Порада: напишіть @ і нік у Telegram, щоб тегнути учасника.'))
	form.appendChild(mentionHint)

	var gate = el('div', 'chat-gate')
	var gateText = el('p', 'chat-gate__text', t('Щоб писати в чаті, потрібно увійти або зареєструватися. Читати повідомлення можна без акаунта.'))
	gate.appendChild(gateText)
	var gateBtns = el('div', 'chat-gate__btns')
	var gLogin = el('a', 'btn btn-primary', t('Увійти'))
	gLogin.href = 'login.html'
	var gReg = el('a', 'btn btn-secondary', t('Зареєструватися'))
	gReg.href = 'register.html'
	gateBtns.appendChild(gLogin)
	gateBtns.appendChild(gReg)
	gate.appendChild(gateBtns)

	/* --- реакції: швидкий вибір + повний набір емодзі --- */
	var QUICK = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏']
	var ALLOWED = {}
	QUICK.forEach(function (e) { ALLOWED[e] = 1 })
	EMOJI.forEach(function (g) { g[1].split(' ').forEach(function (e) { ALLOWED[e] = 1 }) })
	var rpick = el('div', 'chat-rpick')
	rpick.hidden = true
	rpick.setAttribute('role', 'dialog')
	rpick.setAttribute('aria-label', t('Реакція на повідомлення'))
	var rquick = el('div', 'chat-rpick__quick')
	var rmore = el('div', 'chat-rpick__more')
	rmore.hidden = true
	var rpickMid = null
	function rbtn(e, cls) {
		var b = el('button', cls, e)
		b.type = 'button'
		b.setAttribute('aria-label', e)
		b.addEventListener('click', function () { var mid = rpickMid; closeRpick(); toggleReact(mid, e) })
		return b
	}
	QUICK.forEach(function (e) { rquick.appendChild(rbtn(e, 'chat-rpick__e')) })
	var rplus = el('button', 'chat-rpick__plus', '+')
	rplus.type = 'button'
	rplus.setAttribute('aria-label', t('Більше емодзі'))
	rplus.setAttribute('aria-expanded', 'false')
	rplus.addEventListener('click', function (e) {
		e.stopPropagation()
		rmore.hidden = !rmore.hidden
		rplus.setAttribute('aria-expanded', rmore.hidden ? 'false' : 'true')
		placeRpick()
	})
	rquick.appendChild(rplus)
	EMOJI.forEach(function (g) {
		rmore.appendChild(el('p', 'chat-pop__label', t(g[0])))
		var grid = el('div', 'chat-emoji-grid')
		g[1].split(' ').forEach(function (e) { grid.appendChild(rbtn(e, 'chat-emoji')) })
		rmore.appendChild(grid)
	})
	onCustom(function (list) {
		rmore.appendChild(el('p', 'chat-pop__label', t('Kawaii')))
		var grid = el('div', 'chat-emoji-grid chat-emoji-grid--custom')
		list.forEach(function (c) {
			var code = ':' + c.id + ':'
			ALLOWED[code] = 1
			var b = el('button', 'chat-emoji chat-emoji--img')
			b.type = 'button'
			b.setAttribute('aria-label', c.name || c.id)
			b.appendChild(customImg(c))
			b.addEventListener('click', function () { var mid = rpickMid; closeRpick(); toggleReact(mid, code) })
			grid.appendChild(b)
		})
		rmore.appendChild(grid)
		render()
	})
	rpick.appendChild(rquick)
	rpick.appendChild(rmore)
	var toast = el('div', 'chat-toast')
	toast.hidden = true
	toast.setAttribute('role', 'status')

	panel.appendChild(grip)
	panel.appendChild(head)
	panel.appendChild(list)
	panel.appendChild(form)
	panel.appendChild(gate)
	panel.appendChild(rpick)
	panel.appendChild(toast)
	root.appendChild(panel)
	root.appendChild(fab)
	if (CP) {
		CP.apply(panel, 'chat')
		CP.onChange(function () { CP.apply(panel, 'chat') })
		if (window.NTU_CHATMEMBERS) window.NTU_CHATMEMBERS.mount(panel, membersBtn)
	}

	/* ---------- rendering ---------- */
	function fmt(ts) {
		var d = new Date(ts)
		var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)
		var today = new Date()
		if (d.toDateString() === today.toDateString()) return hm
		return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + ' ' + hm
	}
	function colorFor(s) {
		var h = 0
		for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
		return 'hsl(' + h + ',55%,42%)'
	}
	/* ---------- @теги (нік у Telegram) ---------- */
	var dir = [] // [{uid, n, a, tg}] - учасники, які вказали Telegram у профілі
	var dirState = 0 // 0 - не завантажено, 1 - завантажується, 2 - готово
	function loadDir() {
		var A = window.NTU_AUTH
		if (dirState || !A || !A.remote || !me()) return
		dirState = 1
		Promise.all([A.db('GET', 'users', undefined, true), A.db('GET', 'profiles', undefined, true)]).then(function (r) {
			var users = r[0] || {}, profs = r[1] || {}
			dir = Object.keys(profs).map(function (uid) {
				var p = profs[uid] || {}, u = users[uid] || {}
				return { uid: uid, n: u.n || '', a: u.a || '', tg: p.tg || '' }
			}).filter(function (x) { return /^[A-Za-z0-9_]{5,32}$/.test(x.tg) && !isProfane(x.n) })
			dir.sort(function (a, b) { return a.tg.localeCompare(b.tg) })
			dirState = 2
			render()
		}, function () { dirState = 0 })
	}
	function myTg() {
		var id = myUid()
		for (var i = 0; i < dir.length; i++) if (dir[i].uid === id) return dir[i].tg.toLowerCase()
		return ''
	}
	// Додає текст у вузол, перетворюючи @нік на посилання t.me. Повертає true, якщо тегнули поточного користувача.
	// посилання + @згадки: згадки шукаються лише в тексті поза посиланнями
	function appendWithMentions(node, text) {
		var hit = false
		appendLinked(node, text, function (n, part) { if (mentionsIn(n, part)) hit = true })
		return hit
	}
	function mentionsIn(node, text) {
		var mine = myTg(), hit = false, last = 0, m
		MENTION_RE.lastIndex = 0
		while ((m = MENTION_RE.exec(text))) {
			var start = m.index + m[1].length
			if (start > last) appendRich(node, text.slice(last, start))
			var a = el('a', 'chat-mention', '@' + m[2])
			a.href = 'https://t.me/' + m[2]
			a.target = '_blank'
			a.rel = 'noopener noreferrer'
			a.title = t('Відкрити в Telegram')
			if (mine && m[2].toLowerCase() === mine) { a.classList.add('is-me'); hit = true }
			node.appendChild(a)
			last = start + m[2].length + 1
		}
		if (last < text.length) appendRich(node, text.slice(last))
		return hit
	}

	/* суперадмін (admins/{uid} у базі) може видаляти будь-які повідомлення */
	var chatAdmin = false, adminHooked = false
	function hookAdmin() {
		var A = window.NTU_AUTH
		if (adminHooked || !A || !A.isAdmin) return
		adminHooked = true
		A.onChange(function () {
			A.isAdmin().then(function (v) { if (v !== chatAdmin) { chatAdmin = v; render() } })
		})
	}
	// «Поскаржитись» на чуже повідомлення: скарга йде в чергу суперадмінів (особистий кабінет)
	function reportBtn(m) {
		var b = el('button', 'chat-msg__report', '⚑')
		b.type = 'button'
		b.title = t('Поскаржитись')
		b.setAttribute('aria-label', t('Поскаржитись на повідомлення'))
		b.addEventListener('click', function (e) {
			e.stopPropagation()
			var A = window.NTU_AUTH
			if (!A || !A.report) return
			A.report('chat', m.id, m.u, (m.n || '') + ': ' + (m.t || '')).then(function (sent) {
				if (sent) { b.textContent = '✓'; b.disabled = true; b.title = t('Скаргу надіслано') }
			}, function (err) { window.alert(err.message) })
		})
		return b
	}
	function adminDelete(m) {
		var del = el('button', 'chat-msg__del', '🗑')
		del.type = 'button'
		del.title = t('Видалити повідомлення (модерація)')
		del.setAttribute('aria-label', del.title)
		del.addEventListener('click', function (e) {
			e.stopPropagation()
			(window.NTU_AUTH && window.NTU_AUTH.confirm ? window.NTU_AUTH.confirm(t('Видалити це повідомлення для всіх?'), t('Видалити')) : Promise.resolve(window.confirm(t('Видалити це повідомлення для всіх?')))).then(function (ok) {
				if (!ok) return
				window.NTU_AUTH.db('DELETE', 'chat/messages/' + encodeURIComponent(m.id)).then(function () {
					if (window.NTU_AUTH.adminLog) window.NTU_AUTH.adminLog('chat.delete', m.u, (m.n || '') + ': ' + (m.t || (m.f && m.f.name) || ''))
					messages = messages.filter(function (x) { return x.id !== m.id })
					render()
				}).catch(function (err) { window.alert(err.message) })
			})
		})
		return del
	}
	function render() {
		hookAdmin()
		var atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60
		list.textContent = ''
		if (!messages.length) list.appendChild(empty)
		messages.forEach(function (m) {
			var mine = m.u === myUid()
			var bad = (GIF_RE.test(m.t) ? false : isProfane(m.t)) || isProfane(m.n || '')
			var prof = profileFor(m.u)
			var shownName = bad ? t('Гість') : (m.n || (prof && prof.n) || t('Гість'))
			var rowEl = el('div', 'chat-row' + (mine ? ' is-mine' : ''))
			var av
			if (prof && prof.a && !bad) { av = el('img', 'chat-avatar'); av.src = prof.a; av.alt = '' } else {
				av = el('span', 'chat-avatar chat-avatar--ph', (window.NTU_AUTH ? window.NTU_AUTH.initials(shownName) : shownName.charAt(0)))
				av.style.background = colorFor(shownName)
			}
			var b = el('div', 'chat-msg' + (mine ? ' is-mine' : ''))
			var who = el('span', 'chat-msg__who', shownName)
			who.style.color = mine ? '' : colorFor(shownName)
			if (!bad && window.NTU_PROFILE && /^[A-Za-z0-9]{20,64}$/.test(m.u || '')) { clickable(av, m.u, shownName); clickable(who, m.u, shownName) }
			var staff = !bad && window.NTU_AUTH && window.NTU_AUTH.staff && window.NTU_AUTH.staff(m.u)
			if (staff) {
				var ab = el('span', 'chat-author chat-author--' + staff.kind, staff.text)
				ab.title = staff.title
				who.appendChild(ab)
			}
			b.appendChild(who)
			var gm = !bad && GIF_RE.exec(m.t)
			if (gm) {
				var gi = el('img', 'chat-gif')
				gi.src = gifUrl(gm[1])
				gi.alt = 'GIF'
				gi.loading = 'lazy'
				b.classList.add('has-gif')
				b.appendChild(gi)
			} else if (bad) {
				var txt = el('p', 'chat-msg__text is-hidden', t('Повідомлення приховано: нецензурна лексика'))
				b.appendChild(txt)
			} else {
				var txt2 = el('p', 'chat-msg__text')
				if (appendWithMentions(txt2, m.t) && !mine) b.classList.add('is-mention')
				b.appendChild(txt2)
			}
			b.setAttribute('data-mid', m.id)
			var rs = reactSummary(m.id)
			if (rs.length) {
				var bar = el('div', 'chat-reacts')
				rs.forEach(function (r) {
					var c = el('button', 'chat-react' + (r.mine ? ' is-mine' : ''))
					c.type = 'button'
					var ce = el('span', 'chat-react__e')
					ce.appendChild(emojiNode(r.e))
					c.appendChild(ce)
					c.appendChild(el('span', 'chat-react__n', String(r.n)))
					c.title = r.names
					c.setAttribute('aria-label', r.e + ' ' + r.n + (r.mine ? ' · ' + t('ваша реакція, натисніть, щоб прибрати') : ''))
					c.setAttribute('aria-pressed', r.mine ? 'true' : 'false')
					c.addEventListener('click', function () { toggleReact(m.id, r.e) })
					bar.appendChild(c)
				})
				b.appendChild(bar)
			}
			var meta = el('span', 'chat-msg__meta')
			meta.appendChild(el('time', 'chat-msg__time', fmt(m.ts)))
			if (mine && backend.remote) {
				var nSeen = seenCount(m.ts)
				var tick = el('span', 'chat-tick' + (nSeen ? ' is-read' : ''), nSeen ? '✓✓' : '✓')
				tick.title = nSeen ? t('Переглянули') + ': ' + nSeen : t('Надіслано')
				tick.setAttribute('aria-label', tick.title)
				meta.appendChild(tick)
			}
			if (chatAdmin && backend.remote && m.id) meta.appendChild(adminDelete(m))
			else if (!mine && backend.remote && m.id && window.NTU_AUTH && window.NTU_AUTH.user) meta.appendChild(reportBtn(m))
			b.appendChild(meta)
			if (!bad) {
				var addR = el('button', 'chat-msg__add')
				addR.type = 'button'
				addR.setAttribute('aria-label', t('Додати реакцію'))
				addR.title = t('Реакція · подвійний клік - ❤️')
				addR.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/></svg>'
				addR.addEventListener('click', function (e) { e.stopPropagation(); openRpick(m.id) })
				b.appendChild(addR)
				b.addEventListener('dblclick', function (e) {
					if (e.target.closest('a,button')) return
					e.preventDefault()
					if (window.getSelection) window.getSelection().removeAllRanges()
					heart(m.id)
				})
				b.addEventListener('touchend', function (e) {
					if (e.target.closest('a,button') || e.touches.length) return
					var now = Date.now()
					if (lastTap.mid === m.id && now - lastTap.ts < 320) { e.preventDefault(); lastTap.mid = null; heart(m.id) }
					else { lastTap.mid = m.id; lastTap.ts = now }
				})
			}
			rowEl.appendChild(av)
			rowEl.appendChild(b)
			list.appendChild(rowEl)
		})
		if (typers.length) list.appendChild(typingRow())
		if (atBottom || isOpen && messages.length && messages[messages.length - 1].u === myUid()) list.scrollTop = list.scrollHeight
	}
	/* ---------- реакції ---------- */
	var reacts = {} // mid -> {uid: emoji}
	var reactsKey = ''
	var lastTap = { mid: null, ts: 0 }
	function byMid(mid) {
		return list.querySelector('[data-mid="' + (window.CSS && CSS.escape ? CSS.escape(mid) : mid) + '"]')
	}
	function reactSummary(mid) {
		var r = reacts && reacts[mid]
		if (!r) return []
		var by = {}, order = [], meId = myUid()
		Object.keys(r).forEach(function (u) {
			var e = r[u]
			if (typeof e !== 'string' || !ALLOWED[e]) return
			if (!by[e]) { by[e] = { e: e, n: 0, mine: false, who: [] }; order.push(e) }
			by[e].n++
			if (u === meId) by[e].mine = true
			var p = u === meId ? null : profileFor(u)
			by[e].who.push(u === meId ? t('Ви') : (p && p.n) || t('Гість'))
		})
		return order.map(function (e) {
			var x = by[e]
			x.names = x.who.slice(0, 12).join(', ') + (x.who.length > 12 ? ' +' + (x.who.length - 12) : '')
			return x
		}).sort(function (a, b) { return b.n - a.n })
	}
	var toastTimer = null
	function flash(msg) {
		toast.textContent = msg
		toast.hidden = false
		clearTimeout(toastTimer)
		toastTimer = setTimeout(function () { toast.hidden = true }, 3200)
	}
	function canReact() {
		if (canWrite()) return true
		flash(me() ? t('Підтвердьте пошту, щоб ставити реакції.') : t('Увійдіть, щоб ставити реакції.'))
		return false
	}
	function setReact(mid, emoji) {
		var meId = myUid()
		var prev = reacts[mid] && reacts[mid][meId]
		if (!reacts[mid]) reacts[mid] = {}
		if (emoji) reacts[mid][meId] = emoji
		else delete reacts[mid][meId]
		render()
		return backend.react(mid, meId, emoji).then(function () { reactsKey = '' }, function () {
			if (prev) reacts[mid][meId] = prev
			else delete reacts[mid][meId]
			render()
			flash(t('Не вдалося зберегти реакцію. Спробуйте ще раз.'))
		})
	}
	function toggleReact(mid, emoji) {
		if (!mid || !ALLOWED[emoji] || !canReact()) return
		var cur = reacts[mid] && reacts[mid][myUid()]
		setReact(mid, cur === emoji ? null : emoji)
	}
	function heart(mid) {
		if (!canReact()) return
		var cur = reacts[mid] && reacts[mid][myUid()]
		if (cur !== '❤️') setReact(mid, '❤️')
		var b = byMid(mid)
		if (!b) return
		var h = el('span', 'chat-heart', '❤️')
		h.setAttribute('aria-hidden', 'true')
		b.appendChild(h)
		setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h) }, 900)
	}
	function loadReacts() {
		return backend.loadReacts().then(function (data) {
			var k = JSON.stringify(data || {})
			if (k === reactsKey) return
			reactsKey = k
			reacts = data || {}
			render()
		}, function () {})
	}
	function placeRpick() {
		if (rpick.hidden || !rpickMid) return
		var b = byMid(rpickMid)
		if (!b) { closeRpick(); return }
		var pr = panel.getBoundingClientRect(), br = b.getBoundingClientRect()
		var w = rpick.offsetWidth, h = rpick.offsetHeight
		var mine = b.classList.contains('is-mine')
		var left = mine ? br.right - pr.left - w : br.left - pr.left
		left = Math.max(8, Math.min(left, pr.width - w - 8))
		var top = br.top - pr.top - h - 6
		if (top < 64) top = Math.min(br.bottom - pr.top + 6, pr.height - h - 8)
		rpick.style.left = left + 'px'
		rpick.style.top = Math.max(8, top) + 'px'
	}
	function openRpick(mid) {
		if (!canReact()) return
		if (!rpick.hidden && rpickMid === mid) { closeRpick(); return }
		closePops()
		rpickMid = mid
		rmore.hidden = true
		rplus.setAttribute('aria-expanded', 'false')
		rpick.hidden = false
		placeRpick()
		var first = rpick.querySelector('button')
		if (first) first.focus()
	}
	function closeRpick() {
		if (rpick.hidden) return
		rpick.hidden = true
		rpickMid = null
	}
	list.addEventListener('scroll', closeRpick)
	document.addEventListener('click', function (e) {
		if (!rpick.hidden && !rpick.contains(e.target) && !(e.target.closest && e.target.closest('.chat-msg__add'))) closeRpick()
	})

	/* ---------- розмір вікна і повноекранний режим ---------- */
	var KEY_SIZE = 'ntu-chat-size'
	var isFull = false
	function clampSize(w, h) {
		return [Math.round(Math.max(300, Math.min(w, window.innerWidth - 32))), Math.round(Math.max(360, Math.min(h, window.innerHeight - 110)))]
	}
	function applySize(w, h, save) {
		if (!w || !h) { panel.style.width = ''; panel.style.height = ''; if (save) ls(KEY_SIZE, ''); return }
		var c = clampSize(w, h)
		panel.style.width = c[0] + 'px'
		panel.style.height = c[1] + 'px'
		if (save) ls(KEY_SIZE, c.join('x'))
	}
	function restoreSize() {
		var m = /^(\d+)x(\d+)$/.exec(ls(KEY_SIZE) || '')
		if (m && window.innerWidth > 520) applySize(+m[1], +m[2], false)
		else applySize(0, 0, false)
	}
	function setFull(on) {
		var bottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60
		isFull = on
		root.classList.toggle('is-full', on)
		document.documentElement.classList.toggle('chat-full-open', on)
		fullBtn.innerHTML = on ? ICON_SMALL : ICON_FULL
		var lbl = on ? t('Звичайний розмір') : t('На весь екран')
		fullBtn.setAttribute('aria-label', lbl)
		fullBtn.title = lbl
		fullBtn.setAttribute('aria-pressed', on ? 'true' : 'false')
		closeRpick()
		if (on) { panel.style.width = ''; panel.style.height = '' } else restoreSize()
		if (bottom) setTimeout(function () { list.scrollTop = list.scrollHeight }, 30)
	}
	fullBtn.addEventListener('click', function () { setFull(!isFull) })
	var drag = null
	grip.addEventListener('pointerdown', function (e) {
		if (isFull || e.button > 0) return
		e.preventDefault()
		var r = panel.getBoundingClientRect()
		drag = { x: e.clientX, y: e.clientY, w: r.width, h: r.height }
		try { grip.setPointerCapture(e.pointerId) } catch (er) {}
		root.classList.add('is-resizing')
		closeRpick()
	})
	grip.addEventListener('pointermove', function (e) {
		if (!drag) return
		applySize(drag.w - (e.clientX - drag.x), drag.h - (e.clientY - drag.y), false)
	})
	function endDrag() {
		if (!drag) return
		drag = null
		root.classList.remove('is-resizing')
		var r = panel.getBoundingClientRect()
		applySize(r.width, r.height, true)
	}
	grip.addEventListener('pointerup', endDrag)
	grip.addEventListener('pointercancel', endDrag)
	grip.addEventListener('dblclick', function () { applySize(0, 0, true) })
	grip.addEventListener('keydown', function (e) {
		var d = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key]
		if (!d || isFull) return
		e.preventDefault()
		var r = panel.getBoundingClientRect()
		applySize(r.width + d[0], r.height + d[1], true)
	})
	window.addEventListener('resize', function () { if (!isFull) restoreSize(); placeRpick() })
	restoreSize()

	var addedOnce = false
	function add(incoming) {
		var added = 0, fresh = null
		incoming.forEach(function (m) {
			if (!m || !m.id || seen[m.id] || typeof m.t !== 'string') return
			if (hiddenIds.indexOf(m.id) >= 0) return
			seen[m.id] = 1
			messages.push(m)
			added++
			if (!isOpen && m.u !== myUid()) unread++
			if (addedOnce && m.u !== myUid() && !GIF_RE.test(m.t)) fresh = m
			else if (addedOnce && m.u !== myUid()) fresh = { n: m.n, t: 'GIF' }
		})
		addedOnce = true
		if (!added) return
		if (fresh && window.NTU_AUTH && window.NTU_AUTH.alertNew && myUid()) window.NTU_AUTH.alertNew(t('Студентський чат') + ' · ' + (fresh.n || ''), fresh.t, isOpen)
		messages.sort(function (a, b) { return a.ts - b.ts })
		if (messages.length > 300) messages = messages.slice(-300)
		badge.hidden = !unread
		badge.textContent = unread > 9 ? '9+' : unread
		render()
	}

	/* ---------- storage backends ---------- */
	var backend
	if (DB) {
		backend = {
			remote: true,
			load: function () {
				return fetch(DB + '/chat/messages.json?orderBy=%22$key%22&limitToLast=200').then(function (r) {
					if (!r.ok) throw new Error(r.status)
					return r.json()
				}).then(function (data) {
					return Object.keys(data || {}).map(function (k) {
						var v = data[k]
						return { id: k, n: v.n, t: v.t, ts: v.ts, u: v.u }
					})
				})
			},
			save: function (m) {
				var tk = window.NTU_AUTH && window.NTU_AUTH.remote ? window.NTU_AUTH.token() : Promise.resolve(null)
				return tk.then(function (token) {
					return fetch(DB + '/chat/messages.json' + (token ? '?auth=' + encodeURIComponent(token) : ''), {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ n: m.n, t: m.t, ts: m.ts, u: m.u })
					})
				}).then(function (r) {
					if (!r.ok) throw new Error(r.status)
					return r.json()
				}).then(function (res) { return res.name })
			},
			loadReacts: function () {
				return fetch(DB + '/chat/reactions.json?orderBy=%22$key%22&limitToLast=300').then(function (r) {
					if (!r.ok) throw new Error(r.status)
					return r.json()
				})
			},
			react: function (mid, u, emoji) {
				if (!/^[A-Za-z0-9_-]{1,40}$/.test(mid) || !window.NTU_AUTH) return Promise.reject(new Error('id'))
				return window.NTU_AUTH.token().then(function (token) {
					return fetch(DB + '/chat/reactions/' + mid + '/' + u + '.json?auth=' + encodeURIComponent(token), {
						method: emoji ? 'PUT' : 'DELETE',
						headers: { 'Content-Type': 'application/json' },
						body: emoji ? JSON.stringify(emoji) : undefined
					})
				}).then(function (r) { if (!r.ok) throw new Error(r.status) })
			}
		}
	} else {
		backend = {
			remote: false,
			load: function () {
				try { return Promise.resolve(JSON.parse(ls(KEY_MSGS) || '[]')) } catch (e) { return Promise.resolve([]) }
			},
			save: function (m) {
				var all = []
				try { all = JSON.parse(ls(KEY_MSGS) || '[]') } catch (e) {}
				all.push({ id: m.id, n: m.n, t: m.t, ts: m.ts, u: m.u })
				ls(KEY_MSGS, JSON.stringify(all.slice(-500)))
				return Promise.resolve(m.id)
			},
			loadReacts: function () {
				try { return Promise.resolve(JSON.parse(ls('ntu-chat-reacts') || '{}')) } catch (e) { return Promise.resolve({}) }
			},
			react: function (mid, u, emoji) {
				var all = {}
				try { all = JSON.parse(ls('ntu-chat-reacts') || '{}') } catch (e) {}
				if (!all[mid]) all[mid] = {}
				if (emoji) all[mid][u] = emoji
				else delete all[mid][u]
				ls('ntu-chat-reacts', JSON.stringify(all))
				return Promise.resolve()
			}
		}
		window.addEventListener('storage', function (e) { if (e.key === KEY_MSGS || e.key === 'ntu-chat-reacts') refresh() })
	}

	var netOk = true
	function setStatus(online) {
		if (online !== undefined) netOk = online
		status.textContent = ''
		status.classList.remove('is-typing', 'is-stats')
		status.classList.toggle('is-off', backend.remote && !netOk)
		if (!backend.remote) { status.textContent = t('локальний режим · лише на цьому пристрої'); return }
		if (!netOk) { status.textContent = t('немає зв’язку, пробуємо ще…'); return }
		if (typers.length) {
			status.classList.add('is-typing')
			status.appendChild(el('span', 'chat-dots', ''))
			status.appendChild(document.createTextNode(typingText()))
			return
		}
		if (stats) {
			status.classList.add('is-stats')
			status.appendChild(el('span', 'chat-stat', '👥 ' + stats.total + ' ' + plural(stats.total, t('учасник'), t('учасники'), t('учасників'))))
			status.appendChild(el('span', 'chat-stat chat-stat--on', stats.online + ' ' + t('в мережі')))
			return
		}
		status.textContent = t('на зв’язку')
	}
	function refresh() {
		return backend.load().then(function (list) { setStatus(true); add(list); return loadReacts() }, function () { setStatus(false) })
			.then(function () { if (isOpen) { markSeen(); return loadSeen() } })
	}

	/* ---------- профіль по кліку ---------- */
	function clickable(node, uid, name) {
		node.classList.add('is-clickable')
		node.setAttribute('role', 'button')
		node.tabIndex = 0
		node.setAttribute('aria-label', t('Профіль') + ': ' + name)
		var go = function (e) { e.stopPropagation(); window.NTU_PROFILE.show(uid, node) }
		node.addEventListener('click', go)
		node.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e) } })
	}
	function plural(n, one, few, many) {
		var a = n % 10, b = n % 100
		if (document.documentElement.lang === 'en') return n === 1 ? one : many
		return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many
	}

	/* ---------- учасники та «в мережі» (для тих, хто увійшов) ---------- */
	// stats, statsAt - оголошені вгорі
	function loadStats(force) {
		var A = window.NTU_AUTH
		if (!backend.remote || !A || !A.remote || !me()) return
		if (!force && Date.now() - statsAt < 30000) return
		statsAt = Date.now()
		var since = Date.now() - 150000
		Promise.all([
			A.db('GET', 'users?shallow=true', undefined, true),
			// запит за індексом s; якщо індекс ще не опубліковано - рахуємо з повного списку
			A.db('GET', 'users?orderBy=%22s%22&startAt=' + since, undefined, true).catch(function () { return A.db('GET', 'users', undefined, true) })
		]).then(function (r) {
			var all = r[0] || {}, act = r[1] || {}
			var online = Object.keys(act).filter(function (k) { return act[k] && A.isOnline(act[k].s) }).length
			stats = { total: Object.keys(all).length, online: Math.max(online, 1) }
			setStatus()
		}, function () {})
	}

	/* ---------- «друкує»: учасник оновлює chat/typing/{uid}.c, поки набирає; ми бачимо, у кого значення змінилося ---------- */
	// typers, typingPrev, typingTimer, myTypingAt, myTyping - оголошені вгорі
	function typingText() {
		var n = typers.map(function (x) { return x.n })
		if (n.length === 1) return n[0] + ' ' + t('друкує…')
		if (n.length === 2) return n[0] + ' ' + t('і') + ' ' + n[1] + ' ' + t('друкують…')
		return n.length + ' ' + t('учасники друкують…')
	}
	function typingRow() {
		var r = el('div', 'chat-typing')
		r.setAttribute('aria-hidden', 'true')
		var bub = el('span', 'chat-typing__bubble')
		bub.appendChild(el('i'))
		bub.appendChild(el('i'))
		bub.appendChild(el('i'))
		r.appendChild(bub)
		r.appendChild(el('span', 'chat-typing__who', typingText()))
		return r
	}
	function pollTyping() {
		if (!backend.remote || !isOpen || document.hidden) return
		fetch(DB + '/chat/typing.json').then(function (r) { return r.ok ? r.json() : null }).then(function (d) {
			d = d || {}
			var meId = myUid(), next = []
			if (typingPrev) {
				Object.keys(d).forEach(function (u) {
					var v = d[u]
					if (u === meId || !v || typeof v.n !== 'string' || isProfane(v.n)) return
					if (!typingPrev[u] || typingPrev[u].c !== v.c) next.push({ uid: u, n: v.n.slice(0, 40) })
				})
			}
			typingPrev = d
			var changed = next.map(function (x) { return x.uid }).join() !== typers.map(function (x) { return x.uid }).join()
			typers = next
			if (changed) { setStatus(); render() }
		}, function () {})
	}
	function iAmTyping() {
		var A = window.NTU_AUTH, u = me()
		if (!backend.remote || !A || !u || !canWrite()) return
		if (!msgIn.value.trim() || (A.pref && !A.pref('typing'))) { stopTyping(); return }
		if (Date.now() - myTypingAt < 1500) return
		myTypingAt = Date.now()
		myTyping = true
		A.db('PUT', 'chat/typing/' + u.uid, { n: u.name.slice(0, 40), c: Math.random().toString(36).slice(2, 10) }, true).catch(function () {})
	}
	function stopTyping() {
		var A = window.NTU_AUTH, u = me()
		if (!myTyping || !A || !u) return
		myTyping = false
		myTypingAt = 0
		A.db('DELETE', 'chat/typing/' + u.uid, undefined, true).catch(function () {})
	}

	/* ---------- хто переглянув: chat/seen/{uid} = час останнього переглянутого повідомлення ---------- */
	// seenMap, seenKey, seenWritten - оголошені вгорі
	function seenCount(ts) {
		var meId = myUid(), n = 0
		Object.keys(seenMap).forEach(function (u) { if (u !== meId && typeof seenMap[u] === 'number' && seenMap[u] >= ts) n++ })
		return n
	}
	function markSeen() {
		var A = window.NTU_AUTH, u = me()
		if (!backend.remote || !A || !u || document.hidden || !messages.length) return
		var last = messages[messages.length - 1].ts
		if (last <= seenWritten) return
		seenWritten = last
		A.db('PUT', 'chat/seen/' + u.uid, last, true).catch(function () { seenWritten = 0 })
	}
	function loadSeen() {
		if (!backend.remote) return
		return fetch(DB + '/chat/seen.json').then(function (r) { return r.ok ? r.json() : null }).then(function (d) {
			var k = JSON.stringify(d || {})
			if (k === seenKey) return
			seenKey = k
			seenMap = d || {}
			render()
		}, function () {})
	}

	function canWrite() { var u = me(); return !!(u && u.verified !== false) }
	function syncGate() {
		var u = me()
		var ok = canWrite()
		form.hidden = !ok
		gate.hidden = ok
		gateText.textContent = u && !ok
			? t('Підтвердьте пошту, щоб писати в чаті: ми надіслали вам лист із посиланням. Після підтвердження оновіть сторінку.')
			: t('Щоб писати в чаті, потрібно увійти або зареєструватися. Читати повідомлення можна без акаунта.')
		gateBtns.hidden = !!u
		asLine.textContent = u ? t('Ви пишете як') + ' ' + u.name : ''
		if (u) loadDir()
		render()
	}
	if (window.NTU_AUTH) window.NTU_AUTH.onChange(syncGate)
	else { form.hidden = true }

	/* ---------- events ---------- */
	function open(kind) {
		isOpen = true
		document.dispatchEvent(new CustomEvent('ntu:panel', { detail: 'chat' }))
		typingPrev = null
		loadStats(true)
		markSeen()
		loadSeen()
		clearInterval(typingTimer)
		typingTimer = setInterval(function () { pollTyping(); loadStats() }, 2000)
		panel.hidden = false
		root.classList.add('is-open')
		unread = 0
		badge.hidden = true
		list.scrollTop = list.scrollHeight
		if (me() && kind === 'help' && !msgIn.value) msgIn.value = t('Потрібна допомога з предметом: ')
		setTimeout(function () {
			if (!canWrite()) { if (!me()) gLogin.focus(); return }
			msgIn.focus()
			msgIn.setSelectionRange(msgIn.value.length, msgIn.value.length)
		}, 50)
	}
	function shut(noFocus) {
		closePops()
		if (window.NTU_CHATMEMBERS) window.NTU_CHATMEMBERS.close(true)
		if (CP) CP.closePicker()
		hideMentions()
		isOpen = false
		clearInterval(typingTimer)
		typers = []
		stopTyping()
		setStatus()
		closeRpick()
		if (isFull) setFull(false)
		panel.hidden = true
		root.classList.remove('is-open')
		if (noFocus !== true) fab.focus()
	}
	// відкрили AI Student - чат згортається
	document.addEventListener('ntu:panel', function (e) { if (e.detail !== 'chat' && isOpen) shut(true) })
	fab.addEventListener('click', function () { isOpen ? shut() : open() })
	close.addEventListener('click', shut)
	document.addEventListener('keydown', function (e) {
		if (e.key !== 'Escape' || !isOpen) return
		if (window.NTU_CHATMEMBERS && window.NTU_CHATMEMBERS.isOpen()) { window.NTU_CHATMEMBERS.close(); return }
		if (!rpick.hidden) { var mid = rpickMid; closeRpick(); var mb = mid && byMid(mid); var ab = mb && mb.querySelector('.chat-msg__add'); if (ab) ab.focus(); return }
		if (!mentionBox.hidden) { hideMentions(); return }
		if (!emojiPop.hidden || !gifPop.hidden) { var b = !gifPop.hidden ? gifBtn : emojiBtn; closePops(); b.focus(); return }
		if (isFull) { setFull(false); fullBtn.focus(); return }
		shut()
	})

	/* --- емодзі / GIF: відкриття панелей --- */
	function closePops() {
		emojiPop.hidden = true
		gifPop.hidden = true
		emojiBtn.setAttribute('aria-expanded', 'false')
		gifBtn.setAttribute('aria-expanded', 'false')
		emojiBtn.classList.remove('is-active')
		gifBtn.classList.remove('is-active')
	}
	function togglePop(pop, btn) {
		var willOpen = pop.hidden
		closePops()
		hideMentions()
		if (!willOpen) return
		pop.hidden = false
		btn.setAttribute('aria-expanded', 'true')
		btn.classList.add('is-active')
		if (pop === gifPop && gifSearch) gifSearch.focus()
	}
	emojiBtn.addEventListener('click', function () { togglePop(emojiPop, emojiBtn) })
	gifBtn.addEventListener('click', function () { togglePop(gifPop, gifBtn) })
	document.addEventListener('click', function (e) {
		if (emojiPop.hidden && gifPop.hidden) return
		if (emojiPop.contains(e.target) || gifPop.contains(e.target) || emojiBtn.contains(e.target) || gifBtn.contains(e.target)) return
		closePops()
	})

	function insertAtCursor(s) {
		var v = msgIn.value
		var a = msgIn.selectionStart != null ? msgIn.selectionStart : v.length
		var b = msgIn.selectionEnd != null ? msgIn.selectionEnd : v.length
		if (v.length - (b - a) + s.length > MAX_LEN) { note.textContent = t('Повідомлення занадто довге (максимум 500 символів).'); return }
		msgIn.value = v.slice(0, a) + s + v.slice(b)
		var pos = a + s.length
		msgIn.focus()
		msgIn.setSelectionRange(pos, pos)
	}

	/* --- автопідказки @тегів --- */
	var mIdx = 0, mItems = [], mStart = -1
	function hideMentions() {
		mentionBox.hidden = true
		mentionBox.textContent = ''
		mItems = []
		mStart = -1
		msgIn.removeAttribute('aria-activedescendant')
	}
	function highlightMention(i) {
		mIdx = (i + mItems.length) % mItems.length
		Array.prototype.forEach.call(mentionBox.children, function (li, k) {
			li.classList.toggle('is-active', k === mIdx)
			li.setAttribute('aria-selected', k === mIdx ? 'true' : 'false')
		})
		msgIn.setAttribute('aria-activedescendant', 'chatMention' + mIdx)
	}
	function pickMention(i) {
		var u = mItems[i]
		if (!u) return
		var v = msgIn.value, caret = msgIn.selectionStart
		var ins = '@' + u.tg + ' '
		if (v.length - (caret - mStart) + ins.length > MAX_LEN) { hideMentions(); return }
		msgIn.value = v.slice(0, mStart) + ins + v.slice(caret)
		var pos = mStart + ins.length
		hideMentions()
		msgIn.focus()
		msgIn.setSelectionRange(pos, pos)
	}
	function updateMentions() {
		var caret = msgIn.selectionStart
		var before = msgIn.value.slice(0, caret)
		var m = /(^|[^A-Za-z0-9_@.])@([A-Za-z0-9_]{0,32})$/.exec(before)
		if (!m) { hideMentions(); return }
		loadDir()
		var q = m[2].toLowerCase()
		mStart = caret - m[2].length - 1
		var meId = myUid()
		mItems = dir.filter(function (u) {
			return u.uid !== meId && (!q || u.tg.toLowerCase().indexOf(q) === 0 || u.n.toLowerCase().indexOf(q) >= 0)
		}).slice(0, 6)
		mentionBox.textContent = ''
		if (!mItems.length) {
			if (dirState === 2 && !q) {
				var li0 = el('li', 'chat-mentions__empty', t('Поки ніхто не вказав Telegram у профілі.'))
				mentionBox.appendChild(li0)
				mentionBox.hidden = false
			} else mentionBox.hidden = true
			return
		}
		closePops()
		mItems.forEach(function (u, i) {
			var li = el('li', 'chat-mentions__item')
			li.id = 'chatMention' + i
			li.setAttribute('role', 'option')
			var av
			if (u.a) { av = el('img', 'chat-avatar'); av.src = u.a; av.alt = '' } else {
				av = el('span', 'chat-avatar chat-avatar--ph', window.NTU_AUTH ? window.NTU_AUTH.initials(u.n || u.tg) : (u.n || u.tg).charAt(0))
				av.style.background = colorFor(u.n || u.tg)
			}
			li.appendChild(av)
			var tx = el('span', 'chat-mentions__text')
			tx.appendChild(el('strong', null, '@' + u.tg))
			if (u.n) tx.appendChild(el('span', null, u.n))
			li.appendChild(tx)
			li.addEventListener('mousedown', function (e) { e.preventDefault(); pickMention(i) })
			mentionBox.appendChild(li)
		})
		mentionBox.hidden = false
		highlightMention(0)
	}
	msgIn.addEventListener('input', updateMentions)
	msgIn.addEventListener('input', iAmTyping)
	msgIn.addEventListener('blur', function () { if (!msgIn.value.trim()) stopTyping() })
	msgIn.addEventListener('click', updateMentions)
	msgIn.addEventListener('blur', function () { setTimeout(hideMentions, 150) })
	msgIn.addEventListener('keydown', function (e) {
		if (mentionBox.hidden || !mItems.length) return
		if (e.key === 'ArrowDown') { e.preventDefault(); highlightMention(mIdx + 1) }
		else if (e.key === 'ArrowUp') { e.preventDefault(); highlightMention(mIdx - 1) }
		else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickMention(mIdx) }
	})
	document.addEventListener('click', function (e) {
		var o = e.target.closest && e.target.closest('[data-open-chat]')
		if (o) { e.preventDefault(); open(o.getAttribute('data-open-chat')) }
	})

	// Спільна відправка: звичайний текст або GIF (isGif). Повертає Promise<boolean>.
	function deliver(text, isGif) {
		var u = me()
		note.textContent = ''
		if (!u || !canWrite()) { note.textContent = t('Щоб писати в чаті, потрібно увійти й підтвердити пошту.'); return Promise.resolve(false) }
		var name = u.name
		if (!text) return Promise.resolve(false)
		if ((!isGif && isProfane(text)) || isProfane(name)) { note.textContent = t('Нецензурна лексика заборонена. Будь ласка, спілкуйтеся ввічливо.'); return Promise.resolve(false) }
		if (Date.now() - lastSent < 2000) { note.textContent = t('Не так швидко - зачекайте секунду'); return Promise.resolve(false) }
		lastSent = Date.now()
		var m = { n: name.slice(0, 40), t: text.slice(0, MAX_LEN), ts: Date.now(), u: u.uid, id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }
		send.disabled = true
		return backend.save(m).then(function (id) {
			m.id = id || m.id
			stopTyping()
			add([m])
			list.scrollTop = list.scrollHeight
			return true
		}, function () {
			note.textContent = t('Не вдалося надіслати. Перевірте з’єднання й спробуйте ще раз.')
			return false
		}).then(function (ok) { send.disabled = false; return ok })
	}
	function sendGif(id) {
		if (!/^[A-Za-z0-9]{6,40}$/.test(id)) return
		closePops()
		deliver('[gif:' + id + ']', true).then(function () { msgIn.focus() })
	}
	form.addEventListener('submit', function (e) {
		e.preventDefault()
		hideMentions()
		closePops()
		var text = msgIn.value.trim().replace(/\s+/g, ' ')
		if (!text) { note.textContent = t('Напишіть повідомлення або оберіть GIF.'); msgIn.focus(); return }
		deliver(text, false).then(function (ok) {
			if (ok) msgIn.value = ''
			msgIn.focus()
		})
	})

	function mount() {
		document.body.appendChild(root)
		setStatus(true)
		refresh()
		setInterval(function () { if (!document.hidden) refresh() }, POLL_MS)
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
	else mount()
})()
