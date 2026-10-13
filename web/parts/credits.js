// STARS outro ("credits"): still pictures with palette fades, driven by the music position. Original: main 0x2ed..0x472 (+ 0x1b0..0x1e9 for res 57).
// Helpers (exported, reusable by other parts): showPicture / fade (original 0x17e50 / 0x17e96 / 0x17eba, palette math of 0x4a7b0 + 0x4a720).
// A "script" is a generator: each `yield` = one 70 Hz vsync. Palette writes happen right after the yield (like the original, which waits vsync then writes the DAC).
export const FADE_ONE = 256;                       // fade level 8.8: 0 = black, 256 = full palette

// 0x17e50: black palette, copy the 64000 pixels (res = 768 B 6-bit palette + 320x200) to VRAM at once. The picture is thus "there" but invisible until fade().
export function showPicture(vga, data) {
  vga.pal.fill(0); vga.vram.set(data.subarray(768, 768 + 64000));
  return { pal: data.slice(0, 768), level: 0 };    // level = [0x4a7a0]
}
// 0x17e96 (fade in, step>0) / 0x17eba (fade out, step<0; also frees the picture buffer): `count` steps of `step` (8.8 level), then one last palette write.
// Per step: pal[i] = min(63, (src[i]*level >> 8) & 255) written after 1 vsync, then level += step. 65 frames for count=64 (count+1 in general).
export function* fade(vga, pic, step, count) {
  const put = () => { for (let i = 0; i < 768; i++) vga.pal[i] = Math.min(63, ((pic.pal[i] * pic.level) >> 8) & 255); };
  for (; count > 0; count--) { yield; put(); pic.level += step; }
  yield; put();
}
// wait loop `call 0x29f80 / cmp ax,T / jbe` : one check per frame
const waitPos = function* (ctx, t) { while (ctx.pos() <= t) yield; };
const waitFrames = function* (n) { while (n-- > 0) yield; };      // call 0x4a843

function* outro(ctx) {
  const { vga } = ctx, R = n => ctx.res(n);
  const swap = ctx.swap ?? (new Date().getMinutes() & 1);          // original: [4] = DOS clock minutes & 1 (harness: 0)
  const [a, b] = swap ? [0x35, 0x36] : [0x36, 0x35];
  let p = showPicture(vga, R(a));
  yield* waitPos(ctx, 0x9500); yield* fade(vga, p, 4, 0x40);
  yield* waitPos(ctx, 0x9519); yield* fade(vga, p, -4, 0x40);
  p = showPicture(vga, R(b));
  yield* waitPos(ctx, 0x9600); yield* fade(vga, p, 4, 0x40); yield* fade(vga, p, -4, 0x40);   // flash: fade in immediately followed by fade out
  p = showPicture(vga, R(0x37));
  yield* waitPos(ctx, 0x9700); yield* fade(vga, p, 4, 0x40); yield* fade(vga, p, -4, 0x40);
  p = showPicture(vga, R(0x34));
  yield* waitPos(ctx, 0x9800); yield* fade(vga, p, 4, 0x40); yield* fade(vga, p, -4, 0x40);
  p = showPicture(vga, R(10));
  yield* waitPos(ctx, 0x9a00); yield* fade(vga, p, 8, 0x20); yield* fade(vga, p, -4, 0x40);
  p = showPicture(vga, R(0x38));
  yield* waitPos(ctx, 0x9a20); yield* fade(vga, p, 4, 0x40);
  yield* waitFrames(0x14); yield* waitFrames(0xb4);                // (0x4a006 = music-side only) then 180 frames of still picture
  yield* fade(vga, p, -2, 0x80);                                   // slow final fade (129 frames) ; original then returns to text mode (0x7dd, no-op for graphics) and exits
}

// Also res 57 (main 0x1b0..0x1e9): picture shown black, fade in after pos 0x5500, fade out after 0x5800, then VRAM cleared.
function* pic57(ctx) {
  const p = showPicture(ctx.vga, ctx.res(0x39));
  yield* waitPos(ctx, 0x5500); yield* fade(ctx.vga, p, 4, 0x40);
  yield* waitPos(ctx, 0x5800); yield* fade(ctx.vga, p, -4, 0x40);
  ctx.vga.vram.fill(0);
}
const make = (name, resources, script) => {
  let g;
  return { name, resources, init(ctx) { g = script(ctx); }, frame(ctx) { return !g.next().done; } };   // returns false when the script is over
};
export const picture57 = make('picture57', [0x39], pic57);
export default make('credits', [0x34, 0x35, 0x36, 0x37, 10, 0x38], outro);
