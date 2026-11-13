import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { lite, small, videoSrc, posterSrc, warm, afterIntro, whenNear } from './media.js'
import EdgeLight from './EdgeLight.jsx'
import { StippleSky, HalftoneRecord, GrooveRecord, NeedleLine } from './Dots.jsx'
import TurntableScene from './TurntableScene.jsx'
import StyleBackdrops from './StyleBg.jsx'
import TurntableLive from './TurntableLive.jsx'
import Features from './Features.jsx'
import { Logo, Footer } from './Chrome.jsx'
import './features.css'
import './chrome.css'
// From React Bits (reactbits.dev, MIT + Commons Clause): copied in as source.
import ClickSpark from './bits/ClickSpark.jsx'
import BuySheet, { PRICE_LABEL } from './Buy.jsx'
// Buying goes live once Razorpay's keys are on Vercel (VITE_SALES_OPEN=1 at build time); until
// then the download is the only action and the free trial covers everyone.
const SALES_OPEN = import.meta.env.VITE_SALES_OPEN === '1'
// Until then, buying is by hand: UPI, a screenshot, a key back.
const loadManualBuy = () => import('./ManualBuy.jsx')
const ManualBuySheet = lazy(loadManualBuy)
const Laptop3D = lazy(() => import('./Laptop3D.jsx'))

gsap.registerPlugin(ScrollTrigger, useGSAP)

// Swap for the real installer link once it's published.
const DOWNLOAD_URL = 'https://github.com/arnavraj-7/starlit-releases/releases/latest/download/Starlit-Setup.exe'

// Album colours from the three demo covers; sections hand the page one of these as it scrolls.
const ACCENT = { violet: '#ab9cff', amber: '#ffaa6a', teal: '#4fe3cf' }

const STYLES = [
  { id: 'flow', name: 'Flow', accent: ACCENT.violet, media: '/media/flow',
    text: 'The whole lyric sheet scrolls past. The line being sung is sharp, and the others blur the further away they are.' },
  { id: 'constellation', name: 'Constellation', accent: ACCENT.teal, media: '/media/constellation',
    text: 'Each word is a star. A line joins up into a shape like the Big Dipper or Cassiopeia, then the next one starts somewhere else. It looks best on a second screen.' },
  { id: 'pulse', name: 'Pulse', accent: ACCENT.amber, media: '/media/pulse',
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

function SendGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 14.5V3.5M7.8 7.7 12 3.5l4.2 4.2" /><path d="M8.5 10.5H7a2.5 2.5 0 0 0-2.5 2.5v5A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-5a2.5 2.5 0 0 0-2.5-2.5h-1.5" />
    </svg>
  )
}
function ArrowGlyph() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5" /></svg>
}

// Starlit is a Windows app, so a phone can't download it: there the button sends the page on to the
// visitor's PC (the share sheet, or the link copied). Buying still works on a phone; UPI is at home there.
const touchOnly = () => matchMedia('(hover: none) and (pointer: coarse)').matches
const SITE_URL = 'https://starlit-lyrics.vercel.app/'
function useSendLink() {
  const [note, setNote] = useState('')
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const send = async () => {
    const url = location.hostname === 'localhost' ? location.origin + '/' : SITE_URL
    if (navigator.share) {
      try { await navigator.share({ title: 'Starlit', text: 'Live lyrics for whatever’s playing on your PC.', url }); return }
      catch (e) { if (e && e.name === 'AbortError') return }
    }
    let ok = false
    try { await navigator.clipboard.writeText(url); ok = true } catch {}
    setNote(ok ? 'Link copied. Open it on your PC' : url.replace(/^https:\/\/|\/$/g, ''))
    clearTimeout(timer.current); timer.current = setTimeout(() => setNote(''), 3200)
  }
  return [note, send]
}

// One clear action, a quiet way to buy beside it, and the whole deal in one line underneath.
function Cta({ onBuy, big = false, spark }) {
  const [phone] = useState(touchOnly)
  const [note, send] = useSendLink()
  const cls = `btn ${big ? 'btn--big' : 'btn--hero'}`
  const primary = phone
    ? <button type="button" className={cls} onClick={send} aria-live="polite"><SendGlyph />{note || 'Send the link to my PC'}</button>
    : <a className={cls} href={DOWNLOAD_URL}><WindowsGlyph />Download for Windows</a>
  return (
    <div className={`cta ${big ? 'cta--big' : ''}`}>
      <ClickSpark sparkColor="#ffffff" shape="star" {...spark} style={{ height: 'auto' }}>
        <div className="cta-row">
          {big ? <span className="orbit">{primary}</span> : primary}
          <button type="button" className="cta-buy" onClick={onBuy}>Buy now<ArrowGlyph /></button>
        </div>
      </ClickSpark>
      <p className="cta-terms">
        {phone
          ? <><b>3 days free, then {PRICE_LABEL} once.</b> Starlit runs on Windows 10 and 11.</>
          : <><b>3 days free, then {PRICE_LABEL} once.</b> Yours to keep.</>}
      </p>
    </div>
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
    // Heavy: a wheel notch glides on and settles slowly (lerp .065, a little less distance per
    // notch). A precision trackpad already sends its own momentum in small steps, so it gets a
    // lighter hand and the page never trails the fingers.
    let lenis = null
    if (finePointer()) lenis = new Lenis({ lerp: 0.065, wheelMultiplier: 0.9, smoothWheel: true,
      virtualScroll: ({ event }) => {
        if (event.type === 'wheel' && lenis) {
          const d = Math.abs(event.deltaY) || Math.abs(event.deltaX)
          lenis.options.lerp = event.deltaMode === 0 && (d < 40 || d % 1 !== 0) ? 0.12 : 0.065
        }
        return true
      } })
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
    v.dataset.asked = '1'
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
          : <svg className="ic-play" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15L19.5 12z" /></svg>}
      </button>
    </div>
  )
}

function Hero({ onBuy }) {
  const root = useRef(null)
  useGSAP(() => {
    const words = gsap.utils.toArray('.hero h1 .w')
    const html = document.documentElement
    const done = () => { window.__introDone = true; window.dispatchEvent(new Event('starlit:intro-done')) }
    if (reduceMotion()) { html.classList.add('is-in'); done(); return }
    // The one orchestrated entrance: the sky comes up, each word rises out of its line and is
    // sung. The app's window waits just below, in the styles section (see Styles).
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
    // The hidden pieces start at 0.001 opacity so the browser draws them now, not at the moment
    // they are revealed. Until then the page is plain ink (see html:not(.is-in) in the
    // stylesheet), so the sky, the name and the headline all arrive in one move.
    Promise.all([document.fonts.ready, loaded]).then(calm).then(() => { window.__introAt = performance.now(); performance.mark('starlit-intro'); html.classList.add('is-in'); tl.play() })
    tl.from('.stars', { opacity: 0, duration: 1.4, ease: 'power2.out' }, 0)
      .from('.groove', { opacity: 0, scale: 0.94, rotation: -14, duration: 2.4, ease: 'expo.out' }, 0)
      .from('.masthead', { opacity: 0.001, duration: 1, ease: 'power2.out' }, 0.1)
      .from('.hero h1 .ww', { yPercent: 55, duration: 1.25, ease: 'power4.out', stagger: 0.055 }, 0.1)
      .from('.hero h1 .ww', { opacity: 0.001, duration: 0.6, ease: 'power1.inOut', stagger: 0.055 }, 0.1)
      .from('.hero-side > *', { opacity: 0.001, y: 18, duration: 1, ease: 'expo.out', stagger: 0.07 }, 0.3)
      .to(words, { opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.1 }, 0.5)
    // While the needle is on the record and the hero is in view, the page's own edge light runs
    // round the visitor's browser window on the beat: Starlit's edge light, on their screen.
    const groove = document.querySelector('.groove')
    let heroIn = true
    const sync = () => { window.__edgeHype = !!(heroIn && groove && groove.classList.contains('is-lit')) }
    const mo = groove && new MutationObserver(sync)
    mo && mo.observe(groove, { attributes: true, attributeFilter: ['class'] })
    ScrollTrigger.create({ trigger: root.current, start: 'top top', end: 'bottom top', onToggle: st => { heroIn = st.isActive; sync() } })
    // Scroll: the headline drifts away as the app's window rises over it (Styles).
    gsap.to('.groove', { yPercent: 18, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=190%', scrub: true } })
    gsap.to('.hero-row', { y: -140, opacity: 0.1, ease: 'none', force3D: true,
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
    return () => { mo && mo.disconnect(); window.__edgeHype = false }
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
            <Cta onBuy={onBuy} spark={{ sparkCount: 9, sparkRadius: 42, sparkSize: 12, glow: 0.6, duration: 600 }} />
          </div>
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
        trigger: root.current, start: 'top top', end: '+=300%', scrub: true, pin: '.laptop-pin', anticipatePin: 1,
        onEnter: () => setAccent(ACCENT.amber), onEnterBack: () => setAccent(ACCENT.amber),
        onToggle: self => root.current.classList.toggle('is-pinned', self.isActive),
        onUpdate: self => { progress.current = self.progress },
      },
    })
    const s0 = sing(steps[0]), s1 = sing(steps[1])
    // 1. the lid opening, the screen waking
    tl.to(s0.targets, s0.vars, 0.01)
      .to(steps[0], { opacity: 0, y: -40, duration: 0.06 }, 0.24)
    // 2. close on the screen; the word steps out of it, the dots running ahead of the letters
      .fromTo(q('.lw-dots'), { scale: 0.42, opacity: 0 }, { scale: 1.12, opacity: 1, duration: 0.09, ease: 'power2.in' }, 0.425)
      .fromTo(q('.lw-word'), { scale: 0.42, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.09, ease: 'power2.in' }, 0.425)
      .fromTo(q('.lw-tag'), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.035 }, 0.49)
      .to(q('.laptop-stage canvas'), { opacity: 0.22, duration: 0.05 }, 0.44)
      .to(q('.lw-dots'), { scale: 1.75, opacity: 0, duration: 0.07, ease: 'power1.in' }, 0.56)
      .to(q('.lw-word'), { scale: 1.08, opacity: 0, y: '-8vh', duration: 0.06, ease: 'power1.in' }, 0.565)
      .to(q('.lw-tag'), { opacity: 0, duration: 0.03 }, 0.56)
      .to(q('.laptop-stage canvas'), { opacity: 1, duration: 0.05 }, 0.58)
    // 3. pulled back: the monitor rises behind it, both screens playing
      .fromTo(steps[1], { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.05 }, 0.76)
      .to(s1.targets, s1.vars, 0.78)
      .set({}, {}, 1)
  }, { scope: root })
  useGSAP(() => {
    // The 3D scene only renders while its section is on screen. Created after the pin above, so
    // its end includes the pinned scroll distance. Its code is fetched once the intro has played.
    // Phones and light setups fetch it (a 270 kB chunk) only when the section is a screen and a half away.
    const mount = () => (window.requestIdleCallback || setTimeout)(() => setNear(true), { timeout: 1500 })
    const unNear = (lite || small) ? whenNear(root.current, () => setNear(true), '150% 0px') : null
    if (unNear) { /* waits for the scroll */ } else if (window.__introDone) mount(); else window.addEventListener('starlit:intro-done', mount, { once: true })
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
    const late = unNear ? 0 : setTimeout(() => setNear(true), 9000)      // whatever happens, it gets mounted
    return () => { clearTimeout(late); unNear && unNear(); window.removeEventListener('starlit:intro-done', mount) }
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

// The app's window, shown once. It rises out of the hero and holds for a moment; then it steps
// aside to the right and the drum of style names comes in beside it. Scrolling turns the drum and
// the same window changes style in place: Flow, Constellation, Pulse.
// Where each style rests in the pinned scroll (0 is the window's big moment).
const HOLD = [0.33, 0.63, 0.95]
function Styles() {
  const root = useRef(null)
  const frame = useRef(null)
  const flow = useRef(null)
  const [active, setActive] = useState(0)
  const [onScreen, setOnScreen] = useState(false)
  const [ready, setReady] = useState(false)
  const readyRef = useRef(false)
  const videos = useRef([])
  const drumST = useRef(null)
  // a style name you click scrolls the drum round to it
  const goStyle = i => {
    const st = drumST.current
    if (!st) { setActive(i); setAccent(STYLES[i].accent); return }
    const y = st.start + (st.end - st.start) * HOLD[i]
    if (window.__lenis) window.__lenis.scrollTo(y, { duration: 1.1 }); else scrollTo({ top: y, behavior: 'smooth' })
  }
  useTilt(frame, 3)
  useEffect(() => { root.current.style.setProperty('--accent', STYLES[active].accent) }, [active])
  // Nothing is fetched or played until the hero's entrance has finished (the videos are
  // preload="none"; until then the posters stand in). Then the Flow recording is fetched and
  // started and stopped once while still off screen, so its decoder is ready when the window rises.
  // On a slow connection or a small machine the posters stay and only the play button fetches.
  const onScreenRef = useRef(false)
  useEffect(() => {
    const go = () => { readyRef.current = true; setReady(true) }
    if (window.__introDone) go(); else window.addEventListener('starlit:intro-done', go, { once: true })
    const stop = lite ? null : afterIntro(() => {
      const v = flow.current
      if (!v) return
      v.preload = 'auto'
      v.play().then(() => { if (!onScreenRef.current) { v.pause(); v.currentTime = 0 } }).catch(() => {})
    })
    return () => { window.removeEventListener('starlit:intro-done', go); stop && stop() }
  }, [])
  useEffect(() => {
    onScreenRef.current = onScreen
    if (!ready) return
    videos.current.forEach((v, i) => { if (!v) return; if (i === active && onScreen && (!lite || v.dataset.asked)) v.play().catch(() => {}); else v.pause() })
  }, [active, onScreen, ready])
  useGSAP(() => {
    const items = gsap.utils.toArray('.drum-item')
    const step = 34, R = 260
    const place = p => {
      items.forEach((el, i) => {
        const a = (i - p) * step, rad = a * Math.PI / 180, off = Math.abs(i - p)
        el.style.transform = `translateY(${(Math.sin(rad) * R).toFixed(2)}px) translateZ(${((Math.cos(rad) - 1) * R).toFixed(2)}px) rotateX(${(-a).toFixed(2)}deg) scale(${(1 - Math.min(1, off) * 0.18).toFixed(3)})`
        el.style.opacity = String(Math.max(0, 1 - off * 0.76).toFixed(3))
        el.classList.toggle('is-near', off > 0.5 && off < 1.5)
      })
    }
    place(0)
    const pin = root.current.querySelector('.styles-pin'), win = root.current.querySelector('.stage-win')
    const slot = root.current.querySelector('.stage-slot'), body = root.current.querySelector('.stage-rise')
    // The window is laid out at its big size (so it stays sharp) and scaled down into the empty
    // slot beside the drum; this is the move from its centre (the screen's) to the slot's.
    const into = () => {
      const p = pin.getBoundingClientRect(), s = slot.getBoundingClientRect()
      return { x: s.left + s.width / 2 - p.left - p.width / 2, y: s.top + s.height / 2 - p.top - p.height / 2, scale: s.width / body.offsetWidth }
    }
    const mm = gsap.matchMedia()
    mm.add('(min-width: 861px) and (prefers-reduced-motion: no-preference)', () => {
      const state = { p: 0 }
      // 1. it rises out of the hero, standing up as it comes
      gsap.fromTo('.stage-rise', { y: () => innerHeight * 0.08, scale: 0.86, rotationX: 16 }, { y: 0, scale: 1, rotationX: 0, ease: 'none', force3D: true,
        scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'top top', scrub: true } })
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: root.current, start: 'top top', end: '+=330%', scrub: 0.5, pin: '.styles-pin', anticipatePin: 1, invalidateOnRefresh: true,
          snap: { snapTo: [0, ...HOLD, 1], duration: { min: 0.3, max: 0.9 }, delay: 0.18, ease: 'power3.inOut' },
          onRefresh: s => { drumST.current = s },
          onEnter: () => setAccent(STYLES[0].accent), onEnterBack: () => setAccent(STYLES[Math.round(state.p)].accent) },
        onUpdate: () => {
          place(state.p)
          const i = Math.round(state.p)
          setActive(prev => { if (prev !== i) setAccent(STYLES[i].accent); return i })
        },
      })
      // 2. held big for a beat, then it steps aside and the drum comes in beside it
      tl.to(win, { x: () => into().x, y: () => into().y, scale: () => into().scale, duration: 0.24, ease: 'power2.inOut' }, 0.06)
        .to('.stage-win .mini', { autoAlpha: 0, y: 40, duration: 0.1 }, 0.06)
        .fromTo('.styles-copy', { autoAlpha: 0, x: -70 }, { autoAlpha: 1, x: 0, duration: 0.11, ease: 'power2.out' }, 0.21)
      // 3. the drum turns and the window changes style in place
        .to(state, { p: 1, duration: 0.24 }, 0.36)
        .to(state, { p: 2, duration: 0.24 }, 0.66)
        .set({}, {}, 1)
    })
    mm.add('(min-width: 861px) and (prefers-reduced-motion: reduce)', () => {
      // no scene: the window simply sits beside the list
      const put = () => gsap.set(win, into())
      gsap.set('.stage-win .mini', { autoAlpha: 0 })
      put()
      ScrollTrigger.create({ trigger: root.current, onRefresh: put })
    })
  }, { scope: root })
  useGSAP(() => {
    ScrollTrigger.create({ trigger: root.current, start: 'top bottom', end: 'bottom top', onToggle: s => setOnScreen(s.isActive) })
  }, { scope: root })
  const warmed = useRef(false)
  useEffect(() => {
    if (!onScreen || !ready || warmed.current || lite) return
    warmed.current = true
    const timers = videos.current.slice(1).map((v, k) => setTimeout(() => {
      if (!v || !v.paused || v.currentTime > 0) return
      v.preload = 'metadata'           // just the start, to wake the decoder; the rest comes when it's chosen
      v.play().then(() => { if (!v.classList.contains('is-on')) { v.pause(); v.currentTime = 0 } }).catch(() => {})
    }, 500 + k * 450))
    return () => timers.forEach(clearTimeout)
  }, [onScreen, ready])
  return (
    <section className="styles-sec" id="styles" ref={root}>
      <div className="styles-pin">
        <StyleBackdrops active={STYLES[active].id} />
        <div className="stage-win">
          <div className="stage-rise">
            <div className="style-screen">
              {STYLES.map((s, i) => <i key={s.id} className={`frame-glow ${i === active ? 'is-on' : ''}`} style={{ '--accent': s.accent }} aria-hidden="true" />)}
              <div className="display-frame" ref={frame}>
                <div className="sizer" />
                {STYLES.map((s, i) => (
                  <video key={s.id} ref={el => { videos.current[i] = el; if (i === 0) flow.current = el }} className={i === active ? 'is-on' : ''} src={videoSrc(s.media)} poster={posterSrc(s.media)}
                    muted loop playsInline preload="none"
                    aria-label={i === 0 ? 'Starlit in the Flow style: the album on a turntable beside scrolling lyrics' : `The ${s.name} style`} />
                ))}
                {/* the turntable in the Flow recording, live: pausing really lifts the arm */}
                <div className={`tt-live-wrap ${active === 0 ? 'is-on' : ''}`}>
                  <TurntableLive video={flow} cover="/media/covers/a.webp" songStart={22} />
                </div>
              </div>
              <MiniPlayer video={flow} />
            </div>
          </div>
        </div>
        <div className="styles-grid wrap">
          <div className="styles-copy">
            <div className="drum-wrap" aria-hidden="true">
              <div className="drum">{STYLES.map((s, i) => <div className="drum-item" key={s.id} style={{ '--sc': s.accent }} onClick={() => goStyle(i)}>{s.name}</div>)}</div>
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
          <div className="stage-slot" aria-hidden="true"><i /></div>
        </div>
      </div>
    </section>
  )
}

// The share previews are drawn at their real size in px (an OBS window, a Discord popout) and
// zoomed to fit their box, so their type and spacing keep the real proportions at any width.
function useFit(ref, fill = 1) {
  useEffect(() => {
    const el = ref.current, box = el && el.parentElement
    if (!box) return
    const fit = () => {
      const z = parseFloat(el.style.zoom) || 1, r = el.getBoundingClientRect()
      const w = r.width / z, h = r.height / z
      if (w && h) el.style.zoom = String(Math.min(box.clientWidth / w, box.clientHeight / h) * fill)
    }
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    return () => ro.disconnect()
  }, [ref, fill])
}

// Small line icons for the OBS window (16 px grid, drawn like OBS's own).
const OBS_ICONS = {
  plus: <path d="M8 3v10M3 8h10" />,
  trash: <><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" /><path d="M7 7v4M9 7v4" /></>,
  filter: <><rect x="3" y="3" width="10" height="10" rx="1" /><path d="M8 3v10" /><path d="M3.5 5h4M3.5 7.5h4M3.5 10h4" /></>,
  up: <path d="M4 10l4-4 4 4" />,
  down: <path d="M4 6l4 4 4-4" />,
  gear: <><circle cx="8" cy="8" r="2" /><path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.8 3.8l1.4 1.4M10.8 10.8l1.4 1.4M3.8 12.2l1.4-1.4M10.8 5.2l1.4-1.4" /></>,
  eye: <><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" fill="currentColor" /></>,
  lock: <><rect x="4" y="7" width="8" height="6.5" rx="1" fill="currentColor" stroke="none" /><path d="M5.5 7V5.3a2.5 2.5 0 0 1 5 0" /></>,
  globe: <><circle cx="8" cy="8" r="5.8" /><path d="M2.2 8h11.6M8 2.2c-2.2 2.6-2.2 9 0 11.6M8 2.2c2.2 2.6 2.2 9 0 11.6" /></>,
  image: <><rect x="2.5" y="3" width="11" height="10" rx="1" /><path d="M2.5 11l3.5-3.5 3 3 1.8-1.8 2.7 2.7" /><circle cx="10.5" cy="5.8" r="1" fill="currentColor" stroke="none" /></>,
  speaker: <><path d="M2.5 6.2h2.3L8 3.5v9L4.8 9.8H2.5z" fill="currentColor" /><path d="M10.2 5.6a3.2 3.2 0 0 1 0 4.8M11.8 4a5.5 5.5 0 0 1 0 8" /></>,
  dots: <><circle cx="8" cy="3.5" r="1.1" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" /><circle cx="8" cy="12.5" r="1.1" fill="currentColor" stroke="none" /></>,
  caret: <path d="M4 6h8l-4 4.5z" fill="currentColor" stroke="none" />,
  undock: <><rect x="2.5" y="2.5" width="7" height="6" /><path d="M6.5 8.5v5h7v-6h-4" /></>,
  bars: <><path d="M3 13v-2M6 13V9M9 13V7M12 13V4" /></>,
  rec: <><circle cx="8" cy="8" r="4.2" fill="currentColor" stroke="none" /></>,
  live: <><circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" /><path d="M5.2 5.2a4 4 0 0 0 0 5.6M10.8 5.2a4 4 0 0 1 0 5.6" /></>,
}
const Ic = ({ n }) => <svg className="stream-ic" viewBox="0 0 16 16" aria-hidden="true">{OBS_ICONS[n]}</svg>

// The audio meter in OBS's horizontal mixer: green to -20 dB, yellow to -9, red to 0; lit up to `level` dB.
function ObsMeter({ level }) {
  const at = db => `${((db + 60) / 60) * 100}%`
  return (
    <div className="stream-meter">
      {[0, 1].map(ch => <div key={ch} className="stream-meter-bar" style={{ '--lit': at(level - ch * 1.6) }} />)}
      <div className="stream-meter-scale">{[-60, -50, -40, -30, -20, -10, 0].map(d => <span key={d} style={{ left: at(d) }}>{d}</span>)}</div>
    </div>
  )
}

// The OBS preview is a few hundred pixels wide on a phone: half-size copies there.
const STREAM_BG = small ? '/media/share/stream-bg-800.webp' : '/media/share/stream-bg.webp'
const STREAM_LINE = small ? '/media/share/obs-960.webp' : '/media/share/obs.webp'

// Beyond the PC's own screens: a phone, a post, a stream, a status. Each shown large and plain,
// with what the app really makes (the phone's screen, saved cards, the overlay's own line).
function Share() {
  const root = useRef(null), obs = useRef(null), dc = useRef(null)
  useFit(obs)
  useFit(dc, 0.94)
  // The previews are lazy images far down a long page; on a slow line they used to be requested only
  // as they scrolled in, behind the videos, and showed up empty. Now they're fetched one by one in the
  // quiet after the intro (or, on a light connection, two screens ahead), and are decoded and waiting.
  useEffect(() => {
    const list = ['/media/share/phone.webp', '/media/share/card2.webp', '/media/share/card0.webp', '/media/share/card1.webp',
      STREAM_BG, STREAM_LINE, '/media/share/avatar.webp', '/favicon.png']
    const go = () => list.reduce((p, s) => p.then(() => warm(s)), Promise.resolve())
    return lite ? whenNear(root.current, go, '200% 0px') : afterIntro(go, 300)
  }, [])
  useGSAP(() => {
    if (reduceMotion()) return
    gsap.from('.share-item', { opacity: 0, y: 60, duration: 1.1, ease: 'expo.out', stagger: 0.1,
      scrollTrigger: { trigger: '.share-grid', start: 'top 80%' } })
  }, { scope: root })
  return (
    <section className="section share-sec" id="share" ref={root}>
      <div className="wrap">
        <Sung as="h2" className="h2 sung-scroll" text="Take it off the screen." />
        <div className="share-grid">
          <article className="share-item">
            <div className="share-vis share-vis--phone">
              {/* an iPhone 15 Pro, to scale: 70.6 x 146.6 mm body, 1.55 mm bezel, titanium band */}
              <div className="phone" role="img" aria-label="Starlit's lyrics full screen on an iPhone">
                <i className="phone-btn phone-btn--action" /><i className="phone-btn phone-btn--up" /><i className="phone-btn phone-btn--down" /><i className="phone-btn phone-btn--side" />
                <div className="phone-glass" />
                <div className="phone-screen">
                  <img src="/media/share/phone.webp" alt="" width="786" height="1704" loading="lazy" decoding="async" />
                  <div className="phone-status" aria-hidden="true">
                    <span className="phone-time">9:41</span>
                    <span className="phone-icons">
                      <svg viewBox="0 0 18 12"><rect x="0" y="7.5" width="3" height="4.5" rx=".9" /><rect x="5" y="5.3" width="3" height="6.7" rx=".9" /><rect x="10" y="2.8" width="3" height="9.2" rx=".9" /><rect x="15" y="0" width="3" height="12" rx=".9" /></svg>
                      <svg viewBox="0 0 16 12"><path d="M8 2.3c2.4 0 4.6.9 6.2 2.5l1.2-1.2A10.4 10.4 0 0 0 8 .6 10.4 10.4 0 0 0 .6 3.6l1.2 1.2A8.7 8.7 0 0 1 8 2.3zM8 5.8c1.4 0 2.7.5 3.7 1.5l1.2-1.2A7 7 0 0 0 8 4.1a7 7 0 0 0-4.9 2l1.2 1.2c1-1 2.3-1.5 3.7-1.5zM8 9.2c.5 0 1 .2 1.3.5L8 11.4 6.7 9.7c.3-.3.8-.5 1.3-.5z" /></svg>
                      <svg viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.6" fill="none" stroke="currentColor" strokeOpacity=".4" /><rect x="2" y="2" width="16.5" height="9" rx="2.2" /><path d="M25 4.4v4.2c.8-.3 1.4-1.1 1.4-2.1s-.6-1.8-1.4-2.1z" fillOpacity=".4" /></svg>
                    </span>
                  </div>
                  <i className="phone-island" />
                  <i className="phone-home" />
                </div>
              </div>
            </div>
            <h3>Your phone is a screen too</h3>
            <p>Scan the code in Settings and any phone or tablet on your Wi-Fi shows the lyrics. Nothing to install.</p>
          </article>
          <article className="share-item">
            <div className="share-vis share-cards">
              <img src="/media/share/card0.webp" alt="" loading="lazy" decoding="async" />
              <img src="/media/share/card1.webp" alt="" loading="lazy" decoding="async" />
              <img src="/media/share/card2.webp" alt="A lyric card saved by Starlit" loading="lazy" decoding="async" />
            </div>
            <h3>Keep the line that hit</h3>
            <p>Press Ctrl+Alt+S to save the moment as a card or a 10-second clip, ready for your story.</p>
          </article>
          <article className="share-item">
            <div className="share-vis share-vis--stream">
              {/* OBS Studio's own window and dark theme; the canvas holds a photo and Starlit's real overlay */}
              <div className="stream" ref={obs} role="img" aria-label="OBS Studio with Starlit's lyric line as a Browser source over the stream">
                <div className="stream-title">
                  <span>OBS 32.1.1 - Profile: Untitled - Scenes: Untitled</span>
                  <span className="stream-caption"><i className="stream-min" /><i className="stream-max" /><i className="stream-close" /></span>
                </div>
                <div className="stream-menu">{['File', 'Edit', 'View', 'Docks', 'Profile', 'Scene Collection', 'Tools', 'Help'].map(m => <span key={m}>{m}</span>)}</div>
                <div className="stream-main">
                  <div className="stream-dock stream-dock--scenes">
                    <header>Scenes<Ic n="undock" /></header>
                    <ul className="stream-list">
                      <li className="is-sel">Music</li><li>Just Chatting</li><li>Starting Soon</li><li>Be Right Back</li>
                    </ul>
                    <footer><Ic n="plus" /><Ic n="trash" /><Ic n="filter" /><Ic n="up" /><Ic n="down" /></footer>
                  </div>
                  <div className="stream-dock stream-dock--sources">
                    <header>Sources<Ic n="undock" /></header>
                    <ul className="stream-list">
                      <li className="is-sel"><Ic n="globe" />Starlit lyrics<span className="stream-row-ic"><Ic n="eye" /><Ic n="lock" /></span></li>
                      <li><Ic n="image" />Tokyo at night<span className="stream-row-ic"><Ic n="eye" /><Ic n="lock" /></span></li>
                    </ul>
                    <footer><Ic n="plus" /><Ic n="trash" /><Ic n="gear" /><Ic n="up" /><Ic n="down" /></footer>
                  </div>
                  <div className="stream-preview">
                    <div className="stream-canvas">
                      <img src={STREAM_BG} alt="" width="1600" height="900" loading="lazy" decoding="async" />
                      <div className="stream-source">
                        <img src={STREAM_LINE} alt="" width="1920" height="320" loading="lazy" decoding="async" />
                        {['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'].map(h => <i key={h} className={`stream-handle stream-handle--${h}`} />)}
                      </div>
                    </div>
                  </div>
                  <div className="stream-zoom"><span>−</span><span>34%</span><span>+</span><span className="stream-zoom-mode">Scale to Window</span><Ic n="caret" /></div>
                  <div className="stream-context">
                    <span className="stream-context-name"><Ic n="globe" />Starlit lyrics</span>
                    <span className="stream-btn"><Ic n="gear" />Properties</span><span className="stream-btn"><Ic n="filter" />Filters</span><span className="stream-btn">Refresh</span>
                  </div>
                  <div className="stream-docks">
                    <div className="stream-dock stream-dock--mixer">
                      <header>Audio Mixer<Ic n="undock" /></header>
                      <div className="stream-mixer">
                        {[['Desktop Audio', '-3.2 dB', -9, 88], ['Mic/Aux', '0.0 dB', -46, 100]].map(([name, db, level, vol]) => (
                          <div className="stream-ch" key={name}>
                            <div className="stream-ch-head"><span>{name}</span><span>{db}</span></div>
                            <ObsMeter level={level} />
                            <div className="stream-ch-ctl"><span className="stream-slider" style={{ '--v': `${vol}%` }}><i /></span><Ic n="speaker" /><Ic n="dots" /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="stream-dock stream-dock--trans">
                      <header>Scene Transitions<Ic n="undock" /></header>
                      <div className="stream-trans">
                        <span className="stream-combo">Fade<Ic n="caret" /></span>
                        <div className="stream-trans-tools"><Ic n="plus" /><Ic n="trash" /><Ic n="dots" /></div>
                        <div className="stream-trans-dur"><span>Duration</span><span className="stream-combo">300 ms</span></div>
                      </div>
                    </div>
                    <div className="stream-dock stream-dock--controls">
                      <header>Controls<Ic n="undock" /></header>
                      <div className="stream-controls">
                        <span className="stream-btn">Start Streaming</span>
                        <span className="stream-btn">Start Recording</span>
                        <span className="stream-vcam"><span className="stream-btn">Start Virtual Camera</span><span className="stream-btn"><Ic n="gear" /></span></span>
                        <span className="stream-btn">Studio Mode</span>
                        <span className="stream-btn">Settings</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="stream-status">
                  <span><Ic n="bars" /></span><span><Ic n="live" />00:00:00</span><span><Ic n="rec" />00:00:00</span><span>CPU: 1.9%</span><span>60.00 / 60.00 FPS</span>
                </div>
              </div>
            </div>
            <h3>Lyrics on your stream</h3>
            <p>One link in OBS puts a clean, transparent lyric line over whatever you stream.</p>
          </article>
          <article className="share-item">
            <div className="share-vis share-vis--presence">
              {/* Discord's profile popout as it shows what Starlit sends (lib/discord.js): a "Listening"
                  activity named after the app, details = title, state = "by <artist>", the cover as the
                  large image, Starlit as the small one with the sung line as its hover text, start/end times */}
              <div className="presence" ref={dc} role="img" aria-label="A Discord profile: Listening to Starlit, Slow Satellites by Ivo Marin, 1:14 of 3:36">
                <div className="presence-banner" />
                <div className="presence-avatar"><img src="/media/share/avatar.webp" alt="" width="256" height="256" loading="lazy" decoding="async" /><i /></div>
                <div className="presence-body">
                  <div className="presence-name"><b>Mira</b><span>mira.wav</span></div>
                  <div className="presence-card">
                    <div className="presence-head">Listening to Starlit</div>
                    <div className="presence-row">
                      <div className="presence-art">
                        <img src="/media/covers/a.webp" alt="" width="64" height="64" loading="lazy" decoding="async" />
                        <img className="presence-small" src="/favicon.png" alt="" width="26" height="26" loading="lazy" decoding="async" />
                        <span className="presence-tip">“Carry us tonight”</span>
                        <svg className="presence-cursor" viewBox="0 0 13 20" aria-hidden="true"><path d="M1 1v15.5l3.8-3.6 2.6 6 2.4-1-2.5-5.9h5.3z" /></svg>
                      </div>
                      <div className="presence-meta">
                        <b>Slow Satellites</b>
                        <span>by Ivo Marin</span>
                        <div className="presence-progress"><span>01:14</span><i style={{ '--p': '34%' }} /><span>03:36</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <h3>Show what you’re playing</h3>
            <p>Your Discord status shows the song, its cover and a line of the lyrics as it plays.</p>
          </article>
        </div>
        <p className="share-credit">
          Photos: <a href="https://commons.wikimedia.org/wiki/File:Minato_City,_Tokyo,_Japan_(Night).jpg" target="_blank" rel="noopener">Minato City at night</a> by David Kernan, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>;
          {' '}<a href="https://commons.wikimedia.org/wiki/File:The_friendliest_cat_we_met_(3866554035).jpg" target="_blank" rel="noopener">The friendliest cat we met</a> by benjgibbs, <a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noopener">CC BY 2.0</a>. Both cropped.
        </p>
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
          <Sung as="h2" className="h2 sung-scroll" text="Up and running in a minute." />
          <p className="body">No account, nothing to connect.</p>
        </div>
        <ol className="setup">
          <li><h3>Run the installer</h3><p>One small Windows app. Nothing to sign in to.</p></li>
          <li><h3>Hit play anywhere</h3><p>Spotify, Apple Music, YouTube Music or your own files. Starlit picks it up by itself.</p></li>
          <li><h3>Pick a style for each screen</h3><p>Flow, Constellation or Pulse, on your monitor or your laptop.</p></li>
        </ol>
      </div>
    </section>
  )
}

function Finale({ onBuy }) {
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
        <Cta onBuy={onBuy} big spark={{ sparkCount: 12, sparkRadius: 60, sparkSize: 14, glow: 0.7, duration: 700 }} />
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

// When the page's height changes after the triggers were measured (late fonts, a section switching
// layout), measure again; otherwise triggers further down fire at the wrong scroll positions.
function useRemeasure() {
  useEffect(() => {
    let h = document.documentElement.scrollHeight, t = 0
    const ro = new ResizeObserver(() => {
      clearTimeout(t)
      t = setTimeout(() => { const n = document.documentElement.scrollHeight; if (Math.abs(n - h) > 2) { h = n; ScrollTrigger.refresh() } }, 250)
    })
    ro.observe(document.body)
    return () => { ro.disconnect(); clearTimeout(t) }
  }, [])
}

export default function App() {
  useSmoothScroll()
  useRemeasure()
  useMagnetic()
  useSungHeadings()
  const [buying, setBuying] = useState(false)
  const openBuy = () => setBuying(true)
  // /#buy opens the purchase sheet (the app links there); closing it clears the hash.
  const closeBuy = useCallback(() => {
    setBuying(false)
    if (location.hash === '#buy') history.replaceState(history.state, '', location.pathname + location.search)
  }, [])
  useEffect(() => {
    const fromHash = () => { if (location.hash === '#buy') setBuying(true) }
    fromHash()
    addEventListener('hashchange', fromHash)
    // fetch the manual sheet (and its QR code) ahead of the first click
    const t = SALES_OPEN ? 0 : setTimeout(() => loadManualBuy().catch(() => {}), 2500)
    return () => { removeEventListener('hashchange', fromHash); clearTimeout(t) }
  }, [])
  return (
    <>
      <StippleSky />
      <EdgeLight />
      <main>
        <Hero onBuy={openBuy} />
        <Styles />
        <Laptop />
        <Features />
        <Share />
        <Turntable />
        <Setup />
        <Finale onBuy={openBuy} />
      </main>
      <Footer downloadUrl={DOWNLOAD_URL} />
      {SALES_OPEN
        ? <BuySheet open={buying} onClose={closeBuy} downloadUrl={DOWNLOAD_URL} glyph={<WindowsGlyph />} />
        : buying && <Suspense fallback={null}><ManualBuySheet open onClose={closeBuy} /></Suspense>}
    </>
  )
}
