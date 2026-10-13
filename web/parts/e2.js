// E2: 3D scene (68 flat env-mapped objects, mode 3) flying through a camera path over a background picture. Port of 0x11d8e (init) / 0x11e7f (loop) / 0x11f48 (cleanup),
// timer callback 0x12136, camera 0x121b4, object morph 0x122d7, palette script 0x11fa1. Notes: re/parts/e2.md
import { Lib3D, parseObject, SIN } from '../lib3d.js';

const CAM = [[230, -110, 340, -380, 180, 60], [230, -110, 340, -10, 180, 60], [650, -120, 600, 130, 540, 60], [280, -60, 670, 0, 290, 0], [370, -340, 760, 300, 340, 0], [120, 10, 330, 310, 290, 0], [-280, 250, 330, -250, -470, 0], [-700, -10, 550, 0, -570, 60], [-570, -20, -120, 0, -570, 60]];      // 9 key frames at 0x11d12: x,y,z,a,b,c
const OBJ = Int16Array.from([-164, -101, -49, 0, 0, 0, 163, -101, -49, 0, 0, 0, 110, -61, 5, 0, 0, 0, -111, -61, 5, 0, 0, 0, 54, -86, 227, 0, 0, 0, -46, -89, 234, 0, 0, 0, 0, -16, 184, 0, 0, 200, -154, -133, -49, 0, 0, -261, 153, -133, -49, 0, 0, 261, 108, -64, 5, 0, 0, 102, -109, -64, 5, 0, 0, -68, 58, -86, 227, 0, -100, 0, -47, -89, 234, 0, 100, 0, 0, -16, 184, 200, 0, -100, -164, -101, -49, 0, 0, 0, 163, -101, -49, 0, 0, 0, 110, -61, 5, 0, 0, 0, -111, -61, 5, 0, 0, 0, 62, -86, 227, 0, -200, 0, -48, -89, 234, 0, 200, 0, 0, -16, 184, 400, 0, -200, -154, -133, -49, 0, 0, -261, 153, -133, -49, 0, 0, 261, 108, -64, 5, 0, 0, 102, -109, -64, 5, 0, 0, -68, 58, -86, 227, 0, -100, 0, -47, -89, 234, 0, 100, 0, 0, -16, 184, 200, 0, -100]);   // 4 key sets x 7 objects x (x,y,z,ax,ay,az) at 0x11bbe
const IDX = [65, 34, 35, 66, 37, 38, 42];                // 0x11ba2: which of the 68 objects are animated
const s16 = (v) => (v << 16) >> 16;

let L, scene, objs, pal26, pal, S, logo, bgres;

function drawLogo() {            // 0x12102: 80x36 sprite (res 32) on the back buffer at (256,159); pixel >= 0x50 transparent
  let o = 0xcbc0, s = 0;
  for (let y = 0; y < 0x24; y++, o += 0xf0) for (let x = 0; x < 0x50; x++, o++) { const c = logo[s++]; if (c < 0x50) L.back[o] = c; }
}
function fadeWhite(bp) { for (let i = 0; i < 768; i++) pal[i] = ((((pal26[i] - 0x3f) * bp) & 0xffff) >>> 6) + 0x3f & 255; }     // 0x120df
function fadeScale(bp) { for (let i = 0; i < 768; i++) pal[i] = (((pal26[i] * bp) & 0xffff) >>> 6) & 255; }                      // 0x120c4

export default {
  name: 'e2',
  resources: [26, 27, 28, 29, 32],
  init(ctx) {
    const r = ctx.res;
    L = new Lib3D();
    pal26 = new Uint8Array(r(26).subarray(0, 768)); pal26[0] = pal26[1] = pal26[2] = 0;       // [0x11b58] = 0
    pal = new Uint8Array(768);
    logo = r(32);
    L.bg = new Uint8Array(0x10000); L.bg.set(r(27).subarray(0, 64000));
    L.fs = new Uint8Array(0x10000); L.fs.set(r(29).subarray(0, 0x10000));
    L.dist = 0x1e; L.shift = 1; L.mode = 3; L.flags = 1;
    scene = L.newScene(); objs = [];
    const f = r(28), dv = new DataView(f.buffer, f.byteOffset, f.byteLength), n = dv.getUint16(3, true);
    for (let i = 0; i < n; i++) {
      const b = 8 + i * 0x20;
      const o = L.newObject(parseObject(f.subarray(dv.getInt32(b + 0x12, true), f.length)), dv.getInt32(b, true), dv.getInt32(b + 4, true), dv.getInt32(b + 8, true), dv.getInt16(b + 12, true), dv.getInt16(b + 14, true), dv.getInt16(b + 16, true));
      scene.objs.push(o); objs.push(o);
    }
    S = { t: 0, w: 0, set: 0, kw: 0, key: 0, kk: 0, wr: 0, flag: 0, started: 0, bp: 0, logoCnt: 0, done: 0 };
    tick();                       // one timer tick elapses during the first vsync wait (before t is cleared)
    S.t = 0;
    ctx.vga.vram.set(L.bg.subarray(0, 64000));
  },
  frame(ctx, f) {
    const vga = ctx.vga;
    palScript(ctx);               // 0x11fa1 (uses t before this frame's vsync)
    tick();                       // vsync -> ISR 0x12136
    if (S.flag) vga.pal.set(pal);
    camera(); objectsMorph();
    L.flip(vga.vram);
    L.render(scene);
    return !S.done;
  },
};

function tick() {                 // 0x12136
  S.t++;
  if (++S.w >= 8) { S.set++; S.w = 0; if (S.set >= 4) S.set = 0; }
  if (++S.kw >= 0x8c) { S.kw = 0; S.key++; if (S.key > 8) S.key = 0; }
}

function palScript(ctx) {         // 0x11fa1
  const t = S.t;
  if (t < 0x10) { S.flag = 1; S.bp = Math.min(t * 4, 0x3f); fadeWhite(S.bp); }
  else if (t < 0x38e) {
    if (!S.started) { S.started = 1; S.bp = 0x3f; pal.set(pal26); S.flag = 1; }
    else {
      S.flag = 0;
      if (S.key > 3 && S.key < 7) { if (++S.logoCnt === 0xe) S.logoCnt = 0; if (S.logoCnt < 7) drawLogo(); }
    }
  } else {
    S.flag = 1;
    let bx = ((0x3ae - t) >> 1) + 0x3f; if (bx > 0x3f) bx = 0x3f; if (bx <= 0) bx = 0;
    S.done = 1; fadeScale(bx);
  }
}

function camera() {               // 0x121b4 (+ wobble 0x12278)
  const k0 = CAM[S.key], k1 = CAM[S.key + 1 > 8 ? 0 : S.key + 1], w = S.kw, c = L.cam;
  const q = (j) => s16(Math.trunc(s16(k1[j] - k0[j]) * w / 0x8c) + k0[j]);
  c.x = q(0); c.y = q(1); c.z = q(2); c.a = q(3) & 0xffff; c.b = q(4) & 0xffff; c.c = q(5) & 0xffff;
  const e = SIN[((S.t << 6) - 0x400) & 0xfff];
  L.rot.a = (0x64 - (e >> 3)) & 0xffff;
  L.rot.b = (0x190 + (e >> 4) + (c.b - 0x122)) & 0xffff;
  c.y = (c.y + (e >> 6)) | 0;
}

function objectsMorph() {         // 0x122d7
  const a = S.set * 42, b = (S.set + 1 & 3) * 42, w = S.w;
  for (let i = 0; i < 7; i++) {
    const o = objs[IDX[i]], p = i * 6, q = (j) => s16(((s16(OBJ[b + p + j] - OBJ[a + p + j]) * w) >> 3) + OBJ[a + p + j]);
    o.x = q(0); o.y = q(1); o.z = q(2); o.ax = q(3) & 0xffff; o.ay = q(4) & 0xffff; o.az = q(5) & 0xffff;
  }
}
