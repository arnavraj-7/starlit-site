"""Starlit logotype: real type outlines (variable fonts instanced with fontTools), refined by hand
per letter with real boolean ops (skia-pathops), locked up with the ring mark.

    python logotype.py            -> out/logotype-{a,b,c}.svg/.json, out/logotype-sheet.html

Refinements (all geometry, so the result is clean outlines that work on any background):
  glint   the i's dot becomes a four-point star in warm light: star + lit
  stylus  the l's top is cut on a slant, like a stylus tip resting in the groove
  tails   the t's crossbar is trimmed so the two t's sit tighter against their neighbours
"""
import io, os, sys, json, math
import pathops
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

FONTS = 'C:/projects/starlit/src/fonts/files/'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
TEXT = 'Starlit'
STAR_COLOUR = '#ffc496'
CAP = 100.0          # svg units: cap height
BASE = 130.0         # svg baseline


def contours(rec):
    out, cur = [], []
    for op, args in rec.value:
        cur.append((op, args))
        if op in ('closePath', 'endPath'):
            out.append(cur); cur = []
    if cur: out.append(cur)
    return out


def bounds(ops):
    bp = BoundsPen(None)
    for op, args in ops: getattr(bp, op)(*args)
    return bp.bounds


def to_skia(ops, sc, dx):
    """font units -> a pathops.Path in svg units (y down, baseline at BASE)"""
    p = pathops.Path()
    tp = TransformPen(p.getPen(), (sc, 0, 0, -sc, dx, BASE))
    for op, args in ops: getattr(tp, op)(*args)
    return p


def poly(pts):
    p = pathops.Path(); pen = p.getPen()
    pen.moveTo(pts[0])
    for q in pts[1:]: pen.lineTo(q)
    pen.closePath()
    return p


def d_of(path):
    sp = SVGPathPen(None, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
    path.draw(sp)
    return sp.getCommands()


def star_d(cx, cy, r, waist=0.15, tall=1.0):
    """a four-point glint; tall stretches the vertical arms (a sparkle reads taller than wide)"""
    k, ry, rx = r * waist, r * tall, r / tall ** 0.5
    return (f'M{cx:.2f} {cy - ry:.2f}Q{cx + k:.2f} {cy - k:.2f} {cx + rx:.2f} {cy:.2f}'
            f'Q{cx + k:.2f} {cy + k:.2f} {cx:.2f} {cy + ry:.2f}Q{cx - k:.2f} {cy + k:.2f} {cx - rx:.2f} {cy:.2f}'
            f'Q{cx - k:.2f} {cy - k:.2f} {cx:.2f} {cy - ry:.2f}Z')


def mark_svg(cx, cy, size, ink, weight=1.0):
    """the ring mark (Chrome.jsx, viewBox 24), its ring centred on cx, cy; weight thickens the ring
    so it carries the same stroke weight as the letters beside it"""
    s = size / 24
    X = lambda v: cx + (v - 12) * s
    Y = lambda v: cy + (v - 12) * s
    sw = 1.7 * weight
    return (f'<g class="lg-mark">'
            f'<circle cx="{X(12):.2f}" cy="{Y(12):.2f}" r="{(8.2 - (sw - 1.7) / 2) * s:.2f}" fill="none" stroke="currentColor" stroke-width="{sw * s:.2f}"/>'
            f'<circle cx="{X(12):.2f}" cy="{Y(12):.2f}" r="{2.3 * min(weight, 1.25) * s:.2f}" fill="currentColor"/>'
            f'<circle class="lg-sat" cx="{X(18.3):.2f}" cy="{Y(5.7):.2f}" r="{2.9 * s:.2f}" fill="currentColor" stroke="{ink}" stroke-width="{1.5 * s:.2f}"/>'
            f'</g>')


def build(spec):
    f = instancer.instantiateVariableFont(TTFont(FONTS + spec['font']), spec['loc'])
    upm = f['head'].unitsPerEm
    gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f['hmtx']
    cap, xh = f['OS/2'].sCapHeight, f['OS/2'].sxHeight
    sc = CAP / cap
    track, kern = spec.get('track', 0) * upm, spec.get('kern', {})
    x, letters, glint = 0.0, [], None
    for i, ch in enumerate(TEXT):
        name = cmap[ord(ch)]
        rec = DecomposingRecordingPen(gs); gs[name].draw(rec)
        cs = contours(rec)
        if ch == 'i' and spec.get('glint'):
            dot = [c for c in cs if bounds(c)[1] >= xh * 0.98][0]
            cs = [c for c in cs if bounds(c)[1] < xh * 0.98]
            b = bounds(dot)
            glint = (x + (b[0] + b[2]) / 2 * sc, BASE - (b[1] + b[3]) / 2 * sc, (b[2] - b[0]) / 2 * sc)
        ops = [op for c in cs for op in c]
        pts = [a for op, args in ops for a in args if isinstance(a, tuple)]
        letters.append({'ch': ch, 'x': x, 'path': to_skia(ops, sc, x), 'b': bounds(ops), 'pts': pts})
        x += hmtx[name][0] * sc + track * sc + kern.get(TEXT[i:i + 2], 0) * upm * sc
    width = x - track * sc
    L = {'letters': letters, 'width': width, 'sc': sc, 'xh': xh * sc, 'glint': None}
    for fn in spec.get('refine', []): fn(L, spec)
    if glint:
        g = spec['glint']
        L['glint'] = star_d(glint[0] + g.get('dx', 0), glint[1] - g.get('lift', 0), glint[2] * g['size'], g.get('waist', 0.15), g.get('tall', 1.0))
    # one clean outline for the whole word
    word = pathops.Path()
    for l in letters: word = pathops.op(word, l['path'], pathops.PathOp.UNION)
    L['d'] = d_of(word)
    return L


def stem(l, sc, above):
    """x range (svg) and top y of the vertical stroke above a height (font units)"""
    xs = [p[0] for p in l['pts'] if p[1] > above]
    top = max(p[1] for p in l['pts'])
    return l['x'] + min(xs) * sc, l['x'] + max(xs) * sc, BASE - top * sc


def stylus(L, spec):
    """the l's top cut on a slant (rising to the right), like a stylus tip"""
    sc = L['sc']
    for l in L['letters']:
        if l['ch'] != 'l': continue
        x0, x1, top = stem(l, sc, L['xh'] / sc * 1.1)
        w = x1 - x0
        drop = w * spec.get('lslant', spec.get('slant', 0.75))
        cut = poly([(x0 - 2, top - 2), (x1 + 2, top - 2), (x1 + 2, top - 0.01), (x0 - 2, top + drop)])
        l['path'] = pathops.op(l['path'], cut, pathops.PathOp.DIFFERENCE)


def t_slant(L, spec):
    """both t's get the same slanted top as the l, so the three ascenders rhyme"""
    sc = L['sc']
    for l in L['letters']:
        if l['ch'] != 't': continue
        x0, x1, top = stem(l, sc, L['xh'] / sc * 1.08)
        w = x1 - x0
        drop = w * spec.get('slant', 0.75)
        cut = poly([(x0 - 2, top - 2), (x1 + 2, top - 2), (x1 + 2, top - 0.01), (x0 - 2, top + drop)])
        l['path'] = pathops.op(l['path'], cut, pathops.PathOp.DIFFERENCE)


def lockup(L, spec, ink='#070912', pad=20, with_mark=True):
    msize = CAP * spec.get('mark', 1.14)
    gap = CAP * spec.get('gap', 0.3)
    ox = (msize + gap) if with_mark else 0
    top, bot = BASE - CAP - 30, BASE + 26
    parts = []
    if with_mark: parts.append(mark_svg(pad + msize / 2, BASE - CAP / 2, msize, ink, spec.get('ringWeight', 1.5)))
    parts.append(f'<g transform="translate({pad + ox:.2f} 0)"><path class="lg-type" fill="currentColor" d="{L["d"]}"/>')
    if L['glint']: parts.append(f'<path class="lg-glint" fill="{STAR_COLOUR}" d="{L["glint"]}"/>')
    parts.append('</g>')
    w = pad + ox + L['width'] + pad
    return f'0 {top:.1f} {w:.1f} {bot - top:.1f}', ''.join(parts)


SPECS = {
    'a': {'name': 'Glint (Bricolage)', 'font': 'bricolage-grotesque-latin-opsz-normal.woff2', 'loc': {'opsz': 96, 'wght': 700},
          'track': -0.008, 'kern': {'St': -0.02, 'ta': -0.01, 'rl': 0.008, 'li': 0.006, 'it': 0.002},
          'glint': {'size': 1.32, 'lift': 4, 'dx': 1.0, 'waist': 0.14}},
    'b': {'name': 'Glint + stylus (Bricolage)', 'font': 'bricolage-grotesque-latin-opsz-normal.woff2', 'loc': {'opsz': 96, 'wght': 700},
          'track': -0.008, 'kern': {'St': -0.02, 'ta': -0.01, 'rl': 0.008, 'li': 0.006, 'it': 0.002},
          'glint': {'size': 1.32, 'lift': 4, 'dx': 1.0, 'waist': 0.14}, 'refine': [stylus, t_slant], 'slant': 0.7},
    'c': {'name': 'Glint + stylus (Geist)', 'font': 'geist-latin-wght-normal.woff2', 'loc': {'wght': 660},
          'track': -0.018, 'kern': {'St': -0.02, 'ta': -0.01, 'li': 0.004},
          'glint': {'size': 1.42, 'lift': 4, 'dx': 0.5, 'waist': 0.14}, 'refine': [stylus, t_slant], 'slant': 0.8},
    'd': {'name': 'Final: Geist, sparkle i, stylus l, rhyming t', 'font': 'geist-latin-wght-normal.woff2', 'loc': {'wght': 650},
          'track': -0.02, 'kern': {'St': -0.024, 'ta': -0.012, 'ar': -0.004, 'li': 0.006, 'it': 0.002},
          'glint': {'size': 1.85, 'lift': 8, 'dx': 0.4, 'waist': 0.125, 'tall': 1.2}, 'refine': [stylus, t_slant],
          'lslant': 1.05, 'slant': 0.62, 'mark': 1.08, 'gap': 0.3, 'ringWeight': 1.4},
}


if __name__ == '__main__':
    which = sys.argv[1:] or list(SPECS)
    cards = []
    for k in which:
        spec = SPECS[k]
        L = build(spec)
        vb, body = lockup(L, spec)
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" style="color:#eef0fa">{body}</svg>\n'
        io.open(os.path.join(OUT, f'logotype-{k}.svg'), 'w', encoding='utf-8').write(svg)
        json.dump({'viewBox': vb, 'body': body, 'name': spec['name']}, io.open(os.path.join(OUT, f'logotype-{k}.json'), 'w', encoding='utf-8'))
        cards.append(f'<section><h2>{k.upper()} · {spec["name"]}</h2>'
                     f'<div class="big"><svg viewBox="{vb}">{body}</svg></div>'
                     f'<div class="small"><svg viewBox="{vb}">{body}</svg><svg class="s2" viewBox="{vb}">{body}</svg>'
                     f'<svg class="s3" viewBox="{vb}" style="color:#ab9cff">{body}</svg></div></section>')
    html = ('<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#070912;color:#eef0fa;font:14px system-ui}'
            'section{padding:40px 64px;border-bottom:1px solid #1a1d2c}h2{opacity:.5;font-weight:500;margin:0 0 18px}'
            '.big svg{height:200px;display:block}.small{display:flex;gap:64px;margin-top:30px;align-items:center}'
            '.small svg{height:44px}.small .s2{height:26px}.small .s3{height:44px}</style>' + ''.join(cards))
    io.open(os.path.join(OUT, 'logotype-sheet.html'), 'w', encoding='utf-8').write(html)
    print('ok', which)
