#!/usr/bin/env bash
# Captures the site's footage from the real app, off-screen (--shot-quiet), with an original song.
# usage: capture.sh <name> <role> <style> <cover a|b|c> <start s> <seconds> [extra js]
set -e
APP=/c/projects/starlit
A=/c/projects/starlit-site/assets-src
OUT=$A/raw/$1
BACKUP=""

rm -rf "$OUT"; mkdir -p "$OUT"
JS="(async()=>{ if (document.body.dataset.role==='$2') setStyle('$3'); await new Promise(r=>setTimeout(r,600)); $7; return 'ok' })()"
cd $APP
timeout 900 ./node_modules/electron/dist/electron.exe . --shot-quiet --demo --demo-title="Slow Satellites" --demo-artist="Ivo Marin" \
  --demo-len=96 --demo-pos=$5 --demo-lrc=$A/slow-satellites.lrc --demo-art=$A/covers/cover-$4.png \
  --shot=$OUT/still --shot-at=6 "--shot-js=$(printf '%s' "$JS" | base64 -w0)" \
  --shot-record=$6:60:$5 --rec-dir=$OUT --rec-role=$2 2>&1 | grep -E "recorded|rror" || true

ls "$OUT/$2" | wc -l
