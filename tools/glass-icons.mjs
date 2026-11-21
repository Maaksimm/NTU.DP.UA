/**
 * Glassmorphism illustrations for page heroes (src/pages: <span class="hero-art glass-art" data-glass="NAME" aria-hidden="true"></span>).
 * The build inlines the SVG below. If public/assets/lottie/glass-NAME.json exists, the span also gets
 * data-lottie="assets/lottie/glass-NAME.json?v=<hash>" and main.js (13-glass-lottie.js) swaps the SVG for the Lottie animation.
 *
 * Each icon = a coloured shape behind (.ga-back) + a frosted glass panel in front (.ga-glass) + white details.
 * Gradient ids are prefixed with the icon name, so several icons can share one page.
 */

const GLASS = (id) => `<linearGradient id="${id}-gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset="1" stop-color="#fff" stop-opacity=".16"/></linearGradient>`
const GRAD = (id, name, a, b) => `<linearGradient id="${id}-${name}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`
const BLUR = (id) => `<filter id="${id}-bl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>`
const panel = (id, attrs) => `<g class="ga-glass"><${attrs} fill="url(#${id}-gl)" stroke="#fff" stroke-opacity=".75" stroke-width="1.6"/>`

// back shape is drawn twice: sharp, and blurred under the glass (frosted look)
const back = (id, shape) => `<g class="ga-back">${shape}</g><g filter="url(#${id}-bl)" opacity=".55">${shape}</g>`

const ICONS = {
	chat: id => `<defs>${GRAD(id, 'a', '#c13cff', '#5b3cff')}${GLASS(id)}${BLUR(id)}</defs>
${back(id, `<path d="M84 34h70a26 26 0 0 1 26 26v34a26 26 0 0 1-26 26h-6l4 22-26-22H84a26 26 0 0 1-26-26V60a26 26 0 0 1 26-26z" fill="url(#${id}-a)"/>`)}
${panel(id, 'path d="M46 74h70a24 24 0 0 1 24 24v30a24 24 0 0 1-24 24H70l-26 20 6-20h-4a24 24 0 0 1-24-24V98a24 24 0 0 1 24-24z"')}
<circle cx="62" cy="113" r="7" fill="#fff"/><circle cx="83" cy="113" r="7" fill="#fff"/><circle cx="104" cy="113" r="7" fill="#fff"/></g>`,

	calendar: id => `<defs>${GRAD(id, 'a', '#ff9a3c', '#ff3c5c')}${GLASS(id)}${BLUR(id)}</defs>
${back(id, `<rect x="44" y="34" width="116" height="64" rx="20" fill="url(#${id}-a)"/>`)}
${panel(id, 'rect x="40" y="58" width="124" height="112" rx="22"')}
<rect x="70" y="84" width="64" height="9" rx="4.5" fill="#fff" opacity=".85"/>
<text x="102" y="150" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-size="46" font-weight="800" fill="#fff">1</text></g>
<rect x="70" y="22" width="12" height="30" rx="6" fill="#e9eef7"/><rect x="122" y="22" width="12" height="30" rx="6" fill="#e9eef7"/>`,

	weather: id => `<defs>${GRAD(id, 'a', '#ffd35c', '#ff9a1f')}${GLASS(id)}${BLUR(id)}</defs>
${back(id, `<circle cx="124" cy="74" r="38" fill="url(#${id}-a)"/>`)}
${panel(id, 'path d="M62 160a34 34 0 0 1-4-68 44 44 0 0 1 84-8 30 30 0 0 1 8 76z"')}</g>`,

	cards: id => `<defs>${GRAD(id, 'a', '#ffc23c', '#ff3c6e')}${GLASS(id)}${BLUR(id)}</defs>
${back(id, `<rect x="66" y="40" width="112" height="72" rx="16" fill="url(#${id}-a)"/><rect x="66" y="58" width="112" height="14" fill="#7a2a1f" opacity=".55"/>`)}
${panel(id, 'rect x="26" y="88" width="120" height="76" rx="16"')}
<rect x="42" y="106" width="26" height="18" rx="5" fill="#fff" opacity=".9"/><rect x="42" y="140" width="72" height="8" rx="4" fill="#fff" opacity=".85"/></g>`,

	piggy: id => `<defs>${GRAD(id, 'a', '#ffe08a', '#f7b500')}${GRAD(id, 'p', '#ff9ec2', '#ff4f8b')}${GLASS(id)}${BLUR(id)}</defs>
${back(id, `<circle cx="100" cy="46" r="20" fill="url(#${id}-a)"/>`)}
<g filter="url(#${id}-bl)" opacity=".5"><ellipse cx="110" cy="124" rx="56" ry="38" fill="url(#${id}-p)"/></g>
${panel(id, 'path d="M50 112c0-28 26-46 58-46 24 0 42 9 50 22l16-4-4 22c4 6 6 12 6 18 0 16-12 28-28 34v14h-18v-10c-8 2-16 2-24 0v10H88v-16c-24-8-38-24-38-44z"')}
<rect x="88" y="80" width="30" height="7" rx="3.5" fill="#fff"/><circle cx="148" cy="108" r="5" fill="#fff"/></g>`,

	documents: id => `<defs>${GRAD(id, 'a', '#5cb6ff', '#2f5bff')}${GLASS(id)}${BLUR(id)}</defs>
${back(id, `<rect x="84" y="28" width="86" height="110" rx="16" fill="url(#${id}-a)"/>`)}
${panel(id, 'rect x="34" y="58" width="96" height="120" rx="16"')}
<rect x="52" y="84" width="60" height="8" rx="4" fill="#fff"/><rect x="52" y="104" width="60" height="8" rx="4" fill="#fff"/><rect x="52" y="124" width="60" height="8" rx="4" fill="#fff"/><rect x="52" y="144" width="38" height="8" rx="4" fill="#fff"/></g>`,

	folder: id => `<defs>${GRAD(id, 'a', '#6cc4ff', '#2f7bff')}${GLASS(id)}${BLUR(id)}</defs>
${back(id, `<path d="M32 58a12 12 0 0 1 12-12h40l14 16h58a12 12 0 0 1 12 12v40H32z" fill="url(#${id}-a)"/>`)}
${panel(id, 'rect x="24" y="78" width="152" height="96" rx="18"')}
<rect x="44" y="96" width="44" height="8" rx="4" fill="#fff" opacity=".9"/></g>`,

	image: id => `<defs>${GRAD(id, 'a', '#4fb3ff', '#2a62e8')}${GRAD(id, 'g', '#8ee7a0', '#3cc46a')}${GLASS(id)}${BLUR(id)}</defs>
${back(id, `<rect x="44" y="30" width="122" height="104" rx="20" fill="url(#${id}-a)"/><circle cx="82" cy="64" r="14" fill="#ffe24a"/>`)}
<path d="M30 170l44-62 30 38 22-24 44 48z" fill="url(#${id}-g)" opacity=".55"/>
${panel(id, 'path d="M30 170l44-62 30 38 22-24 44 48z"')}</g>`,

	bookmark: id => `<defs>${GRAD(id, 'a', '#ff9a3c', '#ff4f3c')}${GLASS(id)}${BLUR(id)}</defs>
${back(id, `<rect x="82" y="30" width="86" height="104" rx="18" fill="url(#${id}-a)"/>`)}
${panel(id, 'path d="M40 70a16 16 0 0 1 16-16h56a16 16 0 0 1 16 16v104l-44-28-44 28z"')}
<path d="M84 92v36M66 110h36" stroke="#fff" stroke-width="9" stroke-linecap="round"/></g>`,

	location: id => `<defs>${GRAD(id, 'a', '#4fb3ff', '#2a62e8')}${GLASS(id)}${BLUR(id)}</defs>
${back(id, `<ellipse cx="112" cy="160" rx="52" ry="14" fill="url(#${id}-a)"/>`)}
${panel(id, 'path d="M100 172c-30-34-52-60-52-90a52 52 0 0 1 104 0c0 30-22 56-52 90z"')}
<circle cx="100" cy="82" r="20" fill="#fff"/></g>`
}

export const GLASS_NAMES = Object.keys(ICONS)

/** Inline SVG for a glass icon, or '' for an unknown name. */
export function glassSvg(name) {
	const draw = ICONS[name]
	if (!draw) return ''
	return `<svg class="glass-svg" viewBox="0 0 200 200" width="200" height="200" focusable="false" aria-hidden="true">${draw('ga-' + name).replace(/\n/g, '')}</svg>`
}
