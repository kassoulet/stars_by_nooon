// STARS terrain: voxel heightfield rendered in "polar" form (256 rays x 191 depth buffer) remapped to the screen. See re/parts/terrain.md
// Original: init 0x1064, loop 0x11e8 (callback 0xf85 @70Hz), cleanup 0x110d. Loop ends when music order > 0x44.
const SIN = new Int32Array(5120);                       // image 0xa740 = round(65528*sin), cos(i) = SIN[i+1024]
for (let i = 0; i < 5120; i++) SIN[i] = Math.round(65528 * Math.sin(i * 2 * Math.PI / 4096));

let H, C, PAL, LUT, BUF, MAP, T, st;

function buildLut() {                                    // 0x10d6: LUT[row*256+h] = 190 - min(189, (0x2f4+14h)/(row+9))
  LUT = new Uint8Array(65536);
  for (let j = 0, o = 0; j < 211; j++) for (let k = 0; k < 256; k++) LUT[o++] = 0xbe - Math.min(0xbd, ((0x2f4 + 14 * k) / (j + 9)) | 0);
}
function buildMap() {                                    // 0x136a: screen pixel -> (ray<<8 | 190-r) ; first writer wins
  MAP = new Uint16Array(64000);
  for (let a = 0; a < 4096; a++) {
    const cs = SIN[a + 1024], sn = SIN[a], dl = a >> 4;
    let x = 0xa00000, y = 0x640000;
    for (let cl = 0xbe; cl >= 0; cl--) {
      const p = (y >> 16) * 320 + (x >> 16);
      if (MAP[p] === 0) MAP[p] = (dl << 8) | cl;
      x -= cs; if (x >>> 0 >= 0x1400000) break;
      y += sn; if (y >>> 0 >= 0xc80000) break;
    }
  }
}
function setPal(vga, L) { for (let i = 0; i < 768; i++) vga.pal[i] = Math.min(63, ((PAL[i] * L) >> 8) & 255); }

function drawBuf() {                                     // 0x1261: 256 vertical "rays" into BUF[ray*256 + y]
  for (let r = 0; r < 256; r++) BUF.fill(0, r * 256 + 0xa9, r * 256 + 0xa9 + 24);
  let dh = (st.cb8 >> 8) & 255, dl = (st.cba >> 8) & 255;
  for (let ray = 0; ray < 256; ray++) {
    let dx = (dh << 8) | dl, o = ray * 256, ch = 0;
    for (let n = 0, bh = 0; bh < 0xd2; n++, bh += 2) {
      const cl = LUT[(bh << 8) | H[dx]];
      if (cl > ch) { BUF.fill(C[dx], o, o + cl - ch); o += cl - ch; ch = cl; }
      dx = (dx + T[n]) & 0xffff;
    }
    dh = (dh + 1) & 255;
  }
}
function buildTable() {                                  // 0x1158 + 0x11ce
  let e = st.ec6 | 0;
  for (let i = 0; i < 256; i++) { T[i] = (((SIN[e & 0xfff] >> 10) << 8) + i) & 0xffff; e = (e + st.ed6) | 0; }
  for (let i = 255; i > 0; i--) T[i] = (T[i] - T[i - 1]) & 0xffff;
}

export default {
  name: 'terrain',
  resources: [2, 3, 4],
  get state() { return st; },                          // debug
  init(ctx) {
    H = ctx.res(2); C = ctx.res(3); PAL = ctx.res(4).subarray(0, 768);
    BUF = new Uint8Array(65536); T = new Uint16Array(256);
    buildLut(); buildMap();
    st = { ec6: 0, eca: 0, ed6: 0, cb8: 0, cba: 0, cbc: 0, cbe: 0x40, f6d: 0, L: 0, step: 1, fc: 0x100, ece: 0, ed2: 0, eda: 0, ede: 0 };
    ctx.vga.pal.fill(0); ctx.vga.vram.fill(0);
  },
  // ctx.pos() = (order<<8)|row; script must start this part when pos > 0x3500 (original waits there after loading)
  frame(ctx, f) {
    const vga = ctx.vga, pos = ctx.pos(), order = pos >> 8, row = pos & 255;
    setPal(vga, st.L);                                   // palette written (and vsync) before the timer tick of this frame
    // timer callback 0xf85
    if (st.fc) { st.L += st.step; st.fc--; }
    st.ec6 = (st.ec6 + st.eca) | 0;
    st.cba = (st.cba + st.cbe) & 0xffff; st.cb8 = (st.cb8 + st.cbc) & 0xffff;
    st.f6d++;
    if (st.step !== -1 && order >= 0x43) { st.step = -1; st.fc = 0x100; }
    if (order === 0x3b && row === 0 && st.eda === 0) { st.eda = 0x14; st.ede = 1; }
    if (order === 0x3d && row === 0 && st.ece === 0) { st.ece = 0x1e; st.ed2 = 1; }
    if ((st.f6d & 3) === 0) {
      if (st.ece) { st.ece--; st.eca += st.ed2; }
      if (st.eda) { st.eda--; st.ed6 += st.ede; }
    }
    // main loop: event table (frames 0..0x100: [cbe] += 1)
    if (st.f6d <= 0x100) st.cbe += 1;
    buildTable(); drawBuf();
    const v = vga.vram; for (let i = 0; i < 64000; i++) v[i] = BUF[MAP[i]];
    if (order > 0x44) { v.fill(0); return false; }       // 0x4abfe (callback off) + 0x4a84e (clear VRAM); palette is black (L=0) by then
    return true;
  },
};
