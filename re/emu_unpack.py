import sys
from unicorn import *
from unicorn.x86_const import *
d=open('/home/gautier/SynologyDrive/code/current/demos/stars/STARSv2.EXE','rb').read()
img=d[160:]
LOAD=0x1000  # segment
mu=Uc(UC_ARCH_X86,UC_MODE_16)
mu.mem_map(0,0x100000+0x10000)
mu.mem_write(LOAD*16,img[:0x100000-LOAD*16])
mu.mem_write((LOAD-0x10)*16,b'\xcd\x20')
cs=LOAD+0x1250
mu.reg_write(UC_X86_REG_CS,cs);mu.reg_write(UC_X86_REG_IP,0)
for r in (UC_X86_REG_DS,UC_X86_REG_ES):mu.reg_write(r,LOAD-0x10)
mu.reg_write(UC_X86_REG_SS,LOAD+0x1250);mu.reg_write(UC_X86_REG_SP,0x7da)
n=[0]
mu.mem_write((LOAD-0x10)*16+2,(0xa000).to_bytes(2,'little'))
def intr(uc,intno,ud):
    if intno not in (1,3): print('INT',hex(intno),'AX',hex(uc.reg_read(UC_X86_REG_AX)),'cs:ip',hex(uc.reg_read(UC_X86_REG_CS)),hex(uc.reg_read(UC_X86_REG_IP)))
    ip=uc.reg_read(UC_X86_REG_IP);c=uc.reg_read(UC_X86_REG_CS)
    # unicorn: IP at hook is after the instruction for int n? assume next ip
    ss=uc.reg_read(UC_X86_REG_SS);sp=uc.reg_read(UC_X86_REG_SP)
    fl=uc.reg_read(UC_X86_REG_EFLAGS)
    def push(v):
        nonlocal sp
        sp=(sp-2)&0xffff;uc.mem_write(ss*16+sp,v.to_bytes(2,'little'))
    push(fl&0xffff);push(c);push(ip)
    uc.reg_write(UC_X86_REG_SP,sp)
    v=bytes(uc.mem_read(intno*4,4))
    uc.reg_write(UC_X86_REG_EFLAGS,fl&~0x300)
    uc.reg_write(UC_X86_REG_CS,int.from_bytes(v[2:],'little'))
    uc.reg_write(UC_X86_REG_IP,int.from_bytes(v[:2],'little'))
    n[0]+=1
    if 0:print('int',intno,'ret',hex(c),hex(ip),'->',v.hex())
mu.hook_add(UC_HOOK_INTR,intr)
def inh(uc,port,size,ud):return 0
mu.hook_add(UC_HOOK_INSN,inh,None,1,0,UC_X86_INS_IN)
mu.hook_add(UC_HOOK_INSN,lambda *a:None,None,1,0,UC_X86_INS_OUT)
csl=[];first=[];cnt=[0];ring=[]
def code(uc,a,sz,ud):
    cnt[0]+=1; 
    c_=uc.reg_read(UC_X86_REG_CS)
    if not csl or csl[-1][0]!=c_: csl.append((c_,a-c_*16,cnt[0]))
    ring.append((uc.reg_read(UC_X86_REG_CS),a-uc.reg_read(UC_X86_REG_CS)*16,bytes(uc.mem_read(a,sz)).hex(),uc.reg_read(UC_X86_REG_AX),uc.reg_read(UC_X86_REG_BX))); ring[:]=ring[-40:]
mu.hook_add(UC_HOOK_CODE,code)
try: mu.emu_start(cs*16,0,count=int(sys.argv[1]))
except UcError as e: print('err',e)
print('instrs',cnt[0],'cs:ip',hex(mu.reg_read(UC_X86_REG_CS)),hex(mu.reg_read(UC_X86_REG_IP)))

for r in ring[-40:]:print(hex(r[0]),hex(r[1]),r[2],hex(r[3]),hex(r[4]))
open('mem.bin','wb').write(mu.mem_read(0,0x100000))

print([(hex(c),hex(i),n) for c,i,n in csl])
