/* ===== Видатні випускники: пошук + фільтр за напрямом ===== */
function initAlumni() {
	const grid = document.getElementById('alumGrid')
	if (!grid) return
	const search = document.getElementById('alumSearch')
	const empty = document.getElementById('alumEmpty')
	const chips = document.querySelectorAll('[data-alum-filter]')
	let cat = 'all'
	function apply() {
		const q = search.value.trim().toLowerCase()
		let shown = 0
		grid.querySelectorAll('.alum').forEach(c => {
			// data-text holds the Ukrainian text, textContent the visible (maybe English) one
			const hay = c.dataset.text + ' ' + c.textContent.toLowerCase()
			const ok = (cat === 'all' || c.dataset.cat === cat) && (!q || hay.includes(q))
			c.hidden = !ok
			if (ok) shown++
		})
		empty.hidden = shown > 0
	}
	chips.forEach(ch => ch.addEventListener('click', () => {
		chips.forEach(x => { x.classList.toggle('is-active', x === ch); x.setAttribute('aria-pressed', x === ch ? 'true' : 'false') })
		cat = ch.dataset.alumFilter
		apply()
	}))
	search.addEventListener('input', apply)
}
