"""Frame times during the first 4 s after load (headless Edge, 2560x1440)."""
from playwright.sync_api import sync_playwright
INIT = """
window.__ft = []; let last = 0;
const f = t => { if (last) window.__ft.push(+(t - last).toFixed(1)); last = t; if (t < 7500) requestAnimationFrame(f); };
requestAnimationFrame(f);
"""
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--enable-gpu', '--ignore-gpu-blocklist'])
    for run in range(2):
        pg = b.new_page(viewport={'width': 2560, 'height': 1440})
        pg.add_init_script(INIT)
        pg.goto('http://localhost:4317/')
        pg.wait_for_timeout(8000)
        ft = pg.evaluate('window.__ft')
        long = [x for x in ft if x > 25]
        print(f'run {run}: frames {len(ft)}, >25ms {len(long)}, worst {sorted(ft)[-5:]}, first 40: {ft[:40]}')
        pg.close()
    b.close()
