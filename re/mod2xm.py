#!/usr/bin/env python3
"""STARS music (re/out/01.dec: 16CH MOD with 256-entry order table) -> XM (libopenmpt/chiptune3 compatible).
Order numbers are preserved 1:1 (the demo script syncs on (order<<8)|row).
usage: python3 re/mod2xm.py re/out/01.dec web/stars.xm"""
import struct, sys, math
src = open(sys.argv[1], 'rb').read()
NCH, NORD = 16, 256
title = src[0:20]
smp = []                                                  # 31 x (name,len,ft,vol,loop_start,loop_len) in bytes
for s in range(31):
    o = 20 + s * 30
    n, ft, vol, ls, ll = struct.unpack('>HBBHH', src[o + 22:o + 30])
    smp.append((src[o:o + 22], n * 2, ft & 15, vol, ls * 2, ll * 2))
songlen, restart = src[950], src[951]
orders = list(src[952:952 + NORD]); npat = max(orders) + 1
assert src[952 + NORD:952 + NORD + 4] == b'16CH'
pbase = 952 + NORD + 4; dbase = pbase + npat * 64 * NCH * 4
PER = [856,808,762,720,678,640,604,570,538,508,480,453,428,404,381,360,339,320,302,285,269,254,240,226,214,202,190,180,170,160,151,143,135,127,120,113]
# MOD period 428 (index 12) must be XM C-4 = note 49  => note = 37 + idx
def note(p):
    if p == 0: return 0
    k = min(range(36), key=lambda i: abs(PER[i] - p)); return 37 + k
out = bytearray(b'Extended Module: ')
out += title.ljust(20, b'\0')[:20] + b'\x1a' + b'stars-mod2xm'.ljust(20, b'\0') + struct.pack('<H', 0x104)
out += struct.pack('<IHHHHHHHH', 276, songlen, restart, NCH, npat, 31, 0, 6, 125)   # flags 0 = Amiga freq table
out += bytes(orders)
# default pan: Amiga LRRL via 8xx on first free effect slot (done below)
pans = [0x30 if c % 4 in (0, 3) else 0xd0 for c in range(NCH)]
done = set()
pats = []
for p in range(npat):
    rows = []
    for r in range(64):
        row = []
        for c in range(NCH):
            o = pbase + ((p * 64 + r) * NCH + c) * 4; a, b, cc, d = src[o:o + 4]
            per = ((a & 15) << 8) | b; ins = (a & 0xf0) | (cc >> 4); eff, par = cc & 15, d
            row.append([note(per), ins, eff, par])
        rows.append(row)
    pats.append(rows)
for o in orders[:songlen]:                                # pan injection in play order
    for r in range(64):
        for c in range(NCH):
            cell = pats[o][r][c]
            if c not in done and cell[2] == 0 and cell[3] == 0 and (r > 0 or True):
                cell[2], cell[3] = 8, pans[c]; done.add(c)
for rows in pats:
    pk = bytearray()
    for row in rows:
        for n, i, e, par in row:
            m = 0x80 | (1 if n else 0) | (2 if i else 0) | (8 if (e or par) else 0) | (16 if (e or par) else 0)
            pk.append(m)
            if n: pk.append(n)
            if i: pk.append(i)
            if e or par: pk += bytes([e, par])
    out += struct.pack('<IBHH', 9, 0, 64, len(pk)) + pk
pos = dbase
for s, (name, n, ft, vol, ls, ll) in enumerate(smp):
    data = src[pos:pos + n]; pos += n
    loop = ll > 2
    ih = struct.pack('<I22sBHI', 263, name, 0, 1, 40); ih += bytes(263 - len(ih))   # no envelopes, keymap all 0
    out += ih
    if loop and ls + ll > n: ll = max(0, n - ls)
    sf = ft if ft < 8 else ft - 16
    d = bytearray(); prev = 0
    for v in data:                                        # signed 8-bit -> XM delta
        d.append((v - prev) & 255); prev = v
    out += struct.pack('<IIIBbBBb', n, ls if loop else 0, ll if loop else 0, vol, sf * 16, 1 if loop else 0, 128, 0) + bytes([0]) + name
    out += d
open(sys.argv[2], 'wb').write(out)
print('patterns', npat, 'songlen', songlen, 'bytes', len(out))
