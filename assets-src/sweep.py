"""Scroll the whole site in fixed steps at a given viewport and save every frame; tile them 2x3 per sheet."""
import sys, pathlib
from playwright.sync_api import sync_playwright
from PIL import Image
W, H, step = int(sys.argv[1]), int(sys.argv[2]), float(sys.argv[3])
out = pathlib.Path(sys.argv[4]); out.mkdir(parents=True, exist_ok=True)
for f in out.glob('*'): f.unlink()
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:4317/', wait_until='networkidle'); pg.wait_for_timeout(3500)
    total = pg.evaluate('document.documentElement.scrollHeight - innerHeight')
    y, i, files = 0, 0, []
    while y <= total + 1:
        pg.evaluate(f'window.scrollTo(0, {y})'); pg.wait_for_timeout(900)
        f = out / f'{i:03d}.jpg'; pg.screenshot(path=str(f), quality=78); files.append(f)
        y += int(H * step); i += 1
    print('frames', i, 'height', total, 'errors', errs[:3])
    b.close()
tw = 760; th = int(tw * H / W)
for s in range(0, len(files), 6):
    sheet = Image.new('RGB', (tw * 2, th * 3), 'white')
    for k, f in enumerate(files[s:s + 6]):
        sheet.paste(Image.open(f).resize((tw, th)), ((k % 2) * tw, (k // 2) * th))
    sheet.save(out / f'sheet-{s // 6:02d}.jpg', quality=80)
