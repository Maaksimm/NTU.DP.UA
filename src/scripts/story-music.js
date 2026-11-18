/*
 * Музика для сторіз: власні треки, які генеруються в браузері через Web Audio (без файлів і без чужих прав).
 * window.NTU_MUSIC = { list: [{id, name}], name(id), play(id) -> stop() }
 */
(function () {
	'use strict'
	var ctx = null
	function audio() {
		var C = window.AudioContext || window.webkitAudioContext
		if (!C) return null
		ctx = ctx || new C()
		if (ctx.state === 'suspended') ctx.resume()
		return ctx
	}
	var NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
	function freq(n) { // 'A3', 'C#4', 'Eb4'
		var m = /^([A-G])([#b]?)(\d)$/.exec(n)
		var semi = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12
		return 440 * Math.pow(2, (semi - 69) / 12)
	}

	/* chords: 4 акорди по такту; lead: ноти 8-ми (null - пауза) */
	var TRACKS = {
		lofi: { name: 'Lo-fi вечір', bpm: 78, wave: 'triangle', drums: 'soft',
			chords: [['D3', 'F3', 'A3', 'C4'], ['G2', 'B2', 'D3', 'F3'], ['C3', 'E3', 'G3', 'B3'], ['A2', 'C3', 'E3', 'G3']],
			lead: ['A4', null, 'C5', null, 'D5', null, 'C5', 'A4', 'G4', null, null, 'E4', 'G4', null, 'A4', null] },
		chill: { name: 'Chill кампус', bpm: 92, wave: 'sine', drums: 'soft',
			chords: [['F3', 'A3', 'C4', 'E4'], ['A2', 'C3', 'E3', 'G3'], ['D3', 'F3', 'A3', 'C4'], ['C3', 'E3', 'G3', 'B3']],
			lead: ['C5', 'E5', 'G5', null, 'E5', null, 'C5', null, 'A4', 'C5', 'E5', null, 'D5', null, null, null] },
		energy: { name: 'Енергія сесії', bpm: 124, wave: 'sawtooth', drums: 'hard',
			chords: [['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['C3', 'E3', 'G3'], ['G2', 'B2', 'D3']],
			lead: ['E5', 'E5', null, 'A5', null, 'G5', 'E5', null, 'C5', null, 'D5', 'E5', null, 'G5', 'E5', null] },
		dream: { name: 'Мрія', bpm: 66, wave: 'sine', drums: 'none',
			chords: [['C3', 'G3', 'E4'], ['A2', 'E3', 'C4'], ['F2', 'C3', 'A3'], ['G2', 'D3', 'B3']],
			lead: ['G4', null, null, 'E4', null, null, 'C5', null, 'B4', null, null, 'G4', null, null, 'A4', null] }
	}

	function tone(c, out, f, t0, dur, wave, vol) {
		var o = c.createOscillator(), g = c.createGain()
		o.type = wave
		o.frequency.value = f
		g.gain.setValueAtTime(0.0001, t0)
		g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02)
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
		o.connect(g)
		g.connect(out)
		o.start(t0)
		o.stop(t0 + dur + 0.05)
	}
	function kick(c, out, t0, vol) {
		var o = c.createOscillator(), g = c.createGain()
		o.frequency.setValueAtTime(140, t0)
		o.frequency.exponentialRampToValueAtTime(40, t0 + 0.15)
		g.gain.setValueAtTime(vol, t0)
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2)
		o.connect(g)
		g.connect(out)
		o.start(t0)
		o.stop(t0 + 0.25)
	}
	var noiseBuf = null
	function hat(c, out, t0, vol) {
		if (!noiseBuf) {
			noiseBuf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate)
			var d = noiseBuf.getChannelData(0)
			for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
		}
		var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
		s.buffer = noiseBuf
		f.type = 'highpass'
		f.frequency.value = 7000
		g.gain.setValueAtTime(vol, t0)
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04)
		s.connect(f)
		f.connect(g)
		g.connect(out)
		s.start(t0)
	}

	function play(id) {
		var tr = TRACKS[id], c = audio()
		if (!tr || !c) return function () {}
		var master = c.createGain()
		master.gain.value = 0.0001
		master.gain.exponentialRampToValueAtTime(0.5, c.currentTime + 0.6)
		master.connect(c.destination)
		var eighth = 60 / tr.bpm / 2
		var step = 0, next = c.currentTime + 0.05, stopped = false
		function schedule() {
			while (!stopped && next < c.currentTime + 0.3) {
				var bar = Math.floor(step / 8) % tr.chords.length, inBar = step % 8
				if (inBar === 0) tr.chords[bar].forEach(function (n) { tone(c, master, freq(n), next, eighth * 7.5, tr.wave === 'sawtooth' ? 'triangle' : tr.wave, 0.05) })
				if (inBar % 4 === 0) tone(c, master, freq(tr.chords[bar][0]) / 2, next, eighth * 3, 'sine', 0.12)
				var ln = tr.lead[step % tr.lead.length]
				if (ln) tone(c, master, freq(ln), next, eighth * 1.6, tr.wave, tr.wave === 'sawtooth' ? 0.03 : 0.06)
				if (tr.drums !== 'none') {
					if (inBar === 0 || inBar === 4 || (tr.drums === 'hard' && inBar % 2 === 0)) kick(c, master, next, tr.drums === 'hard' ? 0.5 : 0.3)
					if (inBar % 2 === 1) hat(c, master, next, tr.drums === 'hard' ? 0.12 : 0.06)
				}
				step++
				next += eighth
			}
		}
		schedule()
		var timer = setInterval(schedule, 100)
		return function stop() {
			if (stopped) return
			stopped = true
			clearInterval(timer)
			try {
				master.gain.cancelScheduledValues(c.currentTime)
				master.gain.setValueAtTime(master.gain.value, c.currentTime)
				master.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25)
				setTimeout(function () { master.disconnect() }, 400)
			} catch (e) { master.disconnect() }
		}
	}

	window.NTU_MUSIC = {
		list: Object.keys(TRACKS).map(function (k) { return { id: k, name: TRACKS[k].name } }),
		has: function (id) { return Object.prototype.hasOwnProperty.call(TRACKS, id) },
		name: function (id) { return TRACKS[id] ? TRACKS[id].name : '' },
		play: play
	}
})()
