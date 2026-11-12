"""Laptop section after the outside review: no closed-lid beat (it opens already opening, ~300%
pinned), the last beat shows both screens (a monitor rises behind playing the real Flow
recording), the Pulse tag sits below the screen, the side caption doesn't orphan, and nothing
from the hero shows at the pinned view's top edge."""
import io, sys
SRC = 'C:/projects/starlit-site/web/src/'
def patch(name, pairs):
    s = io.open(SRC + name, encoding='utf-8', newline='').read()
    for a, b in pairs:
        if s.count(a) != 1: sys.exit(f'{name}: found {s.count(a)}: {a[:80]!r}')
        s = s.replace(a, b, 1)
    io.open(SRC + name, 'w', encoding='utf-8', newline='').write(s)
    print('ok', name)

# ------------------------------------------------------------------ App.jsx: timeline + markup
patch('App.jsx', [
    ("        trigger: root.current, start: 'top top', end: '+=400%', scrub: true, pin: '.laptop-pin', anticipatePin: 1,\n"
     "        onEnter: () => setAccent(ACCENT.amber), onEnterBack: () => setAccent(ACCENT.amber),\n",
     "        trigger: root.current, start: 'top top', end: '+=300%', scrub: true, pin: '.laptop-pin', anticipatePin: 1,\n"
     "        onEnter: () => setAccent(ACCENT.amber), onEnterBack: () => setAccent(ACCENT.amber),\n"
     "        onToggle: self => root.current.classList.toggle('is-pinned', self.isActive),\n"),
    ("""    // 1. closed, from above
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
      .set({}, {}, 1)""",
     """    // 1. the lid opening, the screen waking
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
      .set({}, {}, 1)"""),
    ("<Laptop3D progress={progress} entry={entry} active={active} />",
     "<Laptop3D progress={progress} entry={entry} active={active} />"),
])

# ------------------------------------------------------------------ styles.css
patch('styles.css', [
    (".laptop-copy .step--side .body { margin-inline: 0; max-width: 30ch; }",
     ".laptop-copy .step--side { max-width: 40vw; }\n.laptop-copy .step--side .body { margin-inline: 0; max-width: 36ch; }"),
    (".lw-word { margin-top: -4.8vh;", ".lw-word { margin-top: -4vh;"),
    (".lw-tag { align-self: end; margin: 0 0 14vh; font-size: clamp(1rem, 1.05vw, 1.6rem); color: var(--mute); opacity: 0; }",
     "/* under the screen, not on its bezel */\n.lw-tag { align-self: end; margin: 0 0 5vh; font-size: max(14px, clamp(1rem, 1.05vw, 1.6rem)); color: rgb(255 255 255 / .55); opacity: 0; }"),
    (".laptop-pin { height: 100vh; display: grid; place-items: center; overflow: hidden; }",
     """.laptop-pin { height: 100vh; display: grid; place-items: center; overflow: hidden; }
/* while pinned, a soft curtain of the page's own colour at the top edge: whatever of the hero
   reaches down past its end (its floating mini player) never shows over the laptop */
.laptop-pin::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 16vh; z-index: 4; pointer-events: none;
  background: linear-gradient(var(--ink) 35%, rgb(7 9 18 / 0)); opacity: 0; transition: opacity .3s var(--ease); }
.laptop-sec.is-pinned .laptop-pin::before { opacity: 1; }
.laptop-sec { z-index: 3; }"""),
])
