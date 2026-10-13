#!/usr/bin/env python3
"""cmp.py A.png B.png [diff.png] -> mean abs RGB diff (0 = identical) and % of differing pixels; optional side-by-side-with-diff image"""
import sys
from PIL import Image, ImageChops
a, b = Image.open(sys.argv[1]).convert('RGB'), Image.open(sys.argv[2]).convert('RGB')
d = ImageChops.difference(a, b); px = list(d.getdata()); n = len(px)
print('mean abs diff %.2f  differing pixels %.1f%%' % (sum(sum(p) for p in px) / n / 3, 100 * sum(1 for p in px if any(p)) / n))
if len(sys.argv) > 3:
    s = Image.new('RGB', (960, 200)); s.paste(a, (0, 0)); s.paste(b, (320, 0)); s.paste(d.point(lambda v: min(255, v * 4)), (640, 0)); s.save(sys.argv[3])
