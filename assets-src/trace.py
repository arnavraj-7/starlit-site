import json, collections
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--enable-gpu', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 2560, 'height': 1440})
    b.start_tracing(page=pg, path='trace.json', categories=['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink', 'gpu'])
    pg.goto('http://localhost:4317/'); pg.wait_for_timeout(4000)
    b.stop_tracing(); b.close()
ev = json.load(open('trace.json', encoding='utf8'))
ev = ev['traceEvents'] if isinstance(ev, dict) else ev
main = collections.Counter()
long = []
for e in ev:
    if e.get('ph') == 'X' and e.get('dur', 0) > 30000:
        a = e.get('args', {}).get('data', {})
        long.append((e['dur'] // 1000, e['name'], (a.get('url') or a.get('functionName') or a.get('frame') or '')[-60:], e.get('tid')))
long.sort(reverse=True)
seen=set()
for x in long:
    k=(x[1],x[2])
    if k in seen: continue
    seen.add(k); print(x)
    if len(seen)>25: break
