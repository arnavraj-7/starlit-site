import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { RoundedBox, Environment, Lightformer, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'

// A laptop in real 3D for the "two screens" scene, played by the scroll (progress, 0..1) as one
// camera move in four beats:
//   1. seen from above, closed;
//   2. the lid opens as the camera comes round, and the screen wakes into Pulse, its light
//      falling on the keys and the desk;
//   3. the camera closes in on the screen and the word leaves it (that part is HTML, in App);
//   4. it pulls back and the laptop turns, a light running round the screen's edge.
// Everything is damped every frame, so coarse scroll input still moves smoothly.
const W = 3.4, D = 2.3, BASE_H = 0.1, LID_T = 0.055
const SCREEN_W = W * 0.94, SCREEN_H = SCREEN_W * 10 / 16
const LID_H = SCREEN_H / 0.92
const LID_OPEN = -0.2
const smooth = k => k * k * (3 - 2 * k)
const clamp01 = k => Math.min(1, Math.max(0, k))
const ramp = (p, a, b) => smooth(clamp01((p - a) / (b - a)))

// The screen's centre and facing, worked out from the hinge (the camera frames it in beat 3).
const SC_Y = LID_H / 2 + 0.02
const SCREEN_C = new THREE.Vector3(0, BASE_H + SC_Y * Math.cos(LID_OPEN), -D / 2 + 0.04 + SC_Y * Math.sin(LID_OPEN))
const SCREEN_N = new THREE.Vector3(0, -Math.sin(LID_OPEN), Math.cos(LID_OPEN))
const CLOSE = SCREEN_C.clone().addScaledVector(SCREEN_N, 5.4)

// Poses along the scroll. Between two keys the move eases in and out.
const KEYS = [
  { at: 0.00, cam: [-2.2, 6.4, 6.2], look: [0, 0, 0.2], rot: -0.42 },
  { at: 0.06, cam: [-2.2, 6.4, 6.2], look: [0, 0, 0.2], rot: -0.42 },
  { at: 0.34, cam: [0, 2.7, 9.4], look: [0, 1.45, -0.5], rot: 0 },
  { at: 0.44, cam: [0, 2.6, 8.8], look: [0, 1.4, -0.6], rot: 0 },
  { at: 0.56, cam: CLOSE.toArray(), look: SCREEN_C.toArray(), rot: 0 },
  { at: 0.70, cam: CLOSE.toArray(), look: SCREEN_C.toArray(), rot: 0 },
  { at: 0.86, cam: [0.4, 2.6, 10.4], look: [-1.6, 1.0, -0.4], rot: -0.5 },
  { at: 1.00, cam: [0.4, 2.55, 10.1], look: [-1.6, 1.0, -0.4], rot: -0.53 },
]
const _a = new THREE.Vector3(), _b = new THREE.Vector3()
function pose(p, cam, look) {
  let i = 0
  while (i < KEYS.length - 2 && p > KEYS[i + 1].at) i++
  const A = KEYS[i], B = KEYS[i + 1], k = ramp(p, A.at, B.at)
  cam.lerpVectors(_a.fromArray(A.cam), _b.fromArray(B.cam), k)
  look.lerpVectors(_a.fromArray(A.look), _b.fromArray(B.look), k)
  return THREE.MathUtils.lerp(A.rot, B.rot, k)
}

function readAccent() {
  const c = window.__accent
  try { return new THREE.Color(c || '#ffaa6a') } catch { return new THREE.Color('#ffaa6a') }
}

// ---------------------------------------------------------------- the Pulse screen
// Pulse drawn live onto the screen: the word being sung, big and glowing, the line under it
// with its sung words lit, and the next line faint. Drawn here rather than recorded, so it is
// always sharp and the word on the screen is the one that steps out of it in beat 3.
const SONG = ['Oh, slow satellites', 'Turning in the dark', 'Carry us tonight', 'Over every heart']
const TIMED = (() => {
  const out = []; let t = 0
  SONG.forEach((line, li) => line.split(' ').forEach((w, wi, ws) => {
    out.push({ w, li, wi, t })
    t += 0.3 + 0.07 * w.length + (wi === ws.length - 1 ? 0.9 : 0)
  }))
  return { words: out, length: t }
})()
const HELD_WORD = 'satellites'                      // what the screen holds while the camera is close (App shows it leaving)
const HELD = TIMED.words.findIndex(x => x.w === HELD_WORD)

class PulseScreen {
  constructor() {
    // laid out at 1600 x 1000, drawn at 0.8 of that: a smaller texture to upload on every change
    this.cv = document.createElement('canvas'); this.cv.width = 1280; this.cv.height = 800
    this.ctx = this.cv.getContext('2d')
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8
    this.glows = new Map(); this.cur = -1; this.prev = -1; this.since = 0; this.last = -1
    this.bg = document.createElement('canvas'); this.bg.width = 1600; this.bg.height = 1000
    const g = this.bg.getContext('2d')
    g.fillStyle = '#120c09'; g.fillRect(0, 0, 1600, 1000)
    for (const [x, y, r, c] of [[380, 330, 700, 'rgba(120,70,36,.55)'], [1250, 760, 650, 'rgba(90,46,30,.5)'], [800, 470, 520, 'rgba(70,44,28,.5)']]) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = rg; g.fillRect(0, 0, 1600, 1000)
    }
    const v = g.createRadialGradient(800, 500, 300, 800, 500, 1000); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)')
    g.fillStyle = v; g.fillRect(0, 0, 1600, 1000)
    // each word's glow is made ahead of time, one per idle moment, so no frame waits on one
    const warm = () => {
      const todo = [...new Set(TIMED.words.map(x => x.w))]
      const next = () => { const w = todo.shift(); if (!w) return; this.glow(w); (window.requestIdleCallback || setTimeout)(next) }
      next()
    }
    const ready = document.fonts ? document.fonts.load('800 150px Inter') : Promise.resolve()
    ready.then(() => { this.glows.clear(); this.last = -1; warm() }).catch(warm)
  }
  glow(w) {                                         // each word's glowing image, made once
    if (this.glows.has(w)) return this.glows.get(w)
    const fs = 150, m = this.ctx
    m.font = `800 ${fs}px Inter, "Inter Variable", sans-serif`
    const tw = Math.ceil(m.measureText(w).width), pad = 90
    const c = document.createElement('canvas'); c.width = tw + pad * 2; c.height = fs * 1.4 + pad * 2
    const x = c.getContext('2d')
    x.font = m.font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.letterSpacing = '-3px'
    x.shadowColor = 'rgba(255,160,90,.85)'; x.shadowBlur = 60; x.fillStyle = '#fff1e6'; x.fillText(w, c.width / 2, c.height / 2)
    x.shadowBlur = 16; x.shadowColor = 'rgba(255,200,150,.9)'; x.fillText(w, c.width / 2, c.height / 2)
    this.glows.set(w, c); return c
  }
  draw(t, hold) {
    const T = t % TIMED.length
    let i = 0
    while (i < TIMED.words.length - 1 && T >= TIMED.words[i + 1].t) i++
    if (hold) i = HELD
    if (i !== this.cur) { this.prev = this.cur; this.cur = i; this.since = t }
    const k = clamp01((t - this.since) / 0.22), stamp = `${i}:${k.toFixed(2)}`
    if (stamp === this.last) return false               // nothing has changed since the last draw
    this.last = stamp
    const g = this.ctx, cw = 1600
    g.setTransform(0.8, 0, 0, 0.8, 0, 0)
    g.globalAlpha = 1; g.drawImage(this.bg, 0, 0)
    const put = (idx, a, s) => {
      if (idx < 0 || a <= 0.01) return
      const im = this.glow(TIMED.words[idx].w)
      g.globalAlpha = a
      g.drawImage(im, cw / 2 - im.width * s / 2, 455 - im.height * s / 2, im.width * s, im.height * s)
    }
    put(this.prev, 1 - k, 1 + 0.05 * k)
    put(this.cur, k, 0.94 + 0.06 * smooth(k))
    g.globalAlpha = 1
    const cur = TIMED.words[i], line = SONG[cur.li].split(' '), next = SONG[(cur.li + 1) % SONG.length]
    g.textBaseline = 'middle'; g.font = '600 36px "Inter Variable", Inter, sans-serif'
    const parts = line.map(w => w + ' '), widths = parts.map(s => g.measureText(s).width)
    let x = cw / 2 - widths.reduce((a, b) => a + b, 0) / 2
    parts.forEach((s, j) => {
      g.fillStyle = j < cur.wi ? 'rgba(255,236,220,.9)' : j === cur.wi ? '#ffb27a' : 'rgba(255,255,255,.42)'
      g.textAlign = 'left'; g.fillText(s, x, 600); x += widths[j]
    })
    g.textAlign = 'center'; g.font = '500 26px "Inter Variable", Inter, sans-serif'; g.fillStyle = 'rgba(255,255,255,.22)'
    g.fillText(next, cw / 2, 660)
    this.tex.needsUpdate = true
    return true
  }
}

// ---------------------------------------------------------------- the edge light
// A light running round the inside of the screen's edge, as Starlit's edge light does: two
// heads chasing round with soft tails, the rim glowing faintly, a little surge on the beat.
const edgeVert = `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const edgeFrag = `
uniform float uTime, uAmt; uniform vec3 uColor; uniform vec2 uHalf; varying vec2 vP;
void main() {
  vec2 q = abs(vP) - uHalf;
  float outside = length(max(q, 0.0)), inside = -min(max(q.x, q.y), 0.0);
  float rim = outside > 0.0 ? exp(-outside * 70.0) * 0.55 : exp(-inside * 26.0);
  float Wd = uHalf.x * 2.0, Ht = uHalf.y * 2.0, P = 2.0 * (Wd + Ht), s;
  if (q.x > q.y) s = vP.x > 0.0 ? Wd + (uHalf.y - vP.y) : 2.0 * Wd + Ht + (vP.y + uHalf.y);
  else s = vP.y > 0.0 ? vP.x + uHalf.x : Wd + Ht + (uHalf.x - vP.x);
  s /= P;
  float h = fract(uTime * 0.09);
  float u1 = fract(h - s), u2 = fract(h + 0.5 - s);
  float tail = exp(-u1 * 7.0) + exp(-u2 * 7.0), core = exp(-u1 * 60.0) + exp(-u2 * 60.0);
  float beat = 1.0 + 0.35 * exp(-fract(uTime * 1.6) * 7.0);
  vec3 c = uColor * rim * (0.1 + 1.5 * tail) * beat + vec3(1.0, 0.95, 0.9) * rim * core * 0.6;
  gl_FragColor = vec4(c * uAmt, 1.0);
}`

// A real keyboard: six rows, each 15 key-units wide, with wide keys where a laptop has them.
const PITCH = 0.188, GAP = 0.018, KEY_T = 0.012
const row = s => s.split(' ').map(t => { const i = t.lastIndexOf(':'); return i > 0 ? { l: t.slice(0, i), w: Number(t.slice(i + 1)) } : { l: t, w: 1 } })
const ROWS = [
  row('esc F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 del end'),
  row('` 1 2 3 4 5 6 7 8 9 0 - = back:2'),
  row('tab:1.5 Q W E R T Y U I O P [ ] \\:1.5'),
  row("caps:1.75 A S D F G H J K L ; ' enter:2.25"),
  row('shift:2.25 Z X C V B N M , . / shift:2.75'),
  row('ctrl:1.25 fn win alt:1.25 _:5.5 alt:1.25 ctrl:1.25 ◀:0.8333 ▼:0.8333 ▶:0.8334'),
]

function Keys({ legendRef }) {
  const ref = useRef()
  const keys = useMemo(() => {
    const out = []
    ROWS.forEach((r, ri) => { let x = -7.5; r.forEach(k => { out.push({ ...k, u: x + k.w / 2, ri }); x += k.w }) })
    return out
  }, [])
  // Legends: one texture for the whole keyboard, laid over the key tops.
  const legends = useMemo(() => {
    const U = 160, c = document.createElement('canvas')
    c.width = 15 * U; c.height = 6 * U
    const g = c.getContext('2d')
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'
    for (const k of keys) {
      if (k.l === '_') continue
      g.font = `600 ${k.l.length > 1 ? 34 : 60}px "Inter Variable", "Segoe UI", sans-serif`
      g.fillText(k.l, (k.u + 7.5) * U, (k.ri + 0.5) * U + 4)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
    return t
  }, [keys])
  useEffect(() => {
    const m = new THREE.Matrix4()
    keys.forEach((k, i) => {
      m.makeScale((k.w * PITCH - GAP) / (PITCH - GAP), 1, 1)
      m.setPosition(k.u * PITCH, 0, (k.ri - 2.5) * PITCH)
      ref.current.setMatrixAt(i, m)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [keys])
  return (
    <group position={[0, BASE_H + KEY_T / 2 + 0.003, -D * 0.13]}>
      <instancedMesh ref={ref} args={[null, null, keys.length]}>
        <boxGeometry args={[PITCH - GAP, KEY_T, PITCH - GAP]} />
        <meshStandardMaterial color="#1b1d23" roughness={0.45} metalness={0.25} />
      </instancedMesh>
      <mesh position={[0, KEY_T / 2 + 0.0015, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[15 * PITCH, 6 * PITCH]} />
        <meshBasicMaterial ref={legendRef} map={legends} transparent depthWrite={false} toneMapped={false} opacity={0.7} />
      </mesh>
    </group>
  )
}

// Soft round falloff, used for the screen's light pool on the desk.
function poolTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g; x.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}
// The glow behind the laptop, as a halftone: a field of dots that grow toward the middle, the
// same dot language as the rest of the page instead of a soft blob.
function dotHaloTexture() {
  const N = 1024, c = document.createElement('canvas'); c.width = c.height = N
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath()
  const step = 15
  for (let j = 0; j < N / step; j++) for (let i = 0; i < N / step; i++) {
    const px = (i + 0.5 + (j % 2) * 0.5) * step, py = (j + 0.5) * step
    const d = Math.hypot(px - N / 2, py - N / 2) / (N / 2)
    const r = step * 0.42 * Math.pow(Math.max(0, 1 - d), 1.6)
    if (r < 0.5) continue
    x.moveTo(px + r, py); x.arc(px, py, r, 0, Math.PI * 2)
  }
  x.fill()
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4
  return t
}

function Model({ progress, pointer, haloRef }) {
  const group = useRef(), lid = useRef(), legend = useRef(), screenMat = useRef(), well = useRef()
  const spill = useRef(), pool = useRef(), edge = useRef()
  const s = useRef({ p: 0, lid: Math.PI / 2 - 0.015, frame: 0, accent: readAccent(), tx: 0, ty: 0, drawn: 0 }).current
  const cam = useMemo(() => new THREE.Vector3(), []), look = useMemo(() => new THREE.Vector3(), [])
  const pulse = useMemo(() => new PulseScreen(), [])
  const poolTex = useMemo(poolTexture, [])
  const edgeUni = useMemo(() => ({ uTime: { value: 0 }, uAmt: { value: 0 }, uColor: { value: new THREE.Color('#ffaa6a') }, uHalf: { value: new THREE.Vector2(SCREEN_W / 2, SCREEN_H / 2) } }), [])
  useEffect(() => () => { pulse.tex.dispose(); poolTex.dispose() }, [pulse, poolTex])

  useFrame(({ camera, clock, size }, dt) => {
    // On a tall, narrow screen the laptop is scaled down to fit the width.
    const sc = Math.min(1, (size.width / size.height) / 1.05)
    group.current.scale.setScalar(sc)
    s.p = THREE.MathUtils.damp(s.p, clamp01(progress.current), 6, dt)
    const p = s.p, t = clock.elapsedTime
    const open = ramp(p, 0.08, 0.34), wake = ramp(p, 0.3, 0.42)
    const out = ramp(p, 0.565, 0.6) * (1 - ramp(p, 0.7, 0.76))         // the word is out of the screen
    const edgeOn = ramp(p, 0.72, 0.86)
    s.lid = THREE.MathUtils.damp(s.lid, THREE.MathUtils.lerp(Math.PI / 2 - 0.015, LID_OPEN, open), 9, dt)
    lid.current.rotation.x = s.lid
    // camera and turn; the pointer leans the laptop a little
    const rot = pose(p, cam, look)
    if (size.width < size.height) { cam.x -= look.x; look.x = 0 }     // portrait: no room beside it for the caption
    // a narrow window shrinks the laptop: the camera keeps its offset from what it looks at, so
    // every pose (the close one too) stays framed, only smaller
    cam.sub(look); look.multiplyScalar(sc); camera.position.copy(look).add(cam)
    camera.lookAt(look)
    s.tx = THREE.MathUtils.damp(s.tx, pointer.current.x, 2.5, dt); s.ty = THREE.MathUtils.damp(s.ty, pointer.current.y, 2.5, dt)
    group.current.rotation.y = rot + s.tx * 0.12 + Math.sin(t * 0.4) * 0.008
    group.current.rotation.x = s.ty * 0.05
    group.current.position.y = Math.sin(t * 0.6) * 0.015
    // song colour: legends backlit in it, the screen's light on the keys and desk, the halo, the edge
    if (++s.frame % 20 === 0) s.accent = readAccent()
    if (legend.current) { legend.current.color.set('#ffffff').lerp(s.accent, 0.5); legend.current.opacity = 0.45 + 0.45 * wake }
    if (well.current) { well.current.emissive.copy(s.accent); well.current.emissiveIntensity = 0.004 + 0.02 * wake }
    if (spill.current) { spill.current.color.copy(s.accent).lerp(new THREE.Color('#ffd9bd'), 0.35); spill.current.intensity = 5.5 * wake * (1 - 0.6 * out) }
    if (pool.current) { pool.current.color.copy(s.accent); pool.current.opacity = 0.5 * wake * (1 - 0.6 * out) }
    if (haloRef.current) { haloRef.current.color.copy(s.accent); haloRef.current.opacity = (0.1 + 0.32 * wake) * (1 - 0.7 * out) }
    // (the material holds its own copy of the uniforms, so they are set on it)
    const eu = edge.current && edge.current.uniforms
    if (eu && eu.uAmt) { eu.uTime.value = t; eu.uColor.value.copy(s.accent); eu.uAmt.value = 0.25 * wake * (1 - out) + 1.1 * edgeOn }
    // the screen: dark until it wakes; it dims as the word leaves it, and holds that word while close
    if (screenMat.current) screenMat.current.color.setScalar(THREE.MathUtils.lerp(0.04, 1, wake) * (1 - out))   // dark while the word is out, so the small lines never show through it
    if (wake > 0.01 && t - s.drawn > 1 / 30) { s.drawn = t; pulse.draw(t, p > 0.47 && p < 0.76) }
  })

  const body = <meshPhysicalMaterial color="#454852" metalness={0.85} roughness={0.3} clearcoat={0.4} clearcoatRoughness={0.25} />
  return (
    <group ref={group}>
      {/* base */}
      <RoundedBox args={[W, BASE_H, D]} radius={0.048} smoothness={8} position={[0, BASE_H / 2, 0]}>{body}</RoundedBox>
      <mesh position={[0, BASE_H + 0.0015, -D * 0.13]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[15 * PITCH + 0.05, 6 * PITCH + 0.05]} />
        <meshStandardMaterial ref={well} color="#0c0d11" roughness={0.8} emissive="#ffaa6a" emissiveIntensity={0} />
      </mesh>
      <Keys legendRef={legend} />
      <RoundedBox args={[1.2, 0.006, 0.6]} radius={0.003} position={[0, BASE_H + 0.003, 0.72]}>
        <meshPhysicalMaterial color="#202228" metalness={0.6} roughness={0.12} clearcoat={1} clearcoatRoughness={0.08} />
      </RoundedBox>
      <mesh position={[0, BASE_H - 0.004, D / 2 - 0.002]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.22, 40, 0, Math.PI]} />
        <meshStandardMaterial color="#141519" metalness={0.8} roughness={0.4} />
      </mesh>
      {/* the screen's light pooling on the desk in front */}
      <mesh position={[0, 0.002, 1.25]} rotation-x={-Math.PI / 2} scale={[1, 0.5, 1]}>
        <planeGeometry args={[7.5, 5]} />
        <meshBasicMaterial ref={pool} map={poolTex} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} opacity={0} />
      </mesh>
      {/* lid, hinged along the back edge */}
      <group ref={lid} position={[0, BASE_H, -D / 2 + 0.04]} rotation-x={Math.PI / 2}>
        <RoundedBox args={[W, LID_H, LID_T]} radius={0.026} smoothness={8} position={[0, LID_H / 2, -LID_T / 2]}>{body}</RoundedBox>
        <mesh position={[0, LID_H / 2, 0.0012]}>
          <planeGeometry args={[W - 0.06, LID_H - 0.06]} />
          <meshPhysicalMaterial color="#050608" roughness={0.12} metalness={0} clearcoat={1} clearcoatRoughness={0.06} />
        </mesh>
        <mesh position={[0, SC_Y, 0.003]}>
          <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          <meshBasicMaterial ref={screenMat} map={pulse.tex} toneMapped={false} color="#0a0a0a" />
        </mesh>
        <mesh position={[0, SC_Y, 0.0045]}>
          <planeGeometry args={[SCREEN_W + 0.1, SCREEN_H + 0.1]} />
          <shaderMaterial ref={edge} uniforms={edgeUni} vertexShader={edgeVert} fragmentShader={edgeFrag}
            transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
        <mesh position={[0, LID_H - 0.035, 0.004]}>
          <circleGeometry args={[0.012, 24]} />
          <meshBasicMaterial color="#1a1c22" />
        </mesh>
        {/* the screen's own light, thrown forward onto the keys */}
        <pointLight ref={spill} position={[0, SC_Y, 0.9]} intensity={0} distance={4.2} decay={1.6} color="#ffaa6a" />
      </group>
    </group>
  )
}

function Halo({ matRef }) {
  const tex = useMemo(dotHaloTexture, [])
  return (
    <mesh position={[0, 1.3, -3.4]}>
      <planeGeometry args={[11, 11]} />
      <meshBasicMaterial ref={matRef} map={tex} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} opacity={0.1} />
    </mesh>
  )
}

export default function Laptop3D({ progress, active = true }) {
  const halo = useRef()
  const pointer = useRef({ x: 0, y: 0 })
  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const move = e => { pointer.current.x = e.clientX / innerWidth * 2 - 1; pointer.current.y = e.clientY / innerHeight * 2 - 1 }
    addEventListener('pointermove', move, { passive: true })
    return () => removeEventListener('pointermove', move)
  }, [])
  return (
    <Canvas
      // 'demand' while off screen: one frame at mount (so shaders are compiled before you get
      // here), then nothing until the section is in view.
      frameloop={active ? 'always' : 'demand'}
      className="laptop-canvas"
      dpr={[1, 2]}
      camera={{ fov: 28, near: 0.1, far: 60, position: [-2.2, 6.4, 6.2] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.15 }}
    >
      <ambientLight intensity={0.2} />
      <directionalLight position={[2, 8, 6]} intensity={1.35} />
      <directionalLight position={[-3, 2, 8]} intensity={0.45} />
      <Halo matRef={halo} />
      <Model progress={progress} pointer={pointer} haloRef={halo} />
      <ContactShadows position={[0, -0.002, 0]} opacity={0.6} scale={9} blur={2.6} far={2.4} resolution={512} color="#000000" />
      {/* Studio lighting built from shapes, so no environment map has to be downloaded:
          a soft box overhead, tall thin strips at the sides, a backdrop light behind. */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[6, 2.5, 1]} />
        <Lightformer form="rect" intensity={6} position={[-4.5, 2, 1]} rotation-y={Math.PI / 2} scale={[0.35, 8, 1]} />
        <Lightformer form="rect" intensity={6} position={[4.5, 2, 1]} rotation-y={-Math.PI / 2} scale={[0.35, 8, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[0, 0.6, 7]} scale={[10, 0.4, 1]} />
        <Lightformer form="rect" intensity={1.8} position={[0, 4.5, -7]} scale={[14, 5, 1]} />
      </Environment>
    </Canvas>
  )
}
