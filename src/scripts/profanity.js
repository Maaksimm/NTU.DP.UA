/* Фільтр нецензурної лексики (укр / рос / англ). Експортує window.NTU_isProfane(text). */
(function () {
	'use strict'
	/* ---------- фільтр нецензурної лексики (укр / рос / англ) ---------- */
	var LAT2CYR = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', i: 'і', k: 'к', m: 'м', t: 'т', b: 'в', h: 'н', '0': 'о', '3': 'з', '@': 'а', '$': 'с' }
	var PFX = '(?:на|по|за|ви|до|роз|з|с|пере|при|під|об|від|не|о|у|від)?'
	var RU_UA = [
		new RegExp('^' + PFX + 'ху[йяеєюїиі]'),
		/пізд|пизд|пезд/,
		new RegExp('^' + PFX + '[еєїи]б(?:а[нтлвшк]|у|ну|ля|ло|ли|ь)'),
		/^[еєїи]бл[оа]н?/,
		/^(?:за|на|по|ви|до|роз)?йоб/,
		/^у[еёє]б(?:ок|ан|ки)/,
		/^бл(?:я|ят|яд|ять|ядь|ядс|яди|яха)$|^бл(?:ят|яд)/,
		/^су(?:ка|ки|ку|кою|ці|ко|ків)$|^су(?:чар|чк)/,
		/^муд(?:ак|ач|ил|ень|озвон)/,
		/^(?:на|по|за)?хер(?:ня|ню|ні|ово|овий|ова)?$/,
		/^г[ао]ндон/,
		/^залуп/,
		/^п[іи]д[оа]р(?:а|и|у|ом|ас|ами|ів)?$/,
		/^п[іи]дар(?:ас|аз)/,
		/^шлюх/,
		/^курв/,
		/^дроч/,
		/^мраз[ьіи]$/,
		/^долбо[её]б/,
		/^довбо[еєї]б/
	]
	var EN = /fuck|shit|bitch|cunt|asshole|whore|slut|blyat|blyad|dick(?:head)?s?$|nigg/
	function squash(s) { return s.replace(/(.)\1+/g, '$1') }
	function isProfane(text) {
		var raw = String(text).toLowerCase()
		if (EN.test(squash(raw.replace(/[^a-z]+/g, ' '))) || /f+u+c+k|sh+i+t/.test(raw.replace(/[^a-z]/g, ''))) return true
		var mapped = raw.replace(/[a-z0-9@$]/g, function (ch) { return LAT2CYR[ch] || ch })
		var words = mapped.split(/[^а-яіїєґё]+/).filter(Boolean).map(squash)
		for (var i = 0; i < words.length; i++)
			for (var j = 0; j < RU_UA.length; j++) if (RU_UA[j].test(words[i])) return true
		// літери через пробіли/крапки: «х у й», «п.і.з.д.а»
		var glued = squash(mapped.replace(/[^а-яіїєґё]/g, ''))
		return /хуй|хуя|пізд|пизд|[еєїи]бат|бляд|блят|блять|залуп/.test(glued)
	}

	window.NTU_isProfane = isProfane
})()
