import { useEffect, useRef, useState } from 'react'


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

// Drawn in a worker on an OffscreenCanvas; here the finished bitmap is handed to a
// 'bitmaprenderer' canvas, which shows it without copying or redrawing anything.
let worker = null, seq = 0
const waiting = new Map()
function halftoneCover(cv, key, rgb) {
  if (!worker) {
    worker = new Worker(new URL('./halftone.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }) => { const done = waiting.get(data.id); waiting.delete(data.id); if (done) done(data) }
  }
  const dpr = Math.min(devicePixelRatio || 1, 1.5), w = cv.clientWidth, h = cv.clientHeight
  const id = ++seq
  return new Promise((resolve, reject) => {
    waiting.set(id, ({ bitmap, error }) => {
      if (error || !bitmap) return reject(new Error(error))
      cv.width = bitmap.width; cv.height = bitmap.height
      cv.getContext('bitmaprenderer').transferFromImageBitmap(bitmap)
      resolve()
    })
    worker.postMessage({ id, url: new URL(`/media/covers/${key}.webp`, location.href).href, w, h, dpr, rgb, cellK: 170 })
  })
}

function dotGrid(cv) {
  const { ctx, w, h } = size(cv)
  const g = 16, levels = Array.from({ length: 10 }, () => [])
  for (let y = g / 2; y < h; y += g) for (let x = g / 2; x < w; x += g) {
    const d = Math.min(x, y, w - x, h - y) / Math.min(w, h)          // 0 at the edge, 0.5 in the middle
    const k = Math.pow(Math.max(0, 1 - d * 3.2), 2.2)
    levels[Math.min(9, Math.round(k * 9))].push(x, y, 1 + 5 * k)
  }
  // one path per brightness level
  levels.forEach((list, i) => {
    if (!list.length) return
    ctx.fillStyle = `rgba(79,227,207,${(0.08 + 0.55 * i / 9).toFixed(3)})`; ctx.beginPath()
    for (let j = 0; j < list.length; j += 3) { const s = list[j + 2]; ctx.rect(list[j] - s / 2, list[j + 1] - s / 2, s, s) }
    ctx.fill()
  })
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
  const buckets = new Map()                                       // colour and strength -> rects
  const block = (x, y, sz, depth) => {
    const n = noise(x / 260, y / 260), m = noise(x / 90 + 5, y / 90)
    if (depth < 2 && m > 0.62) {                                   // busier spots split into smaller pixels
      const q = sz / 2
      block(x, y, q, depth + 1); block(x + q, y, q, depth + 1); block(x, y + q, q, depth + 1); block(x + q, y + q, q, depth + 1)
      return
    }
    const c = pal[Math.min(3, Math.floor(n * 4))]
    const key = `rgba(${c[0]},${c[1]},${c[2]},${(0.05 + 0.22 * Math.round(m * 6) / 6).toFixed(3)})`
    let list = buckets.get(key); if (!list) buckets.set(key, list = [])
    list.push(x + 1, y + 1, sz - 2)
  }
  for (let y = 0; y < h; y += 56) for (let x = 0; x < w; x += 56) block(x, y, 56, 0)
  for (const [key, list] of buckets) {
    ctx.fillStyle = key; ctx.beginPath()
    for (let j = 0; j < list.length; j += 3) ctx.rect(list[j], list[j + 1], list[j + 2], list[j + 2])
    ctx.fill()
  }
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
