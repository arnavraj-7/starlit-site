"""Shoot the 3D features section at chosen points of its scroll (p = 0..5, in features).
    python featshots.py 0 0.75 1 3 4.8"""
import sys, asyncio, os
from playwright.async_api import async_playwright

W, H = int(os.environ.get('W', 2560)), int(os.environ.get('H', 1440))
OUT = os.path.join(os.path.dirname(__file__), 'shots')

async def main(ps):
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='msedge', headless=True, args=['--use-angle=d3d11', '--enable-gpu'])
        pg = await b.new_page(viewport={'width': W, 'height': H})
        await pg.goto('http://localhost:4317/', wait_until='networkidle')
        await pg.wait_for_timeout(2500)
        top = await pg.evaluate("document.querySelector('#details').getBoundingClientRect().top + scrollY")
        # walk down so everything before it has set itself up
        for y in range(0, int(top), H):
            await pg.evaluate(f'window.scrollTo(0,{y})'); await pg.wait_for_timeout(120)
        for v in ps:
            y = top + float(v) / 5 * (6 * 0.85 * H)
            await pg.evaluate(f'window.scrollTo(0,{y})'); await pg.wait_for_timeout(1800)
            path = os.path.join(OUT, f'feat3d-{v}.png')
            await pg.screenshot(path=path); print(path)
        await b.close()

asyncio.run(main(sys.argv[1:] or ['0', '0.75', '1', '2', '3', '4', '5']))
