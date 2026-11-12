"""Screenshots of the hero headline while it is being sung."""
from playwright.sync_api import sync_playwright
from PIL import Image
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--enable-gpu', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 2560, 'height': 1440})
    pg.goto('http://localhost:4317/', wait_until='networkidle'); pg.wait_for_timeout(4600)
    ims = []
    for k in range(6):
        pg.screenshot(path=f'shots/sing{k}.jpg', quality=80, clip={'x': 380, 'y': 300, 'width': 1050, 'height': 520}); ims.append(f'shots/sing{k}.jpg')
        pg.wait_for_timeout(450)
    b.close()
s = Image.new('RGB', (1050 * 2, 520 * 3))
for i, f in enumerate(ims): s.paste(Image.open(f), ((i % 2) * 1050, (i // 2) * 520))
s.resize((1050, 780)).save('shots/sing-sheet.jpg', quality=85)
