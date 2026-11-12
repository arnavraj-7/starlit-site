"""Drag the hero's tonearm in headless Edge and check that the groove under the needle lights.
usage: python armtest.py"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--enable-gpu', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 2560, 'height': 1440})
    pg.goto('http://localhost:4317/', wait_until='networkidle'); pg.wait_for_timeout(6000)
    state = lambda: pg.evaluate("() => { const g = document.querySelector('.groove'), cs = getComputedStyle(g); return { lit: g.classList.contains('is-lit'), na: cs.getPropertyValue('--na'), nr: cs.getPropertyValue('--nr') } }")
    print('after intro:', state())
    t = pg.evaluate("() => { const r = document.querySelector('.ga-tip').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }")
    g = pg.evaluate("() => { const r = document.querySelector('.groove').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.width] }")
    # grab the tube a little above the needle and swing it in toward the label
    pg.mouse.move(t[0] + 6, t[1] - 60); pg.mouse.down()
    for k in range(1, 21):
        pg.mouse.move(t[0] + 6 - k * 9, t[1] - 60 + k * 3); pg.wait_for_timeout(16)
    pg.wait_for_timeout(200); print('while lifted:', state())
    pg.mouse.up(); pg.wait_for_timeout(1800); print('set down further in:', state())
    pg.screenshot(path='shots/armtest.jpg', quality=80)
    # now drag it off the record: it should go back to its rest and the light go out
    t = pg.evaluate("() => { const r = document.querySelector('.ga-tip').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }")
    pg.mouse.move(t[0] + 6, t[1] - 60); pg.mouse.down()
    for k in range(1, 21):
        pg.mouse.move(t[0] + 6 + k * 30, t[1] - 60 - k * 10); pg.wait_for_timeout(16)
    pg.mouse.up(); pg.wait_for_timeout(2500); print('dropped off the record:', state())
    b.close()
