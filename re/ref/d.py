#!/usr/bin/env python3
"""usage: d.py ADDR [COUNT]  -- 32-bit disasm of re/image32.bin from ADDR (hex)"""
import sys, os
from capstone import *
m = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'image32.bin'), 'rb').read()
a = int(sys.argv[1], 16); n = int(sys.argv[2]) if len(sys.argv) > 2 else 40
for i in Cs(CS_ARCH_X86, CS_MODE_32).disasm(m[a:a + n * 8], a):
    print('%06x %-18s %s %s' % (i.address, i.bytes.hex(), i.mnemonic, i.op_str))
    n -= 1
    if n == 0: break
