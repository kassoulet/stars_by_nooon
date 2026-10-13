# parth (3-layer feedback blur / "fire" shapes) -- web/parts/parth.js
Main: `call 0x1528c` (init, at pos>0x6100), wait pos>0x6900, `call 0x1535c` (loop), `call 0x1530a` (cleanup). Visible only from pos 0x6901 to 0x6b30 (loop exit when pos>0x6b30). Start = 0x6901, end = 0x6b31 (~444 frames at 70 Hz).
* Resources 36-38 = stamp streams {u16 skip, u16 count}* (0xffff ends), 39-41 = their data (consecutive for the 3 layers). Layers L0,L1,L2 = 3 x 64000 B in one 384000 B block, two sets (src/dst swapped every frame).
* Palette (0x79fad): idx0-15 green ramp (0,g,0) g=i*0x434>>8; idx16.. r=j*0x492>>8, b=i*0x434>>8 (15x16). LUT 64 KB (0x7a004): lut[L0<<8|L2]=((0x100+0x3c*L0)>>8<<4)|(L2>>2).
* Per frame: when pos>>8 in 0x69..0x6b and (pos&15)==0, stamp res 36+k/39+k into the src layers (repeated every frame of that row, as the original). Blur (generated code 0x1549b): dst[y][4k..4k+3] = ((4 dword neighbours at src(x-1,x+1,y-1,y+1)) >>2) & 0x3f3f3f3f, with a zoom-out warp: src row = rowTab[199-y]=((y-100)*0x77>>7)+100, src col = colTab[k]=((4k-160)*0x77+0x40>>7)+160, plus wave offset (ox=sin*4>>10 +1, oy=cos*4>>10) updated by the 70 Hz tick (phase += 0x78, table = 1023 sin over 2048 words at 0x14260).
* Blit (0x7a061): checkerboard, pixel = lut[L0,L2] or L1>>2; parity flips every frame (first frame: tbl at even x on even rows).
* Palette fade: scale [4a7a0] += 4 per tick for 64 ticks (0..256), palette = pal*scale>>8 clamp 63; when pos>0x6b19 step=-4 for 64 ticks. Palette at start: black (scale 0); at end ~black (scale ~0..0x40, ends at pos 0x6b30 mid fade-out depending on tempo).
* Timing: 1 tick/frame assumed (ctx.ticksAt only for verification).
## Verification
re/parts/parth_tmp (hx.py = harness with hook dumping pos/ticks per iteration, batch.py, run2 from textg_tmp): with the harness's real tick counts fed in, VRAM is pixel-identical in all 420 compared frames (harness frame F = JS frame F-2). Palette differs only by the +-1 tick jitter during fades.
