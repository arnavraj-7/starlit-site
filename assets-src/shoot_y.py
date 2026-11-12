"""Screenshots at absolute scroll positions; 'end' = bottom of page. python shoot_y.py W H name y,y,end"""
import sys
from playwright.sync_api import sync_playwright
W, H, name = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:4317/', wait_until='networkidle'); pg.wait_for_timeout(int(__import__('os').environ.get('WAIT', '4500')))
    total = pg.evaluate('document.documentElement.scrollHeight - innerHeight')
    for k, y in enumerate(sys.argv[4].split(',')):
        yy = total if y == 'end' else int(y)
        if yy: pg.evaluate(f'window.scrollTo(0, {yy})'); pg.wait_for_timeout(1800)
        pg.screenshot(path=f'shots/{name}-{k}.jpg', quality=85)
    print('errors', errs[:3]); b.close()
