#!/usr/bin/env python3
"""callgraph.py ADDR...  -- recursive descent from each entry; prints reachable code range, #bytes, resources loaded (mov eax,N ; call 4a9f3/4a9d3/4aa5e)
Library code (>=0x17900 except 0x1b...) and the 0x4a600-0x4d200 helpers are not followed (listed as 'lib calls')."""
import sys, os
from capstone import *
m = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'image32.bin'), 'rb').read()
md = Cs(CS_ARCH_X86, CS_MODE_32); md.detail = True
LOAD = (0x4a9f3, 0x4a9d3, 0x4aa5e)
def is_lib(a): return a >= 0x17900 and a < 0x7a210 and not (0x78000 <= a < 0x7a210) or 0x4a600 <= a < 0x4d200 and False
def walk(entry, follow_lib=False):
    seen = {}; todo = [entry]; res = []; calls = set()
    while todo:
        a = todo.pop()
        while a not in seen and 0 <= a < 0x7a210:
            ins = next(md.disasm(m[a:a + 16], a), None)
            if not ins: break
            seen[a] = ins
            if ins.mnemonic == 'mov' and ins.op_str.startswith('eax, 0x') and 'ptr' not in ins.op_str:
                last = int(ins.op_str.split(', ')[1], 16)
            if ins.mnemonic == 'call' and ins.op_str.startswith('0x'):
                t = int(ins.op_str, 16)
                if t in LOAD: res.append(last if 'last' in dir() else None)
                elif t >= 0x17900 and t < 0x78000 or (0x4a600 <= t < 0x4d200): calls.add(t)
                else: todo.append(t)
            if ins.mnemonic in ('jmp',) and ins.op_str.startswith('0x'): a = int(ins.op_str, 16); continue
            if ins.mnemonic.startswith('j') and ins.op_str.startswith('0x'): todo.append(int(ins.op_str, 16))
            if ins.mnemonic in ('ret', 'retf', 'iretd', 'jmp'): break
            a += ins.size
    return seen, sorted(set(r for r in res if r)), calls
if __name__ == '__main__':
    for e in sys.argv[1:]:
        e = int(e, 16); seen, res, calls = walk(e)
        ad = sorted(seen); print('%06x: %d insns, code %06x-%06x, resources %s' % (e, len(seen), ad[0], ad[-1], res))
