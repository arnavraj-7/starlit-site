import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

// Starlit's turntable (src/turntable.js in the app), as page elements. Two uses:
//  - TurntableLive sits exactly over the turntable in the hero recording, so pausing the preview
//    really lifts the arm and lets the record coast, and playing drops the needle again.
//  - TurntableScene plays the whole record change, driven by the scroll.
// Everything moves with transforms only.
export const PIVOT = [88, 15], TIP = [-3.36, 64.66], SPINDLE = [44, 50]
export const R_OUT = 36.2, R_IN = 15.5, RPM_DEG = 200
const table = []
for (let d = 0; d <= 48; d += 0.05) {
  const a = d * Math.PI / 180, c = Math.cos(a), s = Math.sin(a)
  table.push([d, Math.hypot(PIVOT[0] + TIP[0] * c - TIP[1] * s - SPINDLE[0], PIVOT[1] + TIP[0] * s + TIP[1] * c - SPINDLE[1])])
}
// Arm angle that puts the stylus at radius r from the spindle.
export const angleFor = r => { for (const [d, dist] of table) if (dist <= r) return d; return 48 }
export const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt)
// Damped spring (response in seconds, damping ratio), stepped in small sub-steps.
class Spring {
  constructor(x, response, damping) { this.x = this.target = x; this.v = 0; this.k = (2 * Math.PI / response) ** 2; this.c = 2 * damping * Math.sqrt(this.k) }
  step(dt) {
    const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n
    for (let i = 0; i < n; i++) { this.v += (-this.k * (this.x - this.target) - this.c * this.v) * h; this.x += this.v * h }
    return this.x
  }
}
// Place the arm (and its shadow, which separates as the arm lifts).
export function setArm(armG, shadow, angle, lift) {
  const s = 1 + 0.03 * lift
  const t = `rotate(${angle.toFixed(2)} ${PIVOT[0]} ${PIVOT[1]}) translate(${PIVOT[0]} ${PIVOT[1]}) scale(${s.toFixed(4)}) translate(${-PIVOT[0]} ${-PIVOT[1]})`
  armG.setAttribute('transform', t)
  shadow.setAttribute('transform', `translate(${(0.7 + 2.4 * lift).toFixed(2)} ${(1.1 + 3 * lift).toFixed(2)}) ${t}`)
  shadow.style.opacity = (0.5 - 0.22 * lift).toFixed(3)
}

export function TurntableParts({ cover, sleeve }) {
  return (
    <>
      <div className="tt-platter"><div className="tt-strobe" /></div>
      {/* the paper inner sleeve sits under the record and the jacket over it, so the record is
          drawn out between the two; two layers moved together, since one can't be split by depth */}
      {sleeve && <div className="tt-sleeve tt-sleeve-back"><div className="tt-inner" /></div>}
      <div className="tt-carrier">
        <div className="tt-spin">
          <div className="tt-vinyl" />
          <div className="tt-label"><img src={cover} alt="" /></div>
        </div>
        <div className="tt-gloss" />
        <div className="tt-spindle" />
      </div>
      {sleeve && (
        <div className="tt-sleeve">
          <div className="tt-jacket"><img src={sleeve} alt="" /></div>
        </div>
      )}
      <svg className="tt-arm" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="ttTube" x1="0" x2="1"><stop offset="0" stopColor="#6d6d75" /><stop offset=".45" stopColor="#e9e9ef" /><stop offset="1" stopColor="#55555c" /></linearGradient>
          <radialGradient id="ttBase" cx=".35" cy=".3"><stop offset="0" stopColor="#5a5a62" /><stop offset="1" stopColor="#1b1b1f" /></radialGradient>
          <filter id="ttSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".7" /></filter>
        </defs>
        <circle cx="88" cy="15" r="7.2" fill="url(#ttBase)" stroke="rgb(255 255 255 / .14)" strokeWidth=".3" />
        <g className="tt-arm-shadow" filter="url(#ttSoft)" fill="#000" stroke="#000">
          <rect x="85.4" y="2.2" width="5.2" height="7.6" rx="1.4" stroke="none" />
          <path d="M88 9 L88 66 Q88 70 86.8 73" fill="none" strokeWidth="1.5" />
          <rect x="84.6" y="72" width="4.4" height="8.4" rx=".9" transform="rotate(18 86.8 73)" stroke="none" />
        </g>
        <g className="tt-arm-g">
          <rect x="85.4" y="2.2" width="5.2" height="7.6" rx="1.4" fill="url(#ttTube)" />
          <path d="M88 9 L88 66 Q88 70 86.8 73" fill="none" stroke="url(#ttTube)" strokeWidth="1.35" strokeLinecap="round" />
          <g transform="rotate(18 86.8 73)">
            <rect x="84.6" y="72" width="4.4" height="8.4" rx=".9" fill="#1f1f24" stroke="rgb(255 255 255 / .25)" strokeWidth=".25" />
            <rect className="tt-accent" x="85.2" y="73.1" width="3.2" height=".9" rx=".3" />
            <rect x="86.3" y="79.6" width="1" height="1.3" fill="#c9c9d0" />
          </g>
          <circle cx="88" cy="15" r="2.9" fill="url(#ttTube)" stroke="rgb(0 0 0 / .5)" strokeWidth=".3" />
          <circle cx="88" cy="15" r="1" fill="#26262b" />
        </g>
      </svg>
    </>
  )
}

export default function TurntableLive({ video, cover, songStart = 0, songLength = 96 }) {
  const root = useRef(null)
  useEffect(() => {
    const el = root.current, v = video.current
    if (!el || !v) return
    const spin = el.querySelector('.tt-spin'), ring = el.querySelector('.tt-strobe')
    const armG = el.querySelector('.tt-arm-g'), shadow = el.querySelector('.tt-arm-shadow')
    // Starts at rest — arm home and lifted, platter still — until the preview first plays.
    const arm = new Spring(0, 0.9, 0.86), lift = new Spring(1, 0.22, 1)
    let angle = 0, omega = 0, last = performance.now(), started = false, shown = ''
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const tick = () => {
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now
      const playing = !v.paused
      if (playing && v.currentTime > 0.08) started = true     // not the brief warm-up play
      const p = Math.min(1, Math.max(0, (songStart + (v.currentTime || 0)) / songLength))
      const groove = angleFor(R_OUT + (R_IN - R_OUT) * p)
      arm.target = started ? groove : 0
      const over = Math.abs(arm.x - groove) < 0.8 && Math.abs(arm.v) < 4
      lift.target = !started ? 1 : !playing ? 0.6 : over ? 0 : Math.abs(arm.x - groove) > 2 ? 1 : lift.target
      const a = arm.step(dt), l = Math.min(1, Math.max(0, lift.step(dt)))
      const want = playing && !reduce ? RPM_DEG : 0
      omega = damp(omega, want, want > omega ? 2.4 : 0.9, dt)
      if (omega < 0.05 && want === 0) omega = 0
      angle = (angle + omega * dt) % 360
      const key = `${angle.toFixed(2)}|${a.toFixed(2)}|${l.toFixed(3)}`
      if (key === shown) return                    // at rest: nothing to write
      shown = key
      spin.style.transform = ring.style.transform = `rotate(${angle.toFixed(2)}deg)`
      setArm(armG, shadow, a, l)
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [video, songStart, songLength])

  return <div className="tt-live" ref={root} aria-hidden="true"><TurntableParts cover={cover} /></div>
}
