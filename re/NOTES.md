# STARSv2.EXE reverse notes

## File layout (1 243 469 bytes)
| range | what |
|---|---|
| 0x0000-0x009f | MZ header (hdr 160 B, entry CS:IP = 1250:0000 -> file 0x125a0, SS:SP 1250:07da) |
| 0x00a0-0x1297a | "MZ image" 76 154 B total, packed twice (see below) |
| 0x1297a-EOF-696 | resource blob (overlay), 58 resources back-to-back, first at 76154 |
| EOF-696..EOF | resource table: 58 x 12 B |

## Unpacking chain
1. **Layer 0** (entry 1250:0): self-decrypting stub. Anti-debug: reads PIC mask (port 21h), jumps into mid-instruction.
   Word-decrypt loop (di=0x46, 0x1ca words): `ax=bswap16(w)^b649; ah=rol1(ah); al=-al; ax^=a32b; ah=rol1(ah); ax+=1`.
   Then 2nd decrypt hooks INT 1 / INT 3 as a state machine (int3 -> int1 -> ... each does 1 op, vectors swapped on the fly).
   Easier to *emulate* than hand-trace: `re/emu_unpack.py` (unicorn, 16-bit, hand-made IVT dispatch). ~540k instr.
2. **Layer 1**: PKLITE-style LZ decompressor ("Not enough memory$"), at ff0:100 (PSP seg+0x10). Needs PSP[2] (mem top) set
   or it prints the error. ~1.7M instr. Output ~600 KB image, relocated, entry = 8a21:0 when load seg = 0x1000.
3. **Real-mode part = PMODE (Tran, v3.07)** at image offset 0x7a210: detects RAW/XMS/VCPI/DPMI, A20, errors
   `<!> ...`. It then enters 32-bit PM (DPMI int 31h API emulated), flat code at image base, entry 32-bit EIP=0x178c3.
   Result of unpack is saved as `re/image32.bin` (= linear image from load seg, 0x8c0b0 bytes, 32-bit offset == file offset in image),
   `re/image32.lst` = naive capstone linear sweep (data decoded as junk, use with care).

## Image32 map (offsets in image32.bin)
- 0x00000  demo main code (32-bit asm); first strings "You can't launch stars from floppy disk."
- 0x17610  PMODE runtime/mem manager (error strings), 0x178c3 PM entry; DOS/DPMI helper at 0x17910-0x17b..
- 0x1b976  LCA's MOD player v3.02 (C) Cedric Bermond 1993-95 (GUS + SB)
- 0x29b90  GUS / SB detection text
- 0x4a8f8-0x4ac5x  resource loader (see below), 0x4ac8b/0x4ad47 = decompressor
- 0x4cfc8-0x4d1xx  DOS file layer (open/close/lseek/read via DPMI int31 ax=0300 real-mode call, buffer 0x4afc0, 8 KB chunks)
- 0x7a210  PMODE real-mode loader

## Resource container
- Program opens **itself** (path from env block, fails if drive A:/B: -> "can't launch from floppy").
- Table at EOF: entry i (1-based) at `EOF-12*i`: `{u32 id, i32 offset_from_EOF (negative), u32 size}`; file data = `EOF+offset`.
- Resource may be raw or **`dlz`**: 17-byte header, bytes 6..8 = "dlz" (bytes 0..5 = decoy `b4 4c cd 21 9d 89` = `mov ah,4c; int 21` so it looks like code),
  decoded size = `byte[0xe]<<14 | word[0xf]` (as in code, only used for allocation), LZ data starts at +0x11.
- Decoder (`re/dlz.py`): PKLITE-like, 16-bit LSB-first flag words (reload when counter hits 0, word fetched from current src ptr);
  bit1 = literal byte. else: bit,al; offset hi starts 0xff ... see source, ends at special code (offset -1 with flag 0).
- `python3 re/extract.py STARSv2.EXE` -> `re/out/NN.bin|.dec`.

## Resource guess table (from sizes/headers; to be confirmed)
- 768 B : VGA palette 6-bit (4,15,20,22,26?,31,42,48)  | 64000 : 320x200 8bpp raw (19,25,27,47,58) | 64768 : 768 B pal (6-bit VGA) THEN 64000 px (8-14,52-57) -- CONFIRMED visually (credits/title screens)
- magic `42 21 1a 0f` (18,24,45,46,50,51) : custom image/bitmap format -- TODO
- 1 (780 KB), 28 (140 KB), 24 (108 KB), 34, 35...: TODO (music / 3D / big textures)

## Images (done) -> `python3 re/images.py` writes re/png/
- 64768 B resources = 768 B palette (6-bit, x4 for 8-bit) + 320x200 chunky. Title/credit screens.
- Raw 64000 / 65536 (256x256) / 66303 blobs are *effect textures/maps* (terrain heightmap+colormap 02/03, plasma/tunnel/ envmaps...). They carry no palette;
  pairing with the 768 B palettes (4,15,20,22,26,31,42,48) is by demo part (see below); ambiguous pairs (20/22, 26/31, 42/48) saved with both.
- `B! 1a 0f` blobs (18,24,45,46,50,51) are NOT images: 3D object files (vertices/faces), to decode with effect code.

## Demo parts (resources requested via `mov eax,N ; call 0x4a9f3` in the code, N hex in disasm)
code region   -> resources (decimal)
0x00a5-0x10c7  1,2,3,4        part A (intro/terrain? res 2/3 = heightmap+colormap)
0x5fa4-0x66f0  5,6,7,15,16,17,19   part B
0x9d3a-0xa32a  11,12,13, 20,21,22,23,25   part C
0x11992-0x12492 26-35        part D
0x152a5-0x1651a 36-41,49     part E
0x16d08-0x16e84 42-47        part F
Others (8,9,10,14,18,24,45,46,48,50-58) loaded by other callers (0x4a9d3/0x4aa5e etc.).

## Music (done) -> `python3 re/mod2xm.py re/out/01.dec web/stars.xm`
Resource 1 (780 KB) = ProTracker-like MOD, **16 channels, signature `16CH` at 0x4b8, 256-entry order table (155 used), 73 patterns, 31 samples**
(sample names carry a message from Groo to Olivier). Normal MOD players only read 128 orders, so it is converted to XM with orders kept 1:1
(demo script syncs on `(order<<8)|row`; played with libopenmpt/chiptune3 in `web/lib/`). Amiga LRRL panning injected as 8xx effects.

## Reference harness (`re/ref/harness.py`)
Unicorn runs the original 32-bit code (flat, GDT with dynamic selectors for 0x17da3), stubs: allocator, resource loader (0x4a9f3 -> re/out/NN.dec),
VGA DAC ports, vsync (port 0x3da, frame counter), PIT (rate parsed from port 0x40; fake IRQ0 -> ISR 0x4ac1f -> up to 3 callbacks),
music position (bytes [0x1c829]=order,[0x1c828]=row, driven by a MOD timeline simulation). Frames -> PNG. Snapshot of the 100 s global init: `ref/prologue.snap`.
Architecture of the demo: ISR (70 Hz PIT 0x4286) calls callbacks installed with 0x4abec/f2/f8; effects = init fn / loop fn / cleanup fn per part; main script waits on music pos.
Part map (main-script address -> functions): see `ref/callgraph.py`; web port lives in `web/` (engine.js, parts/*.js, script.js, main.js, index.html). Serve with `python3 -m http.server -d web`.

## Status: full JS port (web/)
All parts ported (intro, e1, e2, partb, partc, terrain, partd, picture57, partf, textg1, parth, parti, textg2, partj, credits); chained in `web/script.js` (`start` = music pos threshold, part begins after previous ends). Run: `python3 -m http.server -d web`, open index.html, click. Smoke test w/o audio: `node web/tools/smoke.mjs`. Per-part details/exactness: `re/parts/*.md`.
Known gaps: partb-I second half unverified vs original; text-mode ending (0x7dd) not ported; assumes 1 tick/frame; dot RNG seed in textg; lib3d V_WARP256 bottom-clip mismatch (offscreen).

## Music conversion fix
The XM (`web/stars.xm`) was wrong: `re/mod2xm.py` snapped every period to the 36-note ProTracker table, but the song uses periods 45..1076 (351 of 3463 notes outside the table), so high/low notes were clamped to the wrong pitch. Notes now use `round(49-12*log2(p/428))` (clamped 1..96) and the samples get -20/128 semitone finetune (XM C-4 = 8363 Hz vs Amiga C-2 = 8287 Hz). Check: libopenmpt renders of the original MOD (first 128 orders, rebuilt as a standard 16CH MOD; the original has a non-standard 256-entry order list so it cannot be loaded as is, and a standard MOD allows only 128 orders) and of the XM now agree in every octave band to a flat +3.5 dB (XM is louder), with identical duration. Pitfall: `openmpt123 --render` silently keeps an existing .wav unless `--force` is given.
