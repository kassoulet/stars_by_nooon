// STARS intro (main script 0xf0..0x11f: init 0x5b84, loop 0x5a92, cleanup 0x5b8f). See re/parts/intro.md.
// The original is a blocking script synced on the music position; ported 1:1 as a generator, one `yield` = one vsync (70 Hz).
const SIN = new Int32Array(5120);                                   // sine table at image 0xa740 (16.16, 65528 amplitude), 1.25 periods
for (let i = 0; i < 5120; i++) SIN[i] = Math.round(65528 * Math.sin(2 * Math.PI * i / 4096));
// flower descriptors at 0x542a/0x5437/0x5444/0x5451: res6 image, res5 image, shift, step (bytes in SIN) -- the [4]==0 order
const DESC = [{ n6: 0, n5: 1, cl: 12, step: 12 }, { n6: 3, n5: 3, cl: 12, step: 52 }, { n6: 2, n5: 0, cl: 11, step: 12 }, { n6: 1, n5: 2, cl: 11, step: 16 }];
const TICK_OFF = 0;                                                 // ISR ticks seen by the main loop = f + TICK_OFF (calibrated vs harness)

export default {
  name: 'intro',
  resources: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  init(ctx) {
    const { vga } = ctx, res = ctx.res, vram = vga.vram, pal = vga.pal;
    const r5 = res(5), r6 = res(6), r7 = res(7), tex = r7.subarray(192, 192 + 65536);
    const base = new Uint8Array(768);                               // 0x5477: flower palette (idx 1..15 names, 0x10..0x4f petals, 0x60..0x6f names)
    base.set(r5.subarray(0, 45), 3); base.set(r6.subarray(0, 48), 0x60 * 3); base.set(r7.subarray(0, 192), 0x10 * 3);
    const drawNames = (dst, d) => {                                 // 0x5e63 (0x5dbb + 0x5df4): non-zero pixels only
      let s = 0x2d + d.n5 * 0x1440;
      for (let y = 0; y < 36; y++) for (let x = 0; x < 144; x++) { const v = r5[s++]; if (v) dst[150 * 320 + 88 + y * 320 + x] = v; }
      s = 0x30 + d.n6 * 0x2500;
      for (let y = 0; y < 74; y++) for (let x = 0; x < 128; x++) { const v = r6[s++]; if (v) dst[60 * 320 + 96 + y * 320 + x] = v; }
    };
    for (const d of DESC) {                                         // 0x5c97: polar map of the free pixels (rays from (160,100))
      const spr = new Uint8Array(64000); drawNames(spr, d);
      const tbl = new Uint16Array(64000).fill(0xffff), rad = new Int32Array(4096);
      for (let i = 0, b = 0; i < 4096; i++, b += d.step) rad[i] = (SIN[(b & 0x3ffc) >> 2] + 0x10000) >> d.cl;
      for (let a = 0; a < 4096; a++) {
        const sx = SIN[a], cx = SIN[a + 1024], e0 = rad[a] + 1;
        let bp = (((a * 32) & 0xff00) | (e0 & 255)), y = 0x640000, x = 0xa00000;
        for (let k = 100 - e0; k > 0; k--) {
          y = (y + sx) >>> 0; if (y >= 0xc80000) break;
          x = (x + cx) >>> 0; if (x >= 0x1400000) break;
          const p = (y >>> 16) * 320 + (x >>> 16);
          if (spr[p] === 0) tbl[p] = bp;
          bp = (bp + 1) & 0xffff;
        }
      }
      let n = 0; for (let p = 1; p < 64000; p++) if (tbl[p] !== 0xffff) n++;
      d.pos = new Int32Array(n); d.w = new Uint16Array(n);
      for (let p = 1, i = 0; p < 64000; p++) if (tbl[p] !== 0xffff) { d.pos[i] = p; d.w[i++] = tbl[p]; }
    }
    const ph = [0, 0, 0x1000, 0x2000, 0x3000];                      // 0x5a7a,7e,82,86,8a palette pulse phases (+0x190 per call, persistent)
    let bl = 0, bstep = 0, bcnt = 0;                                // 0x5a77/78/79 flower brightness (0..0x80)
    const flowerPal = () => {                                       // 0x61b1 + 0x615b
      for (let i = 0; i < 5; i++) ph[i] += 0x190;
      const o = new Uint8Array(0x210);
      o.set(base.subarray(0, 0x150));
      const sc = (g, p) => { const m = ((SIN[(p & 0x3ffc) >> 2] + 0x30000) >> 10) & 255; for (let k = g * 0x30; k < g * 0x30 + 0x30; k++) o[k] = (base[k] * m) >> 8; };
      for (let g = 0; g < 4; g++) sc(1 + g, ph[1 + g]);
      sc(6, ph[0]);
      const b = bl; if (bcnt) { bl = (bl + bstep) & 255; bcnt--; }
      for (let i = 0; i < 0x210; i++) pal[i] = ((o[i] * b) >> 7) & 255;
    };
    let T = 0;                                                      // ISR tick count (updated per frame)
    const row = () => ctx.pos() & 255, wait = th => ctx.pos() > th;
    const screen = function* (d) {                                  // 0x5c68
      bl = 0; bstep = 2; bcnt = 0x40; flowerPal(); vram.fill(0); drawNames(vram, d);
      const T0 = T;
      for (;;) {
        yield;
        flowerPal();
        const w = d.w, pp = d.pos;
        // [5412] is computed at the end of the previous pass from the then-current [5410]; same value one tick earlier
        const si2 = (((2 * T) & 255) << 8) | (w5412 & 255);
        for (let i = 0; i < pp.length; i++) vram[pp[i]] = tex[(w[i] + si2) & 0xffff];
        w5412 = (SIN[((2 * T << 5) & 0xfff)] + 0x10000) >> 12;
        if (bstep >= 0 && bstep < 128 && T - T0 >= 0x122) { bcnt = 0x40; bstep = 0xfe; }
        if (row() > 0x3e) break;
      }
    };
    let w5412 = 0;
    const black = () => pal.fill(0);
    const fade = function* (img, step, cnt, st) {                   // 0x17e96 / 0x4a7b0 / 0x4a80b
      let flag = true;
      const show = function* () {
        if (!(flag || cnt)) return; flag = false;
        const t = new Uint8Array(768); for (let i = 0; i < 768; i++) t[i] = Math.min(63, (img[i] * st.b & 0xffff) >> 8);
        yield; pal.set(t);
      };
      for (;;) {
        yield* show();
        if (cnt) { st.b += step; cnt--; flag = true; }
        if (!cnt) break;
      }
      yield* show();
    };
    const picture = function* (n, step, cnt, lim) {                 // 0x627e (step 2, 0x80, row>0x2e) / 0x6251 (4, 0x40, row>0x30)
      const r = res(n), st = { b: 0 }; black(); vram.set(r.subarray(768, 768 + 64000));
      yield* fade(r, step, cnt, st);
      while (row() <= lim) yield;
      yield* fade(r, -step, cnt, st);
    };
    const pic1 = n => picture(n, 2, 0x80, 0x2e), pic2 = n => picture(n, 4, 0x40, 0x30);
    const main = function* () {                                     // 0x5a92
      black();
      while (!wait(0)) yield;
      yield* pic1(9);
      while (!wait(0x100)) yield; yield* pic1(8);
      const seq = [[0x200, 0], [0x300, 11], [0x400, 1], [0x500, 12], [0x600, 2], [0x700, 13], [0x800, 3]];
      for (const [th, k] of seq) { while (!wait(th)) yield; yield* (k > 10 ? pic2(k) : screen(DESC[k])); }
      while (!wait(0x900)) yield; yield* pic1(14);
      while (!wait(0xa00)) yield; yield* pic1(10);
      black(); vram.fill(0);                                        // 0x5b74.. ; then 0x5b8f frees (nothing visible)
    };
    const gen = main();
    this.step = f => { T = ctx.ticks ? ctx.ticks() : f + TICK_OFF; return !gen.next().done; };   // ctx.ticks: test hook only
  },
  frame(ctx, f) { return this.step(f); },
};
