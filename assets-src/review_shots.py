"""Screenshots of the whole site for an outside review: each section at several points of its
scroll (pinned sections play out as you scroll, so one frame isn't enough), saved per section,
plus one contact sheet per section.
    python review_shots.py   -> C:/projects/starlit-site/review/"""
import os
from playwright.sync_api import sync_playwright
from PIL import Image

W, H = 2560, 1440
OUT = 'C:/projects/starlit-site/review'
os.makedirs(OUT, exist_ok=True)
SECTIONS = [  # (selector, name, points through the section: 0 = its top at the top of the view)
    ('#top', '01-hero', [0]),
    ('#screens', '02-laptop', [0.0, 0.2, 0.4, 0.55, 0.7, 0.9]),
    ('#styles', '03-styles', [0.05, 0.4, 0.75]),
    ('#turntable', '04-turntable', [0.05, 0.35, 0.65, 0.9]),
    ('#details', '05-features', [0.02, 0.2, 0.36, 0.53, 0.7, 0.88]),
    ('.setup-sec', '06-setup', [0]),
    ('#download', '07-download', [0]),
    ('.footer', '08-footer', [0]),
]

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--enable-gpu', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    pg.goto('http://localhost:4317/', wait_until='networkidle'); pg.wait_for_timeout(6500)   # let the intro and headline play
    pg.screenshot(path=f'{OUT}/01-hero-a.jpg', quality=88)
    total = pg.evaluate('document.documentElement.scrollHeight')
    for y in range(0, total, H // 2):
        pg.evaluate(f'window.scrollTo(0,{y})'); pg.wait_for_timeout(90)
    for sel, name, points in SECTIONS[1:]:
        top, height = pg.evaluate(f"""(() => {{ const e = document.querySelector('{sel}'); const r = e.getBoundingClientRect();
            const sp = e.closest('.pin-spacer') || e.parentElement.classList.contains('pin-spacer') && e.parentElement;
            const box = (e.parentElement && e.parentElement.classList.contains('pin-spacer')) ? e.parentElement.getBoundingClientRect() : r;
            return [box.top + scrollY, box.height] }})()""")
        files = []
        for k, f in enumerate(points):
            y = top + max(0, height - H) * f if height > H * 1.2 else top - (0 if sel != '.footer' else H - height)
            pg.evaluate(f'window.scrollTo(0,{y})'); pg.wait_for_timeout(1600)
            path = f'{OUT}/{name}-{chr(97 + k)}.jpg'; pg.screenshot(path=path, quality=88); files.append(path)
        print(name, len(files))
    b.close()

# a contact sheet per section with more than one frame
by = {}
for f in sorted(os.listdir(OUT)):
    if f.endswith('.jpg') and '-sheet' not in f: by.setdefault(f.rsplit('-', 1)[0], []).append(f)
for name, fs in by.items():
    if len(fs) < 2: continue
    w = 1280; h = int(w * H / W); cols = 2; rows = (len(fs) + 1) // 2
    s = Image.new('RGB', (w * cols, h * rows), (7, 9, 18))
    for i, f in enumerate(fs): s.paste(Image.open(f'{OUT}/{f}').resize((w, h)), ((i % cols) * w, (i // cols) * h))
    s.save(f'{OUT}/{name}-sheet.jpg', quality=85)
print('saved to', OUT)
