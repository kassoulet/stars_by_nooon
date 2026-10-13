// Part B: environment-mapped spiky 3D object over a dark tunnel. Port of 0x65ef (init) / 0x6534 (loop) / 0x6905 (70 Hz timer callback) / 0x6791 (fade script).
// Uses web/lib3d.js (shading mode 15). Timeline in ticks of 70 Hz (t = [0x6518]): 0-0x3f fade in, ... 0x82e-0x92a fade out, ends by itself (~2346 ticks = 33.5 s).
import { Lib3D, parseObject, SIN } from '../lib3d.js';

const RAMP = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,3,3,4,4,5,6,6,7,7,8,9,9,10,10,11,12,12,13,14,14,15,16,16,17,18,18,19,20,20,21,22,23,23,24,25,26,26,27,28,29,30,30,31,32,33,34,35,35,36,37,38,39,40,41,42,43,44,45,47,48,49,50,52,53,55,57,59,63];
const mulsh = (a, b) => Math.floor(a * b / 1024) | 0;

let L, scene, obj, S, pal0, pal;       // pal0 = res 15 (6-bit), pal = faded copy ([0x6390])

function calcPos() {                    // 0x6888
  const p = S.p;
  obj.y = mulsh(SIN[(p << 1) & 0xfff], 0xb4);
  obj.z = mulsh(SIN[p & 0xfff], 0x17c) - 810;
  obj.x = mulsh(SIN[(p - 0x400) & 0xfff], 0x46);
}

export const _lib = () => L; export const _dbg = () => ({ L, pal, S });
export default {
  name: 'partb',
  resources: [15, 16, 17, 18, 19],
  init(ctx) {
    L = new Lib3D();
    const r = ctx.res;
    pal0 = new Uint8Array(r(15).subarray(0, 768)); pal = new Uint8Array(768);
    L.gs = new Uint8Array(0x10000); L.gs.set(r(16).subarray(0, 0x10000));
    L.ds = new Uint8Array(0x10000); L.ds.set(r(17).subarray(0, 0x10000));
    for (let i = 0; i < 0x10000; i++) L.ds[i] = ((L.ds[i] - 8) << 1) & 255;      // sub al,8 ; shl al,1 on every byte
    L.bg = new Uint8Array(0x10000); L.bg.set(r(19).subarray(0, 64000));
    L.makeEnvMap(RAMP, 0, 0);
    for (let i = 0; i < 0x10000; i++) if (L.fs[i] === 0) L.fs[i] += 8;
    L.sqrtTable();                                                            // 0x7871c again (back buffer = sqrt table, flipped to vram on the first frame)
    L.dist = 0x50; L.shift = 1; L.mode = 15; L.flags = 0;
    scene = L.newScene();
    obj = L.newObject(parseObject(r(18)));
    scene.objs.push(obj);
    // 0x6534
    S = { t: 0, phase: 0, palOn: 0, stop: 0, cnt: 0, p: 0, fade: 0 };
    calcPos();
    ctx.vga.vram.fill(0);
  },
  frame(ctx, f) {
    // --- timer callback 0x6905 (one tick per frame)
    S.t++;
    L.rot.a = (L.rot.a + 0x21) & 0xffff; obj.ax = (obj.ax + 2) & 0xffff; obj.ay = (obj.ay + 3) & 0xffff; obj.az = (obj.az + 4) & 0xffff;
    if (S.phase >= 4) { obj.ay = (obj.ay + 7) & 0xffff; L.rot.a = (L.rot.a + 0x14) & 0xffff; }
    if (S.cnt !== 0) { S.p = (S.p + 4) & 0xffff; calcPos(); }
    // --- main loop body: phase script 0x6791
    const t = S.t;
    if (t < 0x40) { S.phase = 1; S.palOn = 1; S.fade = t; S.cnt = 0; }
    else if (t < 0x270) { S.phase = 2; S.palOn = 0; }
    else if (t < 0x45a) { S.phase = 3; S.palOn = 0; S.cnt = (S.cnt + 1) & 255; }
    else if (t < 0x644) { S.phase = 4; S.palOn = 0; S.cnt = (S.cnt + 1) & 255; }
    else if (t < 0x932) {
      S.phase = 5;
      let b = 0x3f - ((t - 0x82e) >> 2); if (b > 0x3f) b = 0x3f;
      if (b <= 0) { b = 0; S.stop = 1; }
      S.fade = b; S.palOn = 1; S.cnt = (S.cnt + 1) & 255;
    }
    if (S.palOn) {                                                           // 0x6861 + 0x696b
      for (let i = 0; i < 768; i++) pal[i] = ((pal0[i] * S.fade) & 0xffff) >> 6;
      ctx.vga.pal.set(pal);
    }
    L.flip(ctx.vga.vram);                                                    // 0x78905
    L.render(scene);                                                         // 0x79483
    if (S.stop === 1) return false;
    if ((ctx.pos() >> 8) === 0x27) return false;
    return true;
  },
};
