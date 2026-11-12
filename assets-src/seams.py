"""Screenshot every boundary between sections, with the seam in the middle of the view.
    python seams.py   -> shots/seam-<n>.jpg and shots/seams.jpg"""
import os
from playwright.sync_api import sync_playwright
from PIL import Image

W, H = 2560, 1440
OUT = os.path.join(os.path.dirname(__file__), 'shots')
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--enable-gpu', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    pg.goto('http://localhost:4317/', wait_until='networkidle'); pg.wait_for_timeout(4000)
    total = pg.evaluate('document.documentElement.scrollHeight')
    for y in range(0, total, H // 2):                       # walk once so everything has set itself up
        pg.evaluate(f'window.scrollTo(0,{y})'); pg.wait_for_timeout(90)
    # boundaries measured in page space, after pin spacers exist
    tops = pg.evaluate("""[...document.querySelectorAll('main > section, main > div, footer, .footer')]
        .map(e => ({ n: (e.id || e.className || e.tagName).toString().slice(0, 30), y: e.getBoundingClientRect().top + scrollY }))""")
    names, files = [], []
    for k, t in enumerate(tops[1:], 1):
        pg.evaluate(f"window.scrollTo(0,{t['y'] - H / 2})"); pg.wait_for_timeout(900)
        f = os.path.join(OUT, f'seam-{k}.jpg'); pg.screenshot(path=f, quality=75); files.append(f)
        names.append(f"{tops[k-1]['n']} -> {t['n']} @ {int(t['y'])}")
    b.close()
print('\n'.join(f'{i+1}: {n}' for i, n in enumerate(names)))
w = 900; h = int(w * H / W)
s = Image.new('RGB', (w * 2, h * ((len(files) + 1) // 2)))
for i, f in enumerate(files): s.paste(Image.open(f).resize((w, h)), ((i % 2) * w, (i // 2) * h))
s.save(os.path.join(OUT, 'seams.jpg'), quality=80)
