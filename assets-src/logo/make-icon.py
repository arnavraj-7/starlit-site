"""Starlit's icon from the site's mark (a record ring, its centre, and a small satellite on the rim),
drawn on an ink tile. Writes every size the app and the site use.
  python make-icon.py            -> out/ (pngs, starlit.ico, favicon.svg)"""
import pathlib
from PIL import Image, ImageDraw, ImageFilter

OUT = pathlib.Path(__file__).with_name('out'); OUT.mkdir(exist_ok=True)
INK = (7, 9, 18)
TILE_TOP, TILE_BOTTOM = (22, 25, 42), (8, 10, 20)
MARK = (171, 156, 255)            # the site's violet accent (#ab9cff)
SS = 4                            # supersampling

def mark_layer(px, scale, ox, oy, colour):
    """The mark in viewBox units (24 x 24) placed at (ox, oy) with `scale` px per unit."""
    im = Image.new('RGBA', (px, px), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    u = lambda v: v * scale
    def circle(cx, cy, r, **kw): d.ellipse([ox + u(cx - r), oy + u(cy - r), ox + u(cx + r), oy + u(cy + r)], **kw)
    circle(12, 12, 8.2 + 0.85, fill=colour)                   # ring = outer disc minus inner disc
    circle(12, 12, 8.2 - 0.85, fill=(0, 0, 0, 0))
    circle(12, 12, 2.3, fill=colour)                          # centre
    circle(18.3, 5.7, 2.9 + 0.7, fill=(0, 0, 0, 0))           # gap round the satellite
    circle(18.3, 5.7, 2.9, fill=colour)                       # satellite
    return im

def icon(size, tight=False):
    P = size * SS
    tile = Image.new('RGBA', (P, P))
    for y in range(P):                                        # quiet vertical gradient
        k = y / (P - 1)
        c = tuple(round(TILE_TOP[i] + (TILE_BOTTOM[i] - TILE_TOP[i]) * k) for i in range(3))
        tile.paste(c + (255,), (0, y, P, y + 1))
    span = 0.86 if tight else 0.62                            # how much of the tile the 24-unit box fills
    scale = P * span / 24; o = (P - 24 * scale) / 2
    m = mark_layer(P, scale, o, o, MARK + (255,))
    if not tight:                                             # soft glow under the mark
        glow = m.filter(ImageFilter.GaussianBlur(P * 0.035)); a = glow.getchannel('A').point(lambda v: int(v * 0.55)); glow.putalpha(a)
        tile.alpha_composite(glow)
    tile.alpha_composite(m)
    mask = Image.new('L', (P, P), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, P - 1, P - 1], radius=int(P * 0.225), fill=255)
    tile.putalpha(mask)
    return tile.resize((size, size), Image.LANCZOS)

big = {s: icon(s) for s in (1024, 512, 256, 180, 128, 64)}
small = {s: icon(s, tight=True) for s in (16, 24, 32, 48)}
for s, im in {**big, **small}.items(): im.save(OUT / f'icon-{s}.png')
frames = [small[16], small[24], small[32], small[48], big[64], big[128], big[256]]
frames[-1].save(OUT / 'starlit.ico', format='ICO', sizes=[f.size for f in frames], append_images=frames[:-1])
(OUT / 'favicon.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="5.4" fill="#0f1220"/>
  <g transform="translate(1.8 1.8) scale(.85)">
    <circle cx="12" cy="12" r="8.2" fill="none" stroke="#ab9cff" stroke-width="1.7"/>
    <circle cx="12" cy="12" r="2.3" fill="#ab9cff"/>
    <circle cx="18.3" cy="5.7" r="2.9" fill="#ab9cff" stroke="#0f1220" stroke-width="1.4"/>
  </g>
</svg>
''', encoding='utf-8')
sheet = Image.new('RGBA', (1200, 560), (236, 236, 240, 255)); x = 20
for s in (512, 256, 64, 48, 32, 24, 16):
    im = big.get(s) or small[s]; sheet.alpha_composite(im, (x, 24)); x += s + 18
sheet.convert('RGB').save(OUT / 'check.jpg', quality=90)
print('wrote', len(list(OUT.iterdir())), 'files')
