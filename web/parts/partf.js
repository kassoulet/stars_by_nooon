// Part F: a morphing environment-mapped ball bouncing in front of a ring of 16 spheres, with colour flashes. Port of main 0x164dc (whole part: init + loop + cleanup)
// + 0x16646 (70 Hz timer callback) + 0x168a3 (flash palette) + 0x16acc (RLE sprite blit) + 0x16945 (sprite precalc, run in the original's global init at 0xe6).
// Uses web/lib3d.js (shading mode 3 = env-map lookup, drawObject without camera). Resources: 49 env map (256x256), 50 sphere object (158 v), 51 morph object (650 v, 3 key frames).
// Main script: wait pos > 0x5820, call 0x164dc (runs ~1807 ticks by itself, palette ends black), clear VRAM, wait pos > 0x6100.
import { Lib3D, parseObject, SIN } from '../lib3d.js';

// static data 0x15660..0x16160 of the original image: 0x15660 flash table (256 w), 0x15860 morph weights (128 w), 0x15960 / 0x159e0 bounce-flash tables (64 w), 0x15a60 colour remap (256 B), 0x15b60 live palette (768 B, 0), 0x15e60 source palette (768 B)
const DATA_B64 = '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';
const b64 = s => typeof atob === 'function' ? Uint8Array.from(atob(s), c => c.charCodeAt(0)) : new Uint8Array(Buffer.from(s, 'base64'));
const D = b64(DATA_B64), DV = new Int16Array(D.buffer, D.byteOffset, D.length >> 1);
const T_FLASH = DV.subarray(0, 256), T_MORPH = DV.subarray(0x100, 0x180), T_A = DV.subarray(0x180, 0x1c0), T_B = DV.subarray(0x1c0, 0x200);
const REMAP = D.subarray(0x400, 0x500), SRC_PAL = D.subarray(0x800, 0xb00);
const i16 = x => (x << 16) >> 16, i8 = x => (x << 24) >> 24;

// 0x16945: 64 frames of 16 small spheres on a ring (angle step 0x100, phase (t&0x1f)<<4), env-mapped with res 49, RLE encoded (rows 77..199) with colours remapped by REMAP.
// frame = [skip(u16), count(u16), count bytes ...]* , 0xffff. Returns Uint8Array[64].
// stale: value of bx stored in every object's ay at 0x16bb6 ("mov [edi+0xe],bx", bx = leftover register, see notes).
export function precalc(res49, res50, stale = t => t === 0 ? 0x38 : t - 1) {
  const L = new Lib3D();
  L.fs = new Uint8Array(0x10000); L.fs.set(res49.subarray(0, 0x10000));
  const data = parseObject(res50), scene = L.newScene();
  for (let i = 0; i < 16; i++) scene.objs.push(L.newObject(data));
  L.mode = 3; L.shift = 3; L.dist = 0x14; L.flags = 0;
  const B = L.back, frames = [];
  for (let t = 0; t < 64; t++) {
    B.fill(0, 0, 64000);
    let e = (t & 0x1f) << 4;                                              // 0x16ba1
    let bx = stale(t);                                                    // bx is clobbered by the loop: ay of object i = (angle of object i-1) - 0x400
    for (const o of scene.objs) {
      o.ay = bx; bx = (e - 0x400) & 0xfff; o.ax = 0x400; o.y = 0x64;
      o.x = (SIN[e & 0xfff] << 8) >> 10; o.z = ((SIN[(e - 0x400) & 0xfff] << 8) >> 10) - 0xbe; e += 0x100;
    }
    L.render(scene);
    const out = []; let p = 0x6180;                                       // 0x16b1e
    for (;;) {
      let n = 0; while (p < 64000 && B[p] === 0) { n++; p++; }
      out.push(n & 255, n >> 8);
      if (p >= 64000) { out.push(255, 255); break; }
      const q = out.length; out.push(0, 0); n = 0;
      while (p < 64000 && B[p] !== 0) { out.push(REMAP[B[p]]); n++; p++; }
      out[q] = n & 255; out[q + 1] = n >> 8;
      if (p >= 64000) { out.push(255, 255); break; }
    }
    frames.push(Uint8Array.from(out));
  }
  return frames;
}
// 0x16acc: blit RLE frame into the back buffer (row 77 on)
function blit(back, f) {
  let p = 0x6180, i = 0;
  for (;;) {
    const skip = f[i] | f[i + 1] << 8; i += 2; if (skip === 0xffff) return;
    p += skip; const n = f[i] | f[i + 1] << 8; i += 2; if (n === 0xffff) return;
    back.set(f.subarray(i, i + n), p); i += n; p += n;
  }
}
// 0x168a3: palette = SRC_PAL faded per component: v < 2^cl: src*v >> cl ; v >= 2^cl: src + (63-src)*(v-2^cl) >> cl  (8-bit signed imul, 16-bit sar)
function mkPal(pal, bb, bc, bd, cl) {
  const bf = 1 << cl, v = [bb, bc, bd];
  for (let i = 0; i < 768; i++) {
    const s = SRC_PAL[i], b = v[i % 3];
    pal[i] = (b >= bf ? (i16(((63 - s) * i8(b - bf)) ) >> cl) + s : i16(s * i8(b)) >> cl) & 255;
  }
}

let L, obj, S, pal, sprites, res49;
export const _dbg = () => ({ L, obj, S, pal });
export default {
  name: 'partf',
  resources: [49, 50, 51],
  init(ctx) {
    const r = ctx.res;
    L = new Lib3D();
    sprites = precalc(r(49), r(50), ctx.stale);
    L.setMorphTable(T_MORPH);
    L.fs = new Uint8Array(0x10000); L.fs.set(r(49).subarray(0, 0x10000));
    L.bg = new Uint8Array(0x10000);                                       // flipClear(0) instead
    L.mode = 3; L.shift = 1; L.dist = ctx.dist ?? 0x64; L.flags = 0;     // dist: left at 0x64 by part C (a2f1); 0x14 if started straight from the harness snapshot
    obj = L.newObject(parseObject(r(51)), 0, 0x16e360, 0xffc6c790 | 0, 0xfc00, 0, 0, { keys: [0, 1, 2, 0], shift: 7, steps: 0x80 });
    pal = new Uint8Array(768);
    ctx.vga.pal.fill(0); ctx.vga.vram.fill(0);                            // 0x16892 with zeros
    S = { t: 0, flag: 0, bb: 0, bc: 0, bd: 0, cl: 6, c1: 9, c3: 206, c7: 560, cb: 0, cf: 4, ph: 0, d4: 0, d8: 0, done: false };
  },
  frame(ctx, f) {
    const vga = ctx.vga;
    // ---- timer callback 0x16646 (one tick per frame)
    S.flag = 0; S.t++; const t = S.t;
    obj.ax = (obj.ax + 0xa) & 0xfff; obj.ay = (obj.ay + S.c1) & 0xfff; obj.az = (obj.az + 6) & 0xfff;
    L.advanceAnim(obj, 3);
    let skip = false;
    if (t < 0x80) { S.flag = 1; S.bb = S.bc = S.bd = t; S.cl = 7; }
    else if (t <= 0x9e) { /* nothing */ }
    else if (t < 0x166) obj.y = (0x173180 - (t - 0x9e) * 0x1d4c) | 0;
    else {
      if (S.cb !== 0) {
        S.cb--; S.flag = 1; S.cl = 6; obj.ax = (obj.ax + 0x12) & 0xfff;
        S.bd = (T_A[S.cb] >> 1) + 0x30 & 255; S.bc = S.bb = T_B[S.cb] + 0x2a & 255;
      } else if (S.ph !== 1 && t === S.c7) {
        S.cb = 0x3f; S.c3 -= S.cf; S.cf += 6; S.c1 += 2;
        if (S.c3 < 0x50) { S.c3 = 0x50; S.ph = 1; S.d8 = 0; }
        S.c7 += S.c3;
      }
    }
    if (S.ph === 1) {                                                    // 0x167f8
      S.d4 += 0xb9; obj.z = (obj.z + S.d4) | 0;
      if (S.d4 > 0x23f0) {
        S.cl = 6; S.d8++; S.bb = S.bc = S.bd = T_FLASH[S.d8 & 255] & 255; S.flag = 1;
        if (S.d8 >= 0xff) { S.d8 = 0xff; S.ph = 2; S.bb = S.bc = S.bd = 0; }
      }
    }
    // ---- main loop body 0x16590
    if (S.flag) mkPal(pal, S.bb, S.bc, S.bd, S.cl);                       // 0x168a3 (before vsync)
    if (S.flag) vga.pal.set(pal);                                         // after vsync: 0x16892
    L.flipClear(vga.vram, 0);                                             // 0x78948
    blit(L.back, sprites[(t >> 1) & 0x3f]);                               // 0x16acc
    L.morph(obj);                                                         // 0x78ffe
    L.drawObject(obj);                                                    // 0x789c4 (fs = res 49 here)
    return S.ph !== 2;
  },
};
