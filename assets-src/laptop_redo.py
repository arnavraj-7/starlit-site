"""The laptop section as a choreographed scroll: closed from above, opens and wakes into Pulse,
the camera closes in and the word steps out of the screen as huge halftone type, then it pulls
back and turns with its edge light running. Three short captions."""
import io, sys
SRC = 'C:/projects/starlit-site/web/src/'

LAPTOP = r'''function Laptop() {
  const root = useRef(null)
  const progress = useRef(0)
  const [near, setNear] = useState(false)
  const [active, setActive] = useState(false)
  useGSAP(() => {
    const steps = gsap.utils.toArray('.laptop-copy .step')
    if (reduceMotion()) { progress.current = 1; return }
    const q = gsap.utils.selector(root)
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: root.current, start: 'top top', end: '+=400%', scrub: true, pin: '.laptop-pin', anticipatePin: 1,
        onEnter: () => setAccent(ACCENT.amber), onEnterBack: () => setAccent(ACCENT.amber),
        onUpdate: self => { progress.current = self.progress },
      },
    })
    const s0 = sing(steps[0]), s1 = sing(steps[1])
    // 1. closed, from above
    tl.to(s0.targets, s0.vars, 0.02)
      .to(steps[0], { opacity: 0, y: -40, duration: 0.07 }, 0.3)
    // 3. the word steps out of the screen: the dots run ahead of the letters, so it has depth
      .fromTo(q('.lw-dots'), { scale: 0.2, opacity: 0 }, { scale: 1.12, opacity: 1, duration: 0.1, ease: 'power2.in' }, 0.575)
      .fromTo(q('.lw-word'), { scale: 0.24, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.1, ease: 'power2.in' }, 0.58)
      .fromTo(q('.lw-tag'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.04 }, 0.645)
      .to(q('.laptop-stage canvas'), { opacity: 0.22, duration: 0.06 }, 0.59)
      .to(q('.lw-dots'), { scale: 1.75, opacity: 0, duration: 0.08, ease: 'power1.in' }, 0.7)
      .to(q('.lw-word'), { scale: 1.08, opacity: 0, y: '-8vh', duration: 0.07, ease: 'power1.in' }, 0.705)
      .to(q('.lw-tag'), { opacity: 0, duration: 0.03 }, 0.7)
      .to(q('.laptop-stage canvas'), { opacity: 1, duration: 0.06 }, 0.72)
    // 4. pulled back and turned, edge light running
      .fromTo(steps[1], { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.05 }, 0.8)
      .to(s1.targets, s1.vars, 0.82)
      .set({}, {}, 1)
  }, { scope: root })
  useGSAP(() => {
    // The 3D scene only renders while its section is on screen. Created after the pin above, so
    // its end includes the pinned scroll distance. Its code is fetched once the intro has played.
    const mount = () => (window.requestIdleCallback || setTimeout)(() => setNear(true), { timeout: 1500 })
    if (window.__introDone) mount(); else window.addEventListener('starlit:intro-done', mount, { once: true })
    // It is mounted early (above) but only draws frames while the section is actually on screen;
    // on a tall window the early trigger is already active at the top of the page.
    ScrollTrigger.create({ trigger: root.current, start: 'top bottom', end: 'bottom top', onToggle: s => setActive(s.isActive) })
    const late = setTimeout(() => setNear(true), 9000)      // whatever happens, it gets mounted
    return () => { clearTimeout(late); window.removeEventListener('starlit:intro-done', mount) }
  }, { scope: root })
  // the word's halftone: drawn once, when the section is near, then only moved and faded
  const dots = useRef(null)
  useEffect(() => { if (near) halftoneWord(dots.current, root.current.querySelector('.lw-word')) }, [near])
  return (
    <section className="laptop-sec" id="screens" ref={root}>
      <div className="laptop-pin">
        <div className="laptop-copy wrap">
          <div className="step">
            <Sung as="h2" className="h2" text="Got a laptop too?" />
            <p className="body">Starlit lights that screen up as well.</p>
          </div>
          <div className="step step--side">
            <Sung as="h2" className="h2" text="Each screen, its own style." />
            <p className="body">Full lyrics on the monitor. One word at a time on the laptop.</p>
          </div>
        </div>
        <div className="laptop-stage">
          {near && <Suspense fallback={null}><Laptop3D progress={progress} active={active} /></Suspense>}
        </div>
        <div className="laptop-word" aria-hidden="true">
          <canvas className="lw-dots" ref={dots} />
          <span className="lw-word">satellites</span>
          <p className="lw-tag"><b>Pulse</b> just the word being sung</p>
        </div>
      </div>
    </section>
  )
}

// The escaping word as a field of dots: the letters, blurred, sampled on a grid, each dot as big
// as the ink under it. One path, filled once.
async function halftoneWord(cv, word) {
  if (!cv || !word) return
  try { await document.fonts.load('800 200px Inter') } catch {}
  const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(devicePixelRatio || 1, 1.5)
  if (!w || !h) return
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
  const cs = getComputedStyle(word), fs = parseFloat(cs.fontSize)
  const m = document.createElement('canvas'); m.width = w; m.height = h
  const g = m.getContext('2d')
  g.font = `800 ${fs}px Inter, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.letterSpacing = cs.letterSpacing
  const step = Math.max(7, Math.round(fs / 22))
  g.filter = `blur(${step * 1.6}px)`; g.fillStyle = '#fff'; g.fillText(word.textContent, w / 2, h / 2)
  g.filter = `blur(${step * 5}px)`; g.globalAlpha = 0.6; g.fillText(word.textContent, w / 2, h / 2)
  const px = g.getImageData(0, 0, w, h).data
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0)
  x.fillStyle = '#ffb27a'; x.beginPath()
  for (let yy = step / 2, j = 0; yy < h; yy += step, j++) {
    for (let xx = step / 2 + (j % 2) * step / 2; xx < w; xx += step) {
      const a = px[((yy | 0) * w + (xx | 0)) * 4 + 3] / 255
      const r = step * 0.5 * Math.sqrt(a) * 1.05
      if (r < 0.45) continue
      x.moveTo(xx + r, yy); x.arc(xx, yy, r, 0, Math.PI * 2)
    }
  }
  x.fill()
}

'''

p = SRC + 'App.jsx'
s = io.open(p, encoding='utf-8', newline='').read()
a = s.index('function Laptop() {'); b = s.index('// The three styles on a drum')
s = s[:a] + LAPTOP + s[b:]
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('App.jsx ok')

c = io.open(SRC + 'styles.css', encoding='utf-8', newline='').read()
old = """.laptop-copy .h2 { margin-inline: auto; max-width: 24ch; }
.laptop-copy .body { margin-inline: auto; }"""
if old not in c: sys.exit('css anchor missing')
c = c.replace(old, """.laptop-copy .h2 { margin-inline: auto; max-width: 24ch; }
.laptop-copy .body { margin-inline: auto; }
/* the last caption sits to the left of the turned laptop */
.laptop-copy .step--side { top: calc(50vh - clamp(56px, 8vh, 104px) - 3em); left: 0; right: auto; text-align: left; max-width: 34vw; }
.laptop-copy .step--side .h2 { margin-inline: 0; font-size: clamp(2.2rem, 3.6vw, 6rem); max-width: 11ch; }
.laptop-copy .step--side .body { margin-inline: 0; max-width: 30ch; }
/* the word that steps out of the laptop's screen */
.laptop-word { position: absolute; inset: 0; z-index: 3; pointer-events: none; display: grid; place-items: center; }
.laptop-word > * { grid-area: 1 / 1; }
.lw-dots { width: 100%; height: 100%; opacity: 0; will-change: transform, opacity; }
.lw-word { font: 800 clamp(5rem, 13vw, 22rem)/1 Inter, sans-serif; letter-spacing: -.045em; color: #fff3ea; opacity: 0; will-change: transform, opacity;
  text-shadow: 0 0 .12em rgb(255 170 110 / .55), 0 0 .5em rgb(255 140 80 / .25); }
.lw-tag { align-self: end; margin: 0 0 14vh; font-size: clamp(1rem, 1.05vw, 1.6rem); color: var(--mute); opacity: 0; }
.lw-tag b { color: #ffc496; font-weight: 700; margin-right: .5em; letter-spacing: .02em; }
@media (prefers-reduced-motion: reduce) { .laptop-word { display: none; } .laptop-copy .step:first-child { opacity: 0; } .laptop-copy .step--side { opacity: 1; } }""", 1)
c = c.replace(".hidden-video { position: fixed; left: 0; top: 0; width: 2px; height: 2px; opacity: .01; pointer-events: none; }   /* decoded for the 3D screen; display:none would stop its frames */\n", "", 1)
io.open(SRC + 'styles.css', 'w', encoding='utf-8', newline='').write(c)
print('css ok')
