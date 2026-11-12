# Starlit site

Landing page for [Starlit](../starlit), a Windows app that shows the lyrics of whatever you're
playing, word by word, in the colours of the album.

```
web/          the page: Vite + React, GSAP ScrollTrigger, Lenis, three.js for the laptop
assets-src/   how the page's media was made, and the scripts used to check it
```

## Run it

```
cd web
npm install
npm run dev          # or: npm run build && npx vite preview --port 4317
```

## Media

Every recording on the page is the real app, captured off-screen with an original demo song
("Slow Satellites", `assets-src/slow-satellites.lrc`):

```
assets-src/capture.sh <name> <deck|stage> <style> <cover a|b|c> <start s> <seconds>
```

The album covers and the app icon were generated with Gemini image generation on Vertex AI
(`assets-src/genimage.py`, prompts in `assets-src/prompts` and `assets-src/logo`). The
backgrounds are drawn in code (WebGL nebula, canvas grooves, CSS stage beams).

## Checks

All run headless Edge against the preview server on port 4317.

| script | what it tells you |
|---|---|
| `sweep.py W H step dir` | screenshots down the whole page, tiled into sheets |
| `introshots.py dir` | what is on screen during the first seconds after load |
| `introperf2.py` | long frames during load and the intro |
| `traceintro.py` | which browser work runs during the intro |
| `scrollperf.py` | slow frames per section while wheel-scrolling the page |
| `shoot_y.py W H name y,y,end` | screenshots at given scroll positions |

`ClickSpark` in `web/src/bits` is from [React Bits](https://reactbits.dev) (MIT + Commons Clause).
