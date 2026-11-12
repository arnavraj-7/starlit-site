import { useEffect, useRef, useState } from 'react'
import { sampler, lum, loadImage } from './Dots.jsx'

// One full-bleed backdrop per feature in the details section, each taken from what the feature
// is about, cross-fading as the list moves on:
//   colour   the album cover itself, in halftone, changing with the cover on show
//   edge     a square-dot grid, brighter toward the window's edges (and the real edge light pulses)
//   players  the players' names, huge and outlined, drifting past
//   games    a pixel mosaic
//   lights   a grainy wash of light, as a room lit by an RGB bar
//   timing   a ruler in quarter seconds
// Canvases are drawn once when the section comes near; only opacity and transforms change after.
const COVERS = [['a', '171,156,255'], ['b', '255,170,106'], ['c', '79,227,207']]
const idle = fn => (window.requestIdleCallback || (f => setTimeout(f, 16)))(fn, { timeout: 600 })

function size(cv) {
  const dpr = Math.min(devicePixelRatio || 1, 1.5), w = cv.clientWidth, h = cv.clientHeight
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w, h }
}

async function halftoneCover(cv, key, rgb) {
  const img = await loadImage(`/media/covers/${key}.webp`)
  const { ctx, w, h } = size(cv)
  const sample = sampler(img, w, h, 3, 'cover')
  const cell = Math.max(9, w / 170), n = Math.ceil(Math.hypot(w, h) / cell)
  ctx.fillStyle = `rgb(${rgb})`
  let j = -n
  await new Promise(done => {
    const slice = () => {                                         // in slices, never a long frame
      const t0 = performance.now()
      while (j <= n && performance.now() - t0 < 5) {
        ctx.beginPath()
        for (let i = -n; i <= n; i++) {
          const x = w / 2 + (i - j) * cell * Math.SQRT1_2, y = h / 2 + (i + j) * cell * Math.SQRT1_2
          if (x < -cell || y < -cell || x > w + cell || y > h + cell) continue
          const r = cell * 0.58 * Math.sqrt(lum(sample(x, y)))
          if (r < 0.4) continue
          ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2)
        }
        ctx.fill(); j++
      }
      if (j <= n) requestAnimationFrame(slice); else done()
    }
    slice()
  })
}

function dotGrid(cv) {
  const { ctx, w, h } = size(cv)
  const g = 16
  ctx.fillStyle = 'rgb(79,227,207)'
  for (let y = g / 2; y < h; y += g) for (let x = g / 2; x < w; x += g) {
    const d = Math.min(x, y, w - x, h - y) / Math.min(w, h)          // 0 at the edge, 0.5 in the middle
    const k = Math.pow(Math.max(0, 1 - d * 3.2), 2.2)
    const s = 1 + 5 * k
    ctx.globalAlpha = 0.08 + 0.55 * k
    ctx.fillRect(x - s / 2, y - s / 2, s, s)
  }
  ctx.globalAlpha = 1
}

function mosaic(cv) {
  const { ctx, w, h } = size(cv)
  let seed = 9
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const lat = Array.from({ length: 64 }, rnd)
  const noise = (x, y) => {                                        // cheap smooth value noise
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi
    const v = (a, b) => lat[((a * 7 + b * 13) % 64 + 64) % 64]
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
    return (v(xi, yi) * (1 - sx) + v(xi + 1, yi) * sx) * (1 - sy) + (v(xi, yi + 1) * (1 - sx) + v(xi + 1, yi + 1) * sx) * sy
  }
  const pal = [[171, 156, 255], [79, 227, 207], [255, 170, 106], [40, 46, 80]]
  const block = (x, y, s, depth) => {
    const n = noise(x / 260, y / 260), m = noise(x / 90 + 5, y / 90)
    if (depth < 2 && m > 0.62) {                                   // busier spots split into smaller pixels
      const q = s / 2
      block(x, y, q, depth + 1); block(x + q, y, q, depth + 1); block(x, y + q, q, depth + 1); block(x + q, y + q, q, depth + 1)
      return
    }
    const c = pal[Math.min(3, Math.floor(n * 4))]
    ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(0.05 + 0.22 * m).toFixed(3)})`
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2)
  }
  for (let y = 0; y < h; y += 56) for (let x = 0; x < w; x += 56) block(x, y, 56, 0)
}

export default function FeatureBackdrops({ active, on }) {
  const root = useRef(null)
  const [cover, setCover] = useState(0)
  useEffect(() => {
    const f = e => setCover(e.detail)
    addEventListener('starlit:cover', f)
    return () => removeEventListener('starlit:cover', f)
  }, [])
  useEffect(() => {
    const el = root.current
    let drawn = false
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || drawn) return
      drawn = true
      const q = s => el.querySelector(s)
      const jobs = [
        () => COVERS.forEach(([k, rgb], i) => halftoneCover(el.querySelectorAll('.fbg--colour canvas')[i], k, rgb).catch(() => {})),
        () => dotGrid(q('.fbg--edge canvas')),
        () => mosaic(q('.fbg--games canvas')),
      ]
      const next = () => { const j = jobs.shift(); if (!j) return el.classList.add('is-drawn'); j(); idle(next) }
      idle(next)
    }, { rootMargin: '150% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const L = id => `fbg fbg--${id} ${active === id ? 'is-on' : ''}`
  const names = 'Spotify   Apple Music   YouTube Music   Your own files   '
  return (
    <div className={`feat-bg ${on ? 'is-live' : ''}`} ref={root} aria-hidden="true">
      <div className={L('colour')}>{COVERS.map(([k], i) => <canvas key={k} className={i === cover ? 'is-on' : ''} />)}</div>
      <div className={L('edge')}><canvas /></div>
      <div className={L('players')}>
        {[0, 1, 2].map(r => <div key={r} className="marquee"><span>{names.repeat(4)}</span><span>{names.repeat(4)}</span></div>)}
      </div>
      <div className={L('games')}><canvas /></div>
      <div className={L('lights')} />
      <div className={L('timing')}><div className="ruler" /></div>
    </div>
  )
}
