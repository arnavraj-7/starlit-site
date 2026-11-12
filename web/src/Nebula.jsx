import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

// The page's sky. Slow nebula clouds in the current album colour, drawn by a tiny shader that
// only looks things up in a small noise texture made once in JS — so it compiles instantly
// (a procedural-noise shader froze the page for half a second while the GPU compiled it).
// Soft by nature: rendered at reduced resolution, 30 times a second.
const FRAG = `
precision mediump float;
uniform vec2 res; uniform float time; uniform float scroll; uniform vec3 accent; uniform float boost; uniform sampler2D noise;
void main() {
  vec2 uv = gl_FragCoord.xy / res; vec2 p = (gl_FragCoord.xy - 0.5 * res) / res.y;
  p.y += scroll * 0.00012;                         // the sky lags far behind the page: deep parallax
  float t = time * 0.004;
  vec2 q = vec2(texture2D(noise, p * 0.35 + vec2(t, 0.0)).r, texture2D(noise, p * 0.35 + vec2(0.37, 0.61) - vec2(0.0, t)).r);
  float n = texture2D(noise, p * 0.45 + 0.55 * q + vec2(t * 0.6, -t * 0.4)).r;
  float band = smoothstep(0.9, 0.0, abs(p.y + 0.35 * p.x - 0.1));        // a diagonal river of dust
  float cloud = pow(n, 2.3) * (0.35 + 0.9 * band);
  vec3 cool = vec3(0.32, 0.38, 0.62);
  vec3 col = mix(cool, accent, smoothstep(0.25, 0.75, q.x)) * cloud * 0.8 * boost;
  col += accent * pow(n, 6.0) * 0.35 * boost;      // brighter knots
  float vign = smoothstep(1.25, 0.2, length(uv - 0.5));
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  gl_FragColor = vec4(col * vign + dither / 255.0, 1.0);
}`
const VERT = 'attribute vec2 pos; void main() { gl_Position = vec4(pos, 0.0, 1.0); }'

// 256x256 tileable fractal noise (five octaves of value noise), as bytes.
function noiseTexture() {
  const N = 256, out = new Uint8Array(N * N)
  let seed = 1337
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const acc = new Float32Array(N * N)
  let amp = 0.5
  for (let f = 4; f <= 64; f *= 2) {
    const lat = new Float32Array(f * f)
    for (let i = 0; i < lat.length; i++) lat[i] = rnd()
    for (let y = 0; y < N; y++) {
      const gy = y / N * f, y0 = Math.floor(gy), fy = gy - y0, sy = fy * fy * (3 - 2 * fy), y1 = (y0 + 1) % f
      for (let x = 0; x < N; x++) {
        const gx = x / N * f, x0 = Math.floor(gx), fx = gx - x0, sx = fx * fx * (3 - 2 * fx), x1 = (x0 + 1) % f
        const a = lat[y0 * f + x0], b = lat[y0 * f + x1], c = lat[y1 * f + x0], d = lat[y1 * f + x1]
        acc[y * N + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy)
      }
    }
    amp *= 0.5
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(acc[i] * 255)))
  return out
}

export default function Nebula() {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' })
    if (!gl) return
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s }
    const prog = gl.createProgram()
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog); gl.useProgram(prog)
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'pos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 256, 256, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, noiseTexture())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    const U = n => gl.getUniformLocation(prog, n)
    const uRes = U('res'), uTime = U('time'), uScroll = U('scroll'), uAccent = U('accent'), uBoost = U('boost')
    gl.uniform1i(U('noise'), 0)
    const SCALE = 0.42
    const resize = () => {
      cv.width = Math.round(innerWidth * SCALE); cv.height = Math.round(innerHeight * SCALE)
      gl.viewport(0, 0, cv.width, cv.height)
    }
    resize(); addEventListener('resize', resize)
    cv.classList.add('is-ready')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const cur = [0.67, 0.61, 1], tgt = [0.67, 0.61, 1]
    const parse = () => {
      const c = window.__accent || '#ab9cff'
      const m = c.match(/^#([0-9a-f]{6})$/i)
      if (m) { const n = parseInt(m[1], 16); tgt[0] = (n >> 16) / 255; tgt[1] = ((n >> 8) & 255) / 255; tgt[2] = (n & 255) / 255 }
      else { const r = c.match(/[\d.]+/g); if (r) for (let i = 0; i < 3; i++) tgt[i] = r[i] / 255 }
    }
    let frame = 0
    const t0 = performance.now()
    const draw = () => {
      if (document.hidden) return
      if (frame++ % 2) return                      // slow clouds: every other frame is plenty
      if (frame % 10 === 1) parse()
      for (let i = 0; i < 3; i++) cur[i] += (tgt[i] - cur[i]) * 0.1
      const y = window.scrollY
      gl.uniform2f(uRes, cv.width, cv.height)
      gl.uniform1f(uTime, reduce ? 0 : (performance.now() - t0) / 1000)
      gl.uniform1f(uScroll, y)
      gl.uniform3f(uAccent, cur[0], cur[1], cur[2])
      gl.uniform1f(uBoost, 1.0 - 0.45 * Math.min(1, y / (innerHeight * 1.5)))
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    gsap.ticker.add(draw)
    return () => { gsap.ticker.remove(draw); removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} className="nebula" aria-hidden="true" />
}
