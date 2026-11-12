import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

// What it does, one thing per screen. Each is a photograph you can look into: a depth map of it
// (Depth Anything, assets-src/feat3d) lets the camera drift through the room as you scroll and
// lean with your pointer, and one photo dissolves into the next through halftone dots, the
// page's own texture. One WebGL canvas, drawn only while the section is on screen.
const FEATURES = [
  { id: 'colour', title: 'Every song brings its own colours', text: 'The lyrics, the glow and the light around them all take their colour from the album cover.', spec: 'Picked from the artwork, song by song' },
  { id: 'edge', title: 'Your screen moves with the beat', text: 'A thin line of light circles the edge of your screen and jumps on every beat you hear.', spec: 'Follows the music as it plays' },
  { id: 'players', title: 'Works with whatever you play', text: 'Spotify, Apple Music, YouTube Music or your own files. Nothing to sign in to, nothing to set up.', spec: 'Spotify · Apple Music · YouTube Music · files' },
  { id: 'screens', title: 'Lyrics on one screen, life on the other', text: 'Put the words on a second monitor or your laptop, and keep working, studying or playing on the main one.', spec: 'One screen or two' },
  { id: 'games', title: 'Never costs you a frame', text: 'Start a fullscreen game and Starlit steps right back, then comes straight back when you quit.', spec: 'Your game gets the GPU' },
  { id: 'lights', title: 'Your desk lights sing along', text: 'Light bars, keyboards and docks glow in the colour of the song that is playing.', spec: 'RGB bars · keyboards · docks' },
]
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const VERT = `attribute vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }`
const FRAG = `precision highp float;
uniform sampler2D uA, uAD, uB, uBD;
uniform vec2 uRes, uOff;
uniform float uImg, uMix, uDollyA, uDollyB, uCell;

// cover-fit, kept to the right where the subject is (the words sit over the dark left side)
vec2 fit(vec2 s) {
  float sa = uRes.x / uRes.y;
  vec2 uv = s;
  if (sa < uImg) { float w = sa / uImg; uv.x = (1. - w) * .82 + s.x * w; }
  else { float h = uImg / sa; uv.y = (1. - h) * .5 + s.y * h; }
  return uv;
}
// look into the photo: near things move further and grow faster than far ones
vec2 look(sampler2D dep, vec2 uv, float dolly) {
  float d = texture2D(dep, uv).r;
  vec2 c = vec2(.66, .5);
  uv = c + (uv - c) / (1. + dolly * (.025 + .07 * d));
  return uv - uOff * (d - .35);
}
vec3 photo(sampler2D img, sampler2D dep, vec2 s, float dolly) {
  return texture2D(img, clamp(look(dep, fit(s), dolly), .001, .999)).rgb;
}
float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
// the photo as halftone: one dot per cell, as big as the light there, in its colour
vec3 dots(sampler2D img, sampler2D dep, vec2 px, float dolly, float size) {
  vec2 cell = (floor(px / uCell) + .5) * uCell;
  vec3 col = photo(img, dep, cell / uRes, dolly);
  float L = dot(col, vec3(.3, .59, .11));
  float r = uCell * .5 * sqrt(L) * 1.5 * size;
  float m = smoothstep(r + .8, r - .8, length(px - cell));
  return col * m * 1.6;
}
void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 s = px / uRes;
  // the change sweeps across from the right, a little uneven cell by cell
  vec2 cid = floor(px / uCell);
  float k = clamp(uMix * 1.9 - (.9 - .55 * s.x) + (hash(cid) - .5) * .18, 0., 1.);
  // photo -> its dots -> the dots turn into the next photo's (size and colour) -> that photo
  vec3 col;
  if (k < .001) col = photo(uA, uAD, s, uDollyA);
  else if (k > .999) col = photo(uB, uBD, s, uDollyB);
  else {
    vec3 mid = mix(dots(uA, uAD, px, uDollyA, 1.), dots(uB, uBD, px, uDollyB, 1.), smoothstep(.3, .7, k));
    col = k < .5 ? mix(photo(uA, uAD, s, uDollyA), mid, smoothstep(0., .3, k))
                 : mix(mid, photo(uB, uBD, s, uDollyB), smoothstep(.7, 1., k));
  }
  gl_FragColor = vec4(col, 1.);
}`

function useDepthScenes(canvasRef, live, enabled) {
  const ctl = useRef({ p: 0, mx: 0, my: 0 })
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' })
    if (!gl) return
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s)); return s }
    const pr = gl.createProgram()
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr); gl.useProgram(pr)
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const U = n => gl.getUniformLocation(pr, n)
    const u = { A: U('uA'), AD: U('uAD'), B: U('uB'), BD: U('uBD'), res: U('uRes'), off: U('uOff'), img: U('uImg'), mix: U('uMix'), da: U('uDollyA'), db: U('uDollyB'), cell: U('uCell') }
    gl.uniform1i(u.A, 0); gl.uniform1i(u.AD, 1); gl.uniform1i(u.B, 2); gl.uniform1i(u.BD, 3)

    // photos and depth maps, loaded in order of appearance; until one arrives it's a black texture
    const black = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(3)); return t }
    const tex = FEATURES.map(() => [black(), black()])
    let alive = true, aspect = 1920 / 815, dirty = true
    const upload = (t, bm) => {
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, bm)
      dirty = true
    }
    ;(async () => {
      for (let i = 0; i < FEATURES.length && alive; i++) {
        for (const [k, suffix] of [[0, ''], [1, '-d']]) {
          try {
            const blob = await (await fetch(`/media/feat3d/${FEATURES[i].id}${suffix}.webp`)).blob()
            const bm = await createImageBitmap(blob)
            if (!alive) return
            if (!k) aspect = bm.width / bm.height
            upload(tex[i][k], bm); bm.close && bm.close()
          } catch {}
        }
      }
    })()

    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.25)
      cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr)
      gl.viewport(0, 0, cv.width, cv.height); dirty = true
    }
    size()
    const ro = new ResizeObserver(size); ro.observe(cv)

    let raf = 0, ox = 0, oy = 0, t0 = performance.now()
    const frame = now => {
      raf = 0
      if (!alive || !live.current) return
      const c = ctl.current, N = FEATURES.length
      const p = Math.max(0, Math.min(N - 1, c.p))
      const i = Math.min(N - 2, Math.floor(p)), f = p - i
      // hold each photo for most of its stretch, change over in the last part
      const m = gsap.utils.clamp(0, 1, (f - 0.55) / 0.45)
      const ease = m * m * (3 - 2 * m)
      const t = (now - t0) / 1000
      // the camera: a slow breath, a lean toward the pointer (eased), and a push in through each photo
      ox += ((c.mx * 0.018 + Math.sin(t * 0.21) * 0.004) - ox) * 0.06
      oy += ((c.my * 0.012 + Math.cos(t * 0.17) * 0.003) - oy) * 0.06
      gl.uniform2f(u.res, cv.width, cv.height)
      gl.uniform2f(u.off, ox, oy)
      gl.uniform1f(u.img, aspect)
      gl.uniform1f(u.mix, ease)
      gl.uniform1f(u.da, Math.min(1, f / 0.8))
      gl.uniform1f(u.db, 0)
      gl.uniform1f(u.cell, Math.max(7, Math.round(cv.width / 230)))
      ;[tex[i][0], tex[i][1], tex[i + 1][0], tex[i + 1][1]].forEach((tx, k) => { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, tx) })
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      dirty = false
      raf = requestAnimationFrame(frame)
    }
    const kick = () => { if (!raf && live.current) raf = requestAnimationFrame(frame) }
    ctl.current.kick = kick
    const onMove = e => { ctl.current.mx = e.clientX / innerWidth - 0.5; ctl.current.my = e.clientY / innerHeight - 0.5 }
    addEventListener('pointermove', onMove, { passive: true })
    kick()
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
  const ctl = useDepthScenes(canvas, live, big)
  useGSAP(() => {
    if (!big) return
    const N = FEATURES.length, st = { p: 0 }
    gsap.to(st, {
      p: N - 1, ease: 'none',
      scrollTrigger: { trigger: root.current, start: 'top top', end: `+=${N * 85}%`, scrub: 0.6, pin: '.feat-pin', anticipatePin: 1 },
      onUpdate: () => {
        ctl.current.p = st.p
        const i = Math.min(N - 1, Math.floor(st.p) + ((st.p % 1) > 0.78 ? 1 : 0))
        setActive(prev => prev === i ? prev : i)
      },
    })
    ScrollTrigger.create({ trigger: root.current, start: 'top bottom', end: 'bottom top',
      onToggle: s => { live.current = s.isActive; if (s.isActive) ctl.current.kick && ctl.current.kick() } })
    const sky = () => { window.__accent = '#4fe3cf' }
    ScrollTrigger.create({ trigger: root.current, start: 'top 60%', end: 'bottom 40%', onEnter: sky, onEnterBack: sky })
  }, { scope: root, dependencies: [big], revertOnUpdate: true })
  // while the edge one is on show, the page's own edge light does the demo
  useEffect(() => { window.__edgeHype = big && FEATURES[active].id === 'edge'; return () => { window.__edgeHype = false } }, [active, big])

  if (!big) return (
    <section className="features features--list" id="details" ref={root}>
      <div className="wrap">
        {FEATURES.map(f => (
          <article className="fl" key={f.id}>
            <img src={`/media/feat3d/${f.id}.webp`} alt="" loading="lazy" decoding="async" />
            <h3 className="fc-title">{f.title}</h3>
            <p className="fc-text">{f.text}</p>
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
