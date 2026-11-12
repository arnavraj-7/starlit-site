"""Depth maps for the feature photos with Depth Anything V2 (small, ONNX, runs on the CPU), and the
web assets: <id>.webp (photo) and <id>-d.webp (depth, near = white), both 1920 wide.

    python depth.py colour edge players screens games lights
"""
import sys, pathlib
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent.parent / 'web' / 'public' / 'media' / 'feat3d'
OUT.mkdir(parents=True, exist_ok=True)
sess = ort.InferenceSession(str(HERE / 'model' / 'da2s.onnx'), providers=['CPUExecutionProvider'])
inp = sess.get_inputs()[0].name

for fid in sys.argv[1:]:
    im = Image.open(HERE / f'{fid}a.png').convert('RGB')
    W, H = im.size
    # the model wants sides that are multiples of 14; keep the aspect, ~518 tall
    h = 518; w = int(round(W * h / H / 14)) * 14
    x = np.asarray(im.resize((w, h), Image.BICUBIC), dtype=np.float32) / 255
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    d = sess.run(None, {inp: x})[0].squeeze()               # relative inverse depth: big = near
    lo, hi = np.percentile(d, 1), np.percentile(d, 99.5)
    d = np.clip((d - lo) / (hi - lo), 0, 1)
    dm = Image.fromarray((d * 255).astype(np.uint8)).resize((1920, int(1920 * H / W)), Image.BICUBIC)
    # a little blur so edges stretch softly instead of tearing
    dm = dm.filter(ImageFilter.GaussianBlur(3))
    dm.save(OUT / f'{fid}-d.webp', quality=82)
    im.resize((1920, int(1920 * H / W)), Image.LANCZOS).save(OUT / f'{fid}.webp', quality=84)
    dm.save(HERE / f'{fid}a-da2.png')
    print(fid, 'ok', (OUT / f'{fid}.webp').stat().st_size // 1024, 'KB')
