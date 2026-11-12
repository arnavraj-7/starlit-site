"""Screenshot an HTML file headless: python shoot_sheet.py in.html out.png [width]"""
import sys, pathlib
from playwright.sync_api import sync_playwright
src, out = pathlib.Path(sys.argv[1]).resolve(), sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv) > 3 else 1400
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={'width': w, 'height': 900}, device_scale_factor=1)
    pg.goto(src.as_uri()); pg.wait_for_timeout(300)
    pg.screenshot(path=out, full_page=True)
    b.close()
print('shot', out)
