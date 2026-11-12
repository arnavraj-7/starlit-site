import { useEffect, useRef } from 'react'

// A full-bleed backdrop for each lyric style, cross-fading as the drum turns, each from the
// reel's list and each what that style is:
//   flow           a grainy gradient: soft, moving, a scroll of colour
//   constellation  a star field with the figures the style draws (Dipper, Cassiopeia, a belt)
//   pulse          thermal heat: the one word, hot in the middle
const FIGURES = [
  [[0.56, 0.2], [0.62, 0.17], [0.68, 0.19], [0.73, 0.24], [0.79, 0.22], [0.83, 0.3], [0.77, 0.33], [0.73, 0.24]],   // dipper
  [[0.58, 0.7], [0.63, 0.62], [0.68, 0.69], [0.73, 0.6], [0.78, 0.67]],                                              // cassiopeia
  [[0.86, 0.5], [0.89, 0.53], [0.92, 0.56]],                                                                          // belt
]

function starField(cv) {
  const dpr = Math.min(devicePixelRatio || 1, 1.5), w = cv.clientWidth, h = cv.clientHeight
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  let seed = 21
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < (w * h) / 900; i++) {                      // faint stipple, denser to the right
    const x = Math.pow(rnd(), 0.6) * w, y = rnd() * h, a = 0.05 + 0.25 * rnd() * (x / w)
    ctx.fillStyle = `rgba(160,240,228,${a.toFixed(3)})`; ctx.fillRect(x, y, 1.2, 1.2)
  }
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(79,227,207,.32)'
  for (const fig of FIGURES) {
    ctx.beginPath(); fig.forEach(([x, y], i) => i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)); ctx.stroke()
    for (const [x, y] of fig) {
      const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, 14)
      g.addColorStop(0, 'rgba(210,255,248,.9)'); g.addColorStop(0.2, 'rgba(79,227,207,.45)'); g.addColorStop(1, 'rgba(79,227,207,0)')
      ctx.fillStyle = g; ctx.fillRect(x * w - 14, y * h - 14, 28, 28)
    }
  }
}

export default function StyleBackdrops({ active }) {
  const root = useRef(null)
  useEffect(() => {
    const el = root.current
    let done = false
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || done) return
      done = true
      ;(window.requestIdleCallback || setTimeout)(() => starField(el.querySelector('.sbg--constellation canvas')))
    }, { rootMargin: '150% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const L = id => `sbg sbg--${id} ${active === id ? 'is-on' : ''}`
  return (
    <div className="styles-bg" ref={root} aria-hidden="true">
      <div className={L('flow')} />
      <div className={L('constellation')}><canvas /></div>
      <div className={L('pulse')} />
    </div>
  )
}
