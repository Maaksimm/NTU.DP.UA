function initGalleryLightbox() {
	const lightbox = document.getElementById('lifeLightbox')
	if (!lightbox) return

	const img = document.getElementById('lightboxImg')
	const caption = document.getElementById('lightboxCaption')
	const closeBtn = document.getElementById('lightboxClose')
	const prevBtn = document.getElementById('lightboxPrev')
	const nextBtn = document.getElementById('lightboxNext')

	let currentGroup = []
	let currentIndex = 0

	function show(index) {
		currentIndex = (index + currentGroup.length) % currentGroup.length
		const item = currentGroup[currentIndex]
		const itemImg = item.querySelector('img')
		img.src = itemImg.currentSrc || itemImg.src
		img.alt = itemImg.alt
		caption.textContent = itemImg.alt
	}

	function open(group, index) {
		currentGroup = group
		show(index)
		lightbox.classList.add('is-open')
		lightbox.setAttribute('aria-hidden', 'false')
		document.body.style.overflow = 'hidden'
	}

	function close() {
		lightbox.classList.remove('is-open')
		lightbox.setAttribute('aria-hidden', 'true')
		document.body.style.overflow = ''
	}

	const groupsMap = {}
	document.querySelectorAll('.gallery-item[data-lightbox-group]').forEach(item => {
		const key = item.dataset.lightboxGroup
		if (!groupsMap[key]) groupsMap[key] = []
		groupsMap[key].push(item)
	})
	Object.values(groupsMap).forEach(group => {
		group.forEach(item => {
			item.addEventListener('click', () => {
				const visible = group.filter(i => !i.hidden)
				open(visible, visible.indexOf(item))
			})
		})
	})

	closeBtn.addEventListener('click', close)
	nextBtn.addEventListener('click', () => show(currentIndex + 1))
	prevBtn.addEventListener('click', () => show(currentIndex - 1))
	lightbox.addEventListener('click', e => {
		if (e.target === lightbox) close()
	})
	document.addEventListener('keydown', e => {
		if (!lightbox.classList.contains('is-open')) return
		if (e.key === 'Escape') close()
		if (e.key === 'ArrowRight') show(currentIndex + 1)
		if (e.key === 'ArrowLeft') show(currentIndex - 1)
	})
}

function initSliders() {
  document.querySelectorAll('.slider').forEach(slider => {
    const slides = Array.from(slider.querySelectorAll('.slider__slide'));
    if (slides.length <= 1) return;
    
    const dotsWrap = slider.querySelector('.slider__dots');
    let dots = [];
    if (dotsWrap) {
      dotsWrap.innerHTML = ''; 
      dots = slides.map((_, i) => {
        const b = document.createElement('button');
        b.className = 'slider__dot' + (i === 0 ? ' is-active' : '');
        b.setAttribute('aria-label', T('Слайд') + ' ' + (i + 1));
        b.addEventListener('click', () => restart(() => go(i)));
        dotsWrap.appendChild(b);
        return b;
      });
    }
    
    let current = 0;
    let timer = null;

    function go(i) {
      slides[current].classList.remove('is-active');
      if (dots[current]) dots[current].classList.remove('is-active');
      
      current = (i + slides.length) % slides.length;
      
      slides[current].classList.add('is-active');
      if (dots[current]) dots[current].classList.add('is-active');
    }

    function next() {
      go(current + 1);
    }
    function prev() {
      go(current - 1);
    }

    const nextBtn = slider.querySelector('.slider__arrow--next');
    const prevBtn = slider.querySelector('.slider__arrow--prev');
    if (nextBtn) nextBtn.addEventListener('click', () => restart(next));
    if (prevBtn) prevBtn.addEventListener('click', () => restart(prev));

    function restart(action) {
      action();
      if (timer) clearInterval(timer);
      timer = setInterval(next, 5500);
    }

    if (timer) clearInterval(timer);
    timer = setInterval(next, 5500);
  });
}

function initInstituteBlocks() {
	document.querySelectorAll('.institute-block__head').forEach(head => {
		head.addEventListener('click', () => {
			head.closest('.institute-block').classList.toggle('is-open')
		})
	})
	initKafedraSelect()
}

function initKafedraSelect() {
	const root = document.getElementById('kafedraSelect')
	if (!root) return

	const toggle = document.getElementById('kafedraSelectToggle')
	const panel = document.getElementById('kafedraSelectPanel')
	const input = document.getElementById('kafedraSelectInput')
	const valueEl = document.getElementById('kafedraSelectValue')
	const empty = document.getElementById('kafedraSelectEmpty')
	const groups = Array.from(panel.querySelectorAll('.kafedra-select__group'))

	function openPanel() {
		root.classList.add('is-open')
		toggle.setAttribute('aria-expanded', 'true')
		input.value = ''
		filterOptions('')
		setTimeout(() => input.focus(), 10)
	}
	function closePanel() {
		root.classList.remove('is-open')
		toggle.setAttribute('aria-expanded', 'false')
	}

	toggle.addEventListener('click', () => {
		root.classList.contains('is-open') ? closePanel() : openPanel()
	})
	document.addEventListener('click', e => {
		if (!root.contains(e.target)) closePanel()
	})
	document.addEventListener('keydown', e => {
		if (e.key === 'Escape') closePanel()
	})

	function filterOptions(query) {
		const q = query.trim().toLowerCase()
		let anyVisible = false
		groups.forEach(group => {
			let groupHasMatch = false
			group.querySelectorAll('.kafedra-select__option').forEach(opt => {
				const match = !q || opt.textContent.trim().toLowerCase().includes(q)
				opt.style.display = match ? '' : 'none'
				if (match) groupHasMatch = true
			})
			group.style.display = groupHasMatch ? '' : 'none'
			if (groupHasMatch) anyVisible = true
		})
		if (empty) empty.hidden = anyVisible
	}

	input.addEventListener('input', () => filterOptions(input.value))

	panel.querySelectorAll('.kafedra-select__option').forEach(opt => {
		opt.addEventListener('click', () => {
			const val = opt.textContent.trim()
			valueEl.textContent = val
			valueEl.classList.remove('is-placeholder')
			panel.querySelectorAll('.kafedra-select__option').forEach(o => o.classList.remove('is-active'))
			opt.classList.add('is-active')
			closePanel()
			highlightKafedra(val)
		})
	})

	function highlightKafedra(val) {
		document.querySelectorAll('.kafedra-list li').forEach(li => li.classList.remove('is-highlighted'))
		const match = Array.from(document.querySelectorAll('.kafedra-list li')).find(
			li => li.textContent.trim() === val,
		)
		if (!match) return
		const block = match.closest('.institute-block')
		if (block) block.classList.add('is-open')
		match.classList.add('is-highlighted')
		setTimeout(() => match.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
		setTimeout(() => match.classList.remove('is-highlighted'), 1700)
	}

	document.querySelectorAll('.kafedra-list li').forEach(li => {
		li.style.cursor = 'pointer'
		li.addEventListener('click', () => {
			const val = li.textContent.trim()
			valueEl.textContent = val
			valueEl.classList.remove('is-placeholder')
			highlightKafedra(val)
		})
	})
}
