#!/usr/bin/env python3
"""Convert image-like resources (re/out/*.dec) to PNG in re/png/.
 - 64768 B : 768 B 6-bit palette + 320x200 8bpp
 - raw 64000/65536/66303.. : image with palettes of the same demo part (PAL below), written as NN_palP.png
 - NN_gray.png always written for 8bpp blobs"""
import os, sys
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__)); out = f'{here}/out'; png = f'{here}/png'; os.makedirs(png, exist_ok=True)
rd = lambda i: open(f'{out}/{i:02d}.dec', 'rb').read()
PALS = {4: [2, 3], 15: [16, 17, 19, 5, 6, 7], 20: [21, 23, 25], 22: [21, 23, 25], 26: [27, 29, 30, 32, 33, 35], 31: [27, 29, 30, 32, 33, 35], 42: [43, 44, 47], 48: [43, 44, 47]}
def pal(d): return [min(255, v * 4 + (v >> 4)) for v in d[:768]]   # VGA 6-bit -> 8-bit
def save(d, w, h, p, name):
    im = Image.frombytes('P', (w, h), d[:w * h]); im.putpalette(p); im.convert('RGB').save(f'{png}/{name}.png')
gray = [v for i in range(256) for v in (i, i, i)]
for i in range(1, 59):
    d = rd(i); n = len(d)
    if n == 64768: save(d[768:], 320, 200, pal(d), f'{i:02d}')
    elif n in (64000, 65535, 65536, 66303, 65546, 65984, 65536): 
        w, h = (320, n // 320) if n in (64000, 66303, 65535) else (256, n // 256)
        save(d, w, h, gray, f'{i:02d}_gray')
        for p, targets in PALS.items():
            if i in targets: save(d, w, h, pal(rd(p)), f'{i:02d}_pal{p}')
