/* ===== File picker: every visible <input type="file"> in a form becomes a styled drop zone =====
   The real input stays in the form (visually hidden, still focusable and submitted); the zone shows
   an icon, "Оберіть файл" and the chosen name(s), accepts drag & drop and clears on form reset.
   Inputs with the hidden attribute (custom buttons trigger them) are left alone. */
const FILEPICK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>'

function filePickLabel(input) {
	const files = Array.from(input.files || [])
	if (!files.length) return ''
	if (files.length === 1) return files[0].name
	return T('Обрано файлів: ') + files.length
}

function initFilePicker(input) {
	if (input.hidden || input.dataset.filepick) return
	input.dataset.filepick = '1'
	input.classList.add('filepick__input')
	const zone = document.createElement('label')
	zone.className = 'filepick'
	zone.htmlFor = input.id || ''
	zone.innerHTML = FILEPICK_ICON
	const text = document.createElement('span')
	text.className = 'filepick__text'
	const main = document.createElement('span')
	main.className = 'filepick__main'
	const sub = document.createElement('span')
	sub.className = 'filepick__sub'
	text.append(main, sub)
	const btn = document.createElement('span')
	btn.className = 'filepick__btn'
	zone.append(text, btn)
	input.after(zone)
	if (!input.id) zone.addEventListener('click', () => input.click())

	const paint = () => {
		const name = filePickLabel(input)
		zone.classList.toggle('has-file', !!name)
		main.textContent = name || T(input.multiple ? 'Оберіть файли' : 'Оберіть файл')
		sub.textContent = name ? T('Натисніть, щоб замінити') : T('або перетягніть сюди')
		btn.textContent = T(name ? 'Змінити' : 'Огляд')
	}
	input.addEventListener('change', paint)
	if (input.form) input.form.addEventListener('reset', () => setTimeout(paint))
	document.addEventListener('ntu:lang', paint)
	;['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('is-drag') }))
	;['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, () => zone.classList.remove('is-drag')))
	zone.addEventListener('drop', e => {
		e.preventDefault()
		const dropped = e.dataTransfer && e.dataTransfer.files
		if (!dropped || !dropped.length) return
		const dt = new DataTransfer()
		Array.from(dropped).slice(0, input.multiple ? dropped.length : 1).forEach(f => dt.items.add(f))
		input.files = dt.files
		input.dispatchEvent(new Event('change', { bubbles: true }))
	})
	paint()
}

document.addEventListener('DOMContentLoaded', () => {
	document.querySelectorAll('form input[type="file"]').forEach(initFilePicker)
})
