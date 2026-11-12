"""Scroll benchmark: wheel through the whole page (headless Edge, 2560x1440) and report slow frames per section.
usage: python scrollperf.py [px_per_wheel=40]"""
import sys, os, collections
from playwright.sync_api import sync_playwright

DY = int(sys.argv[1]) if len(sys.argv) > 1 else 40
INIT = """
window.__fr = []; window.__n = 0; let last = 0;
const f = t => { if (last) { window.__n++; const d = t - last; if (d > 20) window.__fr.push([Math.round(scrollY), Math.round(d)]); } last = t; requestAnimationFrame(f); };
requestAnimationFrame(f);
"""
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 2560, 'height': 1440})
    pg.add_init_script(INIT)
    if os.environ.get('CSS'): pg.add_init_script('addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ' + repr(os.environ['CSS']) + '; document.head.appendChild(s) })')
    pg.goto('http://localhost:4317/', wait_until='networkidle')
    pg.wait_for_timeout(7000)                      # intro done, 3D warmed up
    marks = pg.evaluate("""() => ['#top','#screens','#styles','#turntable','#details','.setup-sec','#download','.footer'].map(s => { const e = document.querySelector(s); return e ? [s, Math.round(e.getBoundingClientRect().top + scrollY)] : null; }).filter(Boolean).sort((a, b) => a[1] - b[1])""")
    total = pg.evaluate('document.documentElement.scrollHeight - innerHeight')
    pg.evaluate('window.__fr = []; window.__n = 0')
    pg.mouse.move(1280, 720)
    t0 = pg.evaluate('performance.now()')
    for _ in range(int(total / DY) + 40):
        pg.mouse.wheel(0, DY)
        pg.wait_for_timeout(14)
    pg.wait_for_timeout(1500)
    secs = (pg.evaluate('performance.now()') - t0) / 1000
    fr, n = pg.evaluate('window.__fr'), pg.evaluate('window.__n')
    b.close()

def section(y):
    name = marks[0][0]
    for s, top in marks:
        if y + 720 >= top: name = s
    return name
by = collections.OrderedDict((s, []) for s, _ in marks)
for y, d in fr: by[section(y)].append(d)
print(f'{n} frames in {secs:.1f}s = {n / secs:.0f} fps average; frames over 20 ms: {len(fr)} ({100 * len(fr) / n:.1f}%); over 50 ms: {sum(1 for _, d in fr if d > 50)}; worst {max([d for _, d in fr] or [0])} ms')
for s, ds in by.items():
    print(f'  {s:12s} slow frames {len(ds):3d}   over 50ms {sum(1 for d in ds if d > 50):2d}   worst {max(ds or [0]):4d} ms')
if os.environ.get('DETAIL'): print('  slow frames (scrollY:ms):', ' '.join(f'{y}:{d}' for y, d in fr if d > int(os.environ['DETAIL'])))
