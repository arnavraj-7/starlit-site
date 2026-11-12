You are a senior product designer and art director who has shipped landing pages for premium consumer software (think Apple, Linear, Teenage Engineering, Nothing, Raycast). Be blunt. I want specific, buildable ideas, not general advice.

## The product

**Starlit** is a free Windows desktop app that shows the lyrics of whatever is playing on your PC (Spotify, Apple Music, YouTube Music, local files), word by word, the moment each word is sung.
- The screen takes its colours from the album cover.
- A thin light runs round the screen's edge on the beat.
- It can put the full lyrics on one monitor and one word at a time on a laptop.
- It steps back to almost nothing while you play a fullscreen game.
- It can turn RGB desk lights, keyboards and docks to the song's colour.

The visitors are music lovers, PC gamers and people with desk setups. The page's only goal is to get them to click **Download for Windows**.

## The page now

The attached screenshots go top to bottom. A sheet with several frames is one pinned section shown at points along its scroll.
1. **Hero** (`01-hero-a.jpg`):
   - Left: the headline "Every word, the moment it's sung." It waits dim and then lights word by word like karaoke.
   - Right: a vinyl record whose grooves are made of lyric text, with a draggable tonearm. Drop the needle and that lyric line lights up.
2. **Laptop** (`02-laptop-*`): a scroll sequence. A closed laptop opens; its screen wakes into the "Pulse" lyric style; the word "satellites" grows out of the screen in halftone dots; then the laptop turns.
3. **Styles** (`03-styles-*`): the three lyric styles (Flow, Constellation, Pulse) on a rolling drum, with real recordings of the app.
4. **Turntable** (`04-turntable-*`): the album cover becomes a record player as you scroll. The sleeve slides in, the record comes out and the needle drops, over a halftone record in the background.
5. **Features** (`05-features-*`): six features, one per screen, words on the left. The right side is empty for now because I'm about to record real clips of the app for it.
6. **Setting it up** (`06-setup-a.jpg`): three steps.
7. **Download** (`07-download-a.jpg`): "Try it with your own music."
8. **Footer** (`08-footer-a.jpg`): a huge outlined "Starlit" wordmark in the album colours.

## Design language (keep it)

- Dark, near-black ink.
- Halftone and stipple textures drawn in code (dots everywhere: the record, the sky, the backgrounds).
- Album colours as accents: violet #ab9cff, amber #ffaa6a, teal #4fe3cf.
- Inter / Geist type.
- Smooth blends between sections, with no visible section breaks.
- Scroll-driven motion with GSAP.

## What has already been tried and rejected

- A navbar of any kind.
- AI-generated stock-style photos.
- Rainbow colours.
- Big soft circular glow "blobs".
- An ASCII or dot-matrix lyric wall.
- Small drawn UI mock-ups in cards.
- Long paragraphs.
- Anything that looks templated or "AI-made".

## Constraints

- It must run smoothly. Scrolling holds about 190 fps now: no heavy filters, no backdrop-filter, no huge masks on moving layers.
- Real app footage can be recorded for any section.
- No generated imagery.

## What I want from you

For **each section, in order**, give me:
1. **Verdict.** In one line: does it earn its place, and what is weakest about it?
2. **Hook.** The one change that would make someone stop scrolling. Describe the motion beat by beat, as it plays during the scroll.
3. **Micro-interaction.** One small pointer or hover detail that rewards attention.
4. **Copy.** A tighter headline and supporting line, written as a product marketer, not a developer. Max 8 words for the headline, 15 for the line.
5. **Polish fixes.** Up to 3 concrete fixes: spacing, type size and weight, contrast, alignment, timing. Use numbers where you can (px, ms, easing, opacity).
6. **Reference.** One real website or product page that does this part well, and what exactly to borrow.

Then, for the **page as a whole**:
- Is the section order right? Suggest a better order if there is one.
- Is anything missing that would make a visitor trust it and download? Examples: proof, social signals, a FAQ about privacy and accounts, system requirements.
- Which sections could be cut or merged?
- What are the 5 changes with the highest impact, ranked?

Be specific to these screenshots. If you would not ship something, say so plainly.
