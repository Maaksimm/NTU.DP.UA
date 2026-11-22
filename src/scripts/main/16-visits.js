/* ===== Статистика відвідувачів (api/visits.php): один запит на перегляд сторінки, без cookies =====
   Надсилаємо лише шлях сторінки, джерело переходу (referrer / utm_source) і ширину екрана.
   Для залогіненого користувача додається ID-токен - сервер перевіряє його і записує акаунт.
   Працює тільки на ntu.dp.ua (не на localhost) і не для автоматизованих браузерів. */
;(function () {
	if (!/^(www\.)?ntu\.dp\.ua$/.test(location.hostname) || navigator.webdriver) return
	var sent = false
	function send(tk) {
		if (sent) return
		sent = true
		var q = new URLSearchParams(location.search)
		var body = { p: location.pathname || '/', r: document.referrer || '', s: q.get('utm_source') || '', w: (window.screen && screen.width) || 0 }
		if (tk) body.tk = tk
		try {
			fetch('api/visits.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true, credentials: 'omit' }).catch(function () {})
		} catch (e) {}
	}
	function start() {
		var A = window.NTU_AUTH
		// дати auth.js відновити сесію; токен - лише якщо користувач справді увійшов
		setTimeout(function () {
			if (A && A.remote && A.user && A.token) A.token().then(send, function () { send() })
			else send()
		}, 1800)
		// пішов зі сторінки раніше - фіксуємо перегляд без токена
		window.addEventListener('pagehide', function () { send() })
	}
	if (document.readyState === 'complete') start()
	else window.addEventListener('load', start)
})()
