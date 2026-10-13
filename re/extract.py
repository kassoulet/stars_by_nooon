#!/usr/bin/env python3
"""Extract + decompress all resources of STARSv2.EXE -> re/out/NN.bin (raw) / NN.dec (decompressed)
usage: python3 re/extract.py [STARSv2.EXE]"""
import struct, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from dlz import dlz
exe = sys.argv[1] if len(sys.argv) > 1 else 'STARSv2.EXE'
d = open(exe, 'rb').read(); n = len(d)
out = os.path.join(os.path.dirname(__file__), 'out'); os.makedirs(out, exist_ok=True)
for i in range(1, 59):                      # table = 12-byte entries at EOF, entry i at n-12*i
    idx, off, size = struct.unpack_from('<3I', d, n - 12 * i)
    off = n + off - (1 << 32)               # offset stored as negative, relative to EOF
    s = d[off:off + size]
    open(f'{out}/{idx:02d}.bin', 'wb').write(s)
    if s[6:9] == b'dlz': s = dlz(s)         # raw resources have no 'dlz' magic
    open(f'{out}/{idx:02d}.dec', 'wb').write(s)
