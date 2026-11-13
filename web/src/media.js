// How much the page asks of the visitor's machine and connection, decided once at start.
//   lite   a slow or metered connection, or a small machine: posters instead of autoplaying
//          footage, lighter backgrounds, the 3D scene fetched only when it's close
//   small  a phone-sized screen: the lighter cut of each recording and the small posters
const nav = typeof navigator !== 'undefined' ? navigator : {}
const conn = nav.connection || {}
const slowNet = !!conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || '')
const weak = (nav.deviceMemory && nav.deviceMemory <= 4) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4)
const forced = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lite') : null

export const lite = forced === '1' ? true : forced === '0' ? false : !!(slowNet || weak)
export const small = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 860px)').matches
if (typeof document !== 'undefined' && lite) document.documentElement.classList.add('lite')

// Each recording has a full cut (1600-1920 wide, 60 fps) and a light one (960 wide) for phones and
// slow connections; each poster comes in the same two widths as WebP.
const dense = () => (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1) * innerWidth
export const videoSrc = base => (small || lite ? `${base}-sm.mp4` : `${base}.mp4`)
export const posterSrc = base => (dense() <= 1200 ? `${base}-960.webp` : `${base}.webp`)

// Fetch an image ahead of time, at the lowest priority, so it's decoded and waiting when its
// section arrives. Resolves either way.
export function warm(src) {
  return new Promise(res => {
    const im = new Image()
    im.decoding = 'async'; im.fetchPriority = 'low'
    im.onload = im.onerror = () => res()
    im.src = src
  })
}

// Runs fn once the hero's entrance has played and the browser has a quiet moment.
export function afterIntro(fn, delay = 0) {
  let t = 0, cancelled = false
  const go = () => { t = setTimeout(() => (window.requestIdleCallback || (f => f()))(() => { if (!cancelled) fn() }, { timeout: 2000 }), delay) }
  if (window.__introDone) go(); else window.addEventListener('starlit:intro-done', go, { once: true })
  return () => { cancelled = true; clearTimeout(t); window.removeEventListener('starlit:intro-done', go) }
}

// Calls fn(true) once el comes within `margin` of the viewport (and fn(false)/fn(true) as it
// leaves and comes back when `track` is set).
export function whenNear(el, fn, margin = '150% 0px', track = false) {
  if (!el) return () => {}
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { fn(true); if (!track) io.disconnect() } else if (track) fn(false)
  }, { rootMargin: margin })
  io.observe(el)
  return () => io.disconnect()
}
