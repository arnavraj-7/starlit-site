#!/usr/bin/env bash
# Re-record every preview on the site from the real app (quiet, off-screen) and re-encode them:
# the three style clips here, then the features footage (capture-feat.sh, encode-feat.sh).
# The clips match what the page expects: 60 fps, H.264, short keyframe interval so loops don't stall.
# ENCODE_ONLY=1 re-encodes the frames already in raw/ without running the app.
set -e
cd /c/projects/starlit-site/assets-src
export STARLIT_SHOT_DATA="${STARLIT_SHOT_DATA:-C:\\Users\\hp\\AppData\\Roaming\\starlit-shot-site}"
if [ -z "$ENCODE_ONLY" ]; then
  ./capture.sh flow deck flow a 22 9
  ./capture.sh constellation stage constellation c 6 9
  ./capture.sh pulse deck pulse b 23 7
  # The card under the record player in the Flow clip, without the player: the page draws its own
  # live record player over the recording on this plate (TurntableLive). The card doesn't move, so one
  # frame is enough; the art's box is printed by the app and goes into .tt-live in styles.css.
  ./capture.sh flow-plate deck flow a 22 0.05 "document.getElementById('tt').style.visibility='hidden'; const r=document.getElementById('artTilt').getBoundingClientRect(); window.__out=document.body.dataset.role+' '+JSON.stringify([r.left,r.top,r.width,r.height].map(Math.round))" | tee raw/flow-plate.txt
fi
python -c "
import json, re; from PIL import Image
x, y, w, h = json.loads(re.search(r'js: deck (\[.*\])', open('raw/flow-plate.txt').read()).group(1))
Image.open('raw/flow-plate/deck/00001.jpg').crop((x, y, x + w, y + h)).save('../web/public/media/flow-plate.webp', quality=96, method=6)
print('plate', x, y, w, h)"
M=../web/public/media
# The frames are full-range RGB. Encoded as they were (full range, untagged), browsers showed every
# clip with its dark tones crushed by ~15 levels; convert to limited-range BT.709 and tag the stream.
RANGE="out_range=tv:out_color_matrix=bt709"
TAGS="-color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709"
enc() {   # <clip> <role> <width>; the poster is the first frame, scaled from the source
  ffmpeg -loglevel error -y -framerate 60 -i raw/$1/$2/%05d.jpg -vf "scale=$3:-2:flags=lanczos:$RANGE,format=yuv420p" \
    -c:v libx264 -preset slow -crf 27 -g 12 $TAGS -movflags +faststart $M/$1.mp4
  ffmpeg -loglevel error -y -i raw/$1/$2/00000.jpg -vf "scale=$3:-2:flags=lanczos" -q:v 5 $M/$1.jpg
  echo "encoded $1"
}
enc flow deck 1920        # the biggest on the page: the styles window at full width, and the monitor
enc constellation stage 1600
enc pulse deck 1600
[ -n "$ENCODE_ONLY" ] || ./capture-feat.sh
./encode-feat.sh
echo all done
