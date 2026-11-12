"""Laptop section seams: it rises out of the dark as the section arrives (smaller, lower, fading
in) instead of showing a half-cut closed lid under the hero, and fades as it leaves. The lid
gets the ring mark so the closed laptop isn't a blank slab."""
import io, sys
SRC = 'C:/projects/starlit-site/web/src/'
def patch(name, pairs):
    s = io.open(SRC + name, encoding='utf-8', newline='').read()
    for a, b in pairs:
        if s.count(a) != 1: sys.exit(f'{name}: found {s.count(a)}: {a[:70]!r}')
        s = s.replace(a, b, 1)
    io.open(SRC + name, 'w', encoding='utf-8', newline='').write(s)
    print('ok', name)

patch('App.jsx', [
    ("  const progress = useRef(0)\n  const [near, setNear] = useState(false)\n",
     "  const progress = useRef(0)\n  const entry = useRef(0)\n  const [near, setNear] = useState(false)\n"),
    ("    ScrollTrigger.create({ trigger: root.current, start: 'top bottom', end: 'bottom top', onToggle: s => setActive(s.isActive) })",
     """    // Arriving, the laptop rises out of the dark and fades in (entry, also read by the 3D scene);
    // leaving, it fades before the next section is under it. No edge of it is ever cut by a seam.
    const stage = root.current.querySelector('.laptop-stage')
    const ends = self => {
      const y = self.scroll(), vh = innerHeight
      const k = Math.min(1, Math.max(0, (y - self.start) / (vh * 0.85)))
      const out = Math.min(1, Math.max(0, (y - (self.end - vh * 1.05)) / (vh * 0.55)))
      entry.current = k
      stage.style.opacity = (Math.min(k * k * (3 - 2 * k), 1 - out * out * (3 - 2 * out))).toFixed(3)
    }
    ScrollTrigger.create({ trigger: root.current, start: 'top bottom', end: 'bottom top', onToggle: s => setActive(s.isActive),
      onUpdate: ends, onRefresh: ends })"""),
    ("<Laptop3D progress={progress} active={active} />", "<Laptop3D progress={progress} entry={entry} active={active} />"),
])

patch('Laptop3D.jsx', [
    ("function Model({ progress, pointer, haloRef }) {", "function Model({ progress, entry, pointer, haloRef }) {"),
    ("    cam.sub(look); look.multiplyScalar(sc); camera.position.copy(look).add(cam)",
     """    cam.sub(look)
    // arriving: further off and lower in the frame, so it rises into its first pose
    const e = smooth(clamp01(entry ? entry.current : 1))
    cam.multiplyScalar(1 + 0.55 * (1 - e)); look.y += 1.6 * (1 - e)
    look.multiplyScalar(sc); camera.position.copy(look).add(cam)"""),
    ("        <mesh position={[0, LID_H - 0.035, 0.004]}>",
     """        {/* the ring mark on the back of the lid, polished into the brushed metal */}
        <group position={[0, LID_H / 2, -LID_T - 0.0012]} rotation-y={Math.PI}>
          <mesh><ringGeometry args={[0.2, 0.235, 72]} /><meshPhysicalMaterial color="#c9ccd6" metalness={1} roughness={0.08} clearcoat={1} /></mesh>
          <mesh><circleGeometry args={[0.061, 40]} /><meshPhysicalMaterial color="#c9ccd6" metalness={1} roughness={0.08} clearcoat={1} /></mesh>
          <mesh position={[0.167, 0.167, 0.0004]}><circleGeometry args={[0.112, 40]} /><meshPhysicalMaterial color="#454852" metalness={0.85} roughness={0.3} clearcoat={0.4} /></mesh>
          <mesh position={[0.167, 0.167, 0.0008]}><circleGeometry args={[0.077, 40]} /><meshPhysicalMaterial color="#c9ccd6" metalness={1} roughness={0.08} clearcoat={1} /></mesh>
        </group>
        <mesh position={[0, LID_H - 0.035, 0.004]}>"""),
    ("export default function Laptop3D({ progress, active = true }) {", "export default function Laptop3D({ progress, entry, active = true }) {"),
    ("      <Model progress={progress} pointer={pointer} haloRef={halo} />", "      <Model progress={progress} entry={entry} pointer={pointer} haloRef={halo} />"),
])
