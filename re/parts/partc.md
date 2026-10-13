# partc (main 0x162..0x177) -- warped picture show

Entries: init `0x9d17` (palette black, loads res 11,12,13), loop `0x975b` (5 stages), cleanup `0x9dcf`. Timer callback `0x9932` (via `0x4abec`) = 70 Hz tick.
JS: `web/parts/partc.js` (resources 11,12,13).

## Data
* res 11/12/13 = 768 B palette + 320x200 picture (same format as title screens). Only the palette of res 13 is used (target of the fade, `[0x4a798]`).
  `0x9d95` builds one 256x256 buffer per picture: crop x=32..287, y stretched 200->256 (src row advances when `dx+=0xc800` carries).
* sin table image 0xa740 (5120 dwords) = round(65528*sin(i*2pi/4096)); cos(i)=sin[i+1024] (table at 0xb740).

## Renderer (0x9989 ring + 0x9a62 draw), exact port
Params block (11 dwords copied to 0x9458 at stage start, listed in the JS `STAGES`): A,B (texture offset 16.16 words, usually 54784/0), R0 (ring radius), dPh1, dPh2 (per-tick phase
increments of ph1/ph2), shift (low 5 bits used: patched `shl ebp,imm`), amp, ph1, ph2, dA, dB.
Ring: 4 curves (top 320 pts / bottom 320 / right 200 / left 200) = points on a circle of radius `R0 + sin[(idx<<shift)+ph2]*amp>>16` (angles ph1.. quarter circles), x=cos*r+160, y=sin*r+100 (16.16).
They define a warped quad: per column k the texture start `T[k]` and per-row step (B[k]-T[k])/200 (packed 8.8|8.8 words, `X<<16|Y`), per row an offset (Right[y]-P1(y)) and a per-pixel step
((Left[y]-P2(y))-(Right[y]-P1(y)))/200; P1/P2 move linearly between the corner midpoints. Pixel = pic[(Y8 <<8)|X8] of the sum of the 3 terms. All 32-bit wraparound / `shr`-vs-`sar` subtleties kept.
Stage timer: counter `[0x9484]` decremented per tick; fade-out starts when it hits 0x20; stage ends when counter<0 (n+1 frames).
Wobble (`0x98b6/0x98e9`): per *frame* `phase+=0x64; amp = c + sin[phase&0xfff]*a>>16` written to the amp field (stage 1: 0..0x40, stage 4: 0x40..0x100).
Picture flip (stage 2,3,4): `acc+=1000` (16 bit) per frame, picture index (res 11->12->13) increments on carry (every 66 frames), reset to 0 at each stage start.

## Script (frames at 70 Hz; f0 = call 0x975b, after waiting pos > 0x2700)
| stage | block | duration | starts when |
|---|---|---|---|
| S0 | 0x9488 | 0x105=261 f | immediately |
| S1 (wobble) | 0x94b4 | 0x187=391 f | after S0 and pos > 0x2800 |
| S2 (flip on) | 0x9564 | 391 f | after S1 and pos > 0x2b00 |
| S3 | 0x95e8 | 391 f | after S2 and pos > 0x2e00 |
| S4 (wobble) | 0x9538 | 391 f | after S3 and pos > 0x3100 |
Each stage fades palette in (level 0->0x100 step 8, 32 frames: pal*L>>8) and out the same way during the last 32 ticks; screen is black between stages (nothing drawn while waiting for pos).
With the real music (orders ~146 frames) S1,S2,S3 start back to back and only S4 waits ~27 frames. Part ends at frame ~1854 (pos ~0x3321); last frame: VRAM cleared, palette black.
Palette write per frame uses the level BEFORE this frame's tick (palette then vsync then render).

## Verification
Harness (`--start 0x162 --order 0x26`, with a patched copy forcing the first stage block) vs `web/parts/partc.js`: stages 0..4 pixel-exact (palette too) over the first 330 frames each
(harness frame k = JS frame k-2). Residual: only harness artifacts (its virtual PIT delivers ~4% extra ticks relative to frames, so wobble/flip (per frame) vs params (per tick) drift in long runs).
