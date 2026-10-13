// Part H: 3-layer feedback blur ("fire") stamped with res 36-41 shapes. Port of 0x1528c (init) / 0x1535c (loop) / 0x1544d (70 Hz tick) / 0x7a061 (blit).
// Active from music pos 0x6900 (loop start) to 0x6b30. Layers L0,L1,L2 (64000 B each) are blurred through a zoom-out warp each frame;
// screen pixel = checkerboard of LUT[L0,L2] (palette idx dh*16+(L2>>2)) and L1>>2 (green ramp), palette fades in/out via scale/256.

const LAY = 64000, TOT = LAY * 3;
const SIN = new Int16Array(2048).map((_, i) => Math.round(1023 * Math.sin(2 * Math.PI * i / 2048)));
function tickTo(n) {                 // 0x1544d, once per 70 Hz tick (ctx.ticksAt only for verification against the harness)
  while (S.tk < n) {
    S.tk++;
    if (S.cnt) { S.scale += S.step; S.cnt--; S.dirty = 1; }
    S.ph = (S.ph + 0x78) & 0xfff;
    S.ox = ((SIN[S.ph >> 1] * 4) >> 10) + 1; S.oy = (SIN[((S.ph + 0x400) & 0xfff) >> 1] * 4) >> 10;
  }
}
let A, B, colTab, rowTab, lut, pal0, pal, S, res36;
const sar = (v, n) => v >> n;

export default {
  name: 'parth',
  resources: [36, 37, 38, 39, 40, 41],
  init(ctx) {
    colTab = new Int32Array(80); rowTab = new Int32Array(200);
    for (let k = 0, e = -0xa0; e !== 0xa0; e += 4, k++) colTab[k] = sar(e * 0x77 + 0x40, 7) + 0xa0;
    for (let i = 0, e = 0x63; e >= -0x64; e--, i++) rowTab[i] = sar(e * 0x77, 7) + 0x64;
    A = new Uint8Array(TOT + 4096); B = new Uint8Array(TOT + 4096);
    // 0x79fad: palette (6-bit), LUT 64 KB
    pal0 = new Uint8Array(768);
    for (let i = 0, bx = 0; i < 16; i++, bx = (bx + 0x434) & 0xffff) pal0[i * 3 + 1] = bx >> 8;
    for (let j = 0, bp = 0, o = 48; j < 15; j++, bp = (bp + 0x492) & 0xffff)
      for (let i = 0, bx = 0; i < 16; i++, bx = (bx + 0x434) & 0xffff, o += 3) { pal0[o] = bp >> 8; pal0[o + 2] = bx >> 8; }
    lut = new Uint8Array(0x10000);
    for (let r = 0, dx = 0x100; r < 64; r++, dx += 0x3c) for (let c = 0; c < 64; c++) lut[r << 8 | c] = (((dx >> 8) << 4) | (c >> 2)) & 255;
    pal = new Uint8Array(768);
    S = { tk: 0, ph: 0, ox: 0, oy: 0, scale: 0, step: 4, cnt: 0x40, par: 0, dirty: 0 };
    res36 = n => ctx.res(n);
  },
  frame(ctx, f) {
    const pos = ctx.pos();
    if (pos > 0x6b30) return false;
    tickTo(ctx.ticksAt ? ctx.ticksAt(f) : f);
    if (S.step >= 0 && pos > 0x6b19) { S.step = -4; S.cnt = 0x40; }
    if ((pos & 15) === 0) {
      const hi = pos >> 8, k = hi - 0x69;
      if (k >= 0 && k <= 2) {
        const st = ctx.res(36 + k), dt = ctx.res(39 + k);
        let sp = 0;
        for (let l = 0; l < 3; l++) {
          let p = 0, d = l * LAY;
          for (;;) {
            const a = st[p] | st[p + 1] << 8; p += 2; if (a === 0xffff) break;
            d += a; const c = st[p] | st[p + 1] << 8; p += 2; if (c === 0xffff) break;
            A.set(dt.subarray(sp, sp + c), d); d += c; sp += c;
          }
        }
      }
    }
    // 0x1549b: blur A -> B with zoom warp + wave offset, per layer
    const dv = new DataView(A.buffer), dw = new DataView(B.buffer);
    const off = S.oy * 320 + S.ox;
    for (let l = 0; l < 3; l++) {
      const base = l * LAY;
      for (let y = 0, e = 199; y < 200; y++, e--) {
        const rs = base + rowTab[e] * 320 + off, rd = base + y * 320;
        for (let k = 0; k < 80; k++) {
          const s = rs + colTab[k];
          const v = (((dv.getUint32(s - 1, true) + dv.getUint32(s + 1, true) + dv.getUint32(s - 320, true) + dv.getUint32(s + 320, true)) >>> 0) >>> 2) & 0x3f3f3f3f;
          dw.setUint32(rd + k * 4, v, true);
        }
      }
    }
    tickTo(ctx.ticksAt ? ctx.ticksAt(f + 1) : f + 1);   // ticks fire during the vsync inside 0x4a7b0
    if (S.dirty || S.cnt) {
      S.dirty = 0;
      for (let i = 0; i < 768; i++) { const v = (pal0[i] * (S.scale & 0xffff)) >> 8; pal[i] = v > 63 ? 63 : v; }
      ctx.vga.pal.set(pal);
    }
    // 0x7a061 blit: checkerboard of lut[L0,L2] and L1>>2
    const vr = ctx.vga.vram, par = S.par ^= 1;
    for (let y = 0; y < 200; y++) {
      const even = ((y & 1) === 0) === (par === 1);   // see notes: row type alternates, flips every frame
      for (let x = 0; x < 320; x++) {
        const i = y * 320 + x;
        vr[i] = (((x & 1) === 0) === even) ? lut[B[i] << 8 | B[i + 2 * LAY]] : B[i + LAY] >> 2;
      }
    }
    const t = A; A = B; B = t;
    return true;
  },
};
