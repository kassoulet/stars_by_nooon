// Headless renderer for part modules: node web/tools/render.mjs <part> [frames=100] [every=10] [outdir=web/tools/out] [startPos=0xORDERROW]
// Writes PNGs to compare with re/ref/harness.py frames (ground truth from the original code).
import { Vga, Resources } from '../engine.js';
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const [, , partName, frames = '100', every = '10', outDir = path.join(here, 'out'), pos0 = '0'] = process.argv;
const crcT = new Int32Array(256).map((_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n; });
const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
function png(vga) {                                         // 8-bit palette PNG (palette scaled 6->8 bit)
  const raw = Buffer.alloc(200 * 321); for (let y = 0; y < 200; y++) { raw[y * 321] = 0; raw.set(vga.vram.subarray(y * 320, y * 320 + 320), y * 321 + 1); }
  const pal = Buffer.alloc(768); for (let i = 0; i < 768; i++) pal[i] = Math.round(vga.pal[i] * 255 / 63);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(320, 0); ihdr.writeUInt32BE(200, 4); ihdr[8] = 8; ihdr[9] = 3;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', pal), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const _m = await import(`../parts/${partName}.js`); const part = process.env.EXPORT ? _m[process.env.EXPORT] : _m.default; // EXPORT=textg2 etc. for named exports
const res = new Resources(async n => new Uint8Array(fs.readFileSync(path.join(here, '..', 'assets', String(n).padStart(2, '0') + '.dec'))));
await res.preload(part.resources || []);
const vga = new Vga(); let pos = parseInt(pos0);
let curF = 0; const PER = +(process.env.ORDER_FRAMES || 0); // ORDER_FRAMES=N: music pos advances one order every N frames (for parts that wait on pos)
const ctx = { vga, res: res.get, pos: () => PER ? pos + ((Math.floor(curF / PER) << 8) | Math.floor((curF % PER) * 64 / PER)) : pos };
fs.mkdirSync(outDir, { recursive: true });
part.init(ctx);
for (let f = 0; f < +frames; f++) {
  curF = f; const go = part.frame(ctx, f);
  if (f % +every === 0) fs.writeFileSync(path.join(outDir, `${partName}_${String(f).padStart(5, '0')}.png`), png(vga));
  if (go === false) break;
}
console.log('done', partName);
