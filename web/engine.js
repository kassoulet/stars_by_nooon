// STARS (Noooon, 1995) JS port -- engine. VGA mode 13h model: 320x200 indexed vram + 6-bit DAC palette.
export const W = 320, H = 200;

export class Vga {
  constructor() { this.vram = new Uint8Array(W * H); this.pal = new Uint8Array(768); this.prev = new Uint8Array(W * H); this.blend = false; }
  beginTick() { if (this.blend) this.prev.set(this.vram); }   // call before each 70 Hz frame; with `blend` the display averages the last two ticks (CRT persistence: parts that flip a checkerboard every tick)   // pal: VGA 6-bit values (0..63)
  clear(c = 0) { this.vram.fill(c); }
  // write pal entries like `out 3c8/3c9`: first colour index, array of 6-bit r,g,b triplets
  setPal(first, rgb6) { this.pal.set(rgb6, first * 3); }
  toRGBA(out32) {                                          // out32: Uint32Array(W*H), little-endian RGBA
    const p = this.pal, v = this.vram, lut = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      const r = p[i * 3], g = p[i * 3 + 1], b = p[i * 3 + 2];   // 6 -> 8 bit like a real DAC (x255/63)
      lut[i] = 0xff000000 | (((b * 255 / 63) | 0) << 16) | (((g * 255 / 63) | 0) << 8) | ((r * 255 / 63) | 0);
    }
    if (this.blend) {
      const q = this.prev;
      for (let i = 0; i < W * H; i++) { const a = lut[v[i]], b = lut[q[i]]; out32[i] = 0xff000000 | ((((a & 0xff00ff) + (b & 0xff00ff)) >> 1) & 0xff00ff) | ((((a & 0xff00) + (b & 0xff00)) >> 1) & 0xff00); }
    } else for (let i = 0; i < W * H; i++) out32[i] = lut[v[i]];
  }
}

// Resource access. `res(n)` returns the decompressed resource n (Uint8Array) -- preloaded before part.init().
export class Resources {
  constructor(loader) { this.loader = loader; this.cache = new Map(); }
  async preload(list) { for (const n of list) if (!this.cache.has(n)) this.cache.set(n, await this.loader(n)); }
  get = n => { const r = this.cache.get(n); if (!r) throw new Error('resource ' + n + ' not preloaded'); return r; };
}
export const browserLoader = async n => new Uint8Array(await (await fetch(`assets/${String(n).padStart(2, '0')}.dec`)).arrayBuffer());

/* Part interface (one ES module per effect, default export):
 *   export default {
 *     name: 'xxx',
 *     resources: [2, 3, 4],                 // resource numbers needed
 *     init(ctx)  { ... },                   // ctx = { vga, res(n), pos() }  called once, may set palette / vram
 *     frame(ctx, f) { ... return true; }    // called at 70 Hz, f = frame index since part start; return false to end the part early
 *   }
 * ctx.pos() = current music position (order<<8 | row), same value the original reads via 0x29f80.
 */
