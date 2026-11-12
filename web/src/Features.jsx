import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

// What it does, one thing per screen: the words on the left, the app doing it on the right.
const FEATURES = [
  { id: 'colour', title: 'Every song brings its own colours', text: 'The lyrics, the glow and the light around them all take their colour from the album cover.', spec: 'Picked from the artwork, song by song' },
  { id: 'edge', title: 'Your screen moves with the beat', text: 'A thin line of light circles the edge of your screen and jumps on every beat you hear.', spec: 'Follows the music as it plays' },
  { id: 'players', title: 'Works with whatever you play', text: 'Spotify, Apple Music, YouTube Music or your own files. Nothing to sign in to, nothing to set up.', spec: 'Spotify · Apple Music · YouTube Music · files' },
  { id: 'screens', title: 'Lyrics on one screen, life on the other', text: 'Put the words on a second monitor or your laptop, and keep working, studying or playing on the main one.', spec: 'One screen or two' },
  { id: 'games', title: 'Never costs you a frame', text: 'Start a fullscreen game and Starlit steps right back, then comes straight back when you quit.', spec: 'Your game gets the GPU' },
  { id: 'lights', title: 'Your desk lights sing along', text: 'Light bars, keyboards and docks glow in the colour of the song that is playing.', spec: 'RGB bars · keyboards · docks' },
]

// Each feature is shown by the app itself: a short clip recorded from Starlit (assets-src, the
// same off-screen capture as the styles footage) at /media/feat/<id>.mp4. Until a clip exists its
// slot stays empty and the words carry the screen on their own.
function Clip({ id, on }) {
  const ref = useRef(null)
  const [ok, setOk] = useState(true)
  useEffect(() => { const v = ref.current; if (!v) return; if (on) v.play().catch(() => {}); else v.pause() }, [on])
  if (!ok) return null
  return (
    <div className={`feat-clip ${on ? 'is-on' : ''}`}>
      <video ref={ref} src={`/media/feat/${id}.mp4`} poster={`/media/feat/${id}.jpg`} muted loop playsInline preload="metadata"
        onError={() => setOk(false)} aria-hidden="true" />
    </div>
  )
}

export default function Features() {
  const root = useRef(null)
  const [inView, setInView] = useState(false)
  const [active, setActive] = useState(0)
  const [big, setBig] = useState(true)
  useEffect(() => {
    const q = matchMedia('(min-width: 861px) and (prefers-reduced-motion: no-preference)')
    const on = () => setBig(q.matches); on(); q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  useGSAP(() => {
    if (!big) return
    const N = FEATURES.length, st = { p: 0 }
    gsap.to(st, {
      p: N - 1, ease: 'none',
      scrollTrigger: { trigger: root.current, start: 'top top', end: `+=${N * 85}%`, scrub: 0.6, pin: '.feat-pin', anticipatePin: 1 },
      onUpdate: () => {
        const i = Math.min(N - 1, Math.floor(st.p) + ((st.p % 1) > 0.72 ? 1 : 0))
        setActive(prev => prev === i ? prev : i)
      },
    })
    ScrollTrigger.create({ trigger: root.current, start: 'top bottom', end: 'bottom top',
      onToggle: s => setInView(s.isActive) })
    const sky = () => { window.__accent = '#4fe3cf' }
    ScrollTrigger.create({ trigger: root.current, start: 'top 60%', end: 'bottom 40%', onEnter: sky, onEnterBack: sky })
  }, { scope: root, dependencies: [big], revertOnUpdate: true })
  // while the edge one is on show, the page's own edge light joins in
  useEffect(() => { window.__edgeHype = big && FEATURES[active].id === 'edge'; return () => { window.__edgeHype = false } }, [active, big])

  if (!big) return (
    <section className="features features--list" id="details" ref={root}>
      <div className="wrap">
        {FEATURES.map(f => (
          <article className="fl" key={f.id}>
            <h3 className="fc-title">{f.title}</h3>
            <p className="fc-text">{f.text}</p>
            <p className="fc-spec"><i aria-hidden="true" />{f.spec}</p>
          </article>
        ))}
      </div>
    </section>
  )
  return (
    <section className="features" id="details" ref={root}>
      <div className="feat-pin">
        <div className="feat-clips">{FEATURES.map((f, i) => <Clip key={f.id} id={f.id} on={inView && i === active} />)}</div>
        <div className="feat-copy wrap">
          <div className="feat-count" aria-hidden="true"><b>{String(active + 1).padStart(2, '0')}</b> / {String(FEATURES.length).padStart(2, '0')}</div>
          {FEATURES.map((f, i) => (
            <div key={f.id} className={`fc ${i === active ? 'is-on' : ''}`} aria-hidden={i !== active}>
              <h3 className="fc-title">{f.title.split(' ').map((w, j) => <span key={j} style={{ '--j': j }}>{w} </span>)}</h3>
              <p className="fc-text">{f.text}</p>
              <p className="fc-spec"><i aria-hidden="true" />{f.spec}</p>
            </div>
          ))}
          <div className="feat-dots" aria-hidden="true">{FEATURES.map((f, i) => <i key={f.id} className={i === active ? 'is-on' : ''} />)}</div>
        </div>
      </div>
    </section>
  )
}
