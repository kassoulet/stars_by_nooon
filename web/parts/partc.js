// STARS partc: 3 pictures (res 11,12,13) warped through a wobbling ring-quad (see re/parts/partc.md)
// Original: init 0x9d17, loop 0x975b (stages), cleanup 0x9dcf. Timer-ISR callback 0x9932 = per-tick params + counter.
const SIN = new Int32Array(5120);                       // table at image 0xa740 = round(65528*sin(i*2pi/4096)); cos(i) = SIN[i+1024]
for (let i = 0; i < 5120; i++) SIN[i] = Math.round(65528 * Math.sin(i * 2 * Math.PI / 4096));

// stage = {params block (11 dwords, image 0x9458..), duration counter, wait: music pos that must be passed BEFORE the stage starts}
const STAGES = [
  { p: [55104, 0, -36, -11, 16, 4, 6, 2560, 0, 0, 0], n: 0x104, wait: 0, wob: 0 },
  { p: [54784, 0, 84, 32, -148, 2, 64, 2560, 0, 0, 0], n: 0x186, wait: 0x2800, wob: [0, 0x40, 0x64] },
  { p: [54784, 0, 412, 1, 12, 34, -161, 2560, 0, 0, 0], n: 0x186, wait: 0x2b00, wob: 0, flip: 1 },
  { p: [54784, 9088, 108, -22, 128, 163, -44, 2560, 0, 0, 0], n: 0x186, wait: 0x2e00, wob: 0 },
  { p: [54784, 0, 84, 0, 16, 192, 256, 2560, 0, 0, 0], n: 0x186, wait: 0x3100, wob: [0x40, 0x100, 0x64] },
];
const T = new Int32Array(320 * 2), B = new Int32Array(320 * 2), RR = new Int32Array(200 * 2), LL = new Int32Array(200 * 2);
const S = new Int32Array(320), D = new Int32Array(320);
let pics, pal0, st;

function buildPic(src) {                                  // 0x9d95: 320x200 -> 256x256 (crop x 32..287, y stretched 200->256)
  const b = new Uint8Array(65536); let o = 0x320, dx = 0;
  for (let r = 0; r < 256; r++) {
    b.set(src.subarray(o, o + 256), r * 256);
    dx += 0xc800; if (dx > 0xffff) { dx &= 0xffff; o += 320; }
  }
  return b;
}

function ring(arr, cnt, ph, step, P) {                    // 0x9a02
  let e = (ph << 20) | 0;
  for (let k = 0; k < cnt; k++) {
    const idx = e >>> 20; e = (e + step) | 0;
    const w = SIN[(((idx << (P[5] & 31)) + P[8]) & 0xfff)];
    const r = (Math.imul(w, P[6]) >> 16) + P[2];
    arr[k * 2] = (Math.imul(SIN[idx + 1024], r) + 0xa00000) | 0;      // [edi]   (x, 160<<16)
    arr[k * 2 + 1] = (Math.imul(SIN[idx], r) + 0x640000) | 0;         // [edi+4] (y, 100<<16)
  }
}
const pack = (X, Y) => ((X << 8) & 0xffff0000) | ((Y >>> 8) & 0xffff);
function fixlo(e, v) { return (v & 0x8000) ? (e + 0x10000) | 0 : e; }

function render(vram, P) {
  ring(T, 320, P[7], 0x333333, P); ring(B, 320, P[7] + 0xc00, 0xffcccccd | 0, P);
  ring(LL, 200, P[7] + 0x400, 0x51eb85, P); ring(RR, 200, P[7], 0xffae147b | 0, P);
  const c1x = (T[0] + RR[0]) >> 1, c1y = (T[1] + RR[1]) >> 1;
  const c2x = (T[638] + LL[0]) >> 1, c2y = (T[639] + LL[1]) >> 1;
  const c3x = (B[0] + RR[398]) >> 1, c3y = (B[1] + RR[399]) >> 1;
  const c4x = (B[638] + LL[398]) >> 1, c4y = (B[639] + LL[399]) >> 1;
  for (let k = 319; k >= 0; k--) {
    let dy = (B[k * 2 + 1] - T[k * 2 + 1]) | 0, dX = (B[k * 2] - T[k * 2]) | 0;
    S[k] = pack(T[k * 2], T[k * 2 + 1]);
    const bx = (((dy / 200) | 0) >>> 8) & 0xffff; let e = ((((dX / 200) | 0) << 8) & 0xffff0000) | bx;
    D[k] = fixlo(e, bx);
  }
  let p1x = c1x, p1y = c1y, p2x = c2x, p2y = c2y;
  const d1x = ((c3x - c1x) / 200) | 0, d1y = ((c3y - c1y) / 200) | 0, d2x = ((c4x - c2x) / 200) | 0, d2y = ((c4y - c2y) / 200) | 0;
  const pic = pics[st.pic], g = ((P[0] << 16) | (P[1] & 0xffff)) | 0;
  let o = 0;
  for (let y = 0; y < 200; y++) {
    let cy = (RR[y * 2 + 1] - p1y) | 0, cx = (RR[y * 2] - p1x) | 0;
    let ey = (LL[y * 2 + 1] - p2y) | 0, ex = (LL[y * 2] - p2x) | 0;
    ey = (ey - cy) | 0; ex = (ex - cx) | 0;
    let base = pack(cx, cy);
    const sy = (ey / 200) | 0, sx = (ex / 200) | 0, bx = (sy >>> 8) & 0xffff;
    const step = fixlo((((sx << 8) & 0xffff0000) | bx) | 0, bx);
    let ebp = (base + g) | 0;
    for (let c = 0; c < 160; c++) {
      for (let h = 0; h < 2; h++) {
        const k = 2 * c + h; const s = (S[k] + D[k]) | 0; S[k] = s;
        const a = (s + ebp) | 0; ebp = (ebp + step) | 0;
        vram[o++] = pic[(((a >>> 8) & 0xff) << 8) | (a >>> 24)];
      }
    }
    p1x = (p1x + d1x) | 0; p1y = (p1y + d1y) | 0; p2x = (p2x + d2x) | 0; p2y = (p2y + d2y) | 0;
  }
}

function startStage(i) {                                  // 0x982c
  const s = STAGES[i]; st.stage = i; st.P = Int32Array.from(s.p); st.count = s.n; st.pic = 0; st.acc = 0;
  st.L = 0; st.step = 8; st.fc = 0x20; st.mode = 'run';
  if (s.wob === 0) st.wobOn = false;
  else if (s.wob) { const [a, b, r] = s.wob; st.wobOn = true; st.wobAmp = (b - a) >> 1; st.wobC = a + st.wobAmp; st.wobRate = r; }
  if (s.flip) st.flip = 1;
}
function setPal(vga, L) {
  for (let i = 0; i < 768; i++) vga.pal[i] = Math.min(63, ((pal0[i] * L) >> 8) & 255);
}

export default {
  name: 'partc',
  resources: [11, 12, 13],
  init(ctx) {
    pics = [11, 12, 13].map(n => buildPic(ctx.res(n)));
    pal0 = ctx.res(13).subarray(0, 768);
    st = { wobPh: 0, flip: 0, wobOn: false, mode: 'run' };
    ctx.vga.pal.fill(0); ctx.vga.vram.fill(0);
    if (ctx.stage >= 2) st.flip = 1;                    // ctx.stage: test hook only (start in a later stage)
    startStage(ctx.stage || 0);
  },
  frame(ctx, f) {
    const vga = ctx.vga;
    if (st.mode === 'done') return false;
    if (st.mode === 'wait') { if (ctx.pos() <= STAGES[st.stage + 1].wait) return true; startStage(st.stage + 1); }
    setPal(vga, st.L);                                  // palette is written (then vsync) BEFORE this frame's timer tick
    // timer callback 0x9932 (one tick per frame)
    const P = st.P;
    if (st.fc) { st.L += st.step; st.fc--; }
    P[7] += P[3]; P[8] += P[4]; P[0] += P[9]; P[1] += P[10];
    if (--st.count === 0x20) { st.step = -8; st.fc = 0x20; }
    if (st.wobOn) { st.wobPh += st.wobRate; P[6] = st.wobC + ((SIN[st.wobPh & 0xfff] * st.wobAmp) >> 16); }
    render(vga.vram, P);
    if (st.flip) { st.acc += 1000; if (st.acc > 0xffff) { st.acc &= 0xffff; if (++st.pic === 3) st.pic = 0; } }
    if (st.count < 0) {
      if (st.stage === STAGES.length - 1) { vga.vram.fill(0); st.mode = 'done'; return false; }
      st.mode = 'wait';
    }
    return true;
  },
};
