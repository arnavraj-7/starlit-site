#!/usr/bin/env bash
# Captures the site's footage from the real app, off-screen (--shot-quiet), with an original song.
# usage: capture.sh <name> <role> <style> <cover a|b|c> <start s> <seconds> [extra js]
set -e
APP=/c/projects/starlit
A=/c/projects/starlit-site/assets-src
OUT=$A/raw/$1
BACKUP=""

rm -rf "$OUT"; mkdir -p "$OUT"
# The test run starts from a copy of the user's own settings; pin the look the page shows (the app's
# defaults: Inter lyrics, record player in the album card, moving edge glow) so footage never depends on them.
LOOK="{font:'Inter Variable',textScale:1,colorMode:'auto',glow:'sweep',glowTrails:2,glowStrength:0.8,cornerRadius:14,glass:'full',maxFps:0,showPanel:true,panelArt:'turntable'}"
JS="(async()=>{ set($LOOK); if (document.body.dataset.role==='$2') setStyle('$3'); await new Promise(r=>setTimeout(r,1200)); await document.fonts.ready; $7; return window.__out || 'ok' })()"
cd $APP
# its own data folder: a second test Starlit would otherwise lose the single-instance lock and quit
export STARLIT_SHOT_DATA="${STARLIT_SHOT_DATA:-C:\Users\hp\AppData\Roaming\starlit-shot-site}"
timeout 900 ./node_modules/electron/dist/electron.exe . --shot-quiet --demo --demo-title="Slow Satellites" --demo-artist="Ivo Marin" \
  --demo-len=96 --demo-pos=$5 --demo-lrc=$A/slow-satellites.lrc --demo-art=$A/covers/cover-$4.png \
  --shot=$OUT/still --shot-at=6 "--shot-js=$(printf '%s' "$JS" | base64 -w0)" \
  --shot-record=$6:60:$5 --rec-dir=$OUT --rec-role=$2 2>&1 | grep -E "recorded|rror|^js:" || true

ls "$OUT/$2" | wc -l
