import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
// the record's type is drawn in a worker, which needs the font file itself
import interUrl from '@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2?url'
import { lite } from './media.js'

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
      const dpr = Math.min(devicePixelRatio || 1, lite ? 1 : 2)
      const w = innerWidth, h = innerHeight, H = Math.round(h * 1.32)
      travel = H - h
      const sample = sampler(img, w, H, 2)
      LAYERS.forEach((L, li) => {
        const cv = els[li], ctx = cv.getContext('2d')
        cv.width = Math.round(w * dpr); cv.height = Math.round(H * dpr)
        cv.style.width = w + 'px'; cv.style.height = H + 'px'
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        const rnd = rng(31 + li * 977), buckets = new Map()
        const grid = L.grid * (lite ? 1.4 : 1)            // about half the dots on a light setup
        for (let gy = 0; gy < H; gy += grid) for (let gx = 0; gx < w; gx += grid) {
          const x = gx + rnd() * grid, y = gy + rnd() * grid
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

// ---------------------------------------------------------------- halftone record
export function HalftoneRecord() {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    let drawn = false, alive = true
    const draw = async () => {
      const img = await loadImage('/media/src/record.webp')
      if (!alive) return
      const dpr = Math.min(devicePixelRatio || 1, 2)
      const D = cv.clientWidth
      cv.width = Math.round(D * dpr); cv.height = Math.round(D * dpr)
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const sample = sampler(img, D, D, 2, 'contain')
      // a 45-degree screen, light dots on dark: brighter ink, bigger dot
      const cell = Math.max(7, D / 150), c = D / 2, n = Math.ceil(D / cell)
      const cos = Math.SQRT1_2, sin = Math.SQRT1_2
      ctx.fillStyle = '#ffb27a'
      // a few rows of dots per frame, each slice filled on its own, so drawing never stalls a frame
      await new Promise(done => {
        let j = -n
        const slice = () => {
          if (!alive) return done()
          const t0 = performance.now()
          while (j <= n && performance.now() - t0 < 5) {
            ctx.beginPath()
            for (let i = -n; i <= n; i++) {
              const x = c + (i * cos - j * sin) * cell, y = c + (i * sin + j * cos) * cell
              if ((x - c) ** 2 + (y - c) ** 2 > c * c) continue
              const l = lum(sample(x, y))
              // the edge fades in the drawing itself (a CSS mask here cost a 450 ms frame at the pin)
              const d = Math.hypot(x - c, y - c) / c, fade = d < 0.6 ? 1 : Math.max(0, 1 - (d - 0.6) / 0.4) ** 1.6
              const r = cell * 0.56 * Math.sqrt(Math.max(0, l - 0.04)) * fade
              if (r < 0.35) continue
              ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2)
            }
            ctx.fill(); j++
          }
          if (j <= n) requestAnimationFrame(slice); else done()
        }
        slice()
      })
      cv.classList.add('is-drawn')
    }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || drawn) return
      drawn = true; idle(() => draw().catch(() => {}))
    }, { rootMargin: '120% 0px' })
    io.observe(cv)
    return () => { alive = false; io.disconnect() }
  }, [])
  return <canvas className="halftone" ref={ref} aria-hidden="true" />
}

// ---------------------------------------------------------------- the lyric record (hero)
// A record whose grooves are the song's lyrics, set in fine type around the disc. It turns
// slowly. The light stays put while the record turns (two still wedges in a mask over the turning
// text), and where the needle rests a few words glow in the album colour, the way Starlit lights
// the word being sung. Two canvases drawn once; the turning is a GPU rotation.
export function GrooveRecord() {
  const root = useRef(null)
  useEffect(() => {
    const el = root.current
    const [dim, lit] = el.querySelectorAll('canvas')
    let alive = true
    // drawn in a worker (thousands of rotated, glowing letters); shown here without redrawing
    // two workers, one per copy, so both are ready in half the time
    let left = 2
    const workers = [[dim, false], [lit, true]].map(([cv, isLit]) => {
      const w = new Worker(new URL('./groove.worker.js', import.meta.url), { type: 'module' })
      w.onmessage = ({ data: { bm, error } }) => {
        w.terminate()
        if (!alive || error || !bm) return
        cv.width = bm.width; cv.height = bm.height; cv.getContext('bitmaprenderer').transferFromImageBitmap(bm)
        if (--left === 0) el.classList.add('is-drawn')
      }
      w.postMessage({ D: el.clientWidth, dpr: Math.min(devicePixelRatio || 1, lite ? 1 : 1.5), fontUrl: new URL(interUrl, location.href).href, lyrics: LYRICS, lit: isLit })
      return w
    })
    // only turns while it can be seen
    const io = new IntersectionObserver(([e]) => el.classList.toggle('is-off', !e.isIntersecting))
    io.observe(el)
    const stopArm = tonearm(el)
    return () => { alive = false; workers.forEach(w => w.terminate()); io.disconnect(); stopArm() }
  }, [])
  return (
    <div className="groove" ref={root} aria-hidden="true">
      <div className="groove-light"><canvas className="groove-spin" /></div>
      <div className="groove-needle-light"><canvas className="groove-spin" /></div>
      <div className="groove-label" />
      <span className="groove-hint">Drag the needle</span>
      <svg className="groove-arm" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="gaTube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5b5e6b" /><stop offset=".42" stopColor="#f1f2f7" /><stop offset=".6" stopColor="#babdca" /><stop offset="1" stopColor="#4a4d59" /></linearGradient>
          <linearGradient id="gaWeight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a3c45" /><stop offset=".35" stopColor="#c9ccd6" /><stop offset=".55" stopColor="#8d909c" /><stop offset="1" stopColor="#24262d" /></linearGradient>
          <radialGradient id="gaBase" cx=".38" cy=".32"><stop offset="0" stopColor="#5d606c" /><stop offset=".7" stopColor="#23252c" /><stop offset="1" stopColor="#14151a" /></radialGradient>
          <radialGradient id="gaTip"><stop offset="0" stopColor="#fff3e6" /><stop offset=".35" stopColor="#ffc496" /><stop offset="1" stopColor="rgb(255 170 106 / 0)" /></radialGradient>
          <filter id="gaBlur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".55" /></filter>
        </defs>
        {/* the rest the arm sits on when it's off the record */}
        <rect x="100.6" y="42.4" width="2.8" height="3.8" rx=".7" fill="url(#gaBase)" stroke="rgb(255 255 255 / .12)" strokeWidth=".15" />
        <g className="ga-shadow" filter="url(#gaBlur)"><ArmShape shadow /></g>
        <g className="ga-arm"><ArmShape /></g>
        <circle cx={ARM.px} cy={ARM.py} r="5.2" fill="url(#gaBase)" stroke="rgb(255 255 255 / .14)" strokeWidth=".2" />
        <circle cx={ARM.px} cy={ARM.py} r="2.1" fill="url(#gaWeight)" stroke="rgb(0 0 0 / .5)" strokeWidth=".15" />
        <circle className="ga-tip" r=".42" fill="#ffe9d6" />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------- the tonearm
// Pivot just off the record's upper right, as on a real deck; long enough to reach from the
// outer groove in to the label. Drawn pointing along +x from the pivot, then rotated.
const ARM = { px: 95.5, py: 6, len: 50, R0: 47.5, R1: 20 }
function ArmShape({ shadow }) {
  const L = ARM.len, f = shadow ? '#000' : undefined
  return (
    <g transform={`translate(${ARM.px} ${ARM.py})`}>
      {/* counterweight behind the pivot */}
      <rect x="-9.6" y="-2.3" width="5.2" height="4.6" rx=".9" fill={f || 'url(#gaWeight)'} />
      <rect x="-4.6" y="-.55" width="4.6" height="1.1" fill={f || 'url(#gaTube)'} />
      {/* the tube, with the slight dog-leg before the headshell */}
      <path d={`M0 0 L${L - 9} 0 Q${L - 6.6} 0 ${L - 5.2} -1.3`} fill="none" stroke={f || 'url(#gaTube)'} strokeWidth="1.05" strokeLinecap="round" />
      {/* headshell, cartridge and finger lift; a wide invisible handle makes it easy to grab */}
      <g transform={`translate(${L - 5.2} -1.3) rotate(22)`}>
        <rect x="0" y="-1.45" width="6.2" height="2.9" rx=".5" fill={f || '#1c1d22'} stroke={shadow ? 'none' : 'rgb(255 255 255 / .28)'} strokeWidth=".15" />
        <rect x="1.4" y="-1.05" width="3.2" height="2.1" rx=".3" fill={f || '#2b2d35'} />
        {!shadow && <rect x="1.7" y="-.25" width="2.6" height=".5" rx=".2" fill="#ffaa6a" opacity=".85" />}
        <path d="M5.6 -1.45 L7.6 -3.2" stroke={f || '#c9ccd6'} strokeWidth=".45" strokeLinecap="round" />
        {!shadow && <rect className="ga-handle" x="-3" y="-5" width="13" height="10" fill="transparent" />}
      </g>
      {!shadow && <rect className="ga-handle" x="4" y="-2.5" width={L - 8} height="5" fill="transparent" />}
    </g>
  )
}

// Drag the arm by its tube or headshell; set it down on the record and that groove lights up
// under the needle; let go off the record and it swings back to its rest.
function tonearm(el) {
  const svg = el.querySelector('.groove-arm'), arm = el.querySelector('.ga-arm'), shadow = el.querySelector('.ga-shadow'), tip = el.querySelector('.ga-tip')
  const { px, py, len, R0, R1 } = ARM
  const rad = d => d * Math.PI / 180
  // where the needle is for an arm angle (the headshell's dog-leg puts it a little off the tube's line)
  const stylusAt = th => {
    const c = Math.cos(rad(th)), s = Math.sin(rad(th))
    const lx = len + 1.2, ly = 1.4
    const x = px + c * lx - s * ly, y = py + s * lx + c * ly
    return [x, y, Math.hypot(x - 50, y - 50)]
  }
  // a real arm only swings from its rest, down beside the record, in toward the label
  // groove radii, in the arm's 0-100 units, matching how the worker spaces them
  const grooveAt = r => {
    const D = el.clientWidth, fs = Math.max(9, Math.min(13, D / 140)), g = fs * 2.9 / (D / 2) * 50, r0 = 50 * 0.95
    return r0 - Math.max(0, Math.round((r0 - r) / g)) * g
  }
  const angleFor = r => { let best = 95, err = 1e9; for (let t = 84; t <= 140; t += 0.1) { const e = Math.abs(stylusAt(t)[2] - r); if (e < err) { err = e; best = t } } return best }
  const REST = 79
  let angle = REST, target = REST, lift = 0.6, liftTarget = 0.6, dragging = false, raf = 0, last = performance.now()
  const show = () => {
    arm.setAttribute('transform', `rotate(${angle.toFixed(2)} ${px} ${py})`)
    shadow.setAttribute('transform', `translate(${(0.8 + 2.6 * lift).toFixed(2)} ${(1.2 + 3.4 * lift).toFixed(2)}) rotate(${angle.toFixed(2)} ${px} ${py})`)
    shadow.style.opacity = (0.55 - 0.3 * lift).toFixed(2)
    const [x, y, r] = stylusAt(angle)
    const onRecord = r < R0 + 1 && r > R1 - 1
    tip.setAttribute('cx', x.toFixed(2)); tip.setAttribute('cy', y.toFixed(2))
    tip.style.opacity = (onRecord ? Math.max(0, 1 - lift * 1.6) : 0).toFixed(2)
    // the lit window under the needle: where it is round the record, and which groove
    el.style.setProperty('--na', `${(Math.atan2(y - 50, x - 50) * 180 / Math.PI + 90).toFixed(1)}deg`)
    el.style.setProperty('--nr', `${(r / 50 * 100).toFixed(2)}%`)
    el.style.setProperty('--nx', `${x.toFixed(2)}%`); el.style.setProperty('--ny', `${y.toFixed(2)}%`)
    el.classList.toggle('is-lit', onRecord && lift < 0.25)
    el.__needle = { r, ang: Math.atan2(y - 50, x - 50), lit: onRecord && lift < 0.25 }     // read by NeedleLine
  }
  const tick = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now
    if (!dragging) angle += (target - angle) * (1 - Math.exp(-dt * 4))
    lift += (liftTarget - lift) * (1 - Math.exp(-dt * (liftTarget > lift ? 14 : 5)))
    show()
    if (dragging || Math.abs(target - angle) > 0.01 || Math.abs(liftTarget - lift) > 0.004) raf = requestAnimationFrame(tick); else raf = 0
  }
  const run = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick) } }
  const toSvg = e => { const b = svg.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * 100, (e.clientY - b.top) / b.height * 100] }
  let grabOff = 0
  const down = e => {
    if (!e.target.closest('.ga-arm')) return
    e.preventDefault()
    const [x, y] = toSvg(e)
    grabOff = angle - Math.atan2(y - py, x - px) * 180 / Math.PI          // keep the grip where it was taken
    dragging = true; liftTarget = 1; svg.setPointerCapture(e.pointerId); el.classList.add('is-lifted'); run()
    dismissHint()
  }
  const move = e => {
    if (!dragging) return
    const [x, y] = toSvg(e)
    angle = Math.max(REST, Math.min(140, Math.atan2(y - py, x - px) * 180 / Math.PI + grabOff))
  }
  const up = () => {
    if (!dragging) return
    dragging = false; el.classList.remove('is-lifted')
    const r = stylusAt(angle)[2]
    if (r < R0 + 0.5 && r > R1) { target = angleFor(grooveAt(r)); liftTarget = 0 }   // settles into the nearest groove
    else if (r <= R1) { target = angleFor(R1 + 1.5); liftTarget = 0 }  // on the label: it settles in the last groove
    else { target = REST; liftTarget = 0.6 }                           // off the record: back to its rest
    run()
  }
  svg.addEventListener('pointerdown', down); svg.addEventListener('pointermove', move)
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up)
  // once the page has come in, the arm swings over from its rest and sets down on the record
  show()
  const go = () => { target = angleFor(grooveAt(R0 * 0.82)); run(); setTimeout(() => { liftTarget = 0; run() }, 900) }
  const t0 = setTimeout(go, 2200)
  // A small hint by the headshell once the needle is down, until the visitor goes near it or
  // grabs it (then never again).
  let seen = false
  try { seen = localStorage.getItem('starlit:needle-hint') === '1' } catch {}
  const dismissHint = () => {
    el.classList.remove('hint-on'); removeEventListener('pointermove', near)
    try { localStorage.setItem('starlit:needle-hint', '1') } catch {}
  }
  const near = e => {
    const b = svg.getBoundingClientRect(), [x, y] = stylusAt(angle)
    if (Math.hypot(e.clientX - (b.left + x / 100 * b.width), e.clientY - (b.top + y / 100 * b.height)) < 120) dismissHint()
  }
  const t1 = !seen && matchMedia('(hover: hover)').matches && setTimeout(() => { el.classList.add('hint-on'); addEventListener('pointermove', near, { passive: true }) }, 4800)
  return () => { clearTimeout(t0); clearTimeout(t1); removeEventListener('pointermove', near); cancelAnimationFrame(raf); svg.removeEventListener('pointerdown', down); svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up) }
}

// ---------------------------------------------------------------- the line under the needle
// The hero's left side reads what the needle is on: the lyric line in the groove under it, with
// the word passing beneath the stylus lit. It follows the turning record, and changes when you move
// the arm. The groove's layout is worked out here the same way the worker drew it.
export function NeedleLine() {
  const ref = useRef(null)
  const [line, setLine] = useState(null)
  useEffect(() => {
    const rec = document.querySelector('.groove')
    if (!rec) return
    const spin = rec.querySelector('.groove-spin')
    const ctx = document.createElement('canvas').getContext('2d')
    const text = LYRICS.replace(/ \/ /g, '\u2003\u2003')
    const rings = new Map()
    const geom = () => { const D = rec.clientWidth, fs = Math.max(9, Math.min(13, D / 140)); return { D, c: D / 2, fs, gap: fs * 2.9 } }
    const ring = n => {                                         // where each letter of groove n sits (radians)
      if (rings.has(n)) return rings.get(n)
      const { c, fs, gap } = geom(), r = c * 0.95 - n * gap
      ctx.font = `500 ${fs}px "Inter Variable", sans-serif`
      let a = n * 0.61, i = 211 * (n + 1)
      const end = a + Math.PI * 2 - (fs * 3) / r, out = []
      while (true) {
        const ch = text[i % text.length], w = ctx.measureText(ch).width + fs * 0.08
        if (a + w / r > end) break
        out.push([i % text.length, a + w / 2 / r]); a += w / r; i++
      }
      rings.set(n, out); return out
    }
    let last = ''
    const tick = () => {
      if (rec.classList.contains('is-off')) return                // the record is off screen
      const nd = rec.__needle
      if (!nd || !nd.lit) { if (last) { last = ''; setLine(null) } return }
      const { c, gap } = geom(), n = Math.round((c * 0.95 - nd.r / 50 * c) / gap)
      const anim = spin && spin.getAnimations()[0]
      const rho = anim ? ((Number(anim.currentTime) || 0) % 150000) / 150000 * Math.PI * 2 : 0
      const want = nd.ang - rho                                   // the record has turned under the needle
      let best = null, bd = 9
      for (const [i, m] of ring(n)) { const d = Math.abs(((m - want) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); if (d < bd) { bd = d; best = i } }
      // in the gap between two lines (the em spaces) the last line stays up: slicing there gave an
      // empty line, which collapsed the pill to its equaliser
      if (best === null || bd > 0.2 || text[best] === '\u2003') return
      const s = text.lastIndexOf('\u2003', best) + 1, e = text.indexOf('\u2003', best)
      const words = text.slice(s, e < 0 ? undefined : e).trim().split(/ +/)
      if (!words[0]) return
      let at = 0, cur = 0
      for (let j = 0; j < words.length; j++) { if (best - s >= at) cur = j; at += words[j].length + 1 }
      const key = s + ':' + cur
      if (key !== last) { last = key; setLine({ words, cur }) }
    }
    const id = setInterval(tick, 110)
    return () => clearInterval(id)
  }, [])
  // On a touch screen the arm can't be picked up; it drops by itself a moment after load.
  const [idle] = useState(() => matchMedia('(hover: hover)').matches ? 'Put the needle on the record' : 'Dropping the needle…')
  // Plain inline text (no flex items), so the pill always shrinks to the line and wraps between
  // words only when the line is wider than the column.
  return (
    <p className={`needle-line ${line ? 'is-on' : ''}`} ref={ref} aria-live="off">
      <span className="nl-eq" aria-hidden="true"><i /><i /><i /></span>
      <span className="nl-text">{line ? line.words.map((w, j) => <span key={j} className={j < line.cur ? 'sung' : j === line.cur ? 'now' : ''}>{w}{j < line.words.length - 1 ? ' ' : ''}</span>) : idle}</span>
    </p>
  )
}
