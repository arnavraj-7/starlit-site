"""Evaluate a JS expression on the page after scrolling to y. usage: python probe.py <y> <js-file>"""
import sys, json
from playwright.sync_api import sync_playwright
y = int(sys.argv[1]); js = open(sys.argv[2], encoding='utf-8').read()
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 2560, 'height': 1440})
    pg.goto('http://localhost:4317/', wait_until='networkidle'); pg.wait_for_timeout(int(__import__('os').environ.get('WAIT0', '4000')))
    if y: pg.evaluate(f'window.scrollTo(0, {y})'); pg.wait_for_timeout(1800)
    print(json.dumps(pg.evaluate(js), indent=1)[:3000])
    b.close()
