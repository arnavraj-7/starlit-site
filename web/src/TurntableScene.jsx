import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { TurntableParts, angleFor, setArm, damp, R_OUT, RPM_DEG } from './TurntableLive.jsx'

// The record change, played by the scroll (progress 0..1): the sleeve slides in with the record
// inside, the record is drawn out onto the platter and set down, the platter starts, the arm
// swings over and the needle drops. Real elements moved with transforms — sharp at any size and
// nothing to decode, unlike an image sequence.
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const seg = (p, a, b) => clamp((p - a) / (b - a))
const ease = k => k * k * (3 - 2 * k)
const out = k => 1 - Math.pow(1 - k, 3)
const lerp = (a, b, k) => a + (b - a) * k

export default function TurntableScene({ progress, cover }) {
  const root = useRef(null)
  useEffect(() => {
    const el = root.current
    const q = s => el.querySelector(s)
    const spin = q('.tt-spin'), ring = q('.tt-strobe'), carrier = q('.tt-carrier'), sleeve = q('.tt-sleeve:not(.tt-sleeve-back)'), back = q('.tt-sleeve-back')
    const armG = q('.tt-arm-g'), shadow = q('.tt-arm-shadow'), fill = el.parentElement.querySelector('.np-fill')
    const groove = angleFor(R_OUT)
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let angle = 0, omega = 0, last = performance.now(), shown = '', visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = performance.now() })
    io.observe(el)
    const tick = () => {
      if (!visible) return
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now
      const p = clamp(progress.current)
      // sleeve: in from the left, waits, then leaves the way it came
      const sx = p < 0.34 ? lerp(-62, 27, out(seg(p, 0, 0.22))) : lerp(27, -52, ease(seg(p, 0.34, 0.54)))
      const sa = Math.min(seg(p, 0, 0.06), 1 - seg(p, 0.44, 0.54))
      // record: rides in the sleeve, is drawn out to the spindle a little raised, then set down
      const cx = p < 0.34 ? sx : lerp(27, 44, ease(seg(p, 0.34, 0.5)))
      const cs = p < 0.34 ? 0.95 : p < 0.5 ? lerp(0.95, 1.035, ease(seg(p, 0.34, 0.44))) : lerp(1.035, 1, out(seg(p, 0.5, 0.57)))
      const ca = seg(p, 0, 0.06)
      // arm: swings over once the record is down, then the needle drops and creeps inward
      const a = groove * ease(seg(p, 0.6, 0.8)) + 2.5 * seg(p, 0.9, 1)
      const lift = 1 - ease(seg(p, 0.8, 0.88))
      const want = p > 0.56 && !reduce ? RPM_DEG : 0
      omega = damp(omega, want, want > omega ? 2.4 : 3, dt)
      if (omega < 0.05 && want === 0) omega = 0
      angle = (angle + omega * dt) % 360
      const key = `${p.toFixed(4)}|${angle.toFixed(2)}`
      if (key === shown) return
      shown = key
      spin.style.transform = ring.style.transform = `rotate(${angle.toFixed(2)}deg)`
      // translate % is of the element's own size, so convert from % of the square
      const lean = p < 0.34 ? 1 : 1 - ease(seg(p, 0.36, 0.52))
      carrier.style.transform = `translate(${((cx - 44) / 75 * 100).toFixed(3)}%, 0) perspective(1200px) rotateY(${(-18 * lean).toFixed(2)}deg) rotateX(${(5 * lean).toFixed(2)}deg) scale(${cs.toFixed(4)})`
      carrier.style.setProperty('--lift', Math.max(0, (cs - 0.95) / 0.085).toFixed(3))     // its shadow spreads as it is lifted
      carrier.style.opacity = Math.max(0.001, ca).toFixed(3)
      back.style.transform = sleeve.style.transform = `translate(${((sx - 27) / 74 * 100).toFixed(3)}%, -50%) perspective(1200px) rotateY(-18deg) rotateX(5deg)`
      back.style.opacity = sleeve.style.opacity = Math.max(0.001, sa).toFixed(3)
      setArm(armG, shadow, a, lift)
      if (fill) fill.style.transform = `scaleX(${(0.04 + 0.1 * seg(p, 0.88, 1)).toFixed(4)})`
    }
    gsap.ticker.add(tick)
    return () => { gsap.ticker.remove(tick); io.disconnect() }
  }, [progress])

  return (
    <div className="tt-stack" aria-hidden="true">
      {/* the app's album card: the record player inside it, the song and the controls below */}
      <div className="np-card">
        <div className="tt-live tt-scene" ref={root}><TurntableParts cover={cover} sleeve={cover} /></div>
        <div className="np-eyebrow"><span className="eq"><i /><i /><i /><i /></span>Now playing</div>
        <div className="np-title">Slow Satellites</div>
        <div className="np-artist">Ivo Marin</div>
        <div className="np-bar"><i className="np-fill" /></div>
        <div className="np-times"><span>0:04</span><span>−1:32</span></div>
        <div className="np-transport">
          <span className="np-btn"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9.5 12z" /></svg></span>
          <span className="np-btn np-btn--play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4.5h4v15H6zM14 4.5h4v15h-4z" /></svg></span>
          <span className="np-btn"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l10.5-7z" /></svg></span>
        </div>
      </div>
    </div>
  )
}
