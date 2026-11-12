import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

// Three depths of stars behind the page. Each depth is drawn once into its own canvas (twice
// over, stacked, so it can wrap) and then only slid by the GPU as you scroll — near stars move
// more than far ones (parallax). The nearest depth twinkles with a slow opacity pulse.
export default function Stars() {
  const root = useRef(null)
  useEffect(() => {
    const layers = [{ n: 130, r: 0.65, k: 0.03, a: 0.55 }, { n: 45, r: 1.15, k: 0.12, a: 0.85 }]
    const els = [...root.current.querySelectorAll('canvas')]
    let tileH = 0
    const draw = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5)
      const w = innerWidth, h = innerHeight
      tileH = Math.round(h * 0.75)
      const area = (w * h) / (1440 * 900)
      layers.forEach((L, li) => {
        const cv = els[li], ctx = cv.getContext('2d')
        const H = h + tileH                          // the screen plus one tile of travel
        cv.width = Math.round(w * dpr); cv.height = Math.round(H * dpr)
        cv.style.width = w + 'px'; cv.style.height = H + 'px'
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        let seed = 17 + li * 101
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
        for (let i = 0; i < Math.round(L.n * Math.max(0.5, area)); i++) {
          const x = rnd() * w, y = rnd() * tileH, r = L.r * (0.6 + rnd() * 0.8), a = L.a * (0.5 + rnd() * 0.5)
          ctx.fillStyle = `rgba(235,238,255,${a})`
          for (let dy = 0; dy < h + tileH; dy += tileH) { ctx.beginPath(); ctx.arc(x, y + dy, r, 0, Math.PI * 2); ctx.fill() }
        }
      })
    }
    draw()
    addEventListener('resize', draw)
    const setters = els.map(el => gsap.quickSetter(el, 'y', 'px'))
    const move = () => {
      const y = window.scrollY
      layers.forEach((L, i) => setters[i](-((y * L.k) % tileH)))
    }
    gsap.ticker.add(move)
    return () => { gsap.ticker.remove(move); removeEventListener('resize', draw) }
  }, [])
  return (
    <div className="stars" ref={root} aria-hidden="true">
      <canvas /><canvas className="twinkle" />
    </div>
  )
}
