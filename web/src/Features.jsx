import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

// What it does, one thing per screen, on one big dot-matrix wall: the record's halftone, grown to
// the whole screen. Each feature is a small live scene, drawn into a tiny canvas and shown as dots
// (each dot as big as the light there, in its colour). One scene melts into the next dot by dot,
// and the dots swell under your pointer. One WebGL canvas, drawn only while the section is on screen.
const FEATURES = [
  { id: 'colour', title: 'Every song brings its own colours', text: 'The lyrics, the glow and the light around them all take their colour from the album cover.', spec: 'Picked from the artwork, song by song' },
  { id: 'edge', title: 'Your screen moves with the beat', text: 'A thin line of light circles the edge of your screen and jumps on every beat you hear.', spec: 'Follows the music as it plays' },
  { id: 'players', title: 'Works with whatever you play', text: 'Spotify, Apple Music, YouTube Music or your own files. Nothing to sign in to, nothing to set up.', spec: 'Spotify · Apple Music · YouTube Music · files' },
  { id: 'screens', title: 'Lyrics on one screen, life on the other', text: 'Put the words on a second monitor or your laptop, and keep working, studying or playing on the main one.', spec: 'One screen or two' },
  { id: 'games', title: 'Never costs you a frame', text: 'Start a fullscreen game and Starlit steps right back, then comes straight back when you quit.', spec: 'Your game gets the GPU' },
  { id: 'lights', title: 'Your desk lights sing along', text: 'Light bars, keyboards and docks glow in the colour of the song that is playing.', spec: 'RGB bars · keyboards · docks' },
]

// ---------------------------------------------------------------- the scenes
// Drawn at 640 x 360 on black; light is what becomes dots. The words sit on the left of the
// screen, so everything happens from x = 280 to the right.
const SW = 640, SH = 360
const COVERS = [['/media/covers/a.webp', [171, 156, 255]], ['/media/covers/b.webp', [255, 170, 106]], ['/media/covers/c.webp', [79, 227, 207]]]
const BPM = 96
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const mixc = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k)
const beatOf = t => Math.exp(-((t * BPM / 60) % 1) * 5)         // 1 on the beat, falling away
const FONT = w => `${w} "Inter Variable", Inter, sans-serif`
const LINES = ['Oh, slow satellites', 'Turning in the dark', 'Carry us tonight', 'Over every heart']
const coverAt = t => { const n = t / 2.6, i = Math.floor(n) % 3, f = Math.min(1, (n % 1) / 0.25); return { i, j: (i + 2) % 3, f } }

function word(ctx, text, x, y, size, color, weight = 800, align = 'left') {
  ctx.font = FONT(`${weight} ${size}px`); ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, x, y)
}

const SCENES = {
  // the cover, and the colour it gives the words and the light around them
  colour(ctx, t, img) {
    const { i, j, f } = coverAt(t)
    const col = mixc(COVERS[j][1], COVERS[i][1], f)
    const g = ctx.createRadialGradient(420, 180, 10, 420, 180, 260)
    g.addColorStop(0, rgb(col, 0.32)); g.addColorStop(1, rgb(col, 0))
    ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH)
    const s = 150, x = 300, y = 105
    if (img[j]) { ctx.globalAlpha = 1 - f; ctx.drawImage(img[j], x, y, s, s) }
    if (img[i]) { ctx.globalAlpha = f; ctx.drawImage(img[i], x, y, s, s) }
    ctx.globalAlpha = 1
    word(ctx, 'slow', 468, 150, 36, rgb(mixc(col, [255, 255, 255], 0.25)))
    word(ctx, 'satellites', 468, 192, 34, rgb(col, 0.6))
  },
  // a screen, and the light running round its edge, jumping on the beat
  edge(ctx, t) {
    const x = 285, y = 70, w = 320, h = 200, b = beatOf(t)
    ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h)
    word(ctx, 'satellites', x + w / 2, y + h / 2, 34, `rgba(255,255,255,${0.35 + 0.4 * b})`, 800, 'center')
    const per = 2 * (w + h), head = ((t * 0.16) % 1) * per
    const at = d => { d = ((d % per) + per) % per; return d < w ? [x + d, y] : d < w + h ? [x + w, y + d - w] : d < 2 * w + h ? [x + w - (d - w - h), y + h] : [x, y + h - (d - 2 * w - h)] }
    for (let k = 0; k < 90; k++) {                                // a comet with a fading tail
      const [px, py] = at(head - k * 2.2), a = Math.pow(1 - k / 90, 1.6) * (0.55 + 0.45 * b)
      ctx.fillStyle = `rgba(79,227,207,${a})`; ctx.fillRect(px - 2.5, py - 2.5, 5, 5)
    }
    ctx.strokeStyle = `rgba(79,227,207,${0.12 + 0.35 * b})`; ctx.lineWidth = 2 + 3 * b; ctx.strokeRect(x, y, w, h)
  },
  // the player changes, the words keep coming
  players(ctx, t) {
    const names = ['Spotify', 'Apple Music', 'YouTube Music', 'your files']
    const n = t / 1.9, i = Math.floor(n) % names.length, f = n % 1
    const fade = Math.min(1, f / 0.15) * Math.min(1, (1 - f) / 0.15)
    ctx.save(); ctx.translate(0, (1 - fade) * 10)
    word(ctx, names[i], 300, 120, 50, `rgba(255,255,255,${0.9 * fade})`)
    ctx.restore()
    const k = Math.floor(t / 1.4) % LINES.length
    word(ctx, LINES[k], 300, 215, 34, 'rgba(255,196,150,.95)', 800)
    word(ctx, LINES[(k + 1) % LINES.length], 300, 262, 30, 'rgba(255,255,255,.22)', 800)
  },
  // the monitor shows the whole lyric, the laptop the word being sung
  screens(ctx, t) {
    const k = Math.floor(t / 0.55), line = 'Oh slow satellites turning in the dark'.split(' '), w = line[k % line.length]
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2
    ctx.strokeRect(280, 70, 210, 130)                                   // monitor
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(375, 200, 20, 22); ctx.fillRect(350, 222, 70, 3)
    ctx.strokeRect(505, 125, 115, 75)                                   // laptop
    ctx.beginPath(); ctx.moveTo(495, 212); ctx.lineTo(630, 212); ctx.lineTo(620, 200); ctx.lineTo(505, 200); ctx.closePath(); ctx.stroke()
    const SHORT = ['Oh, slow', 'satellites', 'turning in', 'the dark'], L = Math.floor(t / 1.1) % SHORT.length
    word(ctx, SHORT[L], 295, 115, 26, 'rgba(255,196,150,.95)', 800)
    word(ctx, SHORT[(L + 1) % SHORT.length], 295, 158, 26, 'rgba(255,255,255,.2)', 800)
    word(ctx, w, 562, 162, 26, 'rgba(171,156,255,.95)', 800, 'center')
  },
  // a game in front: it keeps its frames, Starlit drops to almost nothing
  games(ctx, t) {
    const on = Math.min(1, Math.max(0, (t % 6 - 1.2) / 0.8)) * Math.min(1, Math.max(0, (5.6 - t % 6) / 0.4))
    const star = Math.round(60 - 48 * on)
    word(ctx, 'your game', 300, 92, 26, 'rgba(255,255,255,.35)', 800)
    word(ctx, '144', 300, 150, 76, 'rgba(255,255,255,.9)')
    word(ctx, 'fps', 448, 168, 28, 'rgba(255,255,255,.35)', 800)
    word(ctx, 'Starlit', 300, 228, 26, 'rgba(255,255,255,.35)', 800)
    word(ctx, String(star), 300, 272, 44, `rgba(79,227,207,${0.95 - 0.5 * on})`)
    word(ctx, 'fps', 380, 282, 26, 'rgba(255,255,255,.3)', 800)
    for (let k = 0; k < 26; k++) {                                     // the game's frame-time bars, steady
      const hgt = 18 + 6 * Math.sin(k * 1.7 + t * 8)
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(500 + k * 5, 172 - hgt, 3, hgt)
    }
  },
  // the light bar, the keyboard and the dock take the song's colour
  lights(ctx, t) {
    const { i, j, f } = coverAt(t * 0.8), b = beatOf(t)
    const col = mixc(COVERS[j][1], COVERS[i][1], f)
    const g = ctx.createRadialGradient(450, 70, 5, 450, 80, 240)
    g.addColorStop(0, rgb(col, 0.45 + 0.25 * b)); g.addColorStop(1, rgb(col, 0))
    ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH)
    ctx.fillStyle = rgb(mixc(col, [255, 255, 255], 0.35), 0.95); ctx.fillRect(340, 62, 220, 8)          // light bar
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2; ctx.strokeRect(355, 78, 190, 115)       // monitor
    for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) {          // keyboard
      const wave = 0.5 + 0.5 * Math.sin(c * 0.6 - t * 3 + r * 0.4)
      ctx.fillStyle = rgb(col, 0.25 + 0.6 * wave * (0.6 + 0.4 * b)); ctx.fillRect(345 + c * 15, 240 + r * 14, 11, 10)
    }
    ctx.fillStyle = rgb(col, 0.6 + 0.3 * b); ctx.fillRect(570, 262, 40, 12)                             // dock
  },
}

// ---------------------------------------------------------------- the wall
const VERT = `attribute vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }`
const FRAG = `precision highp float;
uniform sampler2D uA, uB;
uniform vec2 uRes, uPtr;
uniform float uMix, uCell, uAsp;
vec2 fit(vec2 s) {                         // the 16:9 scene, covered, kept to the right
  float sa = uRes.x / uRes.y; vec2 uv = s;
  if (sa < uAsp) { float w = sa / uAsp; uv.x = (1. - w) * .85 + s.x * w; }
  else { float h = uAsp / sa; uv.y = (1. - h) * .5 + s.y * h; }
  return uv;
}
float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 id = floor(px / uCell), c = (id + .5) * uCell;
  vec2 uv = fit(c / uRes);
  // one scene gives way to the next in a sweep from the right, a little uneven cell by cell
  float k = clamp(uMix * 1.8 - (.8 - .5 * (c.x / uRes.x)) + (hash(id) - .5) * .2, 0., 1.);
  vec3 col = mix(texture2D(uA, uv).rgb, texture2D(uB, uv).rgb, smoothstep(0., 1., k));
  float L = dot(col, vec3(.3, .59, .11));
  // dots swell a little under the pointer
  float near = exp(-pow(length(c - uPtr) / (uCell * 9.), 2.));
  float r = uCell * .5 * (sqrt(L) * 1.35 * (1. + .45 * near));
  float rIdle = uCell * .09;                                         // every dot on the wall shows, faintly
  float d = length(px - c);
  float m = smoothstep(r + .9, r - .9, d), mi = smoothstep(rIdle + .7, rIdle - .7, d);
  vec3 lit = col / max(L, .06) * min(1., L * 1.9 + .25);              // the dot's colour, kept bright
  gl_FragColor = vec4(lit * m + vec3(.11, .12, .16) * mi * (1. - m), 1.);
}`

function useWall(canvasRef, live, enabled) {
  const ctl = useRef({ p: 0, px: -9999, py: -9999 })
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const gl = cv.getContext('webgl', { antialias: false, alpha: false })
    if (!gl) return
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s)); return s }
    const pr = gl.createProgram()
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr); gl.useProgram(pr)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const U = n => gl.getUniformLocation(pr, n)
    const u = { A: U('uA'), B: U('uB'), res: U('uRes'), ptr: U('uPtr'), mix: U('uMix'), cell: U('uCell'), asp: U('uAsp') }
    gl.uniform1i(u.A, 0); gl.uniform1i(u.B, 1)
    // two scene canvases (the one on show and the next) and their textures
    const slots = [0, 1].map(k => {
      const c = document.createElement('canvas'); c.width = SW; c.height = SH
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      return { k, c, ctx: c.getContext('2d'), t }
    })
    const img = []
    COVERS.forEach(([src], i) => { const im = new Image(); im.onload = () => { img[i] = im }; im.src = src })
    const paint = (slot, idx, t) => {
      const { ctx, c } = slot
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH)
      SCENES[FEATURES[idx].id](ctx, t, img)
      gl.activeTexture(gl.TEXTURE0 + slot.k); gl.bindTexture(gl.TEXTURE_2D, slot.t)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, c)
    }
    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.25)
      cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); gl.viewport(0, 0, cv.width, cv.height)
    }
    size()
    const ro = new ResizeObserver(size); ro.observe(cv)
    let raf = 0, alive = true, last = 0, sx = -9999, sy = -9999
    const t0 = performance.now()
    const frame = now => {
      raf = 0
      if (!alive || !live.current) return
      raf = requestAnimationFrame(frame)
      if (now - last < 31) return                                     // 30 fps is plenty for dots
      last = now
      const c = ctl.current, N = FEATURES.length, t = (now - t0) / 1000
      const p = Math.max(0, Math.min(N - 1, c.p)), i = Math.min(N - 2, Math.floor(p)), f = p - i
      const m = Math.max(0, Math.min(1, (f - 0.5) / 0.45))
      paint(slots[0], i, t)
      if (m > 0) paint(slots[1], i + 1, t)
      const dpr = cv.width / Math.max(1, cv.clientWidth)
      sx += (c.px * dpr - sx) * 0.3; sy += (c.py * dpr - sy) * 0.3
      gl.uniform2f(u.res, cv.width, cv.height); gl.uniform2f(u.ptr, sx, sy)
      gl.uniform1f(u.mix, m); gl.uniform1f(u.asp, SW / SH)
      gl.uniform1f(u.cell, Math.max(7, Math.round(cv.width / 210)))
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, slots[0].t)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, slots[1].t)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    ctl.current.kick = () => { if (!raf && live.current) raf = requestAnimationFrame(frame) }
    const onMove = e => { const r = cv.getBoundingClientRect(); ctl.current.px = e.clientX - r.left; ctl.current.py = e.clientY - r.top }
    addEventListener('pointermove', onMove, { passive: true })
    ctl.current.kick()
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('pointermove', onMove) }
  }, [canvasRef, live, enabled])
  return ctl
}

export default function Features() {
  const root = useRef(null)
  const canvas = useRef(null)
  const live = useRef(false)
  const [active, setActive] = useState(0)
  const [big, setBig] = useState(true)
  useEffect(() => {
    const q = matchMedia('(min-width: 861px) and (prefers-reduced-motion: no-preference)')
    const on = () => setBig(q.matches); on(); q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  const ctl = useWall(canvas, live, big)
  useGSAP(() => {
    if (!big) return
    const N = FEATURES.length, st = { p: 0 }
    gsap.to(st, {
      p: N - 1, ease: 'none',
      scrollTrigger: { trigger: root.current, start: 'top top', end: `+=${N * 85}%`, scrub: 0.6, pin: '.feat-pin', anticipatePin: 1 },
      onUpdate: () => {
        ctl.current.p = st.p
        const i = Math.min(N - 1, Math.floor(st.p) + ((st.p % 1) > 0.72 ? 1 : 0))
        setActive(prev => prev === i ? prev : i)
      },
    })
    ScrollTrigger.create({ trigger: root.current, start: 'top bottom', end: 'bottom top',
      onToggle: s => { live.current = s.isActive; if (s.isActive) ctl.current.kick && ctl.current.kick() } })
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
        <canvas className="feat-gl" ref={canvas} aria-hidden="true" />
        <div className="feat-shade" aria-hidden="true" />
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
