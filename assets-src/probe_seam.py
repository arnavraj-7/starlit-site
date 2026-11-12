from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--enable-gpu'])
    pg = b.new_page(viewport={'width': 2560, 'height': 1440})
    pg.goto('http://localhost:4317/', wait_until='networkidle'); pg.wait_for_timeout(3000)
    total = pg.evaluate('document.documentElement.scrollHeight')
    for y in range(0, 19000, 720): pg.evaluate(f'window.scrollTo(0,{y})'); pg.wait_for_timeout(80)
    top = pg.evaluate("document.querySelector('#details').getBoundingClientRect().top + scrollY")
    pg.evaluate(f'window.scrollTo(0,{top - 720})'); pg.wait_for_timeout(1200)
    print(pg.evaluate("""(() => document.elementsFromPoint(1280, 500).slice(0,8).map(e => {
      const s = getComputedStyle(e); return [e.tagName, e.className && e.className.baseVal === undefined ? e.className : '', s.backgroundColor, s.backgroundImage.slice(0,60), e.getBoundingClientRect().bottom|0]
    }))()"""))
    pg.screenshot(path='shots/probe.jpg', quality=70)
    b.close()
