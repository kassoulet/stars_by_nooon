# textg  ("NOOON / BRING YOUR BEAUTY FAMILY" feedback-blur text part)

Code 0x13388..0x13a2f. Init 0x13388 (builds tables via 0x13922, loads res 58), cleanup 0x1339d, two loop entries:
* variant 1 = 0x133ad: main calls it at 0x236 (after `pos > 0x6100`), loop runs while order <= 0x68 (callback fade-out starts at order 0x68), palette at 0x13048 (32 colours, blue/cyan), sprite table 0x13178 (13 used entries).
* variant 2 = 0x133f1: main 0x2b5 (after pos > 0x6c00), loop while order <= 0x86, palette 0x130a8 (violet/pink), sprite table 0x13278 (17 entries), starts from black palette (0x4a76c), plus 4 orbiting squares.
Both are the same code (`0x13435` = `0x1348e` + black palette) parametrised by [0x134e2] (end order), [0x4a798] (palette ptr) and the table choice (`cmp [0x4a798],0x130a8`).

JS: `web/parts/textg.js` default export = variant 1 unless `ctx.variant === 2`. Also named exports `textg1`, `textg2` (variant fixed).
Resource 58 only (320x200, values 0/31 = text bitmap, rows 0..117 hold the 4 text images stacked as 24-row bands).
`frame()` returns false when order > limit (variant 1: pos >= 0x6900, variant 2: pos >= 0x8700).

## Algorithm (per 70 Hz frame)
Two 320x200 byte buffers A (source) / B. Values stay 0..31 only; DAC colours 0..31 come from the 96-byte palette tables, scaled by [0x4a7a0]/256.
1. Timer callback (0x1353d + 0x134e3): `c44++` ([0x13044]), `t539++` ([0x13539]); fade step (0x4a80b): scale += step, count--; when order >= limit start fade-out (step -4, 64 steps); if row == 0 or row == 0x1e then countdown [0x13170] = 0x14.
   Fade-in: scale 0, step +4, 64 steps (palette black -> full in ~64 frames).
2. Main loop: palette update (0x4a7b0) when step count != 0, then 0x135c5:
   * 10 random dots (rand(100)+50 row, rand(160)+80 col, colour 0x1f if rand(256) even else 0) stamped as 3/5/5/3 pixel blobs (0x138ff) into A.
   * rand(4000) is drawn once per frame (a 25% branch that draws nothing -- dead code -- but consumes the RNG).
   * Sprite: while countdown != 0: countdown -= t539; if < 0 { countdown = 0; idx++ (wrap 13 / 17) }; blit sprite idx (dst offset, src offset in res 58, w, h from the table at 0x13178 / 0x13278, only non-zero source pixels) into A; t539 = 0. So a sprite is flashed for ~20 frames after each music row 0 / row 0x1e (and idx advances once per trigger). Table entries with w=h=1 are "blank" steps.
   * variant 2 only: 4 squares (7-row disc, stamp 0x138be) at sin/cos(c44<<4 | <<6 | -c44<<2 | <<7) with radii 1024/4096/2048 shifts.
3. 0x13579 blur-zoom: output pixel row y reads source row ((y-100)*120>>7)+100, column groups of 4 pixels at x'=((x-160)*120+64>>7)+160: out dword = ((dw[x'-1]+dw[x'+1]+dw[x'-320]+dw[x'+320])>>2)&0x1f1f1f1f (32-bit adds of unaligned dwords with byte carries, per-byte exact). Written to VRAM and to buffer B; buffers swapped. (The 40-ish routine is runtime-generated code at [0x13040].) Net: a slowly zooming-out blurred feedback of the text/dots.

RNG (0x4af10): `s ^= 0x78d47e5d; s *= 0xd413d473; s = rol(s,18); return s % n`. Seed in the harness = 0x7ea9 (snapshot value; `ctx.seed` overrides). In the real demo the seed depends on how many randoms earlier parts consumed, so the dot pattern is not reproducible anyway.
Sin tables 0xa740/0xb740 (shared by other parts!): `sin[i] = round(65528*sin(2*pi*i/4096))`, cos[i] = same with cos (4096 entries, 16.16-ish with amplitude 65528).

## Timing / verification
Pos is read from `ctx.pos()` each frame (order = pos>>8, row = pos&255). One timer tick per frame (original: 70 Hz IRQ0, harness occasionally injects 2 in one frame).
Harness frame numbering: harness `f%05d` shows the draw of port frame f-2 (the first two frames are blank) and the palette of port frame f-3.
* variant 1 vs harness (ground truth tick stream fed via `ctx.ticksAt(f)` -- test hook, default 1/frame): pixel-exact for the first 345 frames (palette exact too); then the sprite index sequence differs by a one-frame tick-timing ambiguity of the harness (draw/IRQ order), later frames visually identical (same statistics, different random dots/sprite phase).
* variant 2: pixel-exact for 27 frames (c44-driven squares then differ by 1 tick of the same harness jitter), visually identical afterwards.
Residual differences are only harness tick jitter (not meaningful on a real 70 Hz clock) -- the algorithm itself is exact.
Test tools in `re/parts/textg_tmp/` (hz.py = harness copy that prints tick/pos per frame and implements DPMI int31/7; run.mjs, cmp2/cmp3.py).
