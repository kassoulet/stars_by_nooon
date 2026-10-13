# terrain (main 0x17c..0x191) -- polar voxel terrain

Entries: init `0x1064` (loads res 2,3,4; builds tables), loop `0x11e8`, cleanup `0x110d`, callback `0xf85` (70 Hz, via `0x4abec`). JS: `web/parts/terrain.js` (resources 2,3,4).

## Data
* res 2 = heightmap 256x256, res 3 = colour map 256x256 (indices), res 4 = 768 B palette (6-bit), faded in/out with level L (pal*L>>8).
* LUT (`0x10d6`) 211 rows x 256: `LUT[j*256+h] = 190 - min(189, (0x2f4+14h)/(j+9))` (screen height of a point at distance row j, height h).
* MAP (`0x136a`) 320x200 words: for angle a in 0..4095, step from centre (160,100) by (-cos,+sin) 191 times, first writer wins: word = ((a>>4)<<8) | (190-r).
* sin table as in partc (round(65528*sin), image 0xa740).

## Per frame
1. Callback tick: `ec6+=eca` (phase), `cba+=cbe`, `cb8+=cbc` (camera pos 8.8, cbe starts 0x40 = +x speed), `f6d++`, fades, events (below).
2. Main loop: event table `0xf71` = {frames 0..0x100: `cbe += 1` once per main-loop iteration}; table `T[i]` (0x1158/0x11ce): `T[i]=(sin[(ec6+i*ed6)&0xfff]>>10)*256 + i`, then differenced (`T[i]-=T[i-1]`) = 16-bit address step (dy*256+dx) per ray step.
3. `0x1261` draws 256 vertical rays into a 256x256 buffer BUF[ray*256+y]: ray r starts at (x=cba>>8, y=(cb8>>8)+r), 105 steps (bh=0,2..0xd0), classic voxel: cl=LUT[bh<<8|h]; if cl>ch fill y in ch..cl with colour; address += T[step] (16-bit wrap).
   Columns 0xa9..0xc0 of every ray are cleared first. Then the screen is `BUF[MAP[i]]` (polar warp).
Callback events: row 0 of order 0x3b: `ed6 += 1` every 4 ticks for 20 steps (ripple frequency); row 0 of order 0x3d: `eca += 1` every 4 ticks for 30 steps (rotation of the ripple phase);
order >= 0x43: fade out (step -1, 256 ticks). Fade-in at start: step +1, 256 ticks (L 0..0x100).

## Timing for the script
Original: waits for pos > 0x3500, then loop at 70 Hz until `order > 0x44` (i.e. pos reaches 0x4500). With the harness music timeline that is ~2338 frames (f0 at pos 0x3501 -> 0x4500). Fade-in over frames 0..255, fade-out starts at pos 0x4300 (frame ~2045) and reaches black ~256 frames later; final frames black; at the end VRAM is cleared (done in JS).
The events 0x3b/0x3d need `ctx.pos()` to hit row 0 of those orders (checked every frame).
## Verification
Harness (`--start 0x17c`, orders 0x34 / 0x3b / 0x3d / 0x43) vs `terrain.js`: pixel-exact and palette-exact on all compared frames until the harness's own tick/iteration drift (its virtual PIT gives ~4-7% more ticks than vsyncs, so `cbe` ramp (per iteration) differs slightly after ~20-250 frames; state variables ec6/eca/ed6/f6d verified equal tick-by-tick for the 0x3d event).
Model assumption: 1 main-loop iteration per tick (render at 70 fps); on the original machine the speed ramp of `cbe` depended on render speed.
