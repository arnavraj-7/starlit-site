"""Trace the first second of scrolling (or from a given scrollY) and list the long events.
usage: python tracescroll.py [startY=0] [wheels=40] [movemouse=1]"""
import sys, json
from playwright.sync_api import sync_playwright
Y = int(sys.argv[1]) if len(sys.argv) > 1 else 0
N = int(sys.argv[2]) if len(sys.argv) > 2 else 40
MOVE = (sys.argv[3] if len(sys.argv) > 3 else '1') == '1'
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 2560, 'height': 1440})
    pg.goto('http://localhost:4317/', wait_until='networkidle'); pg.wait_for_timeout(7000)
    if Y:
        pg.evaluate(f'window.__lenis ? window.__lenis.scrollTo({Y}, {{ immediate: true }}) : scrollTo(0, {Y})'); pg.wait_for_timeout(2500)
    b.start_tracing(page=pg, path='trace.json', categories=['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink', 'gpu', 'cc'])
    if MOVE: pg.mouse.move(1280, 720)
    for _ in range(N):
        pg.mouse.wheel(0, 40); pg.wait_for_timeout(14)
    pg.wait_for_timeout(600)
    b.stop_tracing(); b.close()
ev = json.load(open('trace.json', encoding='utf8'))
ev = ev['traceEvents'] if isinstance(ev, dict) else ev
names = {}
for e in ev:
    if e.get('ph') == 'M' and e.get('name') == 'thread_name': names[(e['pid'], e['tid'])] = e['args']['name']
long = []
for e in ev:
    if e.get('ph') == 'X' and e.get('dur', 0) > 15000:
        a = e.get('args', {}).get('data', {}) if isinstance(e.get('args', {}).get('data', {}), dict) else {}
        long.append((e['dur'] // 1000, e['name'], str(a.get('url') or a.get('functionName') or a.get('type') or '')[-50:], names.get((e['pid'], e['tid']), '?')))
long.sort(reverse=True)
for x in long[:40]: print(x)
