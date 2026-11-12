// Draws the hero record's grooves (the lyrics set in circles) off the main thread and hands back a
// finished bitmap: the plain copy or the glowing one (the page asks two workers, one for each, at
// once). Drawn on the page, the thousands of rotated letters kept every frame busy and held back the intro.
const GROOVE = { size: D => Math.max(9, Math.min(13, D / 140)), gap: 2.9, outer: 0.95, inner: 0.38 }
self.onmessage = async ({ data: { D, dpr, fontUrl, lyrics, lit } }) => {
  try {
    const face = new FontFace('Inter Variable', `url(${fontUrl})`, { weight: '100 900' })
    self.fonts.add(face)
    await face.load()
    const c = D / 2, fs = GROOVE.size(D)
    const gap = fs * GROOVE.gap, R0 = c * GROOVE.outer, R1 = c * GROOVE.inner     // air between grooves; outer groove, label edge
    const text = lyrics.replace(/ \/ /g, '\u2003\u2003')                          // lines run on with a wide space, no slashes
    const cv = new OffscreenCanvas(Math.round(D * dpr), Math.round(D * dpr)), ctx = cv.getContext('2d')
    ctx.font = `${lit ? 600 : 500} ${fs}px "Inter Variable", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    let k = 0, ring = 0
    for (let r = R0; r > R1; r -= gap, ring++) {
      ctx.fillStyle = lit ? 'rgb(255,236,220)' : `rgba(226,229,242,${(0.62 + 0.14 * Math.sin(ring * 1.7)).toFixed(2)})`
      // each groove starts somewhere else and stops short of a full turn, like a spiral
      let a = ring * 0.61
      k += 211
      let i = k
      const end = a + Math.PI * 2 - (fs * 3) / r
      while (true) {
        const ch = text[i++ % text.length]
        const w = ctx.measureText(ch).width + fs * 0.08
        if (a + w / r > end) break
        const m = a + w / 2 / r, x = c + r * Math.cos(m), y = c + r * Math.sin(m), t = m + Math.PI / 2
        ctx.setTransform(dpr * Math.cos(t), dpr * Math.sin(t), -dpr * Math.sin(t), dpr * Math.cos(t), dpr * x, dpr * y)
        if (ch.trim()) ctx.fillText(ch, 0, 0)
        a += w / r
      }
    }
    if (!lit) { const bm = cv.transferToImageBitmap(); return self.postMessage({ bm }, [bm]) }
    // the glow: a soft halo from one blur of the whole copy, sharp letters on top
    const out = new OffscreenCanvas(cv.width, cv.height), o = out.getContext('2d')
    o.filter = `blur(${(fs * 0.4 * dpr).toFixed(1)}px)`; o.globalAlpha = 0.9; o.drawImage(cv, 0, 0)
    o.filter = 'none'; o.globalAlpha = 1
    o.globalCompositeOperation = 'source-in'; o.fillStyle = 'rgb(255,170,110)'; o.fillRect(0, 0, out.width, out.height)
    o.globalCompositeOperation = 'source-over'; o.drawImage(cv, 0, 0)
    const bm = out.transferToImageBitmap()
    self.postMessage({ bm }, [bm])
  } catch (e) {
    self.postMessage({ error: String(e) })
  }
}
