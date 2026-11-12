"""Measure the laptop section's caption boxes at the final beat, and shoot it.
python capm.py W H name"""
from playwright.sync_api import sync_playwright
import sys
W, H, name = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    pg.goto('http://localhost:4317/', wait_until='networkidle'); pg.wait_for_timeout(5000)
    top = pg.evaluate("document.getElementById('screens').getBoundingClientRect().top + scrollY")
    for y in range(0, int(top), 600): pg.evaluate(f'window.scrollTo(0,{y})'); pg.wait_for_timeout(60)
    pg.wait_for_timeout(1500)
    top = pg.evaluate("document.getElementById('screens').getBoundingClientRect().top + scrollY")
    pin = pg.evaluate("document.getElementById('screens').offsetHeight - innerHeight")
    pg.evaluate(f'window.scrollTo(0,{int(top + pin * 0.97)})'); pg.wait_for_timeout(2500)
    print(pg.evaluate("""JSON.stringify(['.laptop-copy', '.step--side', '.step--side .h2', '.laptop-pin'].map(s => {
      const r = document.querySelector('#screens ' + s).getBoundingClientRect(); return [s, Math.round(r.left), Math.round(r.width)] }))"""))
    pg.screenshot(path=f'shots/{name}.jpg', quality=85)
    b.close()
