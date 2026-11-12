#!/usr/bin/env bash
# Encode the features footage (capture-feat.sh) for the page: 60 fps H.264, short keyframe
# interval so loops don't stall, a poster from the first frame.
set -e
cd /c/projects/starlit-site/assets-src
M=../web/public/media/feat
mkdir -p $M
poster() { ffmpeg -loglevel error -y -i $M/$1.mp4 -frames:v 1 -q:v 3 $M/$1.jpg; }
enc() {   # <clip> <role> <name>
  ffmpeg -loglevel error -y -framerate 60 -i raw/$1/$2/%05d.jpg -vf "scale=1600:-2:flags=lanczos,format=yuv420p" \
    -c:v libx264 -preset slow -crf 27 -g 12 -movflags +faststart $M/$3.mp4
  poster $3; echo "encoded $3"
}
enc feat-colour deck colour
enc feat-edge deck edge
# (players dropped: it is in the setup steps now)
enc feat-games deck games
# (two screens is shown by the laptop section now)
ls -la $M
