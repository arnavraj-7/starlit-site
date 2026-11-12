#!/usr/bin/env bash
# Re-record every preview on the site from the real app (quiet, off-screen) and re-encode them.
# The clips match what the page expects: 60 fps, H.264, short keyframe interval so loops don't stall.
set -e
cd /c/projects/starlit-site/assets-src
./capture.sh flow deck flow a 22 9
./capture.sh constellation stage constellation c 6 9
./capture.sh pulse deck pulse b 23 7
./capture.sh lens deck lens a 36 7
./capture.sh pulse-laptop stage pulse b 23 8
M=../web/public/media
enc() {
  ffmpeg -loglevel error -y -framerate 60 -i raw/$1/$2/%05d.jpg -vf "scale=$3:-2:flags=lanczos,format=yuv420p" \
    -c:v libx264 -preset slow -crf 20 -g 12 -movflags +faststart $M/$1.mp4
  ffmpeg -loglevel error -y -i $M/$1.mp4 -frames:v 1 -q:v 3 $M/$1.jpg
  echo "encoded $1"
}
enc flow deck 1920
enc constellation stage 1600
enc pulse deck 1600
enc lens deck 1600
enc pulse-laptop stage 1600
echo all done
