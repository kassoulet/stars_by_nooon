# STARS (Noooon, 1995) - effects, timeline, tricks

*STARS: Wonders of the world* by **Noooon** (Groo: music, Bartie: 3D motion, Karl: system and effects, Ra: script and pixels), 1995, MS-DOS, 16-channel MOD played by the LCA
player (Cedric Bermond), protected mode by PMODE (Tran). `STARSv2.EXE` is 1.2 MB: a 76 KB packed program plus 58 resources (textures, palettes, 3D objects, the 780 KB module) in an overlay.
The JavaScript port (`web/`) redraws everything into a 320x200 indexed canvas and plays the module through libopenmpt.

Source of the facts below: `re/NOTES.md`, the per-part notes `re/parts/*.md` (each states what was compared against the original), and the port `web/parts/*.js`.
Exactness is stated as the notes state it: "identical" means compared to frames produced by the original code running in the Unicorn harness (`re/ref/harness.py`).

## 0. Display, timing, structure

* **VGA mode 13h, 320x200, 256 colours, non-square pixels** (show it 4:3). Palettes are 6-bit DAC values; fades are written to the DAC (`vga.pal`), the pixels stay put.
* **70 Hz.** A PIT interrupt (programmed to ~70 Hz, `0x4286`, ISR `0x4ac1f`) calls up to three callbacks installed with `0x4abec/f2/f8`; the effect's main loop is synchronised to vertical
  retrace (`0x3da`). Each part is *init function / loop function / cleanup function* plus a timer callback that advances the animation variables. The port assumes **one tick per frame**
  (README, "Known gaps"); on a slow machine the original's per-tick and per-frame quantities drift apart.
* **The script follows the music.** The MOD has 16 channels, 256 orders (155 used), 73 patterns; the demo compares `(order<<8)|row` with thresholds (`pos > 0x3500` ...).
  The port converts the module to XM keeping orders 1:1 (`re/mod2xm.py`) and gives each part the position through `ctx.pos()`. That is why the player can seek: set the module position,
  then replay the current part.
* `web/script.js` chains the parts (a part starts when the previous one is finished *and* the position threshold is passed):
  `intro, e1, e2, partb (0x1700), partc (0x2700), terrain (0x3500), partd, picture 57 (0x5500), partf (0x5820), textg1 (0x6100), parth (0x6900), parti (0x6c00), textg2, partj (0x8700), credits`.
* The shared tables: `sin[i] = round(65528 * sin(2 pi i / 4096))`, `cos[i] = sin[i + 1024]` (image 0xa740 / 0xb740, 4096 entries, 16.16-ish); every effect that needs a sine uses them.
* Not ported: the text-mode ending screen (0x7dd, shown only if a flag is set, no-op under the harness).

## 1. Intro: fading pictures and "flower" name screens (`intro.js`)

Resources 5-14. The script is written in the port as a **generator: one `yield` = one vsync**, with waits on the music position exactly like the original's blocking script
(`wait pos > 0x0100` ...).

* **Pictures** (title, "Join us", "Bring the family", girl, lion...): resource = 768 B palette (6-bit) + 64000 pixels. The picture goes to VRAM at once with a *black* palette; only the
  palette moves. `fade(step, count)`: `pal' = min(63, pal * level >> 8)`, write the DAC *after* vsync, `level += step`; `0x627e` uses step 2 / 129 vsyncs, `0x6251` step 4 / 65 vsyncs.
  Fade-in, hold until a music row, fade-out.
* **Flower name screens** (BARTI/Atomic, KARL/Powerful, GROO/Magic, RA/Nutritive): the author's name is drawn into VRAM once; every *other* pixel is filled each frame from a
  rotating, pulsing flower texture through a **polar map** built at init. For each of 4096 angles a ray is walked from (160,100) (16.16 steps, cos/sin from the table); every pixel
  the ray touches whose name-sprite value is 0 stores a 16-bit word `((a*32) & 0xff00) | (radius + ...)` (later rays overwrite):

```js
for (let a = 0; a < 4096; a++) {            // from web/parts/intro.js
  let bp = ((a * 32) & 0xff00) | (e0 & 255), y = 0x640000, x = 0xa00000;
  for (let k = 100 - e0; k > 0; k--) {
    y = (y + SIN[a]) >>> 0; if (y >= 0xc80000) break;
    x = (x + SIN[a + 1024]) >>> 0; if (x >= 0x1400000) break;
    const p = (y >>> 16) * 320 + (x >>> 16);
    if (spr[p] === 0) tbl[p] = bp;           // sprite pixel 0 = free
    bp = (bp + 1) & 0xffff;                  // radius counter grows along the ray
  }
}
```
  `e0 = rad[a] + 1` is a per-angle starting radius (`rad[i] = (SIN[...] + 0x10000) >> cl`), which gives the flower its petals. Per frame, every free pixel is
  `vram[p] = tex[(map[p] + si) & 0xffff]` with `si = ((2T) & 255) << 8 | w`: the high byte of `si` rotates the texture's angle axis (rotation), the low byte `w = (SIN[(2T*32)&0xfff]+0x10000)>>12` shifts
  the radius axis (pulsing). Pixel 0 of the 256x256 texture is not special: the flower is a pure 16-bit-offset lookup, no multiplication per frame.
* **Palette animation**: DAC 0..175 only. Indices 16..79 are scaled in four groups by `m = (SIN[ph]+0x30000)>>10` (128..255) with five phases that advance by 0x190 per call and *persist across screens*; the name colours
  (96..111) pulse the same way; the lot is multiplied by a fade (0..0x80) that rises for 0x40 frames and falls at `T - T0 >= 0x122`.

Exactness: pictures, fades and title are pixel- and palette-exact (1558 compared frames); flower screens are exact except 44 isolated frames where the harness delivered two timer ticks in one frame
(a harness artifact), and the replay needs one frame of position lag at exit for the same reason (`re/parts/intro.md`).

## 2. e1: flow tunnel (`e1.js`)

A texture-warped tunnel. Init builds, for each screen pixel, one 16-bit word from a polar-like construction: for `m = 1..198`, radius `n = m+1` and 0x898 angle steps,

```js
y = ((n * sin[bx]) >> 14) + 100;  x = ((n * -sin[(bx + 0x226) % 0x898]) >> 14) + 160;   // first write wins
tbl[y*320+x] = swap16((acc >>> 16) + rad);   // acc += 0x1dca per bx;  rad = (0x1400/(m+19)) << 8
```

so each pixel stores (depth, angle) (low byte depth, high byte angle). Resource 33 is the 2200-entry int16 sine table used here (not the 4096 one). Per frame two scroll accumulators
`A1,A2` (layer 1) and `B1,B2` (layer 2) move by `e = 0x400` per tick (`A += e`, `B -= e`), decelerating to zero between frames 0x124 and 0x208, and the picture is
`tex[(w + si) & 0xffff] + tex2[...]` where the second texture is the first one's low nibble `<< 4`. The two pixels of a pair share the second layer's word, as the original's loop does (see the asm
write-up, section 1). Palette: `dac[i] = res31[i] * k >> 6` for `k < 0x40` (fade-in), then **not rewritten**: it stays at 63/64 scale.
Rows 0, 198, 199 are never written. 521 frames (7.4 s). **All 521 frames identical** to the harness (index and palette).

## 3. e2: flat env-mapped objects over a picture (`e2.js`)

68 objects from a "WLDD" scene resource flying past a camera path over a 320x200 background (flipped in as the back buffer's background); 911 frames. Seven of the objects are interpolated between four key
sets with `(diff * w) >> 3`, the camera between nine keys with an `idiv` by 0x8c, plus a wobble `e = SIN[(t<<6)-0x400]` on rotation and camera y. Shading is mode 3 (flat environment-map lookup, see section 15)
using a 256x256 env map used directly. A small sprite (80x36) blinks at (256,159) 7 frames on / 7 off while the camera key is 4..6. The part starts with a fade from white (`out = ((p-63)*bp>>6)+63`, with the
16-bit *logical* shift of the original). One tick leaks in during init's first vsync and is reproduced. **Frames 4..925 of the harness are identical** (index and palette, rows 1..197).

## 4. partb: bump-mapped relief object (`partb.js`)

A static 685-vertex / 1366-face object (resource 18) with **mode 15** shading (environment + bump: texel `gs[uv]` plus env map `fs[ds-word + normal-uv]`), a tunnel picture (res 19) as background and a lighting angle that
rotates (`+0x21` per tick), so the reflections slide over the surface while the geometry mostly turns (`+2,+3,+4`). After tick 0x270 the object flies along a path (position from the sine table). The bump map is `(b-8)*2` per byte,
the env map `makeEnvMap(ramp, dl=0)` (radial ramp). Timeline in ticks: fade in 1..0x3f, hold, fly from 0x270, phases 4 (0x45a) and 5 (0x644), fade out from 0x82e, end at 2346 (33.5 s).
Verified identical (render buffer + palette) at 17 tick values from 3 to 2345, and against harness frames within a 0..2 tick offset (harness tick jitter).

## 5. partc: warped picture show (`partc.js`)

Three pictures (res 11-13, cropped to a 256x256 buffer: x = 32..287, rows stretched 200 -> 256) shown through a quad whose four edges are **sinusoidally wobbling curves**:

```js
function ring(arr, cnt, ph, step, P) {      // 0x9a02: points on a circle of radius R0 + wobble
  for (let k = 0; k < cnt; k++) {
    const idx = e >>> 20; e += step;
    const w = SIN[((idx << (P[5] & 31)) + P[8]) & 0xfff];
    const r = (Math.imul(w, P[6]) >> 16) + P[2];            // amp * sin + R0
    arr[2*k]   = Math.imul(SIN[idx + 1024], r) + 0xa00000;  // x
    arr[2*k+1] = Math.imul(SIN[idx], r) + 0x640000;         // y
  }
}
```
Four calls produce the top (320 points), bottom (320), right (200) and left (200) edges as quarter circles. From them the part builds, per column, a texture start and a per-row step ((B[k]-T[k])/200), per row
an offset and a per-pixel step, so every pixel's texture position is a sum of three accumulated terms packed as `X<<16 | Y` (8.8|8.8) and the picture is `pic[(Y8 << 8) | X8]`. No multiplication per pixel (the asm doc,
section 5). Five stages (S0..S4) of 261 or 391 frames, each fading its palette in and out over 32 ticks, with different radius, phase speeds and shift parameters; stages 1 and 4 add a per-frame wobble of the amplitude, stages
2-4 switch picture every 66 frames (`acc += 1000` in 16 bits, picture index on carry). Part ends at ~frame 1854. Quirks kept: all 32-bit wrap-around and `shr`-versus-`sar` subtleties.
**Stages 0..4 pixel- and palette-exact over their first 330 frames each**; later frames drift only because the harness's virtual PIT delivers ~4 % extra ticks while wobble/flip are per frame and the parameters per tick.

## 6. terrain: polar voxel landscape (`terrain.js`)

A heightmap (res 2) and colour map (res 3), both 256x256, are rendered not as a perspective view but as **256 vertical rays into a 256x256 buffer `BUF[ray*256 + y]`**, which is then remapped to the screen
through a precomputed polar map: the picture is a fish-eye / tunnel-like view around the screen centre.

```js
const LUT[j*256+h] = 0xbe - Math.min(0xbd, ((0x2f4 + 14*h) / (j + 9)) | 0)   // screen height of height h at distance step j
for (ray...) { for (bh = 0; bh < 0xd2; bh += 2) {                              // 105 steps
    cl = LUT[(bh<<8) | H[dx]];
    if (cl > ch) { fill C[dx] from ch to cl; ch = cl; }                          // classic voxel horizon
    dx = (dx + T[n]) & 0xffff;                                                   // 16-bit address step
}}
screen[i] = BUF[MAP[i]]       // MAP: for angle 0..4095 walk 191 steps from (160,100), first writer wins: (a>>4)<<8 | (190-r)
```
`T[i] = (SIN[(ec6 + i*ed6) & 0xfff] >> 10) * 256 + i`, then differenced, is a 16-bit "dy*256+dx" step per ray step; the sine in it gives the rippling bend of the view, `ed6` (ripple frequency) and
`eca` (ripple phase speed) are driven from the timer callback on specific music rows (order 0x3b row 0 and order 0x3d row 0, every 4th tick for 20 / 30 steps). Camera speed `cbe` ramps +1 per frame during the first 0x100
frames. Columns 0xa9..0xc0 of each ray are cleared first. Fade-in 256 ticks, fade-out from order 0x43. About 2338 frames.
Exactness: pixel- and palette-exact on all compared frames until the harness's own tick drift (its PIT gives 4-7 % more ticks than vsyncs, so the `cbe` ramp, which is per main-loop iteration, diverges after 20-250 frames);
the model assumption is one main-loop iteration per tick, while on the original machine the ramp depended on rendering speed.

## 7. partd: morphing bump object with a palette crossfade (`partd.js`)

A 529-vertex / 968-face morph object (res 24, 10 extra key frames) with lib3d mode 15 and a camera/object path interpolated between 6 keys (idiv 0x152). The texture and the bump map are the *same* 256x256 buffer
(`gs` and `ds` are the same selector), assembled each frame from 8 tile frames of 64x128 (T0 = res 23, T7 = res 21, T1..T6 = linear byte blend), tile `w>>3` repeated 4x horizontally and 2x vertically.
Two palettes A and B are cross-faded `A + ((B-A)*w >> 6)`, `w` bouncing 63 -> 0 -> 63, so texture animation and colour change together. Fade in `B*t>>6` for 64 ticks, hold, bounce phase 0x437..0x82d, fade out from 0x82e
(the DAC jumps from the mix to B at that point, as in the original). 2158 frames (30.8 s).
**Frames 2..165 contiguous identical**, later phases checked with a patched harness copy that pokes the JS state into memory (start ticks 1088, 1728, 2080, 2140; 24-30 frames each, all identical).

## 8. partf: bouncing ball on a ring of precalculated spheres (`partf.js`)

* **Precalc** (0x16945, in the original's global init, 0.5 s in JS): 64 frames of 16 spheres on a ring are rendered with the 3D engine and stored **RLE-encoded** for rows 77..199
  (`[skip u16][count u16][bytes remapped via table 0x15a60]... 0xffff`); 1 223 242 bytes, **byte-exact** against the harness snapshot (64/64 frames). Per frame the background is just a blit of frame `(t>>1)&63`.
* **Ball** (resource 51, 650 vertices, 3 extra key frames, morph keys [0,1,2,0], 128 steps): lib3d mode 3 over an env map (res 49). It falls into view (`y = 0x173180 - (t-0x9e)*0x1d4c`), then bounces
  at ticks 560, then every `c3` ticks (206, decreasing by 4, 10, 16... ) 7 times, last at 1502; each bounce starts a 63-tick colour flash (channels from tables 0x15960/0x159e0) and an extra spin. After the last bounce the ball flies toward the camera
  (`z += d4`, `d4 += 0xb9` per tick) and a whole-screen flash from table 0x15660 ends the part (tick 1805, 25.8 s).
* Palette fade `v < 2^cl: src*v>>cl, else src + ((63-src)*(v-2^cl)>>cl)` (fade to white after black).
Exactness: ticks 1-3, 50, 100-130, 160-167, 200, 300, 400, 561-563, 580-700 identical (back buffer, palette, DAC). **Ticks above 700 (later bounces, fly-by flash, end) were not compared** (the harness runs at ~1 tick/s there);
they are transcribed from the disassembly.

## 9. picture57 and the credits (`credits.js`)

Static pictures with palette-only effects. `showPicture(res)` puts 64000 px into VRAM with a black palette; `fade(step,count)` as in the intro. The outro: a table of waits on `pos > 0x9500, 0x9519, 0x9600, 0x9700, 0x9800, 0x9a00, 0x9a20`;
pictures 0x34..0x38 and 10 appear as 130-frame flashes (fade in 65 + out 65), the last stays longer (fade-in, 20 + 180 frames hold, fade-out step -2 over 129 frames). The order of two of the pictures depends on the DOS clock's minutes parity
(`ctx.swap` / `new Date().getMinutes() & 1` in the port). **The whole outro, 1011 frames, is identical (pixels and 6-bit palette)** to the harness; picture 57 (`0x5500`..`0x5800`) is "identical (palette within 8-bit rounding)" in the notes.

## 10. textg: feedback blur with random dots and sprites (`textg.js`, two variants)

Two 320x200 byte buffers A/B whose values stay in 0..31 (the DAC holds a 32-colour blue/cyan palette, or violet/pink for variant 2, scaled by a fade). Each frame:

1. **10 random dots** are stamped as small discs; `rand(100)+50` row, `rand(160)+80` column, colour 0x1f or 0 (so some dots *erase*).
2. a **sprite** from resource 58 (a 320x200 bitmap with the four texts stacked in 24-row bands) is blitted when a countdown is running: the timer callback sets the countdown to 0x14 on music row 0 and row 0x1e, so a sprite
   flashes for ~20 frames after each trigger and the index advances (13 entries, 17 in variant 2; entries of width/height 1 are blanks).
3. variant 2 only: four orbiting squares at `sin/cos(c44<<4 | <<6 | -c44<<2 | <<7)`.
4. **blur-zoom**: output pixel `(x,y)` reads the source at `((y-100)*120>>7)+100` row and `((x-160)*120+64>>7)+160` column (zoom 120/128: the picture slowly shrinks) and replaces it with the average of its four dword neighbours,
   masked with `0x1f1f1f1f` (asm doc, section 3). The result goes to VRAM and to the other buffer. The dots and text therefore smear into trails and spiral inward.

Exactness: variant 1 is pixel- and palette-exact for the first 345 frames (with the harness's real tick stream), later frames are only visually identical (sprite index sequence offsets by one tick of harness timing); variant 2 is exact for 27
frames then differs by one tick of jitter in the squares. The RNG seed is the harness's `0x7ea9`; the real seed depends on how many random numbers earlier parts consumed, so **the random dots do not match a real run** (README).

## 11. parth: three-layer feedback "fire" (`parth.js`)

The same blur with three 64000-byte layers in a 384000-byte block (two sets swapped every frame), stamped from resources 36-38 (skip/count streams) with data 39-41 when `pos>>8` is 0x69..0x6b and `(pos & 15) == 0`.
The blur: `dst dword = ((4 neighbours) >> 2) & 0x3f3f3f3f` with a zoom-out of 0x77/128 and a **wave offset** from the 70 Hz tick (phase += 0x78, 1023-amplitude sine table of 2048 words). The screen is a *checkerboard* of
two views: even pixels `lut[L0 << 8 | L2]` and odd `L1>>2`, parity flipping every frame (so at 70 Hz both are visible). Palette: a green ramp for 0..15, then red/blue combinations for 16..255, scaled with a fade of +4 per tick for 64 ticks and -4
from pos 0x6b19. Visible from pos 0x6901 to 0x6b30 (~444 frames). With the harness's real tick counts fed in, **all 420 compared frames are pixel-identical**; the palette differs only by +-1 tick during fades.

## 12. parti: stone torso and mirror reflection (`parti.js`)

Two 3D objects, a torso (A, drawn with mode 2) and a second object B (mode 20, two face types: 329 "warp" faces then 130 "2-attribute" faces), over a stone background. B rises and spins (0..0x130 ticks), then waves: vertices 177..241 are displaced each
frame from a pristine copy (`y += amp<<4, x += wx, z += wz`) by sine laws, and an env-map band at row `amp + 0x88` is brightened (+0x20) then undone. From tick 0x2e0 a **mirror** is faked: object B is drawn
mirrored (`z = 0xffda8000, ay' = 0x800 - ay`) with the new **mode 21** into a 256x256 target buffer that becomes the environment map of A, so the torso reflects the second object. Fade in `pal*t>>6` for 0x40 ticks, out `pal*(0x98f-t)>>7`
from 0x910, end at tick 0x98f (2447 frames, 35 s). **Verified against the harness at every 10th iteration**; the mode-21 rasteriser `0x54548` (`V_WARP256`) still mismatches 2/400 random triangles with y >= 205 (outside the 200-row screen), see section 15.

## 13. partj: environment-lit head over a feedback tunnel (`partj.js`)

A head drawn as a **stream of skipped/run segments** (resource 34, turned into texture offsets at init: `al = (d>>1)&255, ah = ((d>>4)>>8)&255, sar both, + 0x8080`, 16-bit) shaded from a 256x256 environment map (res 35, scrolled by a
sine of a counter) through one of 32 LUT rows (the row is the "light" and also the feedback fade). Each frame: (a) compose into buffer A (if the head flag is off, the whole buffer is passed through the LUT = fading feedback; otherwise skip pixels pass
through the LUT, run pixels come from the env map), (b) **warp A -> B and VRAM**: `pix(y,x) = A[R[y] + D[x]]` with `D[x] = ((sin[e1]+sin[e2])*P>>16)*320 + (((256-P)*320>>1) + P*x >> 8)` and the analogous `R[y]` (two sines per axis and a zoom factor `P` around 256), (c) swap.
The buffers live in a zeroed 192000-byte arena so reads out of range give 0. The script (pos thresholds 0x8820 .. 0x9230, ~1692 frames) switches the animator on/off, changes the scroll speed, selects four
parameter blocks and, after 0x8d00, strobes the head with an accelerating 16-bit accumulator (carry = one extra frame with the head on, which costs one extra display frame as in the original), then fades out from 0x9210.
**Pixel-exact in the first ~320 frames**, afterwards differing only by harness tick jitter (visually identical shapes and lighting). The shared harness ignores DPMI int 31h/7 (set segment base), which gave a wrong env-map base: the
check used a harness copy implementing it (`re/parts/textg_tmp/hz.py`).

## 14. Music

Resource 1 is a ProTracker-like module with signature `16CH`, 73 patterns, 31 samples and a non-standard 256-entry order list (155 used), so ordinary MOD players (128 orders) cannot load it as is. The port converts it to XM
(`re/mod2xm.py`). First conversion snapped every period to the 36-note table and was wrong: 351 of 3463 notes lie outside it (periods 45..1076); now `note = round(49 - 12*log2(p/428))` (clamped 1..96) with a -20/128 semitone finetune
(XM C-4 = 8363 Hz against the Amiga's C-2 = 8287 Hz), and Amiga left-right-right-left panning as 8xx effects. Check: libopenmpt renderings of the rebuilt MOD and of the XM agree within each octave band to a flat +3.5 dB (the XM is louder). It is **not**
the LCA player's mixer, so timbre and levels differ from the original (README).

## 15. The shared 3D engine (`lib3d.js`)

All 3D parts (e2, b, d, f, i; the head in j is a 2D stream) use one engine, `0x78000..0x7a210` plus the polygon routines `0x4d2xx..0x54xxx`, ported with the same 32-bit fixed point (matrices .10, projection
`0xa0 + x / ((dist - z>>10) << shift)`). Pipeline per object: transform, lighting (vertex and face normals rotated by object angles plus a global `rot`: this moves reflections without moving the geometry), back-face cull, depth key and
a quirky quicksort (ported literally: tie order matters), five stages of per-mode rasteriser. Modes used by the demo: **15** (env + bump), **3 / 2** (flat environment lookup), **20** (per-face type), **21** (256-wide render target). The object format is `'B!' 1a 0f`,
nverts, nfaces, 16-byte vertices (x,y,z, normal, `u|v<<8`), 16-byte faces; magic byte 3 = 0 marks morph objects with extra key frames. The environment map is a radial 256x256 ramp produced by `0x7873a` (`makeEnvMap`), and the sqrt table the engine
needs lives **inside the back-buffer memory** (so `sqrt()` after the first flip returns garbage, as in the original).

Exactness: the full pipeline is identical to the original for mode 15 (partb, 17 ticks); rasterisers verified by calling the original function in Unicorn against the port on random triangles: `0x51593` 400/400, `0x4e710` 400/400,
`0x4f47c` 500/500, `0x52e96` 400/400, but `0x54548` 494/500 (all mismatches have y >= 205). Modes 2/3/20 are verified at rasteriser level plus the shared pipeline; the morph functions are exercised by parts d, f and i (matching harness frames). A camera
path variant (`[0x5799c] == 1`, 0x79df3) is not ported; 22 other table modes are never selected.

## 16. What is exact and what is not (summary)

| exact against the original code under emulation | approximated or not verified |
|---|---|
| e1 (all 521 frames), e2 (911 frames), partb (17 ticks + frames), intro pictures/fades, whole outro (1011 frames), picture 57 (palette within 8-bit rounding), parth (420 frames), partc (first 330 frames of each stage), terrain, textg variant 1 (345 frames), partj (320 frames), partd (checked in segments), partf precalc (byte-exact) | partf after tick 700 (transcribed from disassembly), the second half of part I (README: "not verified"), textg random dots (seed), text-mode ending (not ported), seeking (replays from the start of the current part, so a seeked frame can differ slightly), music (MOD->XM through libopenmpt), `V_WARP256` 6/500 clipped triangles |
