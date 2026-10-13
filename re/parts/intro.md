# intro (main script 0xf0..0x11f)

Entries: `0x5b84` init (flower tables, res 5/6/7), `0x5a92` main script (below), `0x5b8f` cleanup (frees only; nothing visible).
Port: `web/parts/intro.js`, a generator = the original blocking script, **one `yield` = one vsync (70 Hz)**. Waits on the music position
use `ctx.pos()` exactly like the original (`pos > 0xNN00` = `cmp ax,..; jbe`, row tests `cmp al,..`). Resources 5..14.
Main param `[4]` (stored `[0x5426]`) assumed 0 (flower screens in order desc 0,1,2,3).

## Script (0x5a92)
black pal, ISR 0x5b91 on (counts ticks: `[5410]+=2`, `[5465]++`), then:
| wait pos > | action |
|---|---|
| 0x0000 | picture res 9 (Join Us): `0x627e` |
| 0x0100 | picture res 8 (Bring the family): `0x627e` |
| 0x0200,0x0400,0x0600,0x0800 | flower screens 1..4 (BARTI/Atomic, KARL/Powerful, GROO/Magic, RA/Nutritive) `0x5c68` |
| 0x0300,0x0500,0x0700 | pictures res 11,12,13 (girl/lion...) `0x6251` |
| 0x0900 | picture res 14 `0x627e` |
| 0x0a00 | picture res 10 (STARS title) `0x627e`, then black palette + clear VRAM (0x5b74), return |
Intro ends right after the title fade-out (original: pos 0x0a38 in the harness).
**End state**: palette all black, VRAM all 0, ISR callback removed (nothing else). Next part starts at pos > 0x0b00 wait (main 0x11f).

## Picture (res = 768 B pal 6-bit + 64000 px)
`0x17e50`: black pal, VRAM = res+0x300, bright b=0. `0x17e96(step,count)`: each iteration: pal' = min(63, pal*b>>8), **vsync, then write DAC**; b+=step; count--;
final write at full. `0x627e`: step 2, 0x80 => 129 vsyncs fade-in, wait row > 0x2e, fade-out (step -2). `0x6251`: step 4, 0x40 (65 vsyncs), wait row > 0x30.

## Flower screen (0x5c68 / 0x5e7a / 0x5ece)
Res 5 = 15 pal entries (idx 1..) + 4 images 144x36 (word under the name, drawn at (88,150)); res 6 = 16 pal entries (idx 0x60..) + 4 images 128x74 (name, at (96,60));
res 7 = 64 pal entries (idx 0x10..0x4f) + 256x256 texture (starts at +192). Pixels with value 0 are transparent.
* init (0x5c97): per descriptor (res6 idx, res5 idx, shift cl, step) {0,1,12,12},{3,3,12,52},{2,0,11,12},{1,2,11,16}:
  radius table `rad[i]=(SIN[(i*step)&..]+0x10000)>>cl` (4096), then 4096 rays from (160,100) with direction (cos,sin) of angle i (16.16 steps, stops outside 320x200 or after 100-rad-1 steps);
  every sample whose pixel in the name sprite buffer is 0 stores word `((i*32)&0xff00) | (rad+1+step#)` in a per-pixel map (later rays overwrite). Map = polar coords (angle/8, radius) into the texture.
* SIN = image 0xa740: `round(65528*sin(2*pi*i/4096))` (4096 entries; reads past 4096 for cos wrap).
* per frame (after vsync): palette (0x61b1+0x615b) then draw `vram[p] = tex[(map[p] + si) & 0xffff]` with `si = ((2T)&255)<<8 | w`, `w=(SIN[(2T*32)&0xfff]+0x10000)>>12` (0..32; computed after drawing, used next frame), T = ISR tick count since intro start.
  Names are drawn once into VRAM (cleared) at screen start.
* palette (DAC 0..175 only, rest black): 528 B built each frame from base: idx 0..15 as is, idx 16..79 in 4 groups of 16 scaled by `m=(SIN[ph&0x3ffc>>2]+0x30000)>>10` (128..255) `v*m>>8`, idx 96..111 (names, res 6) with ph0; ph[0..4] (0x5a7a,7e,82,86,8a) start {0,0,0x1000,0x2000,0x3000} and +0x190 per call, **persistent across screens**;
  then whole thing * bl >> 7, bl 0..0x80: starts 0, +2 per frame 0x40 frames (fade in), at `T-T0 >= 0x122` -2 per frame for 0x40 frames (fade out; ends black, VRAM keeps picture). Screen ends when row > 0x3e (the order's last row).

## Verification
`re/parts/intro_tmp/{h.py (harness copy + per-frame log), run.mjs (replay with logged pos/ticks), cmp.py}`: all 1558 even harness frames 1..3117 compared (pixel + palette).
Fades / pictures / title: pixel- and palette-exact. Flower screens: exact except
* 44 isolated frames (every ~28 frames) where the harness delivered 2 timer ticks in one frame (harness artifact, T off by one);
* the replay needs 1 frame of pos lag at flower-screen exit (harness advances virtual time while polling the music position inside pure wait loops; with pos sampled that way
  it matches 0 diffs). Not a real difference: the real run just samples pos once per frame.
Harness durations differ from real time (harness 3116 frames; real = music time, ~10.5 orders), the port is pos-driven, not frame-count driven.
`ctx.ticks()` is an optional test hook; otherwise T = f (f = frames since part start, ISR = 70 Hz). Only the rotation phase of the flower depends on it.
