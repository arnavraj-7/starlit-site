"""What is the browser doing during the hero intro? Traces a load and lists, per thread, the
longest events in the 2.5 s after the page's performance.mark('starlit-intro').
usage: python traceintro.py [min_ms=8]"""
import sys, json, collections
from playwright.sync_api import sync_playwright
MIN = float(sys.argv[1]) if len(sys.argv) > 1 else 8
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 2560, 'height': 1440})
    pg.goto('http://localhost:4317/', wait_until='networkidle'); pg.wait_for_timeout(1500)      # warm the cache
    b.start_tracing(page=pg, path='trace.json', categories=['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing', 'blink', 'gpu', 'cc', 'viz'])
    pg.reload(wait_until='networkidle'); pg.wait_for_timeout(5500)
    b.stop_tracing(); b.close()
ev = json.load(open('trace.json', encoding='utf8'))
ev = ev['traceEvents'] if isinstance(ev, dict) else ev
names = {}
for e in ev:
    if e.get('ph') == 'M' and e.get('name') == 'thread_name': names[(e['pid'], e['tid'])] = e['args']['name']
marks = [e['ts'] for e in ev if e.get('name') == 'starlit-intro']
if not marks: sys.exit('no starlit-intro mark in the trace')
t0 = marks[-1]
WRAP = {'RunTask', 'Scheduler::RunTask', 'ThreadControllerImpl::RunTask', 'GPUTask', 'GpuChannel::ExecuteDeferredRequest', 'CommandBufferStub::OnAsyncFlush',
        'CommandBufferService:PutChanged', 'CommandBuffer::Flush', 'SimpleWatcher::OnHandleReady', 'ThreadPool_RunTask', 'TaskGraphRunner::RunTask'}
rows = []
for e in ev:
    if e.get('ph') == 'X' and t0 <= e['ts'] <= t0 + 2_500_000 and e.get('dur', 0) >= MIN * 1000 and e['name'] not in WRAP:
        rows.append(((e['ts'] - t0) // 1000, e['dur'] / 1000, e['name'], names.get((e['pid'], e['tid']), '?')))
rows.sort()
print(f'events >= {MIN} ms in the 2.5 s after the intro starts (at ms, lasted ms, what, thread):')
for at, d, n, th in rows: print(f'  +{at:5d}  {d:6.1f}  {n[:46]:46s} {th}')
tot = collections.Counter()
for at, d, n, th in rows: tot[th] += 1
print('count by thread:', dict(tot))
