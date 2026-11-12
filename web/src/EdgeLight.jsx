import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

// Starlit's edge glow, around the browser window: two light trails run around the rounded
// rectangle of the viewport. Scrolling is the beat — the trails surge with scroll speed,
// stretch, brighten, then coast and drain back to a slow drift (momentum, like the app).
export default function EdgeLight() {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext('2d')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0, h = 0, dpr = 1, P = 1
    const R = 18, inset = 1.5
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2)
      w = innerWidth; h = innerHeight
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      const sw = w - 2 * inset, sh = h - 2 * inset
      P = 2 * (sw + sh) - (8 - 2 * Math.PI) * R
    }
    resize()
    addEventListener('resize', resize)
    // Point at distance s along the rounded-rect perimeter, starting top-left after the corner.
    const at = s => {
      const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset
      const top = x1 - x0 - 2 * R, side = y1 - y0 - 2 * R, arc = Math.PI * R / 2
      s = ((s % P) + P) % P
      const segs = [
        [top, t => [x0 + R + t, y0]],
        [arc, t => { const a = -Math.PI / 2 + t / R; return [x1 - R + Math.cos(a) * R, y0 + R + Math.sin(a) * R] }],
        [side, t => [x1, y0 + R + t]],
        [arc, t => { const a = t / R; return [x1 - R + Math.cos(a) * R, y1 - R + Math.sin(a) * R] }],
        [top, t => [x1 - R - t, y1]],
        [arc, t => { const a = Math.PI / 2 + t / R; return [x0 + R + Math.cos(a) * R, y1 - R + Math.sin(a) * R] }],
        [side, t => [x0, y1 - R - t]],
        [arc, t => { const a = Math.PI + t / R; return [x0 + R + Math.cos(a) * R, y0 + R + Math.sin(a) * R] }],
      ]
      for (const [len, f] of segs) { if (s <= len) return f(s); s -= len }
      return [x0 + R, y0]
    }
    const color = () => window.__accent || '#ab9cff'
    const rgb = c => { const m = c.match(/^#([0-9a-f]{6})$/i); if (m) { const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255] }
      const r = c.match(/[\d.]+/g); return r ? r.slice(0, 3).map(Number) : [171, 156, 255] }
    let want = rgb(color()), tint = want.slice(), lastY = scrollY, frame = 0, head = 0, speed = 60, energy = 0, last = performance.now(), idle = false
    const draw = () => {
      if (document.hidden) return
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now
      if (++frame % 20 === 0) want = rgb(color())
      const y = scrollY, v = Math.abs(window.__lenis ? window.__lenis.velocity : y - lastY)   // px per frame
      lastY = y
      if (v < 0.05 && energy < 0.01 && idle) return                 // at rest: the last frame (just the rim) stays
      const kick = Math.min(1, v / 40)
      energy += (Math.max(energy * 0.94, kick) - energy) * Math.min(1, dt * 10)   // rise fast, drain slow
      speed += ((60 + energy * 1400) - speed) * Math.min(1, dt * 4)
      head += speed * dt
      tint = tint.map((c, i) => c + (want[i] - c) * 0.12)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      // the faint rim that is always there
      ctx.strokeStyle = `rgba(${tint},${0.16 + energy * 0.2})`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.roundRect(inset, inset, w - 2 * inset, h - 2 * inset, R); ctx.stroke()
      if (reduce) return
      idle = energy < 0.01
      if (idle) return                                            // trails drained: leave just the rim
      const len = Math.min(P * 0.2, 60 + energy * 600)
      for (const off of [0, P / 2]) {
        const N = 36
        for (const [lw, a] of [[7, 0.12], [2, 0.9]]) {
          ctx.lineWidth = lw; ctx.lineCap = 'round'
          let [px, py] = at(head + off - len)
          for (let i = 1; i <= N; i++) {
            const k = i / N
            const [x, y] = at(head + off - len + len * k)
            const fade = k * k * (0.35 + 0.65 * energy + 0.25)
            ctx.strokeStyle = i > N - 3 ? `rgba(255,255,255,${a * fade})` : `rgba(${tint},${a * fade})`
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke()
            px = x; py = y
          }
        }
      }
    }
    gsap.ticker.add(draw)
    return () => { gsap.ticker.remove(draw); removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} className="edge-light" aria-hidden="true" />
}
