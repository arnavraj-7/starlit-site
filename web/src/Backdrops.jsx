import { useEffect, useRef } from 'react'

// Vinyl grooves drawn at the screen's own resolution: concentric rings with slight variation
// and two wedges of sheen, on a transparent ground (the section's album tint shows through).
// Drawn once, in idle time, when the section is about to be seen.
export function Grooves() {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    const draw = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      const w = cv.clientWidth, h = cv.clientHeight
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      const ctx = cv.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const cx = w * 0.5, cy = h * 0.5, R = Math.hypot(w, h) * 0.5
      let seed = 7
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
      ctx.lineWidth = 0.6
      for (let r = R * 0.18; r < R; r += 1.35) {
        const gap = (r > R * 0.52 && r < R * 0.535) || (r > R * 0.74 && r < R * 0.752)   // track gaps
        ctx.strokeStyle = `rgba(225,228,240,${gap ? 0.015 : 0.03 + rnd() * 0.05})`
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
      }
    }
    let drawn = false, ro = null
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || drawn) return
      drawn = true
      ;(window.requestIdleCallback || setTimeout)(() => { draw(); ro = new ResizeObserver(draw); ro.observe(cv) })
    }, { rootMargin: '150% 0px' })
    io.observe(cv)
    return () => { io.disconnect(); if (ro) ro.disconnect() }
  }, [])
  return <canvas ref={ref} className="grooves" aria-hidden="true" />
}

// The closing section is a stage: three soft beams, one in each of the demo albums' colours,
// swing in from above and meet on the download button, with a pool of light under it.
// Each beam is a small conic gradient enlarged by the GPU (soft by nature, so nothing to blur),
// swaying a few degrees; the arm it hangs from is turned by the scroll.
const BEAMS = [
  // x %, side (-1 leans right, 1 leans left, 0 straight down), how far open it starts, width, colour, strength %, sway seconds
  [12, -1, -20, 13, '#ffaa6a', 30, 11],
  [50, 0, 0, 21, '#ab9cff', 19, 14],
  [88, 1, 20, 13, '#4fe3cf', 25, 12.5],
]
export function StageLights() {
  return (
    <div className="stage-lights" aria-hidden="true">
      {BEAMS.map(([x, side, open, w, c, a, t], i) => (
        <span key={i} className="beam-arm" data-open={open} style={{ left: `${x}%` }}>
          <i className="beam" style={{ '--side': side, '--w': `${w}deg`, '--c': c, '--amt': `${a}%`, '--t': `${t}s` }} />
        </span>
      ))}
      <i className="pool" />
    </div>
  )
}
