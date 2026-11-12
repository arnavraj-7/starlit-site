import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import FeatureBackdrops from './FeatBg.jsx'

// The details, shown rather than listed: a pinned stage that changes as you scroll through the
// features, each with a small live scene of what it does. Everything here moves with
// transform/opacity only, and a scene only runs while it's the one on show.
const ACCENTS = { a: '#ab9cff', b: '#ffaa6a', c: '#4fe3cf' }
const FEATURES = [
  { id: 'colour', title: 'It takes its colours from the cover', text: 'Starlit picks the main colour out of the album art and fades the lyrics, the glow and the panels over to it when the song changes.' },
  { id: 'edge', title: 'A light runs round the screen edge', text: 'It jumps on the beat. It listens to whatever your PC is playing, so it works with any player.' },
  { id: 'players', title: 'It works with the player you have', text: 'Spotify, Apple Music and YouTube Music, in the browser or the desktop apps, and local files too. Starlit follows whatever Windows reports as playing.' },
  { id: 'games', title: 'It gets out of the way of games', text: 'Open a fullscreen game and Starlit drops to 12 fps so it isn’t eating your frame rate. It goes back to normal when you quit.' },
  { id: 'lights', title: 'Desk lights can match the song', text: 'If you have RGB light bars, a keyboard or a dock, they switch to the song’s colour too. Only the lighting changes. Your key and mouse settings are left alone.' },
  { id: 'timing', title: 'You can fix lyrics that run early or late', text: 'Press [ or ] to shift them a quarter of a second at a time.' },
]
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function Colour({ on }) {
  const [k, setK] = useState(0)
  const keys = ['a', 'b', 'c']
  const box = useRef(null)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setK(x => (x + 1) % 3), 1800)
    return () => clearInterval(id)
  }, [on])
  // The colour change stays inside this scene; the washes behind it cross-fade by opacity.
  useEffect(() => {
    box.current.style.setProperty('--accent', ACCENTS[keys[k]])
    window.dispatchEvent(new CustomEvent('starlit:cover', { detail: k }))     // the backdrop follows the cover
  }, [k])
  return (
    <div className="sc sc-colour" ref={box}>
      <div className="colour-wash" aria-hidden="true">{keys.map((c, i) => <i key={c} className={i === k ? 'is-on' : ''} style={{ '--accent': ACCENTS[c] }} />)}</div>
      <div className="covers-row">
        {keys.map((c, i) => <img key={c} src={`/media/covers/${c}.webp`} alt="" loading="lazy" decoding="async" className={i === k ? 'is-on' : ''} />)}
      </div>
      <div className="colour-line">Carry us <b>tonight</b></div>
    </div>
  )
}

function Edge({ on }) {
  // while this one is on show, the page's own edge light does the demo
  useEffect(() => { window.__edgeHype = on; return () => { window.__edgeHype = false } }, [on])
  return (
    <div className={`sc sc-edge ${on ? 'run' : ''}`}>
      <div className="edge-screen">
        <span className="trail t1" /><span className="trail t2" />
        <div className="edge-lyric">Over every <b>heart</b></div>
      </div>
      <div className="beat" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ animationDelay: `${(i * 97) % 600}ms` }} />)}</div>
    </div>
  )
}

function Players({ on }) {
  const names = ['Spotify', 'Apple Music', 'YouTube Music', 'Your own files']
  const lines = ['We were counting all the lights', 'Every window like a star', 'You said nothing ever stays', 'So we drew our names in chalk']
  const [k, setK] = useState(0)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setK(x => (x + 1) % names.length), 1500)
    return () => clearInterval(id)
  }, [on])
  return (
    <div className="sc sc-players">
      <ul className="sources">
        {names.map((n, i) => <li key={n} className={i === k ? 'is-on' : ''}><span className="dot" />{n}</li>)}
      </ul>
      <div className="arrow" aria-hidden="true" />
      <div className="out glass">
        <div className="mc-eyebrow">Lyrics</div>
        <div className="out-line" key={k}>{lines[k]}</div>
      </div>
    </div>
  )
}

function Games({ on }) {
  const num = useRef(null)
  useEffect(() => {
    if (!on || !num.current) return
    const st = { v: 60 }
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2 })
    tl.set(st, { v: 60 }).to(st, { v: 12, duration: 1.4, ease: 'power2.inOut', delay: 0.8, onUpdate: () => { num.current.textContent = Math.round(st.v) } })
      .to('.sc-games .toast', { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' }, '-=0.6')
      .to('.sc-games .game-dim', { opacity: 0.75, duration: 0.8 }, '<')
      .to({}, { duration: 1.6 })
      .to('.sc-games .toast', { opacity: 0, y: 10, duration: 0.4 })
      .to('.sc-games .game-dim', { opacity: 0, duration: 0.6 }, '<')
      .to(st, { v: 60, duration: 0.8, ease: 'power2.out', onUpdate: () => { num.current.textContent = Math.round(st.v) } }, '<')
    return () => tl.kill()
  }, [on])
  return (
    <div className="sc sc-games">
      <div className="game-screen">
        <div className="game-dim" />
        <div className="fps"><span ref={num}>60</span><small>fps</small></div>
        <div className="toast glass">Game in front. Starlit dropped to 12 fps.</div>
      </div>
    </div>
  )
}

function Lights() {
  return (
    <div className="sc sc-lights">
      <div className="desk">
        <div className="bar" />
        <div className="kb">{Array.from({ length: 48 }, (_, i) => <i key={i} />)}</div>
        <div className="dock"><span /></div>
      </div>
      <div className="desk-glow" />
    </div>
  )
}

function Timing({ on }) {
  const [off, setOff] = useState(0)
  const [press, setPress] = useState(null)
  useEffect(() => {
    if (!on) return
    let i = 0
    const seq = [']', ']', '[']
    const id = setInterval(() => {
      const k = seq[i++ % seq.length]
      setPress(k); setOff(o => Math.round((o + (k === ']' ? 0.25 : -0.25)) * 100) / 100)
      setTimeout(() => setPress(null), 220)
    }, 1300)
    return () => clearInterval(id)
  }, [on])
  return (
    <div className="sc sc-timing">
      <div className="sung-line"><span>Hold</span> <span>the</span> <span>frequency,</span> <span>don’t</span> <span>let</span> <span>it</span> <span>slip</span></div>
      <div className="keys-row">
        <span className={`kbd big ${press === '[' ? 'down' : ''}`}>[</span>
        <span className="offset">{off > 0 ? '+' : ''}{off.toFixed(2)} s</span>
        <span className={`kbd big ${press === ']' ? 'down' : ''}`}>]</span>
      </div>
    </div>
  )
}

const SCENES = { colour: Colour, edge: Edge, players: Players, games: Games, lights: Lights, timing: Timing }

export default function Features() {
  const root = useRef(null)
  const [active, setActive] = useState(0)
  const [inView, setInView] = useState(false)      // scenes only run while the section is on screen
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(min-width: 861px) and (prefers-reduced-motion: no-preference)', () => {
      const N = FEATURES.length, st = { p: 0 }
      gsap.to(st, {
        p: N - 1, ease: 'none',
        snap: { snapTo: 1 / (N - 1), duration: { min: 0.2, max: 0.6 }, ease: 'power3.inOut' },
        scrollTrigger: { trigger: root.current, start: 'top top', end: `+=${N * 60}%`, scrub: 0.4, pin: '.feat-pin' },
        onUpdate: () => {
          const i = Math.round(st.p)
          setActive(prev => prev === i ? prev : i)
          root.current.style.setProperty('--feat-p', (st.p / (N - 1)).toFixed(4))
        },
      })
    })
    ScrollTrigger.create({ trigger: root.current, start: 'top bottom', end: 'bottom top', onToggle: s => setInView(s.isActive) })
    const sky = () => { window.__accent = ACCENTS.c }
    ScrollTrigger.create({ trigger: root.current, start: 'top 60%', end: 'bottom 40%', onEnter: sky, onEnterBack: sky })
  }, { scope: root })
  return (
    <section className="features" id="details" ref={root}>
      <div className="feat-pin wrap">
        {/* one feature per screen: its title lights up word by word, like a sung line */}
        <div className="feat-copy">
          {FEATURES.map((f, i) => (
            <div key={f.id} className={`fc ${i === active ? 'is-on' : ''}`} aria-hidden={i !== active}>
              <h3 className="fc-title">{f.title.split(' ').map((w, j) => <span key={j} style={{ '--j': j }}>{w} </span>)}</h3>
              <p className="fc-text">{f.text}</p>
            </div>
          ))}
          <div className="feat-dots" aria-hidden="true">{FEATURES.map((f, i) => <i key={f.id} className={i === active ? 'is-on' : ''} />)}</div>
        </div>
        <FeatureBackdrops active={FEATURES[active].id} on={inView} />
        <div className="feat-stage">
          {FEATURES.map((f, i) => {
            const Scene = SCENES[f.id]
            return <div key={f.id} className={`scene-wrap ${i === active ? 'is-on' : ''}`}><Scene on={i === active && inView && !reduce()} /></div>
          })}
        </div>
      </div>
    </section>
  )
}
