// Part I: spiky/stone torso (res 46, wavy vertices, warp-textured) + mirror object (res 45, env = mirrored torso rendered with mode 21 into a 256x256 target).
// Port of 0x16d86 (init) / 0x16f7c (loop) / 0x17513 (70 Hz tick) / 0x17084 (script) / 0x17253 (waves). Uses web/lib3d.js modes 20, 21, 2.
// Start when music pos > 0x6c00; ends by itself at tick 0x98f (palette black), or when order > 0x82.
import { Lib3D, parseObject, SIN } from '../lib3d.js';

const RAMP = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,2,2,3,3,4,4,4,5,5,6,6,6,7,7,8,8,8,9,9,10,10,11,11,11,12,12,13,13,14,14,15,15,16,16,17,17,17,18,18,19,19,20,21,21,22,22,23,23,24,24,25,25,26,27,27,28,28,29,30,30,31,32,32,33,34,34,35,36,37,37,38,39,40,41,42,42,43,44,45,47,48,49,50,52,53,55,58,63];
const i16 = v => (v << 16) >> 16;
const sin = a => SIN[(a - 0x400) & 0xfff];            // lib3d table = cos
let L, scene, A, B, C, S, tgt, D, res44, pal0, pal, fs32;

function tick() {                                       // 0x17513
  S.t++;
  if (S.f80) B.ay = (B.ay - 0xc) & 0xffff;
  if (S.f7f === 1) {
    A.ay = (A.ay - 7) & 0xffff; A.ax = (A.ax + 1) & 0xffff; A.az = (A.az + 3) & 0xffff;
    B.x = Math.min(B.x + 0x307, 0x64000);
    A.x = Math.min(A.x + 0xda2, -0x4b000);
    A.z = Math.min(A.z + 0x1e4d, -0x271000);
  }
  if (S.f7f === 2) { A.ay = (A.ay - 8) & 0xffff; A.ax = (A.ax + 1) & 0xffff; A.az = (A.az + 4) & 0xffff; B.x -= 0x5c1; A.x += 0x2ba; }
}
const tickTo = n => { while (S.t < n) tick(); };

function waves(t) {                                      // 0x17253
  const u = t - 0x1f0;
  B.ax = (sin(u << 6) >> 2) & 0xffff;
  S.wx = sin(u << 7) >> 3; S.wz = SIN[(u << 7) & 0xfff] >> 3;
  S.amp = sin((t - 0x130) << 4) >> 5;
}
function script() {                                      // 0x17084
  const t = S.t;
  const scale = (bp, sh) => { for (let i = 0; i < 768; i++) pal[i] = ((pal0[i] * bp) >> sh) & 255; };
  if (t < 0x40) { S.pal = 1; scale(t, 6); }
  else if (t < 0xa0) {
    if (!S.f7d) { S.pal = 1; pal.set(pal0); S.f7d = 1; }
    else {
      S.pal = 0; const e = t - 0x40;
      B.ay = (Math.trunc(-0x800 * e / 0x60) + 0x800) & 0xffff;
      B.y = Math.trunc(-0x113000 * e / 0x60) + 0x113000;
    }
  } else if (t < 0x130) { S.f80 = 1; S.amp = Math.trunc(-200 * (t - 0xa0) / 0x90) + 200; }
  else if (t < 0x1f0) { S.wx = S.wz = 0; S.amp = sin((t - 0x130) << 4) >> 5; }
  else if (t < 0x2e0) waves(t);
  else if (t < 0x640) { waves(t); S.f7f = 1; }
  else if (t < 0x910) { S.f7f = 2; waves(t); }
  else {
    const bx = 0x98f - t; S.pal = 1;
    if (bx >= 0x7f) return;
    let b = bx; if (b <= 0) { S.end = 1; b = 0; }
    scale(b, 7); S.f7f = 2; waves(t);
  }
}
const bright = d => {                                    // 0x17459 / 0x1748b : +-0x20 on a 16-row band of the env map (dword adds, carries kept)
  if (S.amp >= 0x64 || S.amp <= -0x64) return;
  const o = (S.amp + 0x88) << 8 >> 2;
  for (let i = 0; i < 0x400; i++) fs32[o + i] = (fs32[o + i] + d * 0x20202020) >>> 0;
};

export default {
  name: 'parti',
  resources: [29, 42, 43, 44, 45, 46, 47],
  init(ctx) {
    const r = ctx.res;
    L = new Lib3D(); L.dist = 0x12c; L.shift = 1; L.flags = 0;
    pal0 = new Uint8Array(r(42).subarray(0, 768)); pal = new Uint8Array(768);
    L.gs = new Uint8Array(0x10000); for (let i = 0; i < 0x10000; i++) L.gs[i] = (r(29)[i] >> 1) + 0x60;
    D = new Uint8Array(0x10000); for (let i = 0; i < 0x10000; i++) D[i] = ((r(43)[i] - 4) << 3) & 255;
    L.ds = D;
    L.bg = new Uint8Array(0x10000); L.bg.set(r(47).subarray(0, 64000));
    const b32 = new Uint32Array(L.bg.buffer); for (let i = 0; i < 0x3e80; i++) b32[i] = (b32[i] + 0xe6e6e6e6) >>> 0;
    L.bg.fill(0, 0, 320);
    res44 = r(44).subarray(0, 0x10000); tgt = new Uint8Array(0x10000);
    L.makeEnvMap(RAMP, 2, 0);
    fs32 = new Uint32Array(L.fs.buffer); for (let i = 0; i < 0x4000; i++) fs32[i] = (fs32[i] + 0x20202020) >>> 0;
    scene = null;
    A = L.newObject(parseObject(r(45)), -2048000, 0, -6144000);
    B = L.newObject(parseObject(r(46)), 0, 0x113000, 0xffdc1000 | 0);
    C = parseObject(r(46));
    for (let i = 0; i < B.data.nf; i++) B.data.f[i * 8] = i < 329 ? 0 : 1;      // 0x16f46
    S = { t: 0, pal: 0, f7d: 0, f7e: 0, f7f: 0, f80: 0, end: 0, amp: 0xc8, wx: 0, wz: 0 };
    ctx.vga.vram.fill(0);
  },
  frame(ctx, f) {
    tickTo(ctx.ticksAt ? ctx.ticksAt(f) : f);
    script();
    tickTo(ctx.ticksAt ? ctx.ticksAt(f + 1) : f + 1);     // ticks fire in the vsync wait 0x175e1
    if (S.pal) ctx.vga.pal.set(pal);
    L.flip(ctx.vga.vram);
    { // 0x17342 : wave the 65 vertices 177.. of B from the pristine copy C
      const bv = B.data.v, cv = C.v, bx = i16(S.amp << 4);
      for (let k = 0, i = 177; k < 65; k++, i++) {
        bv[i * 8 + 1] = i16(cv[i * 8 + 1] + bx); bv[i * 8] = i16(cv[i * 8] + S.wx); bv[i * 8 + 2] = i16(cv[i * 8 + 2] + S.wz);
      }
    }
    bright(1);
    if (S.f7f) {                                          // 0x173a1
      tgt.set(res44);
      B.z = 0xffda8000 | 0;
      const o3 = { x: B.x >> 1, y: B.y, z: 0xffda8000 | 0, ax: B.ax, ay: (0x800 - B.ay) & 0xffff, az: B.az, data: B.data };
      L.tgt = tgt; L.mode = 21; L.drawObject(o3, false);
      const fs0 = L.fs; L.fs = tgt; L.mode = 2; L.drawObject(A, false); L.fs = fs0;
    }
    L.mode = 20; L.drawObject(B, false);
    bright(-1);
    return !S.end;
  },
};
