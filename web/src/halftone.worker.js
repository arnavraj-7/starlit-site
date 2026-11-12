// Draws a halftone of an image off the main thread and hands back a finished bitmap, so the page
// shows it with one texture upload instead of replaying tens of thousands of dots.
self.onmessage = async ({ data: { id, url, w, h, dpr, rgb, cellK } }) => {
  try {
    const img = await createImageBitmap(await (await fetch(url)).blob())
    // a small copy of the picture to read brightness from ('cover' fit)
    const sw = Math.max(1, Math.round(w / 3)), sh = Math.max(1, Math.round(h / 3))
    const src = new OffscreenCanvas(sw, sh), sctx = src.getContext('2d', { willReadFrequently: true })
    const k = Math.max(sw / img.width, sh / img.height), dw = img.width * k, dh = img.height * k
    sctx.fillStyle = '#000'; sctx.fillRect(0, 0, sw, sh); sctx.drawImage(img, (sw - dw) / 2, (sh - dh) / 2, dw, dh)
    const px = sctx.getImageData(0, 0, sw, sh).data
    const lum = (x, y) => {
      const i = (Math.min(sh - 1, Math.max(0, (y / 3) | 0)) * sw + Math.min(sw - 1, Math.max(0, (x / 3) | 0))) * 4
      return (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255
    }
    const out = new OffscreenCanvas(Math.round(w * dpr), Math.round(h * dpr)), ctx = out.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const cell = Math.max(9, w / cellK), n = Math.ceil(Math.hypot(w, h) / cell)
    ctx.fillStyle = `rgb(${rgb})`; ctx.beginPath()
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {          // a 45-degree screen
      const x = w / 2 + (i - j) * cell * Math.SQRT1_2, y = h / 2 + (i + j) * cell * Math.SQRT1_2
      if (x < -cell || y < -cell || x > w + cell || y > h + cell) continue
      const r = cell * 0.58 * Math.sqrt(lum(x, y))
      if (r < 0.4) continue
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2)
    }
    ctx.fill()
    const bitmap = out.transferToImageBitmap()
    self.postMessage({ id, bitmap }, [bitmap])
  } catch (e) {
    self.postMessage({ id, error: String(e) })
  }
}
