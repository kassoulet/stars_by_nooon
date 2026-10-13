// partj: lit/environment-mapped head (res 34 = pixel stream, res 35 = palette + 256x256 env map + 32 LUT rows) drawn over a feedback
// zoom/wave tunnel. Orig: init 0x10b26, loop 0x1089c (script by music position), cleanup 0x10bd9. See re/parts/partj.md.
// Start: after music position 0x8700 (ctx.pos() > 0x8700); ends when pos > 0x9230 (return false).
const SIN512 = new Int32Array(512), SIN4096 = new Int32Array(4096);
for (let i = 0; i < 512; i++) SIN512[i] = Math.round(1024 * Math.sin(2 * Math.PI * i / 512));
for (let i = 0; i < 4096; i++) SIN4096[i] = Math.round(65528 * Math.sin(2 * Math.PI * i / 4096));
// parameter blocks copied to 0xf740 (dword k: 1,3,5,7 = wave phase speeds; 2,4,6,8 = phase step per column/row; 9 = zoom P; 10 = LUT row; 11 = head flag)
const B1 = [0, 46, 32, 10, 18, 3, 20, 20, 5, 221, 15, 1, 0, 0, 0, 0];
const B2 = [70, 46, 38, 10, 19, 17, 28, 42, 5, 236, 15, 1, 0, 0, 0, 0];
const B3 = [0, 38, 15, 30, 21, 23, 22, 20, 6, 236, 16, 1, 0, 0, 0, 0];
const BA = 16000, BB = 112000;     // the two 64000-byte buffers inside the original 192000-byte arena (zero margins around them)

export default {
  name: 'partj', resources: [34, 35],
  init(ctx) {
    const r34 = ctx.res(34), r35 = ctx.res(35), dv = new DataView(r34.buffer, r34.byteOffset, r34.byteLength);
    // 0x11a0a: expand res 34 records (8 B header: skip@2, count@4; then count dwords) into 16-bit stream
    const st = []; let p = 0, bp = 0;
    while (bp < 0xf8c0 && p + 8 <= r34.length) {
      const skip = dv.getUint16(p + 2, true), cnt = dv.getUint16(p + 4, true);
      st.push(skip); st.push(cnt); bp = (bp + skip) & 0xffff; p += 8;
      for (let i = 0; i < cnt; i++, p += 4) {
        const d = dv.getInt32(p, true);
        let al = (d >>> 1) & 255, ah = ((d >> 4) >> 8) & 255;         // mov al,bl (bl = d>>1) ; ah = byte1 of d>>4
        ah = ((ah << 24) >> 24 >> 1) & 255; al = ((al << 24) >> 24 >> 1) & 255;  // sar ah,1 ; sar al,1
        const ax = ((ah << 8 | al) + 0x8080) & 0xffff;
        st.push(((ax & 255) << 8) | (ax >> 8)); bp = (bp + 1) & 0xffff;   // xchg ah,al
      }
    }
    st.push(0xffff);
    ctx.vga.pal.fill(0);   // 0x4a76c
    this.s = {
      vga: ctx.vga, tex: r35, pal: r35.subarray(0, 768), stream: Uint16Array.from(st), arena: new Uint8Array(192000),
      a: BA, b: BB, lut: new Uint8Array(256),
      pb: new Array(16).fill(0), ph: [0, 0, 0, 0], P: 256, row: 15, head: 1,
      c107ca: 0x180, c107ce: 0, off: 0, scale: 0, step: 4, cnt: 0x40, flag: 0,
      anim: { on: 1, ph: 0, speed: 0x32, amp: 0x30, ctr: 0x100 }, stage: 0, acc: 0, accStep: 0x640, cd: 0,
      R: new Int32Array(200), D: new Int32Array(320),
    };
  },
  frame(ctx, f) {
    const s = this.s, pos = ctx.pos();
    // --- timer callback (0x10ae2), 70 Hz
    const nt = ctx.ticksAt ? ctx.ticksAt(f) : 1;
    for (let n = 0; n < nt; n++) {
      s.c107ca += s.c107ce; s.ph[0] += s.pb[1]; s.ph[1] += s.pb[3]; s.ph[2] += s.pb[5]; s.ph[3] += s.pb[7];
      if (s.anim.on) { s.anim.ph += s.anim.speed; s.P = ((SIN4096[s.anim.ph & 0xfff] * s.anim.amp) >> 16) + s.anim.ctr; }
      if (s.cnt) { s.scale += s.step; s.cnt--; s.flag = 1; }
    }
    // --- script state machine (main loop 0x1089c), evaluated after each drawn frame
    if (s.strobe) { s.head = 1; this.drawFrame(s); s.head = 0; s.strobe = 0; return this.strobePost(s, pos); }
    this.drawFrame(s);
    const L = (cond, next, fn) => { if (cond) { s.stage = next; fn && fn(); } };
    const blk = b => { for (let i = 0; i < 16; i++) { if (i === 9) s.P = b[i]; else if (i === 10) s.row = b[i]; else if (i === 11) s.head = b[i]; else if (i < 9) s.pb[i] = b[i]; else s.ph[i - 12] = b[i]; } };
    switch (s.stage) {
      case 0: L(pos >= 0x8820, 1, () => { s.anim.on = 0; s.c107ce = 0x50; }); break;
      case 1: L(s.c107ca >= 0x980, 2, () => { s.c107ce = 0; blk(B1); }); break;
      case 2: L(pos > 0x8920, 3); break;
      case 3: L(pos > 0x8b00, 4, () => { s.c107ce = 0x1e; }); break;
      case 4: L(pos > 0x8b20, 5, () => blk(B2)); break;
      case 5: L(pos > 0x8d00, 6, () => { s.head = 0; }); break;
      case 6: {   // accelerating strobe of the head: an extra one-frame head every time the 16-bit accumulator overflows
        const sum = s.acc + s.accStep; s.acc = sum & 0xffff;
        if (sum > 0xffff) { s.strobe = 1; break; }
        return this.strobePost(s, pos);
      }
      case 7: L(pos > 0x9000, 8, () => { blk(B3); s.cd = 0x30; }); break;
      case 8: L(pos > 0x9200, 9, () => { s.head = 0; s.P += 0x16; }); break;
      case 9: L(pos > 0x9210, 10, () => { s.cnt = 0x40; s.step = -4; }); break;
      case 10: L(pos > 0x9230, 11); break;
      default: return false;
    }
    return s.stage < 11;
  },
  strobePost(s, pos) {
    s.accStep = (s.accStep + 0x32) & 0xffff;
    if (pos > 0x8f00) { s.stage = 7; s.head = 1; }
    return true;
  },
  // one iteration of 0x10a86
  drawFrame(s) {
    if (s.stage === 8 && s.cd) { s.cd--; if ((s.cd & 3) === 0) s.P++; }
    const idx = ((s.c107ca & 0x7fc) + 0x200) & 0x7fc;
    s.off = ((SIN512[idx >> 2] >> 5) << 8) + 0x2000;                      // 0x107c6 (env map scroll)
    if (s.flag || s.cnt) {                                               // 0x4a7b0: scaled palette
      s.flag = 0; const p = s.vga.pal, q = s.pal;
      for (let i = 0; i < 768; i++) p[i] = Math.min(63, ((q[i] * s.scale) >> 8) & 255);
    }
    const A = s.arena, a = s.a, lut = s.lut, tex = s.tex;
    const base = 0x300 + 0xffff + (s.row << 8); for (let i = 0; i < 256; i++) lut[i] = tex[base + i] | 0;   // 0x1178c
    if (s.head <= 0) { for (let i = 0; i < 64000; i++) A[a + i] = lut[A[a + i]]; }
    else {
      const st = s.stream; let e = a, i = 0;
      for (;;) {
        const sk = st[i++]; if (sk === 0xffff) break;
        for (let k = 0; k < sk; k++, e++) A[e] = lut[A[e]];
        const c = st[i++]; for (let k = 0; k < c; k++, e++) A[e] = tex[s.off + st[i++]] | 0;
      }
    }
    // 0x10bf3: separable wave+zoom warp of buffer a -> buffer b + VRAM
    const P = s.P, T = SIN512, pb = s.pb, D = s.D, R = s.R;
    let e1 = s.ph[0], e2 = s.ph[1], ed = ((256 - P) * 320) >> 1;
    for (let x = 0; x < 320; x++) {
      e1 &= 0x7fc; e2 &= 0x7fc;
      D[x] = ((((T[e1 >> 2] + T[e2 >> 2]) * P) >> 16) * 320) + (ed >> 8); ed += P; e1 += pb[2]; e2 += pb[4];
    }
    e1 = s.ph[2]; e2 = s.ph[3]; ed = ((256 - P) * 200) >> 1;
    for (let y = 0; y < 200; y++) {
      e1 &= 0x7fc; e2 &= 0x7fc;
      R[y] = (((T[e1 >> 2] + T[e2 >> 2]) * P) >> 16) + (ed >> 8) * 320; ed += P; e1 += pb[6]; e2 += pb[8];
    }
    const vr = s.vga.vram, b = s.b;
    for (let y = 0, o = 0; y < 200; y++) {
      const ry = a + R[y];
      for (let x = 0; x < 320; x++, o++) { const v = A[ry + D[x]] | 0; vr[o] = v; A[b + o] = v; }
    }
    s.a = b; s.b = a;
  },
};
