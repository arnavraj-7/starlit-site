"""Screenshot at a section's pin start plus offsets (in viewport heights): python shoot_at.py <sel> <w> <h> <offs>"""
import sys
from playwright.sync_api import sync_playwright
sel, W, H = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
offs = [float(x) for x in sys.argv[4].split(',')]
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    pg.goto('http://localhost:4317/', wait_until='networkidle'); pg.wait_for_timeout(2500)
    top = pg.evaluate(f"(() => {{ const e = document.querySelector('{sel}'); return e.getBoundingClientRect().top + scrollY; }})()")
    for o in offs:
        pg.evaluate(f'window.scrollTo(0, {top + o * H})'); pg.wait_for_timeout(int(__import__("os").environ.get("WAIT", "1500")))
        pg.screenshot(path=f'shots/at-{sel.strip("#.")}-{W}-{int(o*100):03d}.jpg', quality=80)
    b.close()
