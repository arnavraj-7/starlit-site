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
  { id: 'colour', title: 'It takes its colours from the cover', text: 'Starlit takes the main colour from the album art and fades the lyrics, the glow and the panels over to it.' },
  { id: 'edge', title: 'A light runs round the screen edge', text: 'A thin light runs around the edge of your screen and jumps on every beat of whatever your PC is playing.' },
  { id: 'players', title: 'It works with the player you have', text: 'Spotify, Apple Music and YouTube Music, in the browser or the app, and your own files. If Windows sees it, so does Starlit.' },
  { id: 'games', title: 'It gets out of the way of games', text: 'Open a fullscreen game and Starlit drops to 12 fps so it never costs you frames, then comes back when you quit.' },
  { id: 'lights', title: 'Desk lights can match the song', text: 'RGB light bars, keyboards and docks switch to the song\u2019s colour. Only the lighting changes, never your key settings.' },
  { id: 'timing', title: 'You can fix lyrics that run early or late', text: 'Lyrics a little early or late? Press [ or ] to shift them a quarter of a second at a time, without leaving the song.' },
]
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// Each feature is shown in a photograph (generated with Gemini, assets-src/feat), which drifts
// slowly while it is on show. Two still do something live: the colour one walks the backdrop
// through the three covers, and the edge one runs the page's own edge light on a beat.
function Shot({ id, on, children }) {
  return (
    <div className={`sc sc-shot ${on ? 'run' : ''}`}>
      <img src={`/media/feat/${id}.webp`} alt="" loading="lazy" decoding="async" />
      {children}
    </div>
  )
}
function Colour({ on }) {
  const [k, setK] = useState(0)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setK(x => (x + 1) % 3), 2200)
    return () => clearInterval(id)
  }, [on])
  useEffect(() => { window.dispatchEvent(new CustomEvent('starlit:cover', { detail: k })) }, [k])
  return <Shot id="colour" on={on} />
}
function Edge({ on }) {
  // while this one is on show, the page's own edge light does the demo
  useEffect(() => { window.__edgeHype = on; return () => { window.__edgeHype = false } }, [on])
  return <Shot id="edge" on={on} />
}
const Players = ({ on }) => <Shot id="players" on={on} />
const Games = ({ on }) => <Shot id="games" on={on} />
const Lights = ({ on }) => <Shot id="lights" on={on} />
const Timing = ({ on }) => <Shot id="timing" on={on} />

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
