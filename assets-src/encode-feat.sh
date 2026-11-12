#!/usr/bin/env bash
# Encode the features footage (capture-feat.sh) for the page: 60 fps H.264, short keyframe
# interval so loops don't stall, limited-range BT.709 and tagged (see rerecord.sh), a poster
# from the first frame.
set -e
cd /c/projects/starlit-site/assets-src
M=../web/public/media/feat
mkdir -p $M
RANGE="out_range=tv:out_color_matrix=bt709"
TAGS="-color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709"
enc() {   # <clip> <role> <name>
  ffmpeg -loglevel error -y -framerate 60 -i raw/$1/$2/%05d.jpg -vf "scale=1600:-2:flags=lanczos:$RANGE,format=yuv420p" \
    -c:v libx264 -preset slow -crf 27 -g 12 $TAGS -movflags +faststart $M/$3.mp4
  ffmpeg -loglevel error -y -i raw/$1/$2/00000.jpg -vf "scale=1600:-2:flags=lanczos" -q:v 5 $M/$3.jpg
  echo "encoded $3"
}
enc feat-colour deck colour
enc feat-edge deck edge
# (players dropped: it is in the setup steps now)
enc feat-games deck games
# (two screens is shown by the laptop section now)
ls -la $M
