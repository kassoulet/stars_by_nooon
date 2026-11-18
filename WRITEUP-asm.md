# STARS (Noooon, 1995) - asm snippets worth reading

`STARSv2.EXE` is a real-mode self-decrypting stub -> PKLITE-style LZ -> PMODE 3.07 -> a **flat 32-bit image** (`re/image32.bin`, dumped by `re/emu_unpack.py`
under Unicorn). Addresses below are offsets in that image (the same numbers appear as the `0x...` addresses in `re/NOTES.md` and `re/parts/*.md`; code
references such as `mov eax, ds:0x11b24` are absolute within it). Listings were produced with `objdump -D -b binary -mi386 -Mintel` on `re/image32.bin`
(capstone was not installed on the machine used for this write-up; `re/image32.lst` is the older capstone linear sweep). Only code that is described in the
reverse-engineering notes and ported in `web/parts/*.js` is shown.

The demo is a 1995 486/Pentium VGA mode 13h production: no MMX, no FPU in the effect loops, everything integer. 16-bit operand-size tricks are everywhere
(`bx`, `si`, `di`, `dx` used as 64 KB wrap-around addresses, `fs:[bx+di]` with 32-bit segment bases), a habit inherited from real mode.

---

## 1. Four pixels per iteration, 64 KB addressing that wraps for free (tunnel, 0x12662)

The first effect after the intro (`e1`, "flow tunnel") runs this inner loop over 63040 pixels (`ecx = 0x3d90` iterations x 4 pixels):

```
12644: mov edi, 0xa0000            ; VRAM (minus the DPMI base in [0x17620])
1265d: mov ecx, 0x3d90
12662: mov ebx, [ebp+4]            ; two precomputed table words = pixels 2,3
12665: mov al, gs:[bx+si]          ; texture 1, low word of ebx  (si = scroll offset)
12669: shr ebx, 0x10
1266c: mov ah, gs:[bx+si]          ; texture 1, high word
12670: and bl, 0xfe
12673: add ax, fs:[bx+di]          ; texture 2 (word!) added to both pixels at once
12678: shl eax, 0x10               ; park the two pixels in the high half
1267b: mov ebx, [ebp]              ; pixels 0,1
1267e: mov al, gs:[bx+si]
12682: shr ebx, 0x10
12685: add ebp, 8
12688: mov ah, gs:[bx+si]
1268c: and bl, 0xfe
1268f: add ax, fs:[bx+di]
12694: mov [edx], eax              ; one 32-bit store = 4 pixels
12696: add edx, 4
12699: dec cx
1269b: jne 0x12662
```

Why it is nice:

* **Table-driven**: the 64 K-entry table (`tbl`, one 16-bit word per screen pixel, built in init from a polar map: low byte = depth, high byte = angle) is read as
  a *dword* holding two pixels, so a single load feeds two texture fetches via `shr ebx,16`.
* **Offsets are 16-bit sums**: the scroll offsets `si`/`di` are added with `bx` inside the addressing mode; `bx+si` wraps at 64 KB because `bx` is used as a
  16-bit register, so the texture tiles seamlessly with no `and`.
* **Two textures blended with one 16-bit add**: the second layer is a word (two pixels) read from `fs:[bx+di]` and added to `ax` (two pixels). The `and bl,0xfe`
  aligns it, and the *same* second-layer word is shared by both pixels of a pair (this is visible in the JS port, `pair()` in `web/parts/e1.js`, and is a feature
  of the original, not a bug). The second texture is `(res30[i] & 15) << 4` (built in init).

`web/parts/e1.js` reproduces it with the same per-pair semantics (521/521 frames identical to the Unicorn harness, index and palette, `re/parts/e1.md`).

---

## 2. Run-length fill using the bits of the count (voxel terrain, 0x12cb..0x12f7)

The polar voxel terrain draws, for each ray, a vertical run of one colour whenever the new horizon `cl` exceeds the previous one `ch`:

```
12c0: mov bl, es:[edx]             ; height  (bh = depth step, so bx = depth<<8 | height)
12c3: mov cl, fs:[bx]              ; screen height from the 211x256 LUT
12c7: cmp cl, ch                   ; ch = highest row so far
12c9: jbe 0x12f9                   ; hidden -> nothing to draw
12cb: sub cl, ch                   ; run length
12cd: mov al, gs:[edx]             ; colour map
12d0: add ch, cl
12d2: shr cl, 1
12d4: jae 0x12dd
12d6: mov [edi], al                ; bit 0 set: one byte
12d8: lea edi, [edi+1]             ; (lea: does not touch the flags)
12db: je  0x12f9                   ; ZF still comes from the shr -> run was 1
12dd: mov ah, al
12df: shr cl, 1
12e1: jae 0x12eb
12e3: mov [edi], ax                ; bit 1 set: one word
12e6: lea edi, [edi+2]
12e9: je  0x12f9
12eb: push ax / push ax / pop eax  ; replicate the colour into all 4 bytes
12f0: mov [edi], eax               ; remaining count/4 dwords
12f2: add edi, 4
12f5: dec cl
12f7: jne 0x12f0
```

Why it is clever: instead of `rep stosb` (slow start-up on a 486/Pentium for short runs, which most are) or a loop per byte, the run length is consumed **bit by bit**:
bit 0 -> one byte store, bit 1 -> one word store, the rest -> dword stores. `shr` leaves the shifted-out bit in CF and the "result is zero" in ZF, and the stores use
`lea` for the pointer advance specifically because `lea`, unlike `add`, leaves the flags alone, so the `je` that follows tests the *shift*, not the pointer. The whole fill has no multiplication and no divide.

The depth/height-to-screen LUT feeding `cl` is itself built by a short routine (0x10d6) with a saturating clamp written in two instructions:

```
10e6: mov eax, esi / cdq / idiv ebp   ; (0x2f4 + 14*h) / (depth+9)
10eb: cmp ax, 0xbd
10ef: jbe 0x10f3
10f1: mov al, 0xbd                    ; min(189, ...)
10f3: neg al
10f5: add al, 0xbe                    ; 190 - min(189, ...)  (reverses the axis for free)
```

The ray loop advances its map address by **a 16-bit delta table** (`add dx, [ebp*2+0xcc6]` at 0x12fc): `T[i]` stores `dy*256+dx` already differenced
(`T[i] -= T[i-1]` in the ripple setup), so the walk along a ray, including the sinusoidal "ripple" bend, costs one 16-bit add and wraps on the 256x256 map by itself
(`dx = (dx + T[n]) & 0xffff` in `web/parts/terrain.js`).

---

## 3. Self-generated blur code, one block per 4-pixel group (feedback text, 0x13922)

The "NOOON / BRING YOUR BEAUTY FAMILY" parts (`textg`, `parth`) are a feedback blur with a slow zoom. Instead of a general loop, init **writes the loop out as straight-line
code**, one block per group of four pixels, with the zoomed source offsets burned in as immediates:

```
13967: mov edx, 0x10000 / call alloc ; 64 KB buffer for code, address in [0x13040]
139a2: mov ebx, [edx]               ; source column x' of group k  (table 0x12814)
139a7: mov ax, 0x868b / stosw       ; emits  8b 86 <disp32>   = mov eax, [esi + x'-1]
139ad: lea eax,[ebx-1] / stosd
139b1: mov ax, 0xae8b / stosw       ; emits  8b ae <disp32>   = mov ebp, [esi + x'+1]
139b7: lea eax,[ebx+1] / stosd
139bb: mov ax, 0xc503 / stosw       ; emits  03 c5            = add eax, ebp
   ... same for [esi + x'-0x140] and [esi + x'+0x140] ...
139e7: mov al, 0xc1 / stosb ; mov ax,0x2e8 / stosw    ; emits c1 e8 02 = shr eax, 2
139f0: mov ax, 0xc223 / stosw                         ; emits 23 c2    = and eax, edx (0x1f1f1f1f)
139f6: mov ax, 0x8389 / stosw ; mov eax, ecx / stosd  ; emits 89 83 <4k> = mov [ebx + 4k], eax  (VRAM)
139ff: mov al, 0xab / stosb                           ; emits ab        = stosd (same value -> next buffer)
13a02: add ecx, 4 / cmp ecx, 0x140 / jne 0x139a2      ; 80 groups per row
13a0d: mov al, 0xc3 / stosb                           ; ret
```

and the caller (0x13579..0x135b2) just runs the generated routine once per output row:

```
13594: imul esi, [ecx*4+0x12d14], 0x140   ; source row (zoomed: ((y-100)*120>>7)+100)
1359f: add  esi, [0x13038]                ; + source buffer
135a5: call [0x13040]                     ; generated row routine
135ab: add  ebx, 0x140 / dec ecx / jns 0x13594
135b4: ... xchg [0x1303c], eax ... swap source/destination buffers
```

Why it is clever:

* every neighbour address (left, right, up, down for a *scaled* source column) is an **immediate**, so the zoom costs zero arithmetic in the loop: the whole per-row work
  is four dword loads, three adds, a shift, a mask, and two stores, per four pixels. The column zoom table (`((x-160)*120+64)>>7)+160`, 80 entries) exists only
  at generation time.
* the four pixels are blurred **in one 32-bit register**: `(a+b+c+d)>>2` computed on whole dwords, then `& 0x1f1f1f1f`. The mask throws away the carries that leaked from
  one byte into its neighbour and the bits shifted in from the next byte (pixel values stay 0..31, which is why the palette has only 32 colours here).
  The JS port keeps this exactly (`rd(...)+rd(...)+... >>> 2) & 0x1f1f1f1f` in `web/parts/textg.js`).
* the store goes to VRAM (`mov [ebx+4k],eax`) and, through a trailing `stosd` with `edi = the other buffer`, to the feedback buffer at the same time: one result,
  no VRAM read-back (presumably the reason: VRAM reads were slow on that hardware).
* the code buffer is 64 KB, the generated routine is about 80 x 42 bytes (this is my arithmetic from the emitted bytes: 6+6+2+6+2+6+2+3+2+6+1 per block), plus a `ret`.

---

## 4. A decompressor whose bit reader is a `shr`/`dec`/`jae` triple (resource `dlz`, 0x4ad47)

All 58 resources are in the EXE's overlay, most of them packed with a custom LZ ("dlz", with a 17-byte header whose first six bytes decode as `mov ah,4c / int 21` as a decoy). The
decoder reads flag bits LSB-first from a 16-bit word. Every bit fetch is the same five instructions:

```
4ad5f: shr bp, 1             ; next flag bit -> CF
4ad62: dec dl                ; bits left in the word (dec keeps CF)
4ad64: jne 0x4ad6e
4ad66: mov dl, 0x10          ; reload:
4ad68: mov bp, [esi]         ;   next 16 flag bits
4ad6b: lea esi, [esi+2]      ;   (mov/lea keep CF too)
4ad6e: jae 0x4ad73           ; CF=0 -> match, CF=1 -> literal
4ad70: movsb                 ; literal byte
4ad71: jmp 0x4ad5f
```

The trick is that **CF survives** `dec`, the `mov` reload and the `lea` pointer bump, so the refill logic sits *between* the shift and the branch that uses its carry with no
`pushf`/`popf` and no extra bit-count compare. Match decoding then builds the offset high byte with `rcl bh,1` in a `loop` (0x4adcc/0x4adce), and copies with `lea esi,[edi+ebx]` /
`rep movsb` where `bh` starts at `0xff`, so the displacement is a negative 16-bit offset for free (`0x4add5`). The end marker is offset `-1` with a clear flag
(0x4ad9a: `cmp bh,bl`). `re/dlz.py` is a Python transcription of this decoder, used by `re/extract.py` to extract the resources.

---

## 5. Packing a bilinear texture coordinate with `shld` (warped picture, 0x9c81)

`partc` shows three pictures through a quad warped by four sinusoidally wobbling curves. The inner loop produces two pixels per iteration and keeps a texture position as a
single 32-bit word `X<<16 | Y` (8.8 | 8.8):

```
9c81: mov eax, [ecx*8+0x8a30]    ; running "column start" (X<<16|Y packed)
9c88: mov ebx, [ecx*8+0x8f30]    ; per-row step of that column
9c8f: add eax, ebx
9c91: mov [ecx*8+0x8a30], eax    ; store back: the column state is advanced in place
9c98: add eax, ebp               ; + running row offset
9c9a: add ebp, esi               ;   which itself advances by a per-pixel step (second order)
9c9c: mov bl, ah                 ; Y integer byte
9c9e: shld ebx, eax, 8           ; shift it up and pull in X integer byte (bits 31..24)  -> bx = Y8<<8 | X8
9ca2: mov eax, [ecx*8+0x8a34]    ; next pixel of the pair (second column array)
9ca9: mov dl, fs:[bx]            ; texel
   ...
9cc7: mov dh, fs:[bx]
9ccc: mov [edi], dx              ; two pixels, one store
```

Why it is nice: the texture address `(Y8<<8)|X8` needs bytes from *two different halves* of the packed word; `mov bl,ah` + `shld ebx,eax,8` assembles them in two instructions with no masks
and no shift-and-or, and `fs:[bx]` addressing then wraps the 256x256 picture (built in init by cropping the 320x200 picture to 256 columns and stretching the rows to 256) for free. The
position is *linear in three terms* (column start + row offset + a per-pixel step that is itself accumulated, `add ebp,esi`), so there is **no multiplication in the loop**; the
`idiv`s that compute the steps (`/200`, see 0x9b57, 0x9b8e) run once per column or row, not per pixel. The port (`render()` in `web/parts/partc.js`) keeps the 32-bit wrap-around and the
`shr`-versus-`sar` details.

The four curves themselves come from one routine, `0x9a02`, called four times with only the angle step (`ebp`), start angle (`edx`), count and destination changed:

```
99a3: mov edi, 0x6990 / mov ebp, 0x333333     ; top edge,    +3.2 table steps per point
99be: mov ebp, 0xffcccccd  / mov edi, 0x7390  ; bottom edge, negative step
99de: mov ebp, 0x51eb85    / mov edi, 0x83d0  ; right edge
99f8: mov ebp, 0xffae147b  / mov edi, 0x7d90  ; left edge
9a02: shl edx, 0x14 ... add edx, ebp          ; 12-bit angle in the top bits, step in 0.20 fixed point
```

The angle is kept in the top 12 bits of a 32-bit register (`shl edx,0x14`) so a single `add edx,ebp` both steps it and wraps it at one turn; `shr esi,0x14` recovers the table index.
(Arithmetic from the immediates: 0x333333 / 2^32 * 4096 = 3.2 table steps per point, x 320 points = 1024 steps = a quarter turn, which agrees with "quarter circles" in `re/parts/partc.md`.)

---

## 6. A tiny PRNG (0x4af10)

```
4af13: mov eax, [0x4af35]       ; seed (stored in the code segment, right after the ret)
4af18: xor eax, 0x78d47e5d
4af1d: imul eax, eax, 0xd413d473
4af23: rol eax, 18
4af26: mov [0x4af35], eax
4af2b: xor edx, edx / pop ebx / div ebx      ; % n
4af30: mov eax, edx
```

xor-multiply-rotate: three cheap instructions give an acceptable generator, and the `div` by the caller's limit is the modulo. It is used only by the text parts (random dots,
`rand(100)+50`, `rand(160)+80`, `rand(256)&1`, and one `rand(4000)` whose result is thrown away but whose RNG advance matters for the dot sequence). The seed depends on how many random
numbers earlier parts consumed, so the port's default seed is just the harness value `0x7ea9` and the dot positions cannot be bit-reproduced against a real run.

---

## What is *not* covered

* The 3D engine (`0x78000..0x7a210` + the polygon routines at `0x4d2xx..0x54xxx`, shared by parts b, d, e2, f, i and j) is ported bit-exactly (`web/lib3d.js`, see `re/parts/lib3d.md`) but
  I did not extract a listing worth showing from it for this document.
* The sprite precalculation of part F (64 frames x 16 spheres, RLE-encoded, 1.2 MB) and the part J stream decoder were not disassembled for this write-up.
* The decrypting stub (word-decrypt loop and INT 1 / INT 3 state machine) is documented in `re/NOTES.md`; it is emulated, not ported.
