#!/usr/bin/env python3
"""Reference harness: runs the ORIGINAL 32-bit demo code (re/image32.bin) in Unicorn, flat model (all bases 0),
with hardware/DPMI/loader stubbed, and dumps VGA frames (mode 13h) -> PNG.  Ground truth for the JS ports.
usage: harness.py [--start 0xe0] [--order N] [--row R] [--frames F] [--every K] [--out DIR] [--maxinstr N]
 --order/--row : virtual music position at start (script syncs on (order<<8)|row, read via [0x1c829]=order,[0x1c828]=row)
"""
import sys, os, struct, argparse, time
from unicorn import *
from unicorn.x86_const import *
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); RE = os.path.dirname(HERE)
ap = argparse.ArgumentParser()
ap.add_argument('--start', type=lambda x: int(x, 0), default=0xe0)
ap.add_argument('--order', type=lambda x: int(x, 0), default=0); ap.add_argument('--row', type=int, default=0)
ap.add_argument('--frames', type=int, default=200); ap.add_argument('--every', type=int, default=10)
ap.add_argument('--out', default=os.path.join(RE, 'ref', 'frames')); ap.add_argument('--maxinstr', type=int, default=2_000_000_000)
ap.add_argument('--verbose', action='store_true'); ap.add_argument('--trace', type=int, default=0)
ap.add_argument('--snapshot', help='path: if missing, run prologue (0xe0..0xf5 = global init, ~90 s) and save; if present, load it and skip prologue')
ap.add_argument('--quiet-calls', action='store_true', help='do not print CALL trace lines for 0x29f80')
A = ap.parse_args()
os.makedirs(A.out, exist_ok=True)

# ---- music timeline (order,row) vs time, from the MOD ----
def timeline():
    d = open(os.path.join(RE, 'out', '01.dec'), 'rb').read()
    orders = list(d[952:1208]); songlen = d[950]; pb = 1212
    speed, tempo, t, o, r, ev = 6, 125, 0.0, 0, 0, []
    while o < songlen and t < 900:
        ev.append((t, o, r)); jo = br = None
        for c in range(16):
            x = pb + ((orders[o] * 64 + r) * 16 + c) * 4; e = d[x + 2] & 15; p = d[x + 3]
            if e == 15: (speed := p) if 0 < p < 32 else None; tempo = p if p >= 32 else tempo
            if e == 11: jo = p
            if e == 13: br = (p >> 4) * 10 + (p & 15)
        t += speed * 2.5 / tempo
        if jo is not None: o, r = jo, (br or 0)
        elif br is not None: o, r = o + 1, br
        else:
            r += 1
            if r >= 64: o, r = o + 1, 0
    return ev
TL = timeline()
def pos_at(t):
    lo = 0
    for i, (ts, o, r) in enumerate(TL):
        if ts <= t: lo = i
        else: break
    return TL[lo][1], TL[lo][2]
t0 = next((ts for ts, o, r in TL if (o, r) >= (A.order, A.row)), 0.0)

# ---- machine ----
IMG = open(os.path.join(RE, 'image32.bin'), 'rb').read()
mu = Uc(UC_ARCH_X86, UC_MODE_32); MEM = 0x4000000
mu.mem_map(0, MEM); mu.mem_write(0, IMG)
GDT = 0x8d000; gdt = bytearray(8 * 4096)
def desc(base, limit, acc):
    g = 1 if limit > 0xfffff else 0
    if g: limit >>= 12
    return struct.pack('<HHBBBB', limit & 0xffff, base & 0xffff, (base >> 16) & 255, acc, 0x40 | (0x80 if g else 0) | ((limit >> 16) & 15), base >> 24)
gdt[8:16] = desc(0, 0xffffffff, 0x9b); gdt[16:24] = desc(0, 0xffffffff, 0x93)
nsel = [3]; LIM = {}
def new_sel(base, size):
    i = nsel[0]; nsel[0] += 1; LIM[i] = size - 1
    gdt[i * 8:i * 8 + 8] = desc(base, size - 1, 0x93); mu.mem_write(GDT, bytes(gdt)); return i * 8
mu.mem_write(GDT, bytes(gdt)); mu.reg_write(UC_X86_REG_GDTR, (0, GDT, len(gdt) - 1, 0))
mu.reg_write(UC_X86_REG_CR0, mu.reg_read(UC_X86_REG_CR0) | 1)
mu.reg_write(UC_X86_REG_CS, 8)
for r in (UC_X86_REG_DS, UC_X86_REG_ES, UC_X86_REG_SS, UC_X86_REG_FS, UC_X86_REG_GS): mu.reg_write(r, 16)
mu.reg_write(UC_X86_REG_ESP, 0x9f000)
heap = [0x400000]
def alloc(n):
    n = (n + 15) & ~15; p = heap[0] + 16; heap[0] += n + 16
    assert heap[0] < MEM - 0x100000, 'heap exhausted'
    mu.mem_write(p - 4, struct.pack('<I', n)); return p
R = lambda r: mu.reg_read(r)
W = lambda r, v: mu.reg_write(r, v & 0xffffffff)
def ret(): 
    sp = R(UC_X86_REG_ESP); W(UC_X86_REG_EIP, struct.unpack('<I', mu.mem_read(sp, 4))[0]); W(UC_X86_REG_ESP, sp + 4)
def rd32(a): return struct.unpack('<I', mu.mem_read(a, 4))[0]
# palette / frame state
pal = bytearray(768); dac = {'idx': 0, 'comp': 0, 'rd_idx': 0, 'rcomp': 0}
st = {'frames': 0, 'poll': 0, 'reads': 0, 'time': 0.0, 'saved': 0, 'wr3da': 0}
def dump(final=False):
    f = st['frames']
    if f % A.every and not final: return
    px = bytes(mu.mem_read(0xa0000, 64000)); p = [min(255, v * 4 + (v >> 4)) for v in pal]
    if A.verbose: print('frame', f, 'vram nonzero', sum(1 for v in px if v), 'pal nonzero', sum(1 for v in pal if v), 'eip', hex(R(UC_X86_REG_EIP)))
    im = Image.frombytes('P', (320, 200), px); im.putpalette(p); im.save(f'{A.out}/f{f:05d}.png'); st['saved'] += 1
def setpos():
    o, r = pos_at(t0 + st['frames'] / 70.0 + st['poll'] / 2000.0); mu.mem_write(0x1c829, bytes([o])); mu.mem_write(0x1c828, bytes([r]))
    return o, r
st.update(ph=0, div=65536, delivered=0, pitlatch=None, skip=None, ticks=0)
def vtime(): return st['frames'] / 70.0 + st['poll'] / 2000.0
def pit_rate(): return 1193182.0 / st['div']
TRACE=[0]
def _tr(uc,a,sz,ud):
    if TRACE[0]>0: TRACE[0]-=1; print('  tr',hex(a),bytes(uc.mem_read(a,sz)).hex(),'esp',hex(R(UC_X86_REG_ESP)))
if A.trace: mu.hook_add(UC_HOOK_CODE,_tr)
def inject(uc, ret):
    TRACE[0]=A.trace
    if A.verbose: print('inject at', hex(ret), 'esp', hex(R(UC_X86_REG_ESP)), 'tick', st['ticks'])                                   # fake IRQ0: push eflags,cs,eip ; jump to the timer ISR (0x4ac1f)
    sp = R(UC_X86_REG_ESP) - 12; uc.mem_write(sp, struct.pack('<III', ret, 8, R(UC_X86_REG_EFLAGS) | 0x200)); W(UC_X86_REG_ESP, sp); W(UC_X86_REG_EIP, 0x4ac1f)
def due(): return int(vtime() * pit_rate()) - st['delivered']
def vsync_site(uc, a, sz, ud):                         # code hook on every `in al,dx` of port 0x3da
    if st['skip'] == a: st['skip'] = None
    else:
        st['reads'] += 1; ph = (st['reads'] // 2) & 1
        if ph and st['ph'] == 0:
            st['frames'] += 1; setpos(); dump()
            if st['frames'] >= A.frames: uc.emu_stop(); return
        st['ph'] = ph
    if due() > 0:
        st['delivered'] += 1; st['ticks'] += 1; st['skip'] = a; inject(uc, a)
def port_in(uc, port, size, ud):
    if port == 0x3da: return 9 if st['ph'] else 0
    if port == 0x3c9:
        v = pal[dac['rd_idx'] * 3 + dac['rcomp']]; dac['rcomp'] += 1
        if dac['rcomp'] == 3: dac['rcomp'] = 0; dac['rd_idx'] = (dac['rd_idx'] + 1) & 255
        return v
    return 0
def port_out(uc, port, size, val, ud):
    if port == 0x43: st['pitlatch'] = []
    elif port == 0x40 and st['pitlatch'] is not None:
        st['pitlatch'].append(val & 255)
        if len(st['pitlatch']) == 2:
            st['div'] = (st['pitlatch'][1] << 8 | st['pitlatch'][0]) or 65536; st['delivered'] = int(vtime() * pit_rate()); st['pitlatch'] = None
            if A.verbose: print('PIT div', st['div'], 'rate %.1f' % pit_rate())
    elif port == 0x3c8: dac['idx'] = val & 255; dac['comp'] = 0
    elif port == 0x3c7: dac['rd_idx'] = val & 255; dac['rcomp'] = 0
    elif port == 0x3c9:
        pal[dac['idx'] * 3 + dac['comp']] = val & 63; dac['comp'] += 1
        if dac['comp'] == 3: dac['comp'] = 0; dac['idx'] = (dac['idx'] + 1) & 255
    elif A.verbose and port not in (0x20, 0x21): print('out', hex(port), hex(val))
mu.hook_add(UC_HOOK_INSN, port_in, None, 1, 0, UC_X86_INS_IN)
mu.hook_add(UC_HOOK_INSN, port_out, None, 1, 0, UC_X86_INS_OUT)
def on_int(uc, n, ud):
    ax = R(UC_X86_REG_EAX) & 0xffff
    if n == 0x31 and ax == 7:
        i = (R(UC_X86_REG_EBX) & 0xffff) >> 3; base = ((R(UC_X86_REG_ECX) & 0xffff) << 16) | (R(UC_X86_REG_EDX) & 0xffff)
        gdt[i * 8:i * 8 + 8] = desc(base, LIM.get(i, 0xffff), 0x93); mu.mem_write(GDT, bytes(gdt))
    elif n == 0x31 and ax == 1: pass
    elif n == 0x21 and ax >> 8 == 0x2c: W(UC_X86_REG_ECX, 0)
    elif n == 0x21 and ax >> 8 == 0x4c: print('EXIT', hex(ax)); uc.emu_stop()
    elif n == 0x10 or n == 0x21 and ax >> 8 in (2, 9): pass
    else: print('unhandled int', hex(n), hex(ax), 'at', hex(R(UC_X86_REG_EIP)))
mu.hook_add(UC_HOOK_INTR, on_int)
# --- function stubs (hooked at entry; do the work in python, then emulate `ret`) ---
def stub(addr, fn):
    def h(uc, a, sz, ud): fn(); ret()
    mu.hook_add(UC_HOOK_CODE, h, None, addr, addr)
stub(0x17bd7, lambda: W(UC_X86_REG_EAX, alloc(R(UC_X86_REG_EDX))))
stub(0x17c43, lambda: W(UC_X86_REG_EAX, alloc(R(UC_X86_REG_EDX))))
stub(0x17c8e, lambda: None)
stub(0x17cd2, lambda: mu.mem_write(R(UC_X86_REG_EAX) - 4, struct.pack('<I', (R(UC_X86_REG_EDX) + 15) & ~15)))
stub(0x17da3, lambda: W(UC_X86_REG_EBX, new_sel(R(UC_X86_REG_EAX), R(UC_X86_REG_EDX))))   # eax=base(+[0x17620]=0) edx=size -> bx selector
stub(0x17dfd, lambda: None)
def set_base():
    sel = R(UC_X86_REG_EBX) & 0xffff; i = sel >> 3; b = R(UC_X86_REG_EAX)
    d = bytearray(gdt[i * 8:i * 8 + 8]); d[2:4] = struct.pack('<H', b & 0xffff)[0:2]; d[2] = b & 255; d[3] = (b >> 8) & 255; d[4] = (b >> 16) & 255; d[7] = b >> 24
    gdt[i * 8:i * 8 + 8] = d; mu.mem_write(GDT, bytes(gdt))
# resources
sys.path.insert(0, RE)
def load_res():
    n = R(UC_X86_REG_EAX) & 0xffff; d = open(f'{RE}/out/{n:02d}.dec', 'rb').read()
    p = alloc(len(d) + 16); mu.mem_write(p, d); W(UC_X86_REG_EAX, p)
for a in (0x4a9f3, 0x4a9d3, 0x4aa5e): stub(a, load_res)
for a in (0x4a9f3,): pass
stub(0x4a98b, lambda: None); 
# position getter polled in idle loops -> advance virtual time a little
def pos_poll(uc, a, sz, ud):
    if st['skip'] == a: st['skip'] = None; return
    st['poll'] += 1; setpos()
    if due() > 0: st['delivered'] += 1; st['ticks'] += 1; st['skip'] = a; inject(uc, a)
mu.hook_add(UC_HOOK_CODE, pos_poll, None, 0x1c7a3, 0x1c7a3)
for ad in [m.start(1) for m in __import__('re').finditer(rb'\x66\xba\xda\x03(\xec)', IMG[:0x7a210])] + [0x4a83b, 0x1c5eb]: mu.hook_add(UC_HOOK_CODE, vsync_site, None, ad, ad)
# rep outsb/outsw (palette uploads)
def outs(uc, a, sz, ud):
    b = bytes(mu.mem_read(a, 3))
    pre = b[0] == 0xf3; op = b[1] if pre else b[0]
    if op in (0x6e, 0x6f) and (pre or True):
        port = R(UC_X86_REG_EDX) & 0xffff; esi = R(UC_X86_REG_ESI); n = R(UC_X86_REG_ECX) if pre else 1
        w = 1 if op == 0x6e else 4
        for _ in range(n):
            for k in range(w): port_out(uc, port, 1, mu.mem_read(esi + k, 1)[0], None)
            esi += w
        W(UC_X86_REG_ESI, esi); W(UC_X86_REG_EIP, a + sz)
        if pre: W(UC_X86_REG_ECX, 0)
# find all outs instruction addresses once
for m in __import__('re').finditer(rb'\xf3[\x6e\x6f]|(?<!\xf3)[\x6e\x6f]', IMG[:0x7a210]):
    pass
# trace entries of main-script calls (0xe0-0x472): log frame + music position
if True:
    import re as _re
    from capstone import Cs, CS_ARCH_X86, CS_MODE_32
    for i in Cs(CS_ARCH_X86, CS_MODE_32).disasm(IMG[0xe0:0x472], 0xe0):
        if i.mnemonic == 'call' and i.op_str.startswith('0x'):
            tgt = int(i.op_str, 16)
            def mk(tgt, at):
                def h(uc, a, sz, ud):
                    if rd32(R(UC_X86_REG_ESP)) != at + 5: return
                    if not (A.quiet_calls and tgt == 0x29f80): print('CALL %06x from %06x  frame %d pos %02x:%02x' % (tgt, at, st['frames'], *setpos()), flush=True)
                return h
            mu.hook_add(UC_HOOK_CODE, mk(tgt, i.address), None, tgt, tgt)
# init state expected by startup code
mu.mem_write(0x49fef, b'\x01')            # "no sound" flag -> skip module load
mu.mem_write(0, struct.pack('<I', alloc(0x177000)))
setpos()
import pickle, zlib
def snap_save(path):
    mem = bytes(mu.mem_read(0, 0xa0000)); hp = bytes(mu.mem_read(0x400000, heap[0] - 0x400000)); vg = bytes(mu.mem_read(0xa0000, 64000))
    pickle.dump(dict(mem=zlib.compress(mem), hp=zlib.compress(hp), vg=zlib.compress(vg), heap=heap[0], nsel=nsel[0], gdt=bytes(gdt), pal=bytes(pal)), open(path, 'wb'))
def snap_load(path):
    d = pickle.load(open(path, 'rb')); mu.mem_write(0, zlib.decompress(d['mem'])); mu.mem_write(0x400000, zlib.decompress(d['hp'])); mu.mem_write(0xa0000, zlib.decompress(d['vg']))
    heap[0] = d['heap']; nsel[0] = d['nsel']; gdt[:] = d['gdt']; mu.mem_write(GDT, bytes(gdt)); pal[:] = d['pal']
t = time.time()
start = A.start
mu.mem_write(0x4ab06, struct.pack('<III', 0x4abb4, 0x4abb4, 0x4abb4)); st['div'] = 0x4286    # main(): 0x4ab7d (timer ISR callbacks = ret) + 0x4abd4 (PIT = 0x4286 -> 70 Hz)
mu.mem_write(0x1762c, struct.pack('<H', 0x10))     # saved DS selector used by the timer ISR (snapshot must not clobber it)
if A.snapshot:
    if os.path.exists(A.snapshot): snap_load(A.snapshot)
    else:
        mu.emu_start(0xe0, 0xf5, count=A.maxinstr); snap_save(A.snapshot); print('snapshot saved', A.snapshot, '%.1fs' % (time.time() - t)); sys.exit(0)
    setpos(); mu.mem_write(0x1762c, struct.pack('<H', 0x10)); mu.mem_write(0x4ab06, struct.pack('<III', 0x4abb4, 0x4abb4, 0x4abb4))
try: mu.emu_start(start, 0, count=A.maxinstr)
except UcError as e: print('UcError', e, 'eip', hex(R(UC_X86_REG_EIP)), 'esp', hex(R(UC_X86_REG_ESP)))
print('frames', st['frames'], 'saved', st['saved'], 'eip', hex(R(UC_X86_REG_EIP)), 'pos', setpos(), '%.1fs' % (time.time() - t))
dump(True)
