import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// The page's backgrounds are all made of dots and letters, drawn in code at the screen's own
// resolution from small source pictures (generated with Gemini, in public/media/src). The
// pictures only say where the light is; every dot is drawn fresh, so nothing goes soft on a big
// monitor. Each one is drawn once and afterwards only moved by the GPU.
//   StippleSky     the Milky Way as stippled stars, behind the whole page, in two depths
//   HalftoneRecord a vinyl record in halftone, behind the record player section
//   AsciiPlayer    a record player drawn out of the song's own lyrics, in the closing section

const LYRICS = `We were counting all the lights above the town / Every window like a star that fell to ground /
You said nothing ever stays the way it shines / So we drew our names in chalk on summer lines /
Oh, slow satellites / Turning in the dark / Carry us tonight / Over every heart /
I can hear the static singing in the rain / Every signal brings you back to me again /
Hold the frequency, don't let it slip away / We are only echoes of a brighter day /
And if the sky forgets the way we used to glow / I'll keep a little light for you to follow home /
Slow satellites / Turning, turning, slow / `.replace(/\s*\n\s*/g, ' ')

const idle = fn => (window.requestIdleCallback || (f => setTimeout(f, 16)))(fn, { timeout: 400 })

// Pixels of an image fitted over a w x h box ('cover'), at 1/step resolution.
export function sampler(img, w, h, step, fit = 'cover', zoom = 1) {
  const sw = Math.max(1, Math.round(w / step)), sh = Math.max(1, Math.round(h / step))
  const cv = document.createElement('canvas'); cv.width = sw; cv.height = sh
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  const k = zoom * (fit === 'cover' ? Math.max(sw / img.naturalWidth, sh / img.naturalHeight) : Math.min(sw / img.naturalWidth, sh / img.naturalHeight))
  const dw = img.naturalWidth * k, dh = img.naturalHeight * k
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, sw, sh)
  ctx.drawImage(img, (sw - dw) / 2, (sh - dh) / 2, dw, dh)
  const d = ctx.getImageData(0, 0, sw, sh).data
  return (x, y) => {
    const i = (Math.min(sh - 1, Math.max(0, (y / step) | 0)) * sw + Math.min(sw - 1, Math.max(0, (x / step) | 0))) * 4
    return [d[i], d[i + 1], d[i + 2]]
  }
}
export const lum = c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255
export const loadImage = src => new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = rej; im.src = src })
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 } }

// ---------------------------------------------------------------- sky
export function StippleSky() {
  const root = useRef(null)
  useEffect(() => {
    const els = [...root.current.querySelectorAll('canvas')]
    // far: many fine dots that hold the shape of the galaxy; near: fewer, larger, moving more;
    // the brightest stars also go in a third layer that slowly twinkles.
    const LAYERS = [
      { grid: 2.6, size: 0.8, gain: 0.42, floor: 0.08, gamma: 1.5, white: 0.3, alpha: [0.16, 0.55], k: 0.45 },
      { grid: 7, size: 1.15, gain: 0.5, floor: 0.36, gamma: 1.8, white: 0.55, alpha: [0.35, 0.8], k: 1 },
      { grid: 13, size: 1.6, gain: 0.55, floor: 0.66, gamma: 2.4, white: 0.8, alpha: [0.6, 0.95], k: 1 },
    ]
    let travel = 0, img = null, alive = true
    const draw = () => {
      if (!img) return
      const dpr = Math.min(devicePixelRatio || 1, 2)
      const w = innerWidth, h = innerHeight, H = Math.round(h * 1.32)
      travel = H - h
      const sample = sampler(img, w, H, 2)
      LAYERS.forEach((L, li) => {
        const cv = els[li], ctx = cv.getContext('2d')
        cv.width = Math.round(w * dpr); cv.height = Math.round(H * dpr)
        cv.style.width = w + 'px'; cv.style.height = H + 'px'
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        const rnd = rng(31 + li * 977), buckets = new Map()
        for (let gy = 0; gy < H; gy += L.grid) for (let gx = 0; gx < w; gx += L.grid) {
          const x = gx + rnd() * L.grid, y = gy + rnd() * L.grid
          const c = sample(x, y), l = lum(c)
          if (l < L.floor) continue
          const p = L.gain * Math.pow((l - L.floor) / (1 - L.floor), L.gamma)
          if (rnd() > p) continue
          // the dot keeps the hue of the sky there, lifted toward white so it reads as light
          const m = Math.max(1, c[0], c[1], c[2]), q = v => Math.round(((v / m) * 255 * (1 - L.white) + 255 * L.white) / 24) * 24
          const a = Math.round((L.alpha[0] + (L.alpha[1] - L.alpha[0]) * l) * 4) / 4
          const key = `${q(c[0])},${q(c[1])},${q(c[2])},${a}`
          let list = buckets.get(key); if (!list) buckets.set(key, list = [])
          list.push(x, y, L.size * (0.7 + 0.6 * l))
        }
        for (const [key, list] of buckets) {             // one fill per colour: fast
          ctx.fillStyle = `rgba(${key})`; ctx.beginPath()
          for (let i = 0; i < list.length; i += 3) { const r = list[i + 2]; ctx.moveTo(list[i] + r, list[i + 1]); ctx.arc(list[i], list[i + 1], r, 0, Math.PI * 2) }
          ctx.fill()
        }
      })
      root.current.classList.add('is-drawn')
    }
    loadImage('/media/src/sky.webp').then(im => { if (!alive) return; img = im; draw() }).catch(() => {})
    let rt = 0
    const onResize = () => { clearTimeout(rt); rt = setTimeout(draw, 200) }
    addEventListener('resize', onResize)
    // The whole page's scroll maps onto the extra height of the sky: far stars travel less.
    const setters = els.map(el => gsap.quickSetter(el, 'y', 'px'))
    let last = -1
    const move = () => {
      const y = window.scrollY
      if (y === last) return
      last = y
      const k = Math.min(1, y / Math.max(1, ScrollTrigger.maxScroll(window)))
      LAYERS.forEach((L, i) => setters[i](-k * travel * L.k))
    }
    gsap.ticker.add(move)
    return () => { alive = false; gsap.ticker.remove(move); removeEventListener('resize', onResize) }
  }, [])
  return (
    <div className="stars" ref={root} aria-hidden="true">
      <canvas /><canvas /><canvas className="twinkle" />
    </div>
  )
}
