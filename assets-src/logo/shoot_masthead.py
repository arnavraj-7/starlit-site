"""Masthead logo at 2560x1440, headless: full viewport, a 2x close crop, and the hover state."""
from playwright.sync_api import sync_playwright
OUT = 'C:/projects/starlit-site/assets-src/logo/out/'
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={'width': 2560, 'height': 1440}, device_scale_factor=1)
    pg.goto('http://localhost:4317/')
    pg.wait_for_function('window.__introDone === true', timeout=60000); pg.wait_for_timeout(2500)
    print('masthead opacity', pg.evaluate("getComputedStyle(document.querySelector('.masthead')).opacity"))
    pg.screenshot(path=OUT + 'masthead-2560.png')
    box = pg.locator('.brand').bounding_box()
    clip = {'x': box['x'] - 40, 'y': box['y'] - 24, 'width': box['width'] + 80, 'height': box['height'] + 48}
    pg.screenshot(path=OUT + 'masthead-crop.png', clip=clip)
    pg.hover('.brand'); pg.wait_for_timeout(1200)
    pg.screenshot(path=OUT + 'masthead-hover.png', clip=clip)
    b.close()
from PIL import Image
for n in ('masthead-crop', 'masthead-hover'):
    im = Image.open(OUT + n + '.png'); im.resize((im.width * 3, im.height * 3), Image.LANCZOS).save(OUT + n + '-x3.png')
print('ok')
