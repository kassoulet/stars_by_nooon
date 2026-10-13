# lib3d (shared 3D engine) -- web/lib3d.js

Original code: image 0x78000..0x7a210 (engine) + polygon rasterizers at 0x4d2xx..0x54xxx. Everything is bit-exact 32-bit fixed point (matrices .10, projection `0xa0 + x/((dist - z>>10)<<shift)`).
Verification: partb render buffer == original for 17 ticks from 3..2345 (pixel exact, plus palette); random-triangle unit tests (original function called in Unicorn vs JS, sha1 of 64000 B):
0x51593 400/400, 0x4e710 400/400, 0x4f47c 500/500, 0x54548 494/500 (see "not done"). Test tooling: re/parts/lib3d_tmp/{u.py,seq.py,tritest.py,tritest.mjs,cmpgt.mjs}.

## Original entry points
| addr | what | JS |
|---|---|---|
|0x787fc|init/reset (cam=0, rot=0, buffers)|`new Lib3D()` / `reset()`|
|0x788dd|shutdown|(nothing)|
|0x78905|flip: back buffer lines 1..197 -> VRAM, back buffer := background (res 19)|`flip(vram)`|
|0x78948|same but back buffer := constant|`flipClear(vram,c)`|
|0x7871c|sqrt table (value n repeated 2n+1x) **in the back buffer memory** (0x682d0 is both)|`sqrtTable()` (back buffer IS the table, like the original)|
|0x79cbf|approx sqrt via that table|`sqrt()`|
|0x7873a|radial 256x256 "light/env map" into the fs buffer (0x582d0); dl = 0/2/3/4 quantisation, ramp = 128 B table|`makeEnvMap(ramp, dl, dither)`|
|0x78c62|load object ('B!' 1a 0f|00)|`parseObject(bytes)` + `newObject(...)`|
|0x79808|radius = max vertex length|inside `newObject`|
|0x79111/0x7916b|scene / add object|`newScene()`, `scene.objs.push(obj)`|
|0x79483|render scene (camera, visibility, sort objects far->near, draw each)|`render(scene)`|
|0x789c4|draw one object (5-stage pipeline, table of modes at 0x784d1)|`drawObject(o, viaCam)` (viaCam=false = object matrix only, pos used raw)|
|0x7984e/0x79d25|angle matrix / matrix product|`makeMatrix`, `mulMatrix`|
|0x78a35/0x79b16|vertex transform + projection|`project`|
|0x78a15/0x789f5|lighting: rotate vertex / face normals by (obj angles + global `rot`)|`lightVertex`, `lightFace`|
|0x78b08|backface cull + depth key + sort (0x7898d quirky quicksort, ported literally: tie order matters)|`cull`, `sortList`|
|0x79841|morph weight table (128 words)|`setMorphTable`|
|0x78fda/0x78ffe|morph animation step / vertex interpolation|`advanceAnim`, `morph` (untested, no coverage in partb)|
|0x79192|alt. render (z limit [0x57aba]), no callers|not ported|
|0x79da0|sine table builder, never called; table is static data at 0x5599c|`SIN` (embedded base64; SIN[a]=1023cos(2pi a/4096), sin(a)=SIN[(a-0x400)&0xfff])|

## Object format
magic `42 21 1a 0f|00`, u16 nverts, u16 nfaces, vertices 16 B {x,y,z,nx,ny,nz int16 (normal 256=1), attr u16 (u|v<<8 texture coords), pad}, faces 16 B {w0 (type, mode 20: 1 = other triangle routine), i1,i2,i3, face normal xyz, pad}. Magic byte 3 = 0 (res 24, 51): morph object, extra key frames of nverts*16 B follow the base object (`o.data.frames`); anim = `{keys:[frame idx...(+wrap entry)], shift, steps}` passed to `newObject`.

## API (class Lib3D)
Fields: `cam {x,y,z,a,b,c}` (angles 12 bit), `rot {a,b,c}` (global angles added to every object's angles for lighting only: moves reflections), `dist` ([0x57ab6], 0x50 partb), `shift` ([0x5594c]), `mode`, `flags` (bit0: no face sort),
buffers `back` (64 KB), `gs` (texture, 0x55912), `ds` (displacement map, 0x558dc), `fs` (env map, 0x55918), `bg` (64000 B background for flip), `morphTable`.
Typical use (see web/parts/partb.js): `L=new Lib3D(); L.gs=..; L.ds=..; L.bg=..; L.makeEnvMap(ramp,0); scene=L.newScene(); obj=L.newObject(parseObject(res),x,y,z,ax,ay,az); scene.objs.push(obj);` per frame: `L.flip(vram); L.render(scene)`.
Object coordinates are world units, `render` makes them camera relative <<10. Angles int, wrap 4096.
Shading modes (L.mode; original table row i: [transform, light, cull, per-vertex setup, raster]): **15** (env+bump: tex gs[uv]+fs[ds-word+normal-uv]; used by partb and the res-24 part), **3/2** (flat env map lookup fs[normal-uv], shift 12/11), **20** (per-face type: w0==1 -> 2-attr env triangle on gs, else 'warp' fs[ds16[v,2u]+d]). Rasterizer exports for tests: `_tri4, _tri2, _tri4w320, _tri4w256`.
Rasterizer quirks kept: stale slope variables from the previous triangle when |dy|==1, 16-bit carries in the row increments, rows 0, 198,199 never drawn (mode 15), right/left edge fixed by winding.

## Not done / residual
* Mode 21 (0x4deb1 -> 0x54548 / 0x52e96, 256-wide targets) not wired: 0x54548 port (`V_WARP256`) mismatches 6/500 random triangles (all with y>=205, bottom clip), 0x52e96 (2-attr 256 variant, single span function at 0x5324f) not ported. 22 other table modes never selected by the demo (modes used anywhere: 2,3,15,20,21).
* Mode 2/3/20 verified at rasterizer level only (the full pipeline is the same code as mode 15 except stages 4/5). Morph functions untested. Camera path [0x5799c]==1 variant (0x79df3) not ported.
* Original keeps the sqrt table in the back buffer, so `sqrt()` after the first flip returns garbage (as in the original); only call at object creation.
