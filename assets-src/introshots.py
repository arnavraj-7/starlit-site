"""Screenshot the first seconds after navigation, to see what is on screen before and during the intro.
usage: python introshots.py <outdir> [W=2560] [H=1440]"""
import sys, pathlib, time
from playwright.sync_api import sync_playwright
from PIL import Image
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
W = int(sys.argv[2]) if len(sys.argv) > 2 else 2560
H = int(sys.argv[3]) if len(sys.argv) > 3 else 1440
for f in out.glob('*'): f.unlink()
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    pg.goto('http://localhost:4317/', wait_until='commit')
    t0 = time.time(); files = []
    for i in range(12):
        f = out / f'{i:02d}.jpg'; pg.screenshot(path=str(f), quality=70)
        at = pg.evaluate('window.__introAt ? Math.round(performance.now() - window.__introAt) : null')
        files.append((f, f'{time.time() - t0:.2f}s intro{at:+d}ms' if at is not None else f'{time.time() - t0:.2f}s (waiting)'))
        pg.wait_for_timeout(180)
    b.close()
print(' | '.join(t for _, t in files))
tw = 640; th = int(tw * H / W)
sheet = Image.new('RGB', (tw * 4, th * 3), 'white')
for k, (f, _) in enumerate(files): sheet.paste(Image.open(f).resize((tw, th)), ((k % 4) * tw, (k // 4) * th))
sheet.save(out / 'sheet.jpg', quality=82)
