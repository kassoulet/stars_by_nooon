# partj (environment-lit head over feedback tunnel)

Main 0x2d3: init 0x10b26 (res 34 + 35, buffers), wait `pos > 0x8700`, loop 0x1089c, cleanup 0x10bd9. Code 0x1089c..0x11ad7.
JS: `web/parts/partj.js` (resources 34, 35). frame() returns false when pos > 0x9230 (~1692 frames after 0x8700).
Palette ends black (fade-out 64 ticks from pos 0x9210), starts black (fade-in 64 ticks).

## Data
* res 35 (74495 B): 768 B palette; env map 256x256 at +0x300 (read at +[0x107c6]+u16); 32 LUT rows of 256 B at +0x300+0xffff.
* res 34: records {u16 ?, skip, count, u16 ?, count x dword}; init 0x11a0a turns each dword into a u16 texture offset
  (`al=(d>>1)&255, ah=(d>>4)>>8&255, sar both 1, +0x8080 (16-bit), xchg`) -> stream [skip, count, offs...]..., end 0xffff, until 63680 px.
* sin512[i]=round(1024 sin) (table 0xffb8); animator uses sin4096=round(65528 sin) (0xa740).

## Per frame (0x10a86)
1. timer tick (cb 0x10ae2): scroll counter [107ca]+=[107ce]; 4 wave phases += speeds (block 0xf740 dwords 1,3,5,7); animator P=(sin4096[ph]*amp>>16)+ctr (P in 0xd0..0x130, ph+=0x32) while on; palette fade step.
2. [107c6] = (sin512[((107ca&0x7fc)+0x200)&0x7fc >>2]>>5)*256+0x2000 (env map scroll).
3. palette = res35 pal * scale/256 (clamp 63) when fading.
4. compose into buffer A: LUT row [f768] copied; if head flag [f76c]<=0 whole buffer remapped through LUT (fading feedback); else stream: skip px remapped via LUT, run px = res35[[107c6]+off].
5. warp A->B and VRAM: pix(y,x)=A[R[y]+D[x]], D[x]=((sin[e1]+sin[e2])*P>>16)*320+(((256-P)*320>>1)+P*x>>8), R[y]=((sin[e1']+sin[e2'])*P>>16)+(((256-P)*200>>1)+P*y>>8)*320
   (phase index (e&0x7fc)>>2, e += block steps per column/row). Swap A/B (buffers inside a zeroed 192000 arena, A at 16000, B at 112000, so out-of-range reads give 0).
## Script (pos thresholds, checked after each frame)
start: animator on (P around 256), head on, block0 = zeros (P=256,LUT 15) | >=0x8820 animator off, scroll speed 0x50 until [107ca]>=0x980 | speed 0, block1 (0x107dc) until >0x8920 | >0x8b00 speed 0x1e | >0x8b20 block2 (0x1081c) | >0x8d00 head off, then accelerating strobe: 16-bit acc += step (step starts 0x640, +0x32 per iteration), carry => one extra frame with head on | >0x8f00 head on | >0x9000 block3 (0x1085c), counter 0x30 (every 4th decrement P++) | >0x9200 head off, P+=0x16 | >0x9210 fade out | >0x9230 end.
## Verification
Harness (re/parts/textg_tmp/hz.py = copy implementing DPMI int31/7 which the shared harness ignores: with the shared harness the env-map base is wrong, so shading differs!). Frame mapping as textg (harness F = port f+2). Pixel-exact in the first ~320 frames incl. palette; later frames differ only by harness tick jitter (visually identical, same shapes/lighting). Strobe frame costs an extra display frame as in the original.
