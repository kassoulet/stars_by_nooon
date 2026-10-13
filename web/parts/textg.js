// textg: 'NOOON / BRING YOUR BEAUTY FAMILY' feedback-blur text part (orig. init 0x13388, loops 0x133ad / 0x133f1, cleanup 0x1339d).
// Two variants, same code: ctx.variant = 1 (0x133ad, ends when order > 0x68) or 2 (0x133f1, ends when order > 0x86). Default 1.
// Named exports `textg1` / `textg2` are the same part with the variant fixed (use if script.js can't pass ctx.variant).
const T1 = [[25685,0,150,24],[25685,0,150,24],[25685,0,150,24],[25685,0,1,1],[25685,0,150,24],[25685,0,150,24],[25685,0,1,1],[25685,0,150,24],[25685,0,1,1],[25685,0,150,24],[25685,0,1,1],[25685,0,150,24],[25685,0,1,1]];
const T2 = [[26005,0,150,24],[26005,0,150,24],[26005,0,1,1],[26005,0,1,1],[27296,7680,128,24],[27308,15360,104,24],[27267,22720,166,24],[26005,0,1,1],[27296,7680,128,24],[27308,15360,104,24],[27268,29760,162,24],[26005,0,1,1],[26005,0,1,1],[26005,0,150,24],[26005,0,1,1],[26005,0,1,1],[26005,0,150,24]];
const P1 = [0,5,14,0,6,15,0,7,16,0,8,17,1,10,19,1,11,20,1,13,21,2,14,22,2,16,23,3,17,25,4,19,26,5,21,27,6,23,28,6,24,30,7,26,31,8,28,32,9,30,33,10,32,34,12,34,36,14,36,38,17,38,40,20,40,42,24,42,44,27,45,46,31,47,48,35,49,50,39,51,52,43,53,54,48,56,56,52,58,58,57,60,61,63,63,63];
const P2 = [0,5,14,1,2,13,4,2,13,8,4,13,11,6,13,13,8,13,13,10,12,15,11,13,17,13,15,19,15,17,21,17,19,23,18,21,24,19,23,26,22,25,27,23,27,28,26,29,30,28,31,33,29,33,35,31,35,38,33,36,40,34,36,43,36,37,45,38,38,47,40,40,49,43,41,51,46,43,53,48,46,55,51,49,57,54,52,59,57,55,61,60,59,63,63,63];
// sin/cos tables of the original (0xa740/0xb740): round(65528*sin(2pi i/4096)), cos = same shifted by 1024
const SIN = new Int32Array(4096), COS = new Int32Array(4096);
for (let i = 0; i < 4096; i++) { SIN[i] = Math.round(65528 * Math.sin(2 * Math.PI * i / 4096)); COS[i] = Math.round(65528 * Math.cos(2 * Math.PI * i / 4096)); }
const ROW = new Int32Array(200), COL = new Int32Array(80);   // zoom 120/128 mapping (tables 0x12d14 / 0x12814)
for (let y = 0; y < 200; y++) ROW[y] = (((y - 100) * 120) >> 7) + 100;
for (let k = 0; k < 80; k++) COL[k] = (((k * 4 - 160) * 120 + 64) >> 7) + 160;

function make(defVariant) {
  let s;
  const rnd = n => { let e = (s.seed ^ 0x78d47e5d) >>> 0; e = Math.imul(e, 0xd413d473) >>> 0; e = ((e << 18) | (e >>> 14)) >>> 0; s.seed = e; return e % n; };
  const fill = (v, n) => { for (let i = 0; i < n; i++) s.cur[s.e + i] = v; s.e += n; };   // stosb run
  const disc = (v, rows) => { s.e -= 958; for (const [n, a] of rows) { fill(v, n); s.e += a; } };  // dot stamps 0x138ff / 0x138be
  const dotS = v => disc(v, [[3, 316], [5, 315], [5, 316], [3, 0]]);
  const dotB = v => disc(v, [[3, 316], [5, 314], [7, 313], [7, 313], [7, 314], [5, 315], [3, 0]]);
  const rd = (b, p) => (b[p] | b[p + 1] << 8 | b[p + 2] << 16 | b[p + 3] << 24) >>> 0;
  function draw() {             // 0x135c5 (noise dots + sprite) then 0x13579 (blur/zoom)
    const c = s.cur;
    for (let i = 0; i < 10; i++) {
      let e = (rnd(100) + 50) * 320; e += rnd(160) + 0x50; s.e = e; dotS(rnd(256) & 1 ? 0 : 0x1f);
    }
    rnd(4000);                  // original draws nothing in the 25% branch (dead code) but consumes the random number
    if (s.cd !== 0) {
      s.cd -= s.t539;
      if (s.cd < 0) { s.cd = 0; s.idx++; if (s.idx >= (s.v === 2 ? 17 : 13)) s.idx = 0; }
      s.t539 = 0;
      const [d, so, w, h] = (s.v === 2 ? T2 : T1)[s.idx];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = s.res[so + y * 320 + x]; if (p) c[d + y * 320 + x] = p; }
    }
    if (s.v === 2) {            // four orbiting squares (0x13783)
      const t = s.c44;
      for (const [m, ra, ca] of [[t << 4, 10, 10], [t << 6, 12, 10], [-t << 2, 11, 10], [t << 7, 11, 12]]) {
        const i = m & 0xfff; s.e = ((SIN[i] >> ra) + 100) * 320 + (COS_B(i) >> ca) + 160; dotB(0x1f);
      }
    }
    const o = s.oth, vr = s.vga.vram;
    for (let y = 0; y < 200; y++) {
      const r = ROW[y] * 320;
      for (let k = 0; k < 80; k++) {
        const x = COL[k], p = r + x;
        const q = (((rd(c, p - 1) + rd(c, p + 1) + rd(c, p - 320) + rd(c, p + 320)) >>> 0) >>> 2) & 0x1f1f1f1f;
        const d = y * 320 + k * 4;
        vr[d] = o[d] = q & 255; vr[d + 1] = o[d + 1] = (q >>> 8) & 255; vr[d + 2] = o[d + 2] = (q >>> 16) & 255; vr[d + 3] = o[d + 3] = q >>> 24;
      }
    }
    s.cur = o; s.oth = c;
  }
  function tick(order, row) {   // timer callback (70 Hz): 0x1353d + 0x134e3
    s.c44++; s.t539++;
    if (s.cnt) { s.scale += s.step; s.cnt--; s.flag = 1; }
    if (s.step >= 0 && order >= s.limit) { s.step = -4; s.cnt = 0x40; }
    if (row === 0 || row === 0x1e) s.cd = 0x14;
  }
  const COS_B = i => COS[i];    // original table 0xb740 (cos)
  return {
    name: defVariant === 2 ? 'textg2' : 'textg', resources: [58],
    init(ctx) {
      const v = ctx.variant || defVariant;
      s = { v, vga: ctx.vga, res: ctx.res(58), seed: ctx.seed ?? 0x7ea9, cur: new Uint8Array(64400), oth: new Uint8Array(64400),
        limit: v === 2 ? 0x86 : 0x68, pal: v === 2 ? P2 : P1, scale: 0, step: 4, cnt: 0x40, flag: 0, cd: 0x14, idx: 0, t539: 0, c44: 0 };
      if (v === 2) ctx.vga.pal.fill(0);   // 0x4a76c
    },
    frame(ctx, f) {
      const pos = ctx.pos(), order = pos >> 8, row = pos & 255;
      for (let n = ctx.ticksAt ? ctx.ticksAt(f) : 1; n > 0; n--) tick(order, row);
      // main loop iteration: palette (0x4a7b0) then draw
      if (s.flag || s.cnt) {
        s.flag = 0; const p = ctx.vga.pal;
        for (let i = 0; i < 96; i++) p[i] = Math.min(63, ((s.pal[i] * s.scale) >> 8) & 255);
      }
      draw();
      return order <= s.limit;
    },
  };
}
export const textg1 = make(1), textg2 = make(2);
export default make(1);
