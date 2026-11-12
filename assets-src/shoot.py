"""Headless screenshots of the site at given scroll fractions (never touches the user's screens).
usage: python shoot.py <out_dir> <width> <height> <frac,frac,...>"""
import sys, pathlib
from playwright.sync_api import sync_playwright

out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
W, H = int(sys.argv[2]), int(sys.argv[3])
fracs = [float(f) for f in sys.argv[4].split(',')]
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto('http://localhost:4317/', wait_until='networkidle')
    pg.wait_for_timeout(3500)
    total = pg.evaluate('document.documentElement.scrollHeight - innerHeight')
    print('scroll height', total)
    for f in fracs:
        y = int(total * f)
        pg.evaluate(f'window.scrollTo(0, {y})')
        pg.wait_for_timeout(1600)
        pg.screenshot(path=str(out / f'{W}-{int(f * 1000):04d}.jpg'), quality=80)
    print('errors:', errs[:5])
    b.close()
