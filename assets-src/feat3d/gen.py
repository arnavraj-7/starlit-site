"""Feature scenes for the 3D-photo features section: a wide photo per feature with the left
third left dark for the words, then a depth map of it (Nano Banana, through Vertex).

    python gen.py photo <id> [take]     write <id><take>.png
    python gen.py depth <id> [take]     write <id><take>-depth.png from <id><take>.png
"""
import base64, json, os, pathlib, shutil, subprocess, sys, urllib.request, urllib.error

PROJECT = os.environ.get('VERTEX_PROJECT') or 'vigil-prod-73858'
URL = (f'https://aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/global/'
       'publishers/google/models/gemini-3.1-flash-image:generateContent')
HERE = pathlib.Path(__file__).parent

STYLE = ('Cinematic photograph, 21:9 widescreen, shot at night in a dark room, the only light comes from the '
         'subject itself, deep blacks, soft falloff, shallow depth of field, full-frame sensor 35mm f/1.8, fine '
         'grain, quiet and premium, like a product film still. The subject sits in the right half of the frame; '
         'the left third of the frame is dark, empty and out of focus, falling to near black. '
         'No text, no letterforms, no numbers, no logos, no people, no hands, no graphics.')

SCENES = {
    'colour': 'Three large square vinyl record sleeves stand leaning against a dark wall on a wooden desk, one deep '
              'violet, one warm amber, one teal; a soft wash of light the colour of each sleeve spills onto the desk '
              'below it and blends where they meet. A turntable platter edge in the near foreground, out of focus.',
    'edge': 'A thin-bezel computer monitor on a dark desk, its screen showing soft dark blurred colour, with a fine '
            'line of cyan-teal light tracing the full rectangle of its outer edge and a brighter pulse of light '
            'travelling along the bottom edge; the light reflects as a long streak on the glossy desk. Desk '
            'surface leads toward the camera.',
    'players': 'A laptop open on a wooden desk at night, its screen glowing warm amber with large soft blurred '
               'shapes of lyric lines, over-ear headphones resting beside it, a phone face-up glowing faintly; a '
               'warm desk lamp off to the far right edge barely lit.',
    'games': 'A gaming desk at night: a wide curved monitor glowing with a vivid fantasy landscape in violet and teal, '
             'a game controller and a low mechanical keyboard on the desk in the foreground, violet and teal light '
             'reflecting on the desk, shelves with soft teal strip light in the background bokeh.',
    'lights': 'A dark desk against a dark wall: a monitor light bar on top of a monitor and an RGB light strip behind '
              'it throw a strong soft wash of violet light up the wall, a mechanical keyboard and a small dock below '
              'glowing the same violet. Rich gradient of light on the wall.',
    'screens': 'A dark desk at night with two screens side by side: a large monitor on the left glowing with soft warm '
               'amber light and large blurred shapes of lyric lines, and an open laptop on the right of it glowing '
               'soft violet with blurred lyric shapes; the two glows mix on the desk between them, a pair of '
               'over-ear headphones resting in front.',
    'timing':'Extreme close-up of a dark mechanical keyboard at night, low angle, the two square-bracket keys in '
              'sharp focus lit from beneath with teal light, the other keys falling into soft blur, a monitor glowing '
              'out of focus far behind.',
}


def token():
    exe = shutil.which('gcloud') or shutil.which('gcloud.cmd')
    return subprocess.run([exe, 'auth', 'print-access-token'], capture_output=True, text=True, check=True).stdout.strip()


def call(parts, out, aspect=None):
    cfg = {'responseModalities': ['IMAGE']}
    if aspect: cfg['imageConfig'] = {'aspectRatio': aspect}
    body = {'contents': [{'role': 'user', 'parts': parts}], 'generationConfig': cfg}
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), method='POST',
                                 headers={'Authorization': f'Bearer {token()}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=240) as r: payload = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f'Vertex {e.code}: {e.read().decode()[:400]}')
    for c in payload.get('candidates', []):
        for p in c.get('content', {}).get('parts', []):
            if p.get('inlineData', {}).get('data'):
                out.write_bytes(base64.b64decode(p['inlineData']['data'])); print('wrote', out); return
    sys.exit('no image: ' + json.dumps(payload)[:400])


if __name__ == '__main__':
    kind, fid = sys.argv[1], sys.argv[2]
    take = sys.argv[3] if len(sys.argv) > 3 else 'a'
    src = HERE / f'{fid}{take}.png'
    if kind == 'photo':
        (HERE / f'{fid}{take}.prompt.txt').write_text(SCENES[fid] + ' ' + STYLE, encoding='utf-8')
        call([{'text': SCENES[fid] + ' ' + STYLE}], src, '21:9')
    else:
        img = base64.b64encode(src.read_bytes()).decode()
        call([{'inlineData': {'mimeType': 'image/png', 'data': img}},
              {'text': 'Produce the depth map of this exact photograph, pixel-aligned with it, same framing and size: '
                       'a smooth greyscale image where near surfaces are white and far surfaces are black, objects '
                       'with clean edges, flat regions smooth, no texture, no lighting, no text.'}],
             HERE / f'{fid}{take}-depth.png', '21:9')
