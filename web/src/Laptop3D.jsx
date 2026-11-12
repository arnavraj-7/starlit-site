import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { RoundedBox, Environment, Lightformer, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'

// A laptop in real 3D for the "two screens" scene. The scroll position (progress, 0..1) drives
// the hinge and a camera move; both are damped every frame so the motion stays fluid even when
// scroll input is coarse. The screen shows recorded Starlit footage as a video texture.
const W = 3.4, D = 2.3, BASE_H = 0.1, LID_T = 0.055
const SCREEN_W = W * 0.94, SCREEN_H = SCREEN_W * 10 / 16
const LID_H = SCREEN_H / 0.92
const smooth = k => k * k * (3 - 2 * k)
const clamp01 = k => Math.min(1, Math.max(0, k))

function readAccent() {
  const c = window.__accent
  try { return new THREE.Color(c || '#ffaa6a') } catch { return new THREE.Color('#ffaa6a') }
}

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
        <meshStandardMaterial color="#1b1d23" roughness={0.55} metalness={0.2} />
      </instancedMesh>
      <mesh position={[0, KEY_T / 2 + 0.0015, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[15 * PITCH, 6 * PITCH]} />
        <meshBasicMaterial ref={legendRef} map={legends} transparent depthWrite={false} toneMapped={false} opacity={0.7} />
      </mesh>
    </group>
  )
}

function Model({ progress, video, haloRef }) {
  const group = useRef(), lid = useRef(), legend = useRef(), screenMat = useRef(), well = useRef()
  const state = useRef({ lid: Math.PI / 2 - 0.015, open: 0, frame: 0, accent: readAccent() })
  const texture = useMemo(() => {
    if (!video) return null
    const t = new THREE.VideoTexture(video)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [video])

  useFrame(({ camera, clock, size }, dt) => {
    const s = state.current
    // On a tall, narrow screen the laptop is scaled down to fit the width.
    group.current.scale.setScalar(Math.min(1, (size.width / size.height) / 1.05))
    const p = clamp01(progress.current)
    const openK = smooth(clamp01(p / 0.62))
    const targetLid = THREE.MathUtils.lerp(Math.PI / 2 - 0.015, -0.2, openK)
    s.lid = THREE.MathUtils.damp(s.lid, targetLid, 7, dt)
    s.open = THREE.MathUtils.damp(s.open, openK, 7, dt)
    lid.current.rotation.x = s.lid
    // Camera: from high above the closed lid to facing the open screen.
    const k = s.open
    camera.position.set(THREE.MathUtils.lerp(-2.2, 0, k), THREE.MathUtils.lerp(6.4, 2.7, k), THREE.MathUtils.lerp(6.2, 9.4, k))
    camera.lookAt(0, THREE.MathUtils.lerp(0.0, 1.45, k), THREE.MathUtils.lerp(0.2, -0.5, k))
    group.current.rotation.y = THREE.MathUtils.lerp(-0.42, 0, k) + Math.sin(clock.elapsedTime * 0.4) * 0.01
    group.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.02
    // Song colour: the key legends are backlit in it, and it glows behind the laptop.
    if (++s.frame % 20 === 0) s.accent = readAccent()
    if (legend.current) { legend.current.color.set('#ffffff').lerp(s.accent, 0.45); legend.current.opacity = 0.5 + 0.4 * k }
    if (well.current) { well.current.emissive.copy(s.accent); well.current.emissiveIntensity = 0.004 + 0.012 * k }
    if (haloRef.current) { haloRef.current.color.copy(s.accent); haloRef.current.opacity = 0.3 + 0.35 * k }
    if (screenMat.current) screenMat.current.color.setScalar(THREE.MathUtils.lerp(0.15, 1, smooth(clamp01((p - 0.35) / 0.25))))
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
      {/* lid, hinged along the back edge */}
      <group ref={lid} position={[0, BASE_H, -D / 2 + 0.04]} rotation-x={Math.PI / 2}>
        <RoundedBox args={[W, LID_H, LID_T]} radius={0.026} smoothness={8} position={[0, LID_H / 2, -LID_T / 2]}>{body}</RoundedBox>
        <mesh position={[0, LID_H / 2, 0.0012]}>
          <planeGeometry args={[W - 0.06, LID_H - 0.06]} />
          <meshPhysicalMaterial color="#050608" roughness={0.12} metalness={0} clearcoat={1} clearcoatRoughness={0.06} />
        </mesh>
        <mesh position={[0, LID_H / 2 + 0.02, 0.003]}>
          <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          {/* keyed: a material compiled without a map never shows one added later */}
          {texture
            ? <meshBasicMaterial key="video" ref={screenMat} map={texture} toneMapped={false} />
            : <meshBasicMaterial key="dark" ref={screenMat} color="#0a0d12" />}
        </mesh>
        <mesh position={[0, LID_H - 0.035, 0.004]}>
          <circleGeometry args={[0.012, 24]} />
          <meshBasicMaterial color="#1a1c22" />
        </mesh>
      </group>
    </group>
  )
}

// A soft halo of the song's colour behind the laptop, like a product shot's backdrop glow.
function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g; x.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}
function Halo({ matRef }) {
  const tex = useMemo(haloTexture, [])
  return (
    <mesh position={[0, 1.4, -3.2]}>
      <planeGeometry args={[9, 6]} />
      <meshBasicMaterial ref={matRef} map={tex} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} opacity={0.3} />
    </mesh>
  )
}

export default function Laptop3D({ progress, video, active = true }) {
  const halo = useRef()
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
      <ambientLight intensity={0.22} />
      <directionalLight position={[2, 8, 6]} intensity={1.5} />
      <directionalLight position={[-3, 2, 8]} intensity={0.5} />
      <Halo matRef={halo} />
      <Model progress={progress} video={video} haloRef={halo} />
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
