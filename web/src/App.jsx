import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import EdgeLight from './EdgeLight.jsx'
import { StippleSky, HalftoneRecord, GrooveRecord, NeedleLine } from './Dots.jsx'
import StyleBackdrops from './StyleBg.jsx'
import TurntableLive from './TurntableLive.jsx'
import TurntableScene from './TurntableScene.jsx'
import Features from './Features.jsx'
import { Logo, Footer } from './Chrome.jsx'
import './features.css'
import './chrome.css'
// From React Bits (reactbits.dev, MIT + Commons Clause): copied in as source.
import ClickSpark from './bits/ClickSpark.jsx'
const Laptop3D = lazy(() => import('./Laptop3D.jsx'))

gsap.registerPlugin(ScrollTrigger, useGSAP)

// Swap for the real installer link once it's published.
const DOWNLOAD_URL = '#download'

// Album colours from the three demo covers; sections hand the page one of these as it scrolls.
const ACCENT = { violet: '#ab9cff', amber: '#ffaa6a', teal: '#4fe3cf' }

const STYLES = [
  { id: 'flow', name: 'Flow', accent: ACCENT.violet, video: '/media/flow.mp4', poster: '/media/flow.jpg',
    text: 'The whole lyric sheet scrolls past. The line being sung is sharp, and the others blur the further away they are.' },
  { id: 'constellation', name: 'Constellation', accent: ACCENT.teal, video: '/media/constellation.mp4', poster: '/media/constellation.jpg',
    text: 'Each word is a star. A line joins up into a shape like the Big Dipper or Cassiopeia, then the next one starts somewhere else. It looks best on a second screen.' },
  { id: 'pulse', name: 'Pulse', accent: ACCENT.amber, video: '/media/pulse.mp4', poster: '/media/pulse.jpg',
    text: 'Only the word being sung, as big as the screen allows, with the rest of the line small underneath.' },
]

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches
// The colour the sky and the window's edge light drift toward. The sections themselves carry
// their colour in the stylesheet: animating one --accent on :root restyled the whole page on
// every frame of every change, which was most of the scroll jank.
const setAccent = c => { window.__accent = c }
// Light a heading's words like a sung line (used inside scrubbed timelines).
const sing = el => ({ targets: el.querySelectorAll('.w'), vars: { opacity: 1, stagger: 0.012, duration: 0.06, ease: 'none' } })

function WindowsGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm0 13 7.5 1.1v-7H3v5.9Zm8.4 1.2L21 21v-8.3h-9.6v7Zm0-15.4v7.2H21V3l-9.6 1.3Z" />
    </svg>
  )
}

// A heading whose words light up like a sung lyric.
function Sung({ text, as: Tag = 'span', className = '' }) {
  return (
    <Tag className={`sung ${className}`} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} aria-hidden="true"><span className="wm"><span className="ww" data-w={w}><span className="w">{w}</span></span></span>{' '}</span>
      ))}
    </Tag>
  )
}

function useSmoothScroll() {
  useEffect(() => {
    ScrollTrigger.config({ ignoreMobileResize: true })      // the address bar hiding is not a resize
    gsap.ticker.lagSmoothing(50, 16)        // a stalled frame pauses the animations; they never skip ahead
    if (reduceMotion()) { document.documentElement.classList.add('no-motion'); return }
    // Touch screens keep their own scrolling: it is already smooth and runs off the main thread.
    const lenis = finePointer() ? new Lenis({ lerp: 0.09, smoothWheel: true }) : null
    window.__lenis = lenis
    const tick = t => lenis.raf(t * 1000)
    if (lenis) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(tick) }
    const onClick = e => {
      const a = e.target.closest('a[href^="#"]')
      if (!a || a.getAttribute('href').length < 2) return
      const el = document.querySelector(a.getAttribute('href'))
      if (!el) return
      e.preventDefault()
      if (lenis) lenis.scrollTo(el, { offset: -20, duration: 1.6 }); else el.scrollIntoView({ behavior: 'smooth' })
    }
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('click', onClick); gsap.ticker.remove(tick); if (lenis) lenis.destroy(); window.__lenis = null }
  }, [])
}

// Buttons lean a little toward the pointer (fine pointers only).
function useMagnetic() {
  useEffect(() => {
    if (!finePointer() || reduceMotion()) return
    const offs = []
    document.querySelectorAll('.btn').forEach(b => {
      const x = gsap.quickTo(b, 'x', { duration: 0.6, ease: 'power3.out' })
      const y = gsap.quickTo(b, 'y', { duration: 0.6, ease: 'power3.out' })
      const move = e => { const r = b.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * 0.14); y((e.clientY - r.top - r.height / 2) * 0.2) }
      const leave = () => { x(0); y(0) }
      b.addEventListener('pointermove', move); b.addEventListener('pointerleave', leave)
      offs.push(() => { b.removeEventListener('pointermove', move); b.removeEventListener('pointerleave', leave) })
    })
    return () => offs.forEach(f => f())
  }, [])
}

// A screen that tilts toward the pointer like the app's album cover, with a sheen that follows.
function useTilt(ref, max = 5) {
  useEffect(() => {
    const el = ref.current
    if (!el || !finePointer() || reduceMotion()) return
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.9, ease: 'power3.out' })
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.9, ease: 'power3.out' })
    const move = e => {
      const r = el.getBoundingClientRect()
      const u = (e.clientX - r.left) / r.width - 0.5, v = (e.clientY - r.top) / r.height - 0.5
      rx(-v * max); ry(u * max)
      el.style.setProperty('--sheen', `${((u + 0.5) * 100).toFixed(1)}%`)
    }
    const leave = () => { rx(0); ry(0) }
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave)
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave) }
  }, [ref, max])
}

// The app's stage mini-player, floating over the hero: cover, song, live progress, EQ.
function MiniPlayer({ video }) {
  const fill = useRef(null)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    const v = video.current
    if (!v) return
    const sync = () => setPlaying(!v.paused)
    v.addEventListener('play', sync); v.addEventListener('pause', sync)
    const tick = () => { if (fill.current && v.duration) fill.current.style.transform = `scaleX(${(v.currentTime / v.duration).toFixed(4)})` }
    gsap.ticker.add(tick)
    return () => { gsap.ticker.remove(tick); v.removeEventListener('play', sync); v.removeEventListener('pause', sync) }
  }, [video])
  const toggle = () => {
    const v = video.current
    if (v.paused) v.play(); else v.pause()
  }
  return (
    <div className={`mini glass ${playing ? '' : 'is-paused'}`}>
      <img src="/media/covers/a.webp" alt="" width="52" height="52" />
      <div className="mini-text">
        <div className="mini-eyebrow"><span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>{playing ? 'Now playing' : 'Paused'}</div>
        <div className="mini-title">Slow Satellites</div>
        <div className="mini-artist">Ivo Marin</div>
        <div className="mini-track"><i ref={fill} /></div>
      </div>
      <button className="mini-play" onClick={toggle} aria-label={playing ? 'Pause the preview' : 'Play the preview'}>
        {playing
          ? <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4.5h4v15H6zM14 4.5h4v15h-4z" /></svg>
          : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15L19.5 12z" /></svg>}
      </button>
    </div>
  )
}

function Hero() {
  const root = useRef(null)
  const frame = useRef(null)
  const video = useRef(null)
  useTilt(frame, 4)
  useGSAP(() => {
    const words = gsap.utils.toArray('.hero h1 .w')
    const v = video.current
    const html = document.documentElement
    const done = () => { window.__introDone = true; window.dispatchEvent(new Event('starlit:intro-done')) }
    if (reduceMotion()) { html.classList.add('is-in'); v.play().catch(() => {}); done(); return }
    // The one orchestrated entrance: the sky comes up, each word rises out of its line and is
    // sung, the screen rises into place — and then the record is put on: the preview starts and
    // the live tonearm swings over and drops as the platter spins up.
    // It waits until the page has loaded and laid out, so nothing else is competing for frames.
    const tl = gsap.timeline({ paused: true, onComplete: done })
    const loaded = new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }))
    // ...and then until the browser has had 150 ms of unbroken short frames (load-time layout and
    // first paint can stall for hundreds of ms; starting inside that made the intro jump).
    const calm = () => new Promise(res => {
      const t0 = performance.now(); let last = t0, quiet = 0
      const f = now => {
        const d = now - last; last = now
        quiet = d < 24 ? quiet + d : 0
        if (quiet >= 150 || now - t0 > 3000) res(); else requestAnimationFrame(f)
      }
      requestAnimationFrame(f)
    })
    // Warm-up while still hidden: start and stop the preview once so the video decoder is
    // ready, and keep the hidden pieces at 0.001 opacity so the browser draws them now, not at
    // the moment they are revealed.
    v.play().then(() => { v.pause(); v.currentTime = 0 }).catch(() => {})
    // Until then the page is plain ink (see html:not(.is-in) in the stylesheet), so the sky, the
    // name, the headline and the screen all arrive in one move.
    Promise.all([document.fonts.ready, loaded]).then(calm).then(() => { window.__introAt = performance.now(); performance.mark('starlit-intro'); html.classList.add('is-in'); tl.play() })
    tl.from('.stars', { opacity: 0, duration: 1.4, ease: 'power2.out' }, 0)
      .from('.groove', { opacity: 0, scale: 0.94, rotation: -14, duration: 2.4, ease: 'expo.out' }, 0)
      .from('.masthead', { opacity: 0.001, duration: 1, ease: 'power2.out' }, 0.1)
      .from('.hero h1 .ww', { yPercent: 55, duration: 1.25, ease: 'power4.out', stagger: 0.055 }, 0.1)
      .from('.hero h1 .ww', { opacity: 0.001, duration: 0.6, ease: 'power1.inOut', stagger: 0.055 }, 0.1)
      .from('.hero-side > *', { opacity: 0.001, y: 18, duration: 1, ease: 'expo.out', stagger: 0.07 }, 0.3)
      .from('.hero .screen-wrap', { opacity: 0.001, y: 140, scale: 0.94, rotationX: 18, duration: 1.5, ease: 'expo.out' }, 0.35)
      .to(words, { opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.1 }, 0.5)
      .call(() => { v.play().catch(() => {}) }, null, 1.35)
      .from('.hero .mini', { opacity: 0.001, x: -30, y: 20, scale: 0.94, duration: 1.1, ease: 'expo.out' }, 1.45)
    // Once in, the headline is sung the way the app sings a line: it waits dim, like the next
    // lyric, and each word lights from left to right as it is sung, rises a hair and blooms, then
    // settles; the line stays lit. Timed like singing it (Ev-ery word, / the mo-ment / it's sung).
    // It sings again whenever the needle is put down on the record.
    const wws = words.map(w => w.parentElement)
    const TIMES = [0.46, 0.52, 0.2, 0.5, 0.22, 0.95]             // how long each word is held
    const GAPS = [0, 0.04, 0.3, 0.03, 0.12, 0.05]                 // breath before it
    const glow = a => `drop-shadow(0 0 ${(0.07 * a).toFixed(3)}em rgb(255 244 236 / ${(0.45 * a).toFixed(3)}))`   // a tight sheen on the letters, never a haze around the word
    let sing = null
    const singLine = (from = 0) => {
      if (sing) sing.kill()
      sing = gsap.timeline({ delay: from })
      words.forEach((w, i) => {
        const at = `>${GAPS[i] ? '+=' + GAPS[i] : ''}`
        sing.addLabel(`w${i}`, i ? at : 0)
          .to(w, { '--sungAt': '0%', duration: TIMES[i], ease: 'none' }, `w${i}`)
          .fromTo(wws[i], { y: 0 }, { y: '-0.035em', duration: 0.35, ease: 'back.out(3)' }, `w${i}`)
          .fromTo(wws[i], { filter: glow(0) }, { filter: glow(1), duration: 0.12, ease: 'power2.out' }, `w${i}`)
          .to(wws[i], { filter: glow(0), duration: 0.9, ease: 'power2.out' }, `w${i}+=${TIMES[i]}`)
          .to(wws[i], { y: 0, duration: 0.8, ease: 'power3.out' }, `w${i}+=${TIMES[i]}`)
      })
    }
    const unsing = () => gsap.to(words, { '--sungAt': '100%', duration: 0.45, ease: 'power2.in', stagger: { each: 0.03, from: 'end' } })
    const startSinging = () => { gsap.set('.hero h1 .wm', { overflow: 'visible' }); singLine(0.25) }   // room for the bloom
    if (window.__introDone) startSinging(); else window.addEventListener('starlit:intro-done', startSinging, { once: true })
    // the needle going down on the record plays the line again
    const groove = document.querySelector('.groove')
    let wasLit = groove ? groove.classList.contains('is-lit') : false
    const mo = groove && new MutationObserver(() => {
      const lit = groove.classList.contains('is-lit')
      if (lit && !wasLit && window.__introDone) { unsing(); singLine(0.55) }
      wasLit = lit
    })
    mo && mo.observe(groove, { attributes: true, attributeFilter: ['class'] })
    // a word you point at blooms like the word being sung (the glow sits on the outer word: the
    // inner one's mask would cut it off at its box)
    const hovers = wws.map((ww, i) => {
      const enter = () => {
        gsap.fromTo(ww, { filter: glow(1) }, { filter: glow(0), duration: 1.1, ease: 'power2.out' })
        gsap.fromTo(ww, { y: 0 }, { y: '-0.04em', duration: 0.5, ease: 'back.out(3)', overwrite: 'auto' })
      }
      const leave = () => gsap.to(ww, { y: 0, duration: 0.7, ease: 'power3.out', overwrite: 'auto' })
      ww.addEventListener('pointerenter', enter); ww.addEventListener('pointerleave', leave)
      return () => { ww.removeEventListener('pointerenter', enter); ww.removeEventListener('pointerleave', leave) }
    })
    // Scroll: the screen grows toward you, the headline drifts away.
    gsap.to('.hero .screen-wrap', { scale: 1.07, ease: 'none', force3D: true,
      scrollTrigger: { trigger: '.hero .screen-wrap', start: 'top 75%', end: 'bottom top', scrub: true } })
    gsap.to('.groove', { yPercent: 18, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
    gsap.to('.hero-row', { y: -140, opacity: 0.1, ease: 'none', force3D: true,
      scrollTrigger: { trigger: '.hero', start: 'top top', end: '55% top', scrub: true } })
    gsap.to('.hero .mini', { y: -60, ease: 'none', force3D: true,
      scrollTrigger: { trigger: '.hero .screen-wrap', start: 'top 60%', end: 'bottom top', scrub: true } })
    // The preview only plays while it's on screen.
    ScrollTrigger.create({ trigger: root.current, start: 'top top', end: 'bottom top',
      onLeave: () => v.pause(), onEnterBack: () => v.play().catch(() => {}) })
    return () => { hovers.forEach(f => f()); mo && mo.disconnect(); window.removeEventListener('starlit:intro-done', startSinging) }
  }, { scope: root })
  return (
    <section className="hero" id="top" ref={root}>
      <GrooveRecord />
      <div className="wrap masthead"><a className="brand" href="#top" aria-label="Starlit"><Logo /></a></div>
      <div className="wrap" style={{ perspective: '1600px' }}>
        <div className="hero-row">
          <Sung as="h1" text="Every word, the moment it’s sung." />
          <div className="hero-side">
            <p className="lead">Live lyrics for whatever’s playing on your PC.</p>
            <NeedleLine />
            <ClickSpark sparkColor="#ffffff" shape="star" sparkCount={9} sparkRadius={42} sparkSize={12} glow={0.6} duration={600} style={{ height: 'auto' }}>
              <div className="cta-row">
                <a className="btn" href={DOWNLOAD_URL}><WindowsGlyph />Download for Windows</a>
                <a className="btn btn--ghost" href="#styles">See the styles</a>
              </div>
            </ClickSpark>
            <p className="fineprint">Free, for Windows 10 and 11. Works with Spotify, Apple Music, YouTube Music and local files.</p>
          </div>
        </div>
        <div className="screen-wrap">
          <div className="display-frame" ref={frame}>
            <video ref={video} src="/media/flow.mp4" poster="/media/flow.jpg" muted loop playsInline preload="auto"
              aria-label="Starlit on a monitor: the album on a turntable beside scrolling lyrics" />
            <TurntableLive video={video} cover="/media/covers/a.webp" songStart={22} />
          </div>
          <MiniPlayer video={video} />
        </div>
      </div>
    </section>
  )
}

function Laptop() {
  const root = useRef(null)
  const progress = useRef(0)
  const entry = useRef(0)
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
      .fromTo(q('.lw-dots'), { scale: 0.5, opacity: 0 }, { scale: 1.12, opacity: 1, duration: 0.1, ease: 'power2.in' }, 0.575)
      .fromTo(q('.lw-word'), { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.1, ease: 'power2.in' }, 0.575)
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
    // Arriving, the laptop rises out of the dark and fades in (entry, also read by the 3D scene);
    // leaving, it fades before the next section is under it. No edge of it is ever cut by a seam.
    const stage = root.current.querySelector('.laptop-stage')
    const ends = self => {
      const y = self.scroll(), vh = innerHeight
      const k = Math.min(1, Math.max(0, (y - self.start) / (vh * 0.85)))
      const out = Math.min(1, Math.max(0, (y - (self.end - vh * 1.05)) / (vh * 0.55)))
      entry.current = k
      const f = Math.min(1, Math.max(0, (k - 0.4) / 0.6))              // not until the section is well in
      stage.style.opacity = (Math.min(f * f * (3 - 2 * f), 1 - out * out * (3 - 2 * out))).toFixed(3)
    }
    ScrollTrigger.create({ trigger: root.current, start: 'top bottom', end: 'bottom top', onToggle: s => setActive(s.isActive),
      onUpdate: ends, onRefresh: ends })
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
          {near && <Suspense fallback={null}><Laptop3D progress={progress} entry={entry} active={active} /></Suspense>}
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
  // blurred well past the letters' shapes, so the dots read as the word's light, not a second copy of it
  g.filter = `blur(${step * 3.2}px)`; g.fillStyle = '#fff'; g.globalAlpha = 0.85; g.fillText(word.textContent, w / 2, h / 2)
  g.filter = `blur(${step * 9}px)`; g.globalAlpha = 0.7; g.fillText(word.textContent, w / 2, h / 2)
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

// The three styles on a drum that turns with the scroll.
function Styles() {
  const root = useRef(null)
  const frame = useRef(null)
  const [active, setActive] = useState(0)
  const [onScreen, setOnScreen] = useState(false)
  const videos = useRef([])
  useTilt(frame, 3)
  useEffect(() => { root.current.style.setProperty('--accent', STYLES[active].accent) }, [active])
  useEffect(() => {
    videos.current.forEach((v, i) => { if (!v) return; if (i === active && onScreen) v.play().catch(() => {}); else v.pause() })
  }, [active, onScreen])
  useGSAP(() => {
    const items = gsap.utils.toArray('.drum-item')
    const step = 34, R = 260
    const place = p => {
      items.forEach((el, i) => {
        const a = (i - p) * step, rad = a * Math.PI / 180, off = Math.abs(i - p)
        el.style.transform = `translateY(${(Math.sin(rad) * R).toFixed(2)}px) translateZ(${((Math.cos(rad) - 1) * R).toFixed(2)}px) rotateX(${(-a).toFixed(2)}deg) scale(${(1 - Math.min(1, off) * 0.08).toFixed(3)})`
        el.style.opacity = String(Math.max(0, 1 - off * 0.62).toFixed(3))
      })
    }
    place(0)
    const mm = gsap.matchMedia()
    mm.add('(min-width: 861px) and (prefers-reduced-motion: no-preference)', () => {
      const state = { p: 0 }
      gsap.to(state, {
        p: STYLES.length - 1, ease: 'none',
        snap: { snapTo: 1 / (STYLES.length - 1), duration: { min: 0.25, max: 0.7 }, ease: 'power3.inOut' },
        scrollTrigger: { trigger: root.current, start: 'top top', end: `+=${STYLES.length * 70}%`, scrub: 0.5, pin: '.styles-pin', anticipatePin: 1,
          onEnter: () => setAccent(STYLES[0].accent), onEnterBack: () => setAccent(STYLES[Math.round(state.p)].accent) },
        onUpdate: () => {
          place(state.p)
          const i = Math.round(state.p)
          setActive(prev => { if (prev !== i) setAccent(STYLES[i].accent); return i })
        },
      })
    })
  }, { scope: root })
  useGSAP(() => {
    ScrollTrigger.create({ trigger: root.current, start: 'top bottom', end: 'bottom top', onToggle: s => setOnScreen(s.isActive) })
  }, { scope: root })
  const warmed = useRef(false)
  useEffect(() => {
    if (!onScreen || warmed.current) return
    warmed.current = true
    const timers = videos.current.slice(1).map((v, k) => setTimeout(() => {
      if (!v || !v.paused || v.currentTime > 0) return
      v.play().then(() => { if (!v.classList.contains('is-on')) { v.pause(); v.currentTime = 0 } }).catch(() => {})
    }, 500 + k * 450))
    return () => timers.forEach(clearTimeout)
  }, [onScreen])
  return (
    <section className="styles-sec" id="styles" ref={root}>
      <div className="styles-pin wrap">
        <StyleBackdrops active={STYLES[active].id} />
        <div>
          <div className="drum-wrap" aria-hidden="true">
            <div className="drum">{STYLES.map(s => <div className="drum-item" key={s.id}>{s.name}</div>)}</div>
          </div>
          <div className="style-info">
            {STYLES.map((s, i) => (
              <div className={`info ${i === active ? 'is-on' : ''}`} key={s.id} onClick={() => { setActive(i); setAccent(s.accent) }}>
                <h3 className="info-name">{s.name}</h3>
                <p className="body">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="style-screen">
          {STYLES.map((s, i) => <i key={s.id} className={`frame-glow ${i === active ? 'is-on' : ''}`} style={{ '--accent': s.accent }} aria-hidden="true" />)}
          <div className="display-frame" ref={frame}>
            <div className="sizer" />
            {STYLES.map((s, i) => (
              <video key={s.id} ref={el => (videos.current[i] = el)} className={i === active ? 'is-on' : ''} src={s.video} poster={s.poster}
                muted loop playsInline preload="metadata" aria-label={`The ${s.name} style`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// The record change, played by the scroll on the real turntable (see TurntableScene).
function Turntable() {
  const root = useRef(null)
  const progress = useRef(0)
  useGSAP(() => {
    const steps = gsap.utils.toArray('.tt-steps .step')
    const mm = gsap.matchMedia()
    mm.add('(min-width: 861px) and (prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline({ defaults: { ease: 'none' },
        scrollTrigger: { trigger: root.current, start: 'top top', end: '+=240%', scrub: 0.5, pin: '.tt-pin', anticipatePin: 1,
          onUpdate: self => { progress.current = self.progress },
          onEnter: () => setAccent(ACCENT.amber), onEnterBack: () => setAccent(ACCENT.amber) } })
      const [a, b, c] = steps.map(sing)
      tl.to('.progress-rail i', { scaleX: 1, duration: 1 }, 0)
        .fromTo('.halftone', { rotation: -8, scale: 1.06 }, { rotation: 22, scale: 1, duration: 1 }, 0)     // the record turns as the scene plays
        .to(a.targets, a.vars, 0)
        .to(steps[0], { opacity: 0, y: -20, duration: 0.06 }, 0.3)
        .fromTo(steps[1], { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.06 }, 0.36)
        .to(b.targets, b.vars, 0.4)
        .to(steps[1], { opacity: 0, y: -20, duration: 0.06 }, 0.58)
        .fromTo(steps[2], { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.06 }, 0.64)
        .to(c.targets, c.vars, 0.68)
    })
    mm.add('(max-width: 860px), (prefers-reduced-motion: reduce)', () => {
      // No pinning: the finished state (record playing) stands in for the sequence.
      progress.current = 1
      document.querySelectorAll('.tt-steps .w').forEach(w => { w.style.opacity = '1' })
      ScrollTrigger.create({ trigger: root.current, start: 'top 60%', onEnter: () => setAccent(ACCENT.amber), onEnterBack: () => setAccent(ACCENT.amber) })
    })
  }, { scope: root })
  return (
    <section className="tt-sec" id="turntable" ref={root}>
      <div className="plate plate--grooves" aria-hidden="true" />
      <div className="tt-pin wrap">
        <HalftoneRecord />
        <TurntableScene progress={progress} cover="/media/covers/b.webp" />
        <div>
          <div className="progress-rail" aria-hidden="true"><i /></div>
          <div className="tt-steps">
            <div className="step">
              <Sung as="h2" className="h2" text="A new song gets a new record." />
              <p className="body">When the track changes, the album art turns into a record player. The sleeve slides in with the record inside.</p>
            </div>
            <div className="step">
              <Sung as="h2" className="h2" text="The record comes out of the sleeve." />
              <p className="body">It lands on the platter with the cover printed on its label, and starts turning.</p>
            </div>
            <div className="step">
              <Sung as="h2" className="h2" text="Then the needle drops." />
              <p className="body">The arm swings over, sets down, and creeps toward the label as the song plays. Pause the music and the arm lifts while the record slows to a stop.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Setup() {
  const root = useRef(null)
  useGSAP(() => {
    if (reduceMotion()) return
    gsap.from('.setup li', { opacity: 0, y: 24, stagger: 0.1, duration: 0.8, ease: 'expo.out',
      scrollTrigger: { trigger: '.setup', start: 'top 80%' } })
  }, { scope: root })
  return (
    <section className="section setup-sec" ref={root}>
      <div className="wrap setup-grid">
        <div>
          <Sung as="h2" className="h2 sung-scroll" text="Setting it up" />
          <p className="body">It takes about a minute, and most of that is the download.</p>
        </div>
        <ol className="setup">
          <li><h3>Install it</h3><p>Run the installer. There’s no account and nothing to sign in to.</p></li>
          <li><h3>Play something</h3><p>Use any app or browser tab. The lyrics show up on their own.</p></li>
          <li><h3>Pick a style</h3><p>Each screen can have a different one, and you can switch whenever you like.</p></li>
        </ol>
      </div>
    </section>
  )
}

function Finale() {
  const root = useRef(null)
  useGSAP(() => {
    ScrollTrigger.create({ trigger: root.current, start: 'top 60%', onEnter: () => setAccent(ACCENT.amber), onEnterBack: () => setAccent(ACCENT.amber) })
    ScrollTrigger.create({ trigger: root.current, start: 'top bottom', end: 'bottom top', toggleClass: 'in-view' })
    if (reduceMotion()) return
    // The closing line is sung as you scroll into it.
    gsap.to('.finale .w', { opacity: 1, stagger: 0.5, ease: 'none',
      scrollTrigger: { trigger: '.finale', start: 'top 75%', end: 'center 50%', scrub: 0.6 } })
  }, { scope: root })
  return (
    <section className="finale" id="download" ref={root}>
      <div className="wrap">
        <Sung as="h2" className="h2" text="Try it with your own music." />
        <ClickSpark sparkColor="#ffffff" shape="star" sparkCount={12} sparkRadius={60} sparkSize={14} glow={0.7} duration={700} style={{ height: 'auto' }}>
          <div className="cta-row">
            <span className="orbit"><a className="btn btn--big" href={DOWNLOAD_URL}><WindowsGlyph />Download for Windows</a></span>
          </div>
        </ClickSpark>
        <p className="fineprint">Free. Windows 10 and 11, on one screen or two.</p>
      </div>
    </section>
  )
}

// Headings outside the pinned scenes are sung as they scroll into view.
function useSungHeadings() {
  useGSAP(() => {
    if (reduceMotion()) return
    gsap.utils.toArray('.sung-scroll').forEach(el => {
      gsap.to(el.querySelectorAll('.w'), { opacity: 1, stagger: 0.3, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 85%', end: 'top 50%', scrub: 0.5 } })
    })
  })
}

export default function App() {
  useSmoothScroll()
  useMagnetic()
  useSungHeadings()
  return (
    <>
      <StippleSky />
      <EdgeLight />
      <main>
        <Hero />
        <Laptop />
        <Styles />
        <Turntable />
        <Features />
        <Setup />
        <Finale />
      </main>
      <Footer downloadUrl={DOWNLOAD_URL} />
    </>
  )
}
