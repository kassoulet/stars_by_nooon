// e1: tunnel/flow effect (orig. main 0x11f..0x134: init 0x1241b, loop 0x126ae, cleanup 0x123d8). See re/parts/e1.md
// Resources: 30 = 256x256 texture (+10 pad), 31 = palette (768), 33 = sine table (2200 x int16).
// Original runs the loop from the moment music pos > 0x0b00; frame() waits for that itself.
const END_T = 0x208;               // loop ends when timer t >= 0x208 (520 ticks)

let tex, tex2, pal0, tbl, started, f0, t, A, flag4;
const s16 = v => (v << 16) >> 16;

function buildTable(sin) {
  const occ = new Uint8Array(65536);            // plotted flags (gs buffer)
  tbl = new Uint16Array(65536);                 // word per pixel: lo=depth byte, hi=angle byte
  for (let m = 1; m < 199; m++) {
    const rad = ((Math.trunc(0x1400 / (m + 0x13))) << 8) & 0xffff, n = m + 1;   // radius is m+1 (counter incremented before the call)
    let acc = 0;
    for (let bx = 0; bx < 0x898; bx++, acc = (acc + 0x1dca) >>> 0) {
      const y = (((n * sin[bx]) >> 14) + 0x64) & 0xffff;
      if (y >= 200) continue;
      let i = bx + 0x226; if (i >= 0x898) i -= 0x898;
      const x = (((n * (-sin[i] << 16 >> 16)) >> 14) + 0xa0) & 0xffff;
      if (x >= 320) continue;
      const p = y * 320 + x;
      if (occ[p]) continue;
      occ[p]++;
      const v = ((acc >>> 16) + rad) & 0xffff;
      tbl[p] = ((v & 0xff) << 8) | (v >> 8);
    }
  }
}

function render(vram) {
  let si = ((((s16(A[1] >> 10) >> 1) << 8) & 0xffff) + (A[0] >> 10)) & 0xffff;
  let di = (((((s16(A[3] >> 10) >> 1) << 8) & 0xffff) + (A[2] >> 10)) << 1) & 0xffff;
  for (let p = 320; p < 320 + 0x3d90 * 4; p += 4) {
    const w0 = tbl[p], w1 = tbl[p + 1], w2 = tbl[p + 2], w3 = tbl[p + 3];
    const pair = (a, b, bx) => {
      bx &= 0xfffe;
      const o = (bx + di) & 0xffff;
      return ((tex[(a + si) & 0xffff] | tex[(b + si) & 0xffff] << 8) + (tex2[o] | tex2[o + 1] << 8)) & 0xffff;
    };
    const hi = pair(w2, w3, w3), lo = pair(w0, w1, w1);
    vram[p] = lo & 255; vram[p + 1] = lo >> 8; vram[p + 2] = hi & 255; vram[p + 3] = hi >> 8;
  }
}

export default {
  name: 'e1',
  resources: [30, 31, 33],
  durationFrames: END_T + 1,        // frames rendered after the music-wait (t=0..0x208 inclusive)
  init(ctx) {
    const r30 = ctx.res(30);
    tex = new Uint8Array(65546); tex.set(r30.subarray(0, 65546));
    tex2 = new Uint8Array(65546);
    for (let i = 0; i < 65536; i++) tex2[i] = (r30[i] & 15) << 4;
    pal0 = ctx.res(31);
    const r33 = ctx.res(33), sin = new Int16Array(0x898);
    for (let i = 0; i < 0x898; i++) sin[i] = r33[2 * i] | r33[2 * i + 1] << 8;
    buildTable(sin);
    ctx.vga.pal.fill(0);               // 0x127ec with zeroed palette
    started = false; t = 0; flag4 = 0;
    A = new Int32Array([81920, 143360, 0, -40960]);
  },
  frame(ctx, f) {
    if (!started) {
      if (ctx.pos() <= 0x0b00) return true;
      started = true; f0 = f;
    }
    const k = f - f0, { vga } = ctx;
    if (k > END_T) return false;
    // iteration k of the main loop: state evaluated with t=k (0x126fa), vsync (ISR: t++), palette, render
    if (k < 0x40) { for (let i = 0; i < 768; i++) vga.pal[i] = (pal0[i] * k) >> 6; }   // fade-in, DAC written
    else if (k < 0x124) flag4 = 0;
    else if (k < END_T) flag4 = 1;
    // ISR at vsync
    t = k + 1;
    let e = 0x400;
    if (flag4) e = 0x400 - Math.trunc(0x400 * (t - 0x124) / 0xe4);
    A[0] += e; A[1] += e; A[2] -= e; A[3] -= e;
    render(vga.vram);
    return k < END_T;
  },
};
