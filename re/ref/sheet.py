#!/usr/bin/env python3
"""contact sheet: sheet.py OUT.png frames_dir [step=1] [first=0] [count=24] [cols=6]"""
import sys, glob
from PIL import Image, ImageDraw
out, d = sys.argv[1], sys.argv[2]; step = int(sys.argv[3]) if len(sys.argv) > 3 else 1
first = int(sys.argv[4]) if len(sys.argv) > 4 else 0; cnt = int(sys.argv[5]) if len(sys.argv) > 5 else 24; cols = int(sys.argv[6]) if len(sys.argv) > 6 else 6
fs = sorted(glob.glob(d + '/*.png'))[first::step][:cnt]
sh = Image.new('RGB', (cols * 160, ((len(fs) + cols - 1) // cols) * 100)); dr = ImageDraw.Draw(sh)
for k, f in enumerate(fs):
    x, y = (k % cols) * 160, (k // cols) * 100; sh.paste(Image.open(f).convert('RGB').resize((160, 100)), (x, y)); dr.text((x + 2, y + 2), f.split('/')[-1][:-4], fill=(255, 255, 0))
sh.save(out)
