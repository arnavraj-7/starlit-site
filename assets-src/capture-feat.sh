#!/usr/bin/env bash
# Footage for the features section, recorded from the real app (quiet, off-screen) with the
# site's original demo song. Each clip drives the app the way the feature works: a new cover,
# new songs, a game coming to the front. Events are timed in recorded seconds (after the
# harness's 1.5 s warm-up) by wrapping the harness's frame step.
set -e
cd /c/projects/starlit-site/assets-src
A=$(pwd)
F="file:///C:/projects/starlit-site/assets-src/covers"
# helpers, put in the page before recording starts
H="const at=(s,fn)=>{let acc=0,done=false;const s0=window.__step;window.__step=dt=>{s0(dt);acc+=dt;if(!done&&acc>=1.5+s){done=true;fn()}}};
const toData=async u=>{const b=await (await fetch(u)).blob();return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)})};
const swap=(art,title,artist,k)=>setTrack({...state.track,key:state.track.key+k,art,title,artist});"

# 1. colours from the cover: the song changes to one with a teal cover, and everything follows
[ -d raw/feat-colour/deck ] || ./capture.sh feat-colour deck flow a 30 8 "$H const C=await toData('$F/cover-c.png'); at(2.6,()=>swap(C,'Slow Satellites','Ivo Marin','c'));"
# 2. the edge light running round the screen
./capture.sh feat-edge deck pulse b 23 7 ""
# 3. whatever you play: three songs in a row, the lyrics carry on
./capture.sh feat-players deck flow b 40 9 "$H const B=await toData('$F/cover-a.png'),C=await toData('$F/cover-c.png'); at(2.8,()=>swap(B,'Paper Moons','Lio Arden','p')); at(5.8,()=>swap(C,'Static Rain','Mara Vey','s'));"
# 4. two screens: the monitor's full lyrics and the laptop's one word, same moment
./capture.sh feat-screens-deck deck flow a 22 7 ""
./capture.sh feat-screens-stage stage pulse a 22 7 ""
# 5. a game comes to the front: Starlit steps back
./capture.sh feat-games deck flow b 30 7 "$H at(2.6,()=>applyPower({low:true,app:'VALORANT'}));"
echo captured
