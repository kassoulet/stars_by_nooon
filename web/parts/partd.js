// Part D: morphing 3D object (res 24, 529 verts, 33 key frames) env/bump mapped (mode 15) with an animated texture + palette crossfade. Port of
// 0xa14d (init) / 0xa0ca (loop) / 0xa346 (cleanup), timer callback 0xa4ac, palette+texture script 0xa3c9/0xa530. Notes: re/parts/partd.md
// Script: init when pos > 0x3500, the loop starts when pos > 0x4500 (frame() waits itself), ends by itself after 0x86e frames, palette black then.
import { Lib3D, parseObject } from '../lib3d.js';

const RAMP = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5, 5, 6, 6, 6, 7, 7, 8, 8, 8, 9, 9, 10, 10, 11, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 16, 16, 17, 17, 17, 18, 18, 19, 19, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 27, 27, 28, 28, 29, 30, 30, 31, 32, 32, 33, 34, 34, 35, 36, 37, 37, 38, 39, 40, 41, 42, 42, 43, 44, 45, 47, 48, 49, 50, 52, 53, 55, 58, 63];
const KEYS = [[0, 0, -1310, 120, 1960, 320], [0, 0, -1430, -240, 1700, -60], [0, 0, -1110, -260, 2360, -60], [20, 20, -1290, 300, 2220, 260], [60, 80, -1290, 380, 1780, 0], [60, 80, -1290, -280, 2060, 0]];           // 6 object path keys at 0xa082: x,y,z,ax,ay,az
const ANIM = [0, 0, 0, 1, 0, 0, 0, 5, 1, 0, 0, 0, 5, 1, 2, 3, 7, 1, 3, 1, 5, 7, 4, 2, 1, 6, 4, 8, 1, 4, 5, 8, 5, 0];           // morph key list at 0x9fa0 (indices of extra frames; last = wrap entry)
const s16 = (v) => (v << 16) >> 16;

let L, scene, obj, S, palA, palB, pal, T, tile;     // T = 8 tile frames (0x2000 B each), tile = 256x256 texture (gs = ds)

function buildTiles(r23, r21) {                      // 0xa5c5
  T = new Uint8Array(8 * 0x2000);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 64; x++) { T[y * 64 + x] = r23[y * 256 + x]; T[7 * 0x2000 + y * 64 + x] = r21[y * 256 + x]; }
  for (let i = 1; i < 7; i++) for (let k = 0; k < 0x2000; k++) { const a = T[k]; T[i * 0x2000 + k] = (((s16(((T[7 * 0x2000 + k] - a) << 24 >> 24)) * i) >> 3) + a) & 255; }
}
function setTile(w) {                                // 0xa530 (second half): frame w>>3 repeated 4x horizontally, 2x vertically
  const o = (w >> 3) * 0x2000;
  for (let y = 0; y < 128; y++) for (let k = 0; k < 4; k++) for (let x = 0; x < 64; x++) tile[y * 256 + k * 64 + x] = tile[(y + 128) * 256 + k * 64 + x] = T[o + y * 64 + x];
}
function mix(w) {                                    // 0xa530 (first half): pal = A + ((B-A)*w >> 6)
  for (let i = 0; i < 768; i++) pal[i] = ((((palB[i] - palA[i]) << 24 >> 24) * w) >> 6) + palA[i] & 255;
}
function scaleB(bp) { for (let i = 0; i < 768; i++) pal[i] = (((palB[i] * bp) & 0xffff) >>> 6) & 255; }      // 0xa491

export const _dbg = () => ({ S, obj });
export default {
  name: 'partd',
  resources: [20, 21, 22, 23, 24, 25],
  init(ctx) {
    const r = ctx.res;
    L = new Lib3D();
    palA = new Uint8Array(r(22).subarray(0, 768)); palB = new Uint8Array(r(20).subarray(0, 768)); pal = new Uint8Array(768);
    buildTiles(r(23), r(21));
    tile = new Uint8Array(0x10000); L.gs = tile; L.ds = tile;
    L.bg = new Uint8Array(0x10000); L.bg.set(r(25).subarray(0, 64000));
    L.shift = 3; L.dist = 0x64; L.mode = 15; L.flags = 0;
    L.makeEnvMap(RAMP, 4, 0); L.sqrtTable();
    scene = L.newScene();
    obj = L.newObject(parseObject(r(24)), 0, 0, -1000, 2000, 0, 2000, { keys: ANIM, shift: 6, steps: 63 });
    scene.objs.push(obj);
    S = { t: 0, w: 63, dw: 0, kc: 0, ki: 0, flag: 0, bp: 0, done: 0, wait: 1 };
    ctx.vga.vram.fill(0);
  },
  frame(ctx, f) {
    if (S.wait) { if (ctx.pos() <= 0x4500) return true; S.wait = 0; mix(63); setTile(63); }     // 0xa0e8 at loop start
    const vga = ctx.vga;
    palScript();                                      // 0xa3c9 (t before this frame's tick)
    tick();                                           // vsync -> callback 0xa4ac
    if (S.flag) vga.pal.set(pal);
    L.flip(vga.vram);
    objPath();                                        // 0xa656
    L.render(scene);
    L.morph(obj);                                     // 0x78ffe
    return !S.done;
  },
};

function palScript() {
  const t = S.t;
  if (t < 0x40) { S.flag = 1; scaleB(t); }
  else if (t < 0x437) S.flag = 0;
  else if (t < 0x82e) { S.flag = 1; if (S.dw === 0) S.dw = -1; mix(S.w); setTile(S.w); }
  else {
    S.flag = 1; setTile(S.w);
    let bx = 0x3f - (t - 0x82e); if (bx > 0x3f) bx = 0x3f;
    if (bx <= 0) { bx = 0; S.done = 1; }
    scaleB(bx);
  }
}
function tick() {                                     // 0xa4ac
  S.t++;
  S.w += S.dw; if (S.w === 0x3f || S.w === 0) S.dw = -S.dw;
  L.advanceAnim(obj, 0x21);
  if (++S.kc >= 0x152) { S.kc = 0; if (++S.ki > 5) S.ki = 0; }
}
function objPath() {                                  // 0xa656
  const k0 = KEYS[S.ki], k1 = KEYS[S.ki + 1 > 5 ? 0 : S.ki + 1], w = S.kc;
  const q = (j) => s16(Math.trunc(s16(k1[j] - k0[j]) * w / 0x152) + k0[j]);
  obj.x = q(0); obj.y = q(1); obj.z = q(2); obj.ax = q(3) & 0xffff; obj.ay = q(4) & 0xffff; obj.az = q(5) & 0xffff;
}
