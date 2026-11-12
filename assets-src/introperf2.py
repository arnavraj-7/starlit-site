"""When do the long frames happen? (headless Edge, 2560x1440, second load = warm cache)"""
from playwright.sync_api import sync_playwright
INIT = """
window.__ft = []; let last = 0;
const f = t => { if (last && t - last > 34) window.__ft.push([Math.round(last), Math.round(t - last)]); last = t; if (t < 8000) requestAnimationFrame(f); };
requestAnimationFrame(f);
"""
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--enable-gpu', '--ignore-gpu-blocklist'])
    for run in range(3):
        pg = b.new_page(viewport={'width': 2560, 'height': 1440})
        pg.add_init_script(INIT)
        pg.goto('http://localhost:4317/')
        pg.wait_for_timeout(8500)
        print(f'run {run}: intro starts at', round(pg.evaluate('window.__introAt || 0')), 'ms; long frames (at ms, lasted ms):', pg.evaluate('window.__ft'))
        pg.close()
    b.close()
