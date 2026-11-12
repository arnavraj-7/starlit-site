"""Screenshots of the laptop section at points through its pinned scroll.
python laptopshots.py name [fractions]   e.g. python laptopshots.py lap 0,.2,.4,.6,.8,1"""
import sys, os
from playwright.sync_api import sync_playwright
name = sys.argv[1]
fracs = [float(x) for x in (sys.argv[2] if len(sys.argv) > 2 else '-0.4,0,.15,.3,.45,.6,.75,.9,1,1.25').split(',')]
W, H = int(os.environ.get('W', 2560)), int(os.environ.get('H', 1440))
os.makedirs('shots', exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text[:300]) if m.type in ('error','warning') else None)
    pg.goto('http://localhost:4317/', wait_until='networkidle'); pg.wait_for_timeout(int(os.environ.get('WAIT', '5000')))
    # walk down to the section so the 3D scene mounts and the triggers are refreshed
    top = pg.evaluate("document.getElementById('screens').getBoundingClientRect().top + scrollY")
    for y in range(0, int(top), 600): pg.evaluate(f'window.scrollTo(0,{y})'); pg.wait_for_timeout(60)
    pg.wait_for_timeout(2500)
    top = pg.evaluate("document.getElementById('screens').getBoundingClientRect().top + scrollY")
    pin = pg.evaluate("document.getElementById('screens').offsetHeight - innerHeight")
    print('top', top, 'pin', pin)
    for k, f in enumerate(fracs):
        y = int(top + f * pin)
        pg.evaluate(f'window.scrollTo(0,{y})'); pg.wait_for_timeout(int(os.environ.get('STEP', '1600')))
        pg.screenshot(path=f'shots/{name}-{k}.jpg', quality=82)
    print('errors', errs[:3]); b.close()
