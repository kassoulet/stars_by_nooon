import struct
def dlz(src):
    """port of STARS decompressor at 0x4ad47 (PKLITE-like LZ). src = resource incl. 17-byte header"""
    p=0x11; out=bytearray()
    st=[struct.unpack_from('<H',src,p)[0],16]; p+=2
    def rd(): 
        nonlocal p
        v=src[p]; p+=1; return v
    def gb():
        nonlocal p
        b=st[0]&1; st[0]>>=1; st[1]-=1
        if st[1]==0:
            st[1]=16; st[0]=struct.unpack_from('<H',src,p)[0]; p+=2
        return b
    def copy(bh,bl,n):
        off=((bh<<8)|bl)-0x10000
        for _ in range(n): out.append(out[len(out)+off])
    while True:
        if gb(): out.append(rd()); continue
        b2=gb(); bl=rd(); bh=0xff
        if not b2:
            if gb():
                for _ in range(3): bh=((bh<<1)|gb())&255
                bh=(bh-1)&255
                copy(bh,bl,2); continue
            if bl!=0xff: copy(bh,bl,2); continue
            if gb(): continue
            return bytes(out)
        bh=((bh<<1)|gb())&255
        if not gb():
            dh=2
            for _ in range(3):
                if gb(): break
                bh=((bh<<1)|gb())&255; dh=(dh<<1)&255
            bh=(bh-dh)&255
        for cl in (3,4,5,6):
            if gb(): break
        else:
            if gb(): cl=8 if gb() else 7
            elif gb(): cl=rd()+0x11
            else:
                c=0
                for _ in range(3): c=(c<<1)|gb()
                cl=c+9
        copy(bh,bl,cl)
