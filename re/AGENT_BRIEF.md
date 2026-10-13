# Brief: porting one effect of STARS (Noooon, 1995 MS-DOS demo) to JavaScript

Read `re/NOTES.md` first (file layout, unpack chain, resource container). Project root = repo dir `demos/stars`.
Use the repo-local venv-free python (`python3`, has capstone? NO -> use the scratch venv python given in your task prompt for anything that imports capstone/unicorn/PIL).

## What exists
* `re/out/NN.dec` : the 58 decompressed resources (also `web/assets/NN.dec`). `re/png/` : images already converted.
* `re/image32.bin` : the unpacked 32-bit flat image (~573 KB). **32-bit offset == file offset in this image, base 0**, VGA = 0xA0000.
  `python3 re/ref/d.py ADDR [N]` disassembles N instrs from ADDR (needs capstone; use the venv python). `re/image32.lst` is a naive linear
  sweep (loses sync inside data) -- fine for grep, never trust blindly. `re/ref/callgraph.py ADDR..` = reachable code + resources of an entry.
* The code is ONE asm program. `main` = image offset 0xe0..0x472: a linear script `call init; (loop); call cleanup; wait music position`.
  Position = `(order<<8)|row` of the music, read via `call 0x29f80` (ax). Each effect = `init fn` (loads resources, builds tables),
  `loop fn` (runs until a flag / music position), `cleanup fn` (frees).
* **Reference harness** `re/ref/harness.py` runs the ORIGINAL code in Unicorn (flat model, DPMI/disk/sound stubbed) and dumps VGA frames to PNG:
  `python3 re/ref/harness.py --snapshot re/ref/prologue.snap --start 0xADDR --order O --row R --frames N --every K --out DIR --quiet-calls`
  * `--snapshot` skips the 100 s global init (0x16945) -- ALWAYS use it. `--start` = an address *inside main* (e.g. the `call` that begins your part;
    see `re/NOTES.md`) so init->loop->cleanup run in order; execution continues into later parts, so just limit `--frames`.
  * `--order/--row` set the virtual music position at start (script thresholds compare it). `--verbose` prints PIT/inject info and per-dump stats.
  * Speed ~6 frames/s for heavy effects. Frames are 70 Hz (VGA retrace). PIT = 70 Hz timer IRQ0 (ISR 0x4ac1f calls up to 3 callbacks set by
    `0x4abec/f2/f8` (eax = callback ptr); effect code often lives in such a callback AND/OR in the main loop synced with `0x4a830` (vsync)).
  * `re/ref/sheet.py OUT.png DIR [step first count cols]` contact sheet; `re/ref/cmp.py A.png B.png [diff.png]` pixel diff (0 = identical).
  * Anything you can't see in frames, you can inspect by adding hooks (copy harness.py to your own file; never edit the shared one concurrently).
* **JS skeleton** `web/engine.js` (read it, 60 lines): `Vga` (vram 64000 B indexed + `pal` 768 B of 6-bit VGA values), `Resources`, part interface.
  `web/tools/render.mjs <part> <frames> <every> <outdir> [pos]` renders your part headlessly to palette PNGs (node >= 18, no deps).
  Parts: `web/parts/<name>.js`, `export default { name, resources:[...], init(ctx), frame(ctx,f) }`, 70 Hz, `ctx.vga.vram/pal`, `ctx.res(n)`, `ctx.pos()`.
  Keep a part self-contained (own helpers inside the file) unless a shared lib is stated in your task. Plain ES modules, no build step, no deps.

## Original-code conventions you will meet
* 386 flat 32-bit, `ds=es` base 0 (so `[0x1234]` is a global at image offset 0x1234; `edi=0xa0000-[0x17620]` = VRAM, `[0x17620]` is 0).
  `fs/gs/es` are loaded with *selectors* returned by `0x17da3` (eax=base, edx=size -> bx): segment-relative access = base+offset, limit = size-1.
* `0x4a9f3` eax=res# -> eax=ptr to decompressed resource. `0x17bd7` alloc(edx)->eax, `0x17c43` alloc, `0x17c8e` free(eax), `0x17cd2` shrink.
  `0x4a894 esi=table` allocs a list of buffers (9-byte entries {ptr_var, size, dos_flag}, end=-1); `0x4a8c7` frees them.
* Palette: `0x4a759` (al=first idx, esi=rgb6 data, ecx=count) writes DAC; `0x4a76c` all black; `0x4a781` all white; palette fades via `0x4a7b0/0x4a80b`,
  `0x4a720` (scale). Data is 6-bit VGA (0..63). `0x4a830` = wait vsync (one 70 Hz frame), `0x4a843` ecx frames, `0x4a84e` clear VRAM.
* `0x1c7a3`/`0x29f80`: music position. Some effects also read other player vars (volume/beat) -- harness stubs these to 0, say so in your notes if they matter.
* 8-bit chunky mode 13h, 320x200 = 64000 B. 32-bit register tricks (bp/sx 16-bit halves, `66` prefixes) are everywhere; fixed-point math is mostly 16.16 / 8.8.

## Deliverables (per part)
1. `web/parts/<name>.js` : faithful port. Palette handling, timing (frame counts at 70 Hz) and animation curves must match the original frames.
2. `re/parts/<name>.md` : short notes: entry addresses, resources used, algorithm summary, tables/magic numbers, how timing/sync works, what is approximated.
3. Verification: compare harness frames vs `render.mjs` frames at several frame indices (cmp.py). Aim for pixel-exact where it is a deterministic image op;
   for random/noise-driven parts at least visually identical; state the residual diff.
Keep tool output small (no huge dumps: use head/grep/count, `d.py ... 60`). Don't modify files outside your part (`web/parts/<name>.js`, `re/parts/<name>.md`, your own scratch files under `re/parts/<name>_tmp/`).
Report back: what works, residual differences, anything the shared script (`web/script.js`) needs to know (start position, duration, palette state at the end).
