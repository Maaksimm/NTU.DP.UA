/* AI Student - помічник сайту: коротка розмова, погода та навігація по World Students.
   1) Погода - Open-Meteo (безкоштовно, без ключа, у браузері); дата/час і приклади - локально.
   2) Якщо на сервері налаштовано ключ (api/ai.php -> Claude), відповідає справжня мовна модель зі знаннями про сайт.
   3) Інакше - локальний модуль: розмовні відповіді + база знань (src/data/ai-kb.json) + розділи сторінок
      (assets/data/ai-index.json генерує tools/build.mjs).
   Історія розмови - лише в sessionStorage цієї вкладки. Кнопка - поруч із кнопкою чату (подія ntu:panel). */
;(function () {
	'use strict'
	if (window.NTU_AI) return
	var LOG_KEY = 'ntu-ai-log'
	function t(s) { return typeof T === 'function' ? T(s) : s }
	function en() { return document.documentElement.lang === 'en' }
	function el(tag, cls, text) {
		var e = document.createElement(tag)
		if (cls) e.className = cls
		if (text != null) e.textContent = text
		return e
	}

	/* ---------- пошук ---------- */
	var STOP = ('і й та або а але чи що як де коли хто це цей ця ці то той та ті у в на з із зі до від для про по при за над під між без через ' +
		'мені мене мій моя моє мої ти тебе твій ви вас ваш він вона воно вони їх його її є був була було були буде можна треба потрібно ' +
		'не ні так ще вже лише тільки дуже теж також же б би ж ось там тут скільки який яка яке які чому навіщо розкажи скажи підкажи будь ласка ' +
		'the a an is are was of to in on for and or what how where when who which do does can i you me my your it this that about please tell').split(' ')
	var STOPSET = {}
	STOP.forEach(function (w) { STOPSET[w] = 1 })
	function words(s) {
		return String(s || '').toLowerCase().replace(/[ʼ’`']/g, '').replace(/ё/g, 'е').split(/[^a-zа-яіїєґ0-9]+/i).filter(function (w) { return w && !STOPSET[w] })
	}
	function stem(w) { return w.length <= 5 ? w : w.slice(0, w.length - 2) }
	function stems(s) { return words(s).map(stem) }
	function same(a, b) {
		if (a === b) return true
		var s = a.length < b.length ? a : b, l = s === a ? b : a
		return s.length >= 4 && l.indexOf(s) === 0
	}
	function has(list, w) { for (var i = 0; i < list.length; i++) if (same(list[i], w)) return true; return false }

	var data = null, loading = null, idf = {}
	function load() {
		if (data) return Promise.resolve(data)
		if (loading) return loading
		loading = fetch('assets/data/ai-index.json', { cache: 'no-cache' }).then(function (r) {
			if (!r.ok) throw new Error(r.status)
			return r.json()
		}).then(function (d) {
			d.kb.forEach(function (e) { e._q = e.q.map(function (p) { return { s: stems(p), raw: words(p).join(' ') } }) })
			var df = {}
			d.pages.forEach(function (c) {
				c._t = stems(c.t + ' ' + (c.p || ''))
				c._x = stems(c.x)
				var seen = {}
				c._t.concat(c._x).forEach(function (w) { if (!seen[w]) { seen[w] = 1; df[w] = (df[w] || 0) + 1 } })
			})
			var N = d.pages.length
			Object.keys(df).forEach(function (w) { idf[w] = Math.log(1 + N / df[w]) })
			data = d
			return d
		}, function (e) { loading = null; throw e })
		return loading
	}
	function idfOf(w) {
		if (idf[w]) return idf[w]
		var best = 0
		for (var k in idf) if (same(k, w) && idf[k] > best) best = idf[k]
		return best || 1
	}
	function scoreKb(q, qraw) {
		var best = null
		data.kb.forEach(function (e) {
			// найкраща фраза запису + невеликий бонус за інші збіги (щоб загальні слова на кшталт «сайт» не переважали)
			var sc = 0, sum = 0
			e._q.forEach(function (p) {
				if (!p.s.length) return
				var hit = p.s.filter(function (w) { return has(q, w) }).length, v = 0
				if (hit === p.s.length) v = 1.5 + 1.5 * p.s.length + (qraw.indexOf(p.raw) >= 0 ? 1 : 0)
				else if (hit && p.s.length > 1) v = 0.6 * hit
				sum += v
				if (v > sc) sc = v
			})
			sc += 0.25 * (sum - sc)
			if (sc > 0 && (!best || sc > best.sc)) best = { e: e, sc: sc }
		})
		return best
	}
	function scorePages(q) {
		var res = []
		data.pages.forEach(function (c) {
			var sc = 0, matched = 0
			q.forEach(function (w) {
				var inT = has(c._t, w), inX = has(c._x, w)
				if (inT || inX) { matched++; sc += idfOf(w) * (inT ? 2.2 : 0) + idfOf(w) * (inX ? 1 : 0) }
			})
			if (!matched) return
			sc *= matched / q.length
			if (!c.x || c.u.indexOf('#') < 0) sc *= 1.05
			res.push({ c: c, sc: sc })
		})
		res.sort(function (a, b) { return b.sc - a.sc })
		var out = [], pagesSeen = {}
		for (var i = 0; i < res.length && out.length < 3; i++) {
			var base = res[i].c.u.split('#')[0]
			if (pagesSeen[base]) continue
			pagesSeen[base] = 1
			out.push(res[i])
		}
		return out
	}
	function answer(question) {
		var q = stems(question), qraw = words(question).join(' ')
		if (!q.length) return { text: en() ? 'Ask me a question in words - for example, “how to apply?”' : 'Напишіть питання словами - наприклад, «як вступити?»' }
		var kb = scoreKb(q, qraw)
		var pages = scorePages(q)
		var top = pages[0] && pages[0].sc
		if (kb && kb.sc >= 3) {
			var links = (kb.e.l || []).slice()
			var extra = pages.filter(function (p) { return p.sc > 4 && !links.some(function (l) { return l[1].split('#')[0] === p.c.u.split('#')[0] }) }).slice(0, 2)
			return { text: en() && kb.e.en ? kb.e.en : kb.e.a, links: links, pages: extra, also: true }
		}
		if (pages.length && top > 2.2) {
			return { text: en() ? 'Here is what I found on the site:' : 'Ось що я знайшов на сайті:', pages: pages }
		}
		if (kb) return { text: en() && kb.e.en ? kb.e.en : kb.e.a, links: kb.e.l || [] }
		return {
			text: en()
				? 'I could not find an answer on this site. Try rephrasing the question, open the site map or the university news.'
				: 'Не знайшов відповіді на цьому сайті. Спробуйте переформулювати питання, відкрийте мапу сайту або новини університету.',
			links: [['Мапа сайту', 'sections.html'], ['Новини університету', 'news.html']]
		}
	}

	/* ---------- розмова: короткі відповіді без сервера ---------- */
	var NAME_KEY = 'ntu-ai-name'
	function pick(a) { return a[Math.floor(Math.random() * a.length)] }
	function userName() { try { return sessionStorage.getItem(NAME_KEY) || '' } catch (e) { return '' } }
	function low(s) { return String(s || '').toLowerCase().replace(/[ʼ’`]/g, "'").replace(/\s+/g, ' ').trim() }
	var UA = {
		how: ['Усе чудово, дякую! Сьогодні вже допоміг кільком студентам знайти потрібні сторінки. А як ваші справи?', 'Добре! Працюю без перерв на каву ☕ А у вас як справи?', 'Відмінно, особливо коли є з ким поговорити 🙂 Як ваш день?'],
		good: ['Радий чути! 🙌 Якщо треба щось знайти на сайті - питайте.', 'Супер! Гарного навчання й легкої сесії 🎓', 'Чудово! Чим можу допомогти?'],
		bad: ['Мені шкода, що так 😔 Зробіть коротку перерву, випийте води й прогуляйтеся 10 хвилин - це справді допомагає. А якщо хочеться поговорити з іншими студентами, відкрийте чат праворуч унизу.', 'Буває всяке, і це нормально. Спробуйте розбити справи на маленькі кроки й почати з найпростішого. Якщо тиснуть дедлайни - зазирніть на сторінку exam-prep.html, там є поради з підготовки.'],
		who: 'Я AI Student - помічник студентської платформи World Students НТУ «Дніпровська політехніка». Можу трохи поговорити, підказати погоду, пожартувати і, головне, допомогти знайти потрібне на сайті: вступ, навчання, розклад, рейтинг, акаунт.',
		name: 'Мене звати AI Student. А вас?',
		can: 'Я вмію: підтримати коротку розмову, показати погоду (напишіть, наприклад, «погода в Дніпрі» або «погода завтра»), сказати дату й час, порахувати приклад, розповісти жарт, а ще - знайти потрібний розділ сайту й розповісти, як влаштована платформа.',
		creator: 'Мене створила команда студентів - авторів World Students. Усіх їх можна побачити на сторінці authors.html.',
		age: 'Я зовсім молодий - з’явився у 2026 році разом з оновленою платформою World Students. А університету, до речі, вже понад 125 років: його історія почалася в 1899-му.',
		love: ['Дякую, дуже приємно! 😊', 'Ви теж класні! 💙', 'Ох, засоромили 😊 Дякую!'],
		rude: 'Розумію, що буває неприємно. Я намагаюся допомогти - спробуйте переформулювати питання, і я зроблю все можливе.',
		bored: 'Нудно? Можна зазирнути в студентський чат праворуч унизу, переглянути події на events.html, фото й відео на media.html або перевірити, хто зараз у рейтингу на rating.html.',
		lazy: ['Маленький крок краще, ніж жодного: поставте таймер на 25 хвилин і просто почніть. Після - 5 хвилин відпочинку. Це техніка «Помодоро», і вона працює 🍅', 'Згадайте, навіщо ви вступили - і зробіть сьогодні хоча б одну маленьку справу для цього. Поради з підготовки є на exam-prep.html.'],
		jokes: ['Студент на іспиті: «Можна я відповім своїми словами?» Викладач: «Можна, але бажано - правильними» 😄', 'Чому програмісти плутають Хелловін і Різдво? Бо Oct 31 = Dec 25 🎃🎄', 'Сесія - це коли за три дні вивчаєш те, що не встиг за пів року. І найдивніше - іноді виходить 😅', '- Ти готовий до іспиту?\n- Морально - так. Фізично - теж. Інтелектуально - є питання 🙂'],
		meName: function (n) { return 'Приємно познайомитися, ' + n + '! 🙂 Чим можу допомогти?' },
		whoMe: function (n) { return n ? 'Вас звати ' + n + ' 🙂' : 'Ви ще не казали, як вас звати. Напишіть, наприклад, «мене звати Оля».' },
		math: function (e, r) { return e + ' = ' + r },
		time: function (d) { return 'Зараз ' + d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/\.$/, '') + '.' }
	}
	var EN = {
		how: ['All good, thanks! I have already helped a few students today. How are you?', 'Great! Working without coffee breaks ☕ How are you doing?'],
		good: ['Glad to hear it! 🙌 Ask me if you need anything on the site.', 'Awesome! Good luck with your studies 🎓'],
		bad: ['Sorry to hear that 😔 Take a short break, drink some water and walk for 10 minutes - it really helps. If you want to talk to other students, open the chat in the bottom-right corner.'],
		who: 'I am AI Student, the assistant of the World Students platform of Dnipro University of Technology. I can chat a bit, tell you the weather, tell a joke and, most importantly, help you find things on the site.',
		name: 'My name is AI Student. And yours?',
		can: 'I can chat, show the weather (try “weather in Dnipro” or “weather tomorrow”), tell the date and time, do simple maths, tell a joke and find the right section of the site.',
		creator: 'I was made by the student team behind World Students - see authors.html.',
		age: 'I am very young - I appeared in 2026 with the new World Students platform. The university itself dates back to 1899.',
		love: ['Thank you, that is very kind! 😊', 'You are great too! 💙'],
		rude: 'I understand it can be frustrating. I am trying to help - try rephrasing the question.',
		bored: 'Bored? Check the student chat, events.html, media.html or see who is on top at rating.html.',
		lazy: ['Set a 25-minute timer and just start, then rest for 5 minutes - the Pomodoro technique works 🍅'],
		jokes: ['Why do programmers mix up Halloween and Christmas? Because Oct 31 = Dec 25 🎃🎄', 'An exam session is when you learn in three days what you missed in half a year 😅'],
		meName: function (n) { return 'Nice to meet you, ' + n + '! 🙂 How can I help?' },
		whoMe: function (n) { return n ? 'Your name is ' + n + ' 🙂' : 'You have not told me your name yet.' },
		math: function (e, r) { return e + ' = ' + r },
		time: function (d) { return 'It is ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '.' }
	}
	function L() { return en() ? EN : UA }
	function calc(s) {
		var m = /^(?:скільки буде|порахуй|обчисли|what is|calculate)?\s*([\d\s+\-*/().,^]+?)\s*=?\s*\??$/i.exec(s)
		if (!m || !/\d\s*[+\-*/^]\s*[\d(]/.test(m[1])) return null
		var expr = m[1].replace(/,/g, '.').replace(/\^/g, '**').trim()
		if (!/^[\d\s+\-*/().]+$/.test(expr.replace(/\*\*/g, '*'))) return null
		try {
			var r = Function('"use strict";return (' + expr + ')')()
			if (typeof r !== 'number' || !isFinite(r)) return null
			return L().math(m[1].trim(), Math.round(r * 1e8) / 1e8)
		} catch (e) { return null }
	}
	// повертає {text} або null, якщо це не «розмова», а питання про сайт
	function smallTalk(raw) {
		var s = low(raw), D = L(), n
		var c = calc(s)
		if (c) return { text: c }
		if (/^(привіт|вітаю|добрий (день|вечір|ранок)|доброго (ранку|дня|вечора)|хай|здоров|салют|hello|hi|hey|good (morning|evening|afternoon))[!.,)🙂👋 ]*$/u.test(s)) {
			var un = userName()
			return { text: en() ? 'Hi' + (un ? ', ' + un : '') + '! 👋 How can I help? We can just chat, too.' : 'Привіт' + (un ? ', ' + un : '') + '! 👋 Чим можу допомогти? Можемо й просто поговорити.' }
		}
		if ((n = /(?:мене звати|моє ім'я|my name is|call me)\s+([a-zа-яіїєґ'-]{2,20})/i.exec(s))) {
			var nm = n[1].charAt(0).toUpperCase() + n[1].slice(1)
			try { sessionStorage.setItem(NAME_KEY, nm) } catch (e) {}
			return { text: D.meName(nm) }
		}
		if (/як мене звати|ти знаєш моє ім'я|what is my name|what's my name/.test(s)) return { text: D.whoMe(userName()) }
		if (/як (ти|у тебе|твої|твоі)? ?(справи|ся маєш|життя|настрій)|як ти\b|як справи|how are you|how's it going|what's up|як воно/.test(s)) return { text: pick(D.how) }
		if (/^(у мене |в мене |я )?(теж |також |все )?(добре|норм|нормально|чудово|супер|відмінно|класно|непогано|good|fine|great|ok|окей)[!. 🙂]*$/.test(s)) return { text: pick(D.good) }
		if (/(погано|сумно|сумую|втомив|втомл|стрес|депрес|не дуже|важко|i'?m (sad|tired)|feel bad)/.test(s)) return { text: pick(D.bad), links: [['Підготовка до екзаменів', 'exam-prep.html']] }
		if (/як тебе звати|твоє ім'я|як тебе називати|what is your name|your name/.test(s)) return { text: D.name }
		if (/хто тебе (створив|зробив|розробив)|хто твій (автор|творець)|who (made|created|built) you/.test(s)) return { text: D.creator, links: [['Автори', 'authors.html']] }
		if (/хто ти|що ти так|ти (бот|людина|робот|ші|штучний)|who are you|are you (a )?(bot|human|robot)|what are you/.test(s)) return { text: D.who }
		if (/що (ти )?(вмієш|можеш)|чим (ти )?(можеш )?допомогти|що ти робиш|what can you do|how can you help/.test(s)) return { text: D.can }
		if (/скільки тобі років|твій вік|how old are you/.test(s)) return { text: D.age }
		if (/жарт|анекдот|розсміши|смішн|joke|make me laugh/.test(s)) return { text: pick(D.jokes) }
		if (/котра (зараз )?година|скільки (зараз )?час|яке (сьогодні )?число|яка (сьогодні )?дата|який (сьогодні )?день|what time|what day|today's date/.test(s)) return { text: D.time(new Date()) }
		if (/ти (класний|крутий|молодець|розумний|кращий|найкращий|милий)|люблю тебе|ти мені подобаєшся|you('re| are) (cool|great|awesome|smart)|i love you|good bot/.test(s)) return { text: pick(D.love) }
		if (/(дурн|тупий|тупа|ідіот|бовдур|stupid|idiot|dumb)/.test(s)) return { text: D.rude }
		if (/нудно|нема чого робити|bored/.test(s)) return { text: D.bored }
		if (/лінь|лінуюсь|не хочу вчит|мотивац|motivat|lazy/.test(s)) return { text: pick(D.lazy) }
		return null
	}

	/* ---------- погода: Open-Meteo (безкоштовно, без ключа) ---------- */
	var LOC = { 'дніпрі': 'Дніпро', 'києві': 'Київ', 'львові': 'Львів', 'харкові': 'Харків', 'одесі': 'Одеса', 'запоріжжі': 'Запоріжжя', 'полтаві': 'Полтава', 'вінниці': 'Вінниця', 'черкасах': 'Черкаси', 'чернігові': 'Чернігів', 'сумах': 'Суми', 'житомирі': 'Житомир', 'ужгороді': 'Ужгород', 'луцьку': 'Луцьк', 'рівному': 'Рівне', 'тернополі': 'Тернопіль', 'хмельницькому': 'Хмельницький', 'миколаєві': 'Миколаїв', 'херсоні': 'Херсон', 'кривому розі': 'Кривий Ріг', 'кам\'янському': 'Кам\'янське', 'павлограді': 'Павлоград', 'новомосковську': 'Самар', 'франківську': 'Івано-Франківськ', 'івано-франківську': 'Івано-Франківськ', 'чернівцях': 'Чернівці', 'кропивницькому': 'Кропивницький', 'варшаві': 'Варшава', 'берліні': 'Берлін', 'лондоні': 'Лондон', 'парижі': 'Париж', 'празі': 'Прага', 'відні': 'Відень' }
	var WMO = {
		uk: { 0: 'ясно ☀️', 1: 'переважно ясно 🌤️', 2: 'мінлива хмарність ⛅', 3: 'хмарно ☁️', 45: 'туман 🌫️', 48: 'паморозь і туман 🌫️', 51: 'легка мряка 🌦️', 53: 'мряка 🌦️', 55: 'сильна мряка 🌧️', 56: 'крижана мряка 🌧️', 57: 'крижана мряка 🌧️', 61: 'невеликий дощ 🌦️', 63: 'дощ 🌧️', 65: 'сильний дощ 🌧️', 66: 'крижаний дощ 🌧️', 67: 'крижаний дощ 🌧️', 71: 'невеликий сніг 🌨️', 73: 'сніг 🌨️', 75: 'сильний снігопад ❄️', 77: 'снігова крупа 🌨️', 80: 'короткочасний дощ 🌦️', 81: 'зливи 🌧️', 82: 'сильні зливи ⛈️', 85: 'снігопад 🌨️', 86: 'сильний снігопад ❄️', 95: 'гроза ⛈️', 96: 'гроза з градом ⛈️', 99: 'гроза з градом ⛈️' },
		en: { 0: 'clear ☀️', 1: 'mainly clear 🌤️', 2: 'partly cloudy ⛅', 3: 'overcast ☁️', 45: 'fog 🌫️', 48: 'rime fog 🌫️', 51: 'light drizzle 🌦️', 53: 'drizzle 🌦️', 55: 'dense drizzle 🌧️', 61: 'light rain 🌦️', 63: 'rain 🌧️', 65: 'heavy rain 🌧️', 71: 'light snow 🌨️', 73: 'snow 🌨️', 75: 'heavy snow ❄️', 80: 'rain showers 🌦️', 81: 'rain showers 🌧️', 82: 'violent showers ⛈️', 95: 'thunderstorm ⛈️', 96: 'thunderstorm with hail ⛈️', 99: 'thunderstorm with hail ⛈️' }
	}
	function wmo(code) { var m = WMO[en() ? 'en' : 'uk']; return m[code] || m[Math.floor(code / 10) * 10] || (en() ? 'variable' : 'мінлива погода') }
	function weatherQuery(raw) {
		var s = low(raw)
		if (!/погод|температур|прогноз|градус|парасол|дощ буде|чи буде дощ|холодно на вулиці|тепло на вулиці|weather|forecast|temperature/.test(s)) return null
		var day = /післязавтра|day after tomorrow/.test(s) ? 2 : /завтра|tomorrow/.test(s) ? 1 : 0
		var m = /(?:^|\s)(?:в|у|во|in|for)\s+([a-zа-яіїєґ'][a-zа-яіїєґ' -]{1,30}?)(?:\s+(?:завтра|сьогодні|післязавтра|зараз|today|tomorrow|now))?[?!.]*$/i.exec(s)
		var city = m ? m[1].trim() : ''
		if (/^(місті|городі|нас|мене|дніпрі|дніпро)$/.test(city)) city = city.indexOf('дніпр') === 0 ? 'Дніпро' : ''
		return { city: city, day: day }
	}
	function geo(name) {
		var tries = [], c = name
		if (LOC[c]) tries.push(LOC[c])
		tries.push(c)
		if (/ові$|еві$|єві$/.test(c)) tries.push(c.slice(0, -3), c.slice(0, -3).replace(/и$/, 'ів'))
		if (/і$/.test(c)) tries.push(c.slice(0, -1) + 'о', c.slice(0, -1) + 'а', c.slice(0, -1) + 'я', c.slice(0, -1))
		if (/ах$|ях$/.test(c)) tries.push(c.slice(0, -2) + 'и', c.slice(0, -2) + 'і')
		if (/ому$/.test(c)) tries.push(c.slice(0, -3) + 'ий', c.slice(0, -3) + 'е')
		if (/у$/.test(c)) tries.push(c.slice(0, -1))
		var seen = {}
		tries = tries.filter(function (x) { x = x.toLowerCase(); if (!x || seen[x]) return false; seen[x] = 1; return true }).slice(0, 5)
		var i = 0
		function next() {
			if (i >= tries.length) return Promise.resolve(null)
			var q = tries[i++]
			return fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=' + (en() ? 'en' : 'uk') + '&name=' + encodeURIComponent(q))
				.then(function (r) { return r.json() }).then(function (d) { return d && d.results && d.results[0] ? d.results[0] : next() })
		}
		return next()
	}
	function weather(w) {
		var place = w.city ? geo(w.city) : Promise.resolve({ name: en() ? 'Dnipro' : 'Дніпро', latitude: 48.4647, longitude: 35.0462 })
		return place.then(function (p) {
			if (!p) return { text: en() ? 'I could not find that city. Try writing it like “weather in Kyiv”.' : 'Не знайшов такого міста. Спробуйте, наприклад, «погода в Києві» або «погода Львів».' }
			var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + p.latitude + '&longitude=' + p.longitude +
				'&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
				'&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3&wind_speed_unit=ms'
			return fetch(url).then(function (r) { return r.json() }).then(function (d) {
				var r = function (x) { return Math.round(x) }
				var dl = d.daily, i = w.day
				var where = p.name + (p.country && !/^(Україна|Ukraine)$/.test(p.country) ? ', ' + p.country : '')
				var text
				if (i === 0 && d.current) {
					var cu = d.current
					text = en()
						? where + ' now: ' + r(cu.temperature_2m) + '°C (feels like ' + r(cu.apparent_temperature) + '°C), ' + wmo(cu.weather_code) + ', wind ' + r(cu.wind_speed_10m) + ' m/s, humidity ' + cu.relative_humidity_2m + '%. Today ' + r(dl.temperature_2m_min[0]) + '…' + r(dl.temperature_2m_max[0]) + '°C, chance of rain ' + (dl.precipitation_probability_max[0] || 0) + '%.'
						: where + ' зараз: ' + r(cu.temperature_2m) + '°C (відчувається як ' + r(cu.apparent_temperature) + '°C), ' + wmo(cu.weather_code) + ', вітер ' + r(cu.wind_speed_10m) + ' м/с, вологість ' + cu.relative_humidity_2m + '%. Сьогодні ' + r(dl.temperature_2m_min[0]) + '…' + r(dl.temperature_2m_max[0]) + '°C, імовірність опадів ' + (dl.precipitation_probability_max[0] || 0) + '%.'
				} else {
					var when = en() ? (i === 1 ? 'Tomorrow' : 'The day after tomorrow') : (i === 1 ? 'Завтра' : 'Післязавтра')
					text = when + ' (' + where + '): ' + r(dl.temperature_2m_min[i]) + '…' + r(dl.temperature_2m_max[i]) + '°C, ' + wmo(dl.weather_code[i]) + (en() ? ', chance of rain ' : ', імовірність опадів ') + (dl.precipitation_probability_max[i] || 0) + '%.'
				}
				var rain = (dl.precipitation_probability_max[i] || 0) >= 50
				if (rain) text += en() ? ' Take an umbrella ☂️' : ' Візьміть парасольку ☂️'
				return { text: text, src: 'Open-Meteo' }
			})
		}).catch(function () { return { text: en() ? 'Could not get the weather right now. Try again in a minute.' : 'Зараз не вдалося отримати погоду. Спробуйте за хвилину.' } })
	}

	/* ---------- справжній ШІ на сервері (api/ai.php), якщо налаштовано ключ ---------- */
	var server = null // null - ще не перевіряли, true/false - результат
	function serverOn() {
		if (server !== null) return Promise.resolve(server)
		if (!/^https?:$/.test(location.protocol)) { server = false; return Promise.resolve(false) }
		return fetch('api/ai.php?check=1', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null }).then(function (d) {
			server = !!(d && d.configured)
			return server
		}, function () { server = false; return false })
	}
	function askServer() {
		var msgs = history.filter(function (m) { return m.text && !m.local }).slice(-12).map(function (m) { return { role: m.me ? 'user' : 'assistant', content: m.text } })
		var ctl = window.AbortController ? new AbortController() : null
		var timer = setTimeout(function () { if (ctl) ctl.abort() }, 45000)
		return fetch('api/ai.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs, lang: en() ? 'en' : 'uk' }), signal: ctl ? ctl.signal : undefined })
			.then(function (r) {
				clearTimeout(timer)
				if (r.status === 503) server = false
				return r.ok ? r.json() : Promise.reject(r.status)
			}).then(function (d) {
				if (!d || typeof d.reply !== 'string' || !d.reply) throw new Error('empty')
				return { text: d.reply, ai: true }
			})
	}
	function local(text) {
		var st = smallTalk(text)
		if (st) return Promise.resolve(st)
		return load().then(function () { return answer(text) })
	}
	// порядок: погода (Open-Meteo) -> сервер ШІ (якщо є) з посиланнями з бази знань -> локальні відповіді
	function reply(text) {
		var w = weatherQuery(text)
		if (w) return weather(w)
		var c = calc(low(text))
		if (c) return Promise.resolve({ text: c })
		return serverOn().then(function (on) {
			if (!on) return local(text)
			return askServer().then(function (a) {
				// до відповіді ШІ додаємо кнопки-посилання, якщо питання явно про розділ сайту
				return load().then(function () {
					var q = stems(text), kb = q.length ? scoreKb(q, words(text).join(' ')) : null
					if (kb && kb.sc >= 4.5 && kb.e.l) a.links = kb.e.l
					return a
				}, function () { return a })
			}, function () { return local(text) })
		})
	}

	/* ---------- інтерфейс ---------- */
	var root = el('div', 'ai')
	var fab = el('button', 'ai-fab')
	fab.type = 'button'
	fab.setAttribute('aria-label', t('Відкрити AI Student'))
	fab.setAttribute('aria-expanded', 'false')
	fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8zM5 15l.6 1.4L7 17l-1.4.6L5 19l-.6-1.4L3 17l1.4-.6z"/></svg><span class="ai-fab__label">AI</span>'
	var panel = el('section', 'ai-panel')
	panel.hidden = true
	panel.setAttribute('role', 'dialog')
	panel.setAttribute('aria-label', 'AI Student')
	var head = el('header', 'ai-head')
	var logo = el('span', 'ai-head__logo')
	logo.innerHTML = fab.querySelector('svg').outerHTML
	head.appendChild(logo)
	var ht = el('div', 'ai-head__text')
	ht.appendChild(el('strong', null, 'AI Student'))
	var sub = el('span', 'ai-head__sub', t('Помічник World Students'))
	ht.appendChild(sub)
	head.appendChild(ht)
	var clearBtn = el('button', 'ai-head__btn')
	clearBtn.type = 'button'
	clearBtn.setAttribute('aria-label', t('Очистити розмову'))
	clearBtn.title = t('Очистити розмову')
	clearBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>'
	var closeBtn = el('button', 'ai-head__btn', '✕')
	closeBtn.type = 'button'
	closeBtn.setAttribute('aria-label', t('Закрити AI Student'))
	head.appendChild(clearBtn)
	head.appendChild(closeBtn)
	var log = el('div', 'ai-log')
	log.setAttribute('aria-live', 'polite')
	var chips = el('div', 'ai-chips')
	var SUGGEST = ['Як справи?', 'Хто ти?', 'Яка погода в Дніпрі?', 'Як вступити?', 'Як працює рейтинг?', 'Як влаштований сайт?']
	var form = el('form', 'ai-form')
	form.setAttribute('autocomplete', 'off')
	var input = el('input', 'ai-input')
	input.type = 'text'
	input.maxLength = 300
	input.placeholder = t('Напишіть повідомлення…')
	input.setAttribute('aria-label', t('Ваше питання для AI Student'))
	var send = el('button', 'ai-send')
	send.type = 'submit'
	send.setAttribute('aria-label', t('Надіслати'))
	send.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
	form.appendChild(input)
	form.appendChild(send)
	panel.appendChild(head)
	panel.appendChild(log)
	panel.appendChild(chips)
	panel.appendChild(form)
	root.appendChild(panel)
	root.appendChild(fab)

	var history = []
	try { history = JSON.parse(sessionStorage.getItem(LOG_KEY)) || [] } catch (e) {}
	function save() { try { sessionStorage.setItem(LOG_KEY, JSON.stringify(history.slice(-30))) } catch (e) {} }

	function linkChip(label, href) {
		var a = el('a', 'ai-link', t(label))
		a.href = href
		if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; a.textContent += ' ↗' }
		return a
	}
	// текст із клікабельними посиланнями: https://… і сторінки сайту на кшталт rating.html#розділ
	var LINK_RE = /(https?:\/\/[^\s<>"')]+[^\s<>"').,!?;:]|\b[a-z0-9][a-z0-9-]*\.html(?:\?[a-z]+=[\w\/-]+)?(?:#[A-Za-z][\w-]*)?)/g
	function richText(text, plain) {
		var p = el('p', 'ai-msg__t')
		if (plain) { p.textContent = text; return p }
		var last = 0, m
		LINK_RE.lastIndex = 0
		while ((m = LINK_RE.exec(text))) {
			if (m.index > last) p.appendChild(document.createTextNode(text.slice(last, m.index)))
			var a = el('a', 'ai-inline', m[0])
			a.href = m[0]
			if (/^https?:/.test(m[0])) { a.target = '_blank'; a.rel = 'noopener' }
			p.appendChild(a)
			last = m.index + m[0].length
		}
		if (last < text.length) p.appendChild(document.createTextNode(text.slice(last)))
		return p
	}
	function bubble(m) {
		var row = el('div', 'ai-msg ai-msg--' + (m.me ? 'me' : 'bot'))
		var b = el('div', 'ai-msg__b')
		b.appendChild(richText(m.text, m.me))
		if (m.pages && m.pages.length) {
			if (m.also) b.appendChild(el('p', 'ai-msg__sub', en() ? 'Also on the site:' : 'Також на сайті:'))
			var list = el('div', 'ai-res')
			m.pages.forEach(function (p) {
				var a = el('a', 'ai-res__i')
				a.href = p.u
				a.appendChild(el('strong', null, t(p.t)))
				if (p.p && p.p !== p.t) a.appendChild(el('small', null, t(p.p)))
				if (p.x) a.appendChild(el('span', null, p.x.length > 170 ? p.x.slice(0, 170).replace(/\s+\S*$/, '') + '…' : p.x))
				list.appendChild(a)
			})
			b.appendChild(list)
		}
		if (m.links && m.links.length) {
			var ls = el('div', 'ai-links')
			m.links.forEach(function (l) { ls.appendChild(linkChip(l[0], l[1])) })
			b.appendChild(ls)
		}
		row.appendChild(b)
		return row
	}
	function greet() {
		return { text: en()
			? 'Hi! I am AI Student 👋 We can just chat, I can tell you the weather, and I will help you find anything on World Students: admission, studies, timetable, rating, your account or how the site is built.'
			: 'Привіт! Я AI Student 👋 Можемо просто поговорити, можу підказати погоду, а ще допоможу знайти будь-що на World Students: вступ, навчання, розклад, рейтинг, акаунт чи будову сайту.' }
	}
	function renderAll() {
		log.textContent = ''
		log.appendChild(bubble(greet()))
		history.forEach(function (m) { log.appendChild(bubble(m)) })
		chips.hidden = history.length > 0
		log.scrollTop = log.scrollHeight
	}
	chips.textContent = ''
	SUGGEST.forEach(function (s) {
		var c = el('button', 'ai-chip', t(s))
		c.type = 'button'
		c.addEventListener('click', function () { ask(t(s)) })
		chips.appendChild(c)
	})

	var busy = false
	function ask(text) {
		text = String(text || '').trim().slice(0, 300)
		if (!text || busy) return
		busy = true
		var mine = { me: true, text: text }
		history.push(mine)
		chips.hidden = true
		log.appendChild(bubble(mine))
		var dots = el('div', 'ai-msg ai-msg--bot ai-msg--typing')
		dots.innerHTML = '<div class="ai-msg__b"><span class="ai-dots"><i></i><i></i><i></i></span></div>'
		log.appendChild(dots)
		log.scrollTop = log.scrollHeight
		var started = Date.now()
		reply(text).catch(function () {
			return { text: en() ? 'Could not load the knowledge base. Check your connection and try again.' : 'Не вдалося завантажити базу знань. Перевірте з’єднання й спробуйте ще раз.' }
		}).then(function (a) {
			var m = { text: a.text, links: a.links, also: a.also, pages: (a.pages || []).map(function (p) { return { u: p.c.u, t: p.c.t, p: p.c.p, x: p.c.x } }) }
			if (a.src) m.src = a.src
			setTimeout(function () {
				dots.remove()
				history.push(m)
				save()
				log.appendChild(bubble(m))
				log.scrollTop = log.scrollHeight
				busy = false
			}, Math.max(0, 450 - (Date.now() - started)))
		})
	}
	form.addEventListener('submit', function (e) {
		e.preventDefault()
		var v = input.value
		input.value = ''
		ask(v)
		input.focus()
	})
	clearBtn.addEventListener('click', function () { history = []; save(); renderAll(); input.focus() })

	var isOpen = false
	function open() {
		isOpen = true
		panel.hidden = false
		root.classList.add('is-open')
		fab.setAttribute('aria-expanded', 'true')
		document.dispatchEvent(new CustomEvent('ntu:panel', { detail: 'ai' }))
		renderAll()
		load().catch(function () {})
		setTimeout(function () { input.focus() }, 30)
	}
	function shut(focusFab) {
		if (!isOpen) return
		isOpen = false
		panel.hidden = true
		root.classList.remove('is-open')
		fab.setAttribute('aria-expanded', 'false')
		if (focusFab) fab.focus()
	}
	fab.addEventListener('click', function () { isOpen ? shut() : open() })
	closeBtn.addEventListener('click', function () { shut(true) })
	panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); shut(true) } })
	document.addEventListener('ntu:panel', function (e) { if (e.detail !== 'ai') shut() })
	document.addEventListener('ntu:lang', function () {
		fab.setAttribute('aria-label', t('Відкрити AI Student'))
		if (isOpen) renderAll()
	})

	function mount() { document.body.appendChild(root) }
	if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount)
	window.NTU_AI = { open: open, close: shut, ask: function (q) { if (!isOpen) open(); ask(q) } }
})()
