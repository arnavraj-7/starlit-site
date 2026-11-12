import io, sys
SRC = 'C:/projects/starlit-site/web/src/'
name = 'Laptop3D.jsx'
s = io.open(SRC + name, encoding='utf-8', newline='').read()
def rep(a, b):
    global s
    if s.count(a) != 1: sys.exit(f'found {s.count(a)}: {a[:80]!r}')
    s = s.replace(a, b, 1)

rep("""// A laptop in real 3D for the "two screens" scene, played by the scroll (progress, 0..1) as one
// camera move in four beats:
//   1. seen from above, closed;
//   2. the lid opens as the camera comes round, and the screen wakes into Pulse, its light
//      falling on the keys and the desk;
//   3. the camera closes in on the screen and the word leaves it (that part is HTML, in App);
//   4. it pulls back and the laptop turns, a light running round the screen's edge.""",
"""// A laptop in real 3D for the "two screens" scene, played by the scroll (progress, 0..1) as one
// camera move in three beats:
//   1. it rises in with its lid already opening, and the screen wakes into Pulse, its light
//      falling on the keys and the desk;
//   2. the camera closes in on the screen and the word leaves it (that part is HTML, in App);
//   3. it pulls back and a monitor rises behind it playing Flow: each screen its own style,
//      a light running round the laptop's edge.""")
rep("const CLOSE = SCREEN_C.clone().addScaledVector(SCREEN_N, 5.4)", "const CLOSE = SCREEN_C.clone().addScaledVector(SCREEN_N, 6.4)")
rep("""const KEYS = [
  { at: 0.00, cam: [-2.2, 6.4, 6.2], look: [0, 0, 0.2], rot: -0.42 },
  { at: 0.06, cam: [-2.2, 6.4, 6.2], look: [0, 0, 0.2], rot: -0.42 },
  { at: 0.34, cam: [0, 2.7, 9.4], look: [0, 1.45, -0.5], rot: 0 },
  { at: 0.44, cam: [0, 2.6, 8.8], look: [0, 1.4, -0.6], rot: 0 },
  { at: 0.56, cam: CLOSE.toArray(), look: SCREEN_C.toArray(), rot: 0 },
  { at: 0.70, cam: CLOSE.toArray(), look: SCREEN_C.toArray(), rot: 0 },
  { at: 0.86, cam: [0.4, 2.6, 10.4], look: [-1.6, 1.0, -0.4], rot: -0.5 },
  { at: 1.00, cam: [0.4, 2.55, 10.1], look: [-1.6, 1.0, -0.4], rot: -0.53 },
]""",
"""const KEYS = [
  { at: 0.00, cam: [-1.1, 3.9, 10.2], look: [0, 0.9, -0.3], rot: -0.24 },
  { at: 0.20, cam: [0, 2.7, 9.4], look: [0, 1.45, -0.5], rot: 0 },
  { at: 0.28, cam: [0, 2.6, 8.8], look: [0, 1.4, -0.6], rot: 0 },
  { at: 0.40, cam: CLOSE.toArray(), look: SCREEN_C.toArray(), rot: 0 },
  { at: 0.57, cam: CLOSE.toArray(), look: SCREEN_C.toArray(), rot: 0 },
  { at: 0.80, cam: [-0.6, 3.5, 15.2], look: [0.35, 1.95, -1.0], rot: 0.1 },
  { at: 1.00, cam: [-0.5, 3.45, 14.8], look: [0.35, 1.95, -1.0], rot: 0.12 },
]""")

# monitor
rep("""function Halo({ matRef }) {""",
"""// ---------------------------------------------------------------- the monitor
// A slim 27-inch-ish monitor on a stand, in the laptop's metal, behind and to the right. Its
// screen plays the real Flow recording, but only while it is up: the video is paused (and not
// even loaded) the rest of the time.
const MW = 5.6, MH = MW * 9 / 16, M_BOTTOM = 1.3
function Monitor({ monRef, matRef }) {
  const metal = <meshPhysicalMaterial color="#454852" metalness={0.85} roughness={0.3} clearcoat={0.4} clearcoatRoughness={0.25} />
  return (
    <group ref={monRef} position={[3.1, 0, -2.7]} rotation-y={-0.34} visible={false}>
      <RoundedBox args={[1.7, 0.05, 1.05]} radius={0.02} smoothness={4} position={[0, 0.025, 0]}>{metal}</RoundedBox>
      <RoundedBox args={[0.26, M_BOTTOM + 0.4, 0.07]} radius={0.03} smoothness={4} position={[0, (M_BOTTOM + 0.4) / 2, -0.32]}>{metal}</RoundedBox>
      <RoundedBox args={[MW + 0.09, MH + 0.09, 0.07]} radius={0.03} smoothness={6} position={[0, M_BOTTOM + MH / 2, -0.24]}>{metal}</RoundedBox>
      <mesh position={[0, M_BOTTOM + MH / 2, -0.2045]}>
        <planeGeometry args={[MW + 0.05, MH + 0.05]} />
        <meshPhysicalMaterial color="#050608" roughness={0.12} metalness={0} clearcoat={1} />
      </mesh>
      <mesh position={[0, M_BOTTOM + MH / 2, -0.203]}>
        <planeGeometry args={[MW, MH]} />
        <meshBasicMaterial ref={matRef} toneMapped={false} color="#000000" />
      </mesh>
    </group>
  )
}

function Halo({ matRef }) {""")

rep("function Model({ progress, entry, pointer, haloRef }) {", "function Model({ progress, entry, pointer, haloRef, active }) {")
rep("  const spill = useRef(), pool = useRef(), edge = useRef()\n",
    """  const spill = useRef(), pool = useRef(), edge = useRef(), world = useRef(), mon = useRef(), monMat = useRef()
  // the monitor's Flow video: a poster until the video has a frame, loaded only when first needed
  const flow = useMemo(() => {
    const v = document.createElement('video')
    v.muted = true; v.loop = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.preload = 'none'
    const tex = new THREE.VideoTexture(v); tex.colorSpace = THREE.SRGBColorSpace
    const poster = new THREE.TextureLoader().load('/media/flow.jpg'); poster.colorSpace = THREE.SRGBColorSpace
    return { v, tex, poster, live: false, wanted: false }
  }, [])
  useEffect(() => {
    const f = flow, onFrame = () => { f.live = true }
    f.v.addEventListener('playing', onFrame)
    return () => { f.v.removeEventListener('playing', onFrame); f.v.pause(); f.v.removeAttribute('src'); f.v.load(); f.tex.dispose(); f.poster.dispose() }
  }, [flow])
  useEffect(() => { if (!active) flow.v.pause(); else if (flow.wanted) flow.v.play().catch(() => {}) }, [active, flow])
""")
rep("""    const sc = Math.min(1, (size.width / size.height) / 1.05)
    group.current.scale.setScalar(sc)""",
"""    const sc = Math.min(1, (size.width / size.height) / 1.05)
    world.current.scale.setScalar(sc)""")
rep("""    const open = ramp(p, 0.08, 0.34), wake = ramp(p, 0.3, 0.42)
    const out = ramp(p, 0.565, 0.6) * (1 - ramp(p, 0.7, 0.76))         // the word is out of the screen
    const edgeOn = ramp(p, 0.72, 0.86)""",
"""    const e = smooth(clamp01(entry ? entry.current : 1))
    // the lid is already opening as the laptop rises in, and finishes as the pin begins
    const open = THREE.MathUtils.lerp(0.1, 0.42, e) + 0.58 * ramp(p, 0, 0.2), wake = Math.max(0.35 * e * e, ramp(p, 0.02, 0.18))
    const out = ramp(p, 0.425, 0.46) * (1 - ramp(p, 0.56, 0.62))        // the word is out of the screen
    const edgeOn = ramp(p, 0.6, 0.78), rise = ramp(p, 0.6, 0.8)        // last beat: edge light, monitor up""")
rep("""    // arriving: further off and lower in the frame, so it rises into its first pose
    const e = smooth(clamp01(entry ? entry.current : 1))
    cam.multiplyScalar""", """    // arriving: further off and lower in the frame, so it rises into its first pose
    cam.multiplyScalar""")
rep("""    if (wake > 0.01 && t - s.drawn > 1 / 30) { s.drawn = t; pulse.draw(t, p > 0.47 && p < 0.76) }""",
"""    if (wake > 0.01 && t - s.drawn > 1 / 30) { s.drawn = t; pulse.draw(t, p > 0.33 && p < 0.62) }
    // the monitor rises from below; its video plays only while it is up
    const m = mon.current
    m.visible = rise > 0.002
    m.position.y = -4.5 * (1 - rise)
    if (monMat.current) {
      const mm = monMat.current, want = rise > 0.002
      if (want !== flow.wanted) {
        flow.wanted = want
        if (want) { if (!flow.v.src) { flow.v.src = '/media/flow.mp4'; flow.v.preload = 'auto' } flow.v.play().catch(() => {}) } else flow.v.pause()
      }
      const map = flow.live ? flow.tex : flow.poster
      if (mm.map !== map) { mm.map = map; mm.needsUpdate = true }
      mm.color.setScalar(rise)
    }""")
rep("""  return (
    <group ref={group}>
      {/* base */}""", """  return (
    <group ref={world}>
    <Monitor monRef={mon} matRef={monMat} />
    <group ref={group}>
      {/* base */}""")
# close the world group: find the end of Model's JSX (the lid group closes, then the laptop group)
rep("""        <pointLight ref={spill} position={[0, SC_Y, 0.9]} intensity={0} distance={4.2} decay={1.6} color="#ffaa6a" />
      </group>
    </group>
  )""", """        <pointLight ref={spill} position={[0, SC_Y, 0.9]} intensity={0} distance={4.2} decay={1.6} color="#ffaa6a" />
      </group>
    </group>
    </group>
  )""")
rep("      <Model progress={progress} entry={entry} pointer={pointer} haloRef={halo} />",
    "      <Model progress={progress} entry={entry} pointer={pointer} haloRef={halo} active={active} />")
io.open(SRC + name, 'w', encoding='utf-8', newline='').write(s)
print('ok', name)
