# credits (outro) -- web/parts/credits.js

Main script 0x2ed..0x472 (res 0x34..0x38, 10) and 0x1b0..0x1e9 (res 0x39, exported as `picture57`).

## Helpers (original -> JS, exported from credits.js)
* `0x17e50 showPicture(res)`: [0x4a7a0]=fade level=0, DAC all black (0x4a76c), copies res+0x300 (64000 px) to VRAM AT ONCE (rep movsd), keeps palette (768 B 6-bit)
  in a 0x600-byte buffer. The picture is in VRAM but invisible (black palette) until a fade-in.
* `0x17e96 fade(vga,pic,step,count)` (ebx=step, ecx=count): loop { 0x4a7b0: vsync(0x4a830) then write DAC with pal'=min(63,(pal*level)>>8 &255); 0x4a80b: level+=step; count-- }, then one last 0x4a7b0.
  Level is 8.8 (256 = full). => count+1 frames (65 for 4/0x40: levels 0,4..256). Fade-out = step<0 (0xfffffffc) from 256 (`0x17eba` = same + free picture buffer).
* No other drawing: the picture is never redrawn, only the palette moves.

## Script (waits `pos > T`, pos = order<<8|row; one check per frame is enough)
| step | action |
|---|---|
| show res A | A = 0x36 then 0x35, swapped if [4] != 0 ([4] = DOS clock minutes&1 -> JS: `ctx.swap` or `new Date().getMinutes()&1`; harness = 0) |
| wait > 0x9500 | fade in (4,0x40); wait > 0x9519; fade out (-4,0x40) |
| show res B (other of 0x35/0x36) | wait > 0x9600; fade in (4,0x40) immediately followed by fade out (-4,0x40) (a flash) |
| show 0x37 | wait > 0x9700; in/out flash |
| show 0x34 | wait > 0x9800; in/out flash |
| show 10 | wait > 0x9a00; fade in (8,0x20) (33 frames); fade out (-4,0x40) |
| show 0x38 | wait > 0x9a20; fade in (4,0x40); wait 0x14 frames; (0x4a006 only touches music callback, nothing visible); wait 0xb4 frames; fade out (-2,0x80) (129 frames) |
| 0x7dd | text-mode end screen only if [0x7b0]==1 (no-op in harness, not ported); then int10 mode 3, return |

Thresholds: 0x9500, 0x9519, 0x9600, 0x9700, 0x9800, 0x9a00, 0x9a20. A part-ending fade-out finishes ~ 0x9a20 + 20+180+129 frames (~4.7 s).
The part ends (frame() returns false) after the last fade; palette is then black, VRAM holds res 0x38 pixels.
Each flash = 130 frames (65 in, 65 out) -- shorter than the 0x100-row gaps, so the screen is black in between (picture of next step already loaded in VRAM, hidden).

## Other picture (main 0x1b0..0x1e9) -- `picture57` export
showPicture(0x39) ; wait > 0x5500 ; fade in (4,0x40) ; wait > 0x5800 ; fade out (-4,0x40) ; VRAM cleared (0x1ee). (Then the original continues with 0x164dc at >0x5820; not part of this module.)
Not harness-verified separately (same helpers).

## Verification
re/parts/credits_tmp: h2.py (harness copy logging pos per frame), r2.mjs (render.mjs driven by that pos table, swap=0), cmpall.py.
Harness --start 0x2ed --order 0x93: all 1011 frames (whole outro) pixel + palette (6-bit) identical to the JS.
Note: the harness position was already > 0x9500 at frame 1, so the first wait is only checked by the logic, not by timing.
