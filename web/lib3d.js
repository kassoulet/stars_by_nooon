// STARS (Noooon, 1995) -- shared 3D engine, port of the original code at image offsets 0x78000..0x7a210
// (+ the polygon rasterizers that live at 0x4d2xx..0x54xxx). See re/parts/lib3d.md for the API and the mapping to the original entry points.
// Bit-exact port: 32-bit integer arithmetic, 16-bit register wrap, the same stale-variable quirks as the original.
// Only the shading modes actually used by the demo are implemented (see MODES).

const SIN_B64 = '/wP+A/4D/gP+A/4D/gP+A/4D/gP+A/4D/gP+A/4D/gP+A/4D/gP+A/4D/gP+A/4D/gP+A/4D/gP+A/0D/QP9A/0D/QP9A/0D/QP9A/0D/QP9A/wD/AP8A/wD/AP8A/wD/AP8A/sD+wP7A/sD+wP7A/sD+wP6A/oD+gP6A/oD+gP6A/kD+QP5A/kD+QP5A/gD+AP4A/gD+AP4A/cD9wP3A/cD9wP2A/YD9gP2A/YD9QP1A/UD9QP1A/QD9AP0A/QD8wPzA/MD8wPyA/ID8gPyA/ID8QPxA/ED8APwA/AD8APvA+8D7wPvA+4D7gPuA+4D7QPtA+0D7APsA+wD6wPrA+sD6wPqA+oD6gPpA+kD6QPoA+gD6APnA+cD5wPmA+YD5gPlA+UD5QPkA+QD5APjA+MD4gPiA+ID4QPhA+ED4APgA98D3wPfA94D3gPeA90D3QPcA9wD3APbA9sD2gPaA9kD2QPZA9gD2APXA9cD1gPWA9YD1QPVA9QD1APTA9MD0gPSA9ID0QPRA9AD0APPA88DzgPOA80DzQPMA8wDywPLA8oDygPJA8kDyAPIA8cDxwPGA8YDxQPFA8QDxAPDA8MDwgPCA8EDwQPAA78DvwO+A74DvQO9A7wDvAO7A7sDugO5A7kDuAO4A7cDtwO2A7UDtQO0A7QDswOyA7IDsQOxA7ADrwOvA64DrgOtA6wDrAOrA6sDqgOpA6kDqAOnA6cDpgOlA6UDpAOkA6MDogOiA6EDoAOgA58DngOeA50DnAOcA5sDmgOaA5kDmAOYA5cDlgOVA5UDlAOTA5MDkgORA5EDkAOPA44DjgONA4wDjAOLA4oDiQOJA4gDhwOGA4YDhQOEA4MDgwOCA4EDgAOAA38DfgN9A30DfAN7A3oDegN5A3gDdwN2A3YDdQN0A3MDcwNyA3EDcANvA28DbgNtA2wDawNrA2oDaQNoA2cDZgNmA2UDZANjA2IDYQNhA2ADXwNeA10DXANcA1sDWgNZA1gDVwNWA1YDVQNUA1MDUgNRA1ADTwNPA04DTQNMA0sDSgNJA0gDRwNHA0YDRQNEA0MDQgNBA0ADPwM+Az4DPQM8AzsDOgM5AzgDNwM2AzUDNAMzAzIDMQMwAzADLwMuAy0DLAMrAyoDKQMoAycDJgMlAyQDIwMiAyEDIAMfAx4DHQMcAxsDGgMZAxgDFwMWAxUDFAMTAxIDEQMQAw8DDgMNAwwDCwMKAwkDCAMHAwYDBQMEAwMDAgMBAwAD/wL+Av0C/AL7AvoC+QL4AvcC9QL0AvMC8gLxAvAC7wLuAu0C7ALrAuoC6QLoAucC5QLkAuMC4gLhAuAC3wLeAt0C3ALbAtkC2ALXAtYC1QLUAtMC0gLRAtACzgLNAswCywLKAskCyALHAsUCxALDAsICwQLAAr8CvQK8ArsCugK5ArgCtwK1ArQCswKyArECsAKvAq0CrAKrAqoCqQKnAqYCpQKkAqMCogKgAp8CngKdApwCmwKZApgClwKWApUCkwKSApECkAKPAo0CjAKLAooCiAKHAoYChQKEAoICgQKAAn8CfgJ8AnsCegJ5AncCdgJ1AnQCcgJxAnACbwJtAmwCawJqAmgCZwJmAmUCYwJiAmECYAJeAl0CXAJbAlkCWAJXAlUCVAJTAlICUAJPAk4CTQJLAkoCSQJHAkYCRQJEAkICQQJAAj4CPQI8AjoCOQI4AjcCNQI0AjMCMQIwAi8CLQIsAisCKQIoAicCJQIkAiMCIQIgAh8CHQIcAhsCGQIYAhcCFQIUAhMCEQIQAg8CDQIMAgsCCQIIAgcCBQIEAgMCAQIAAv8B/QH8AfoB+QH4AfYB9QH0AfIB8QHwAe4B7QHrAeoB6QHnAeYB5QHjAeIB4AHfAd4B3AHbAdkB2AHXAdUB1AHSAdEB0AHOAc0BywHKAckBxwHGAcQBwwHCAcABvwG9AbwBuwG5AbgBtgG1AbMBsgGxAa8BrgGsAasBqgGoAacBpQGkAaIBoQGfAZ4BnQGbAZoBmAGXAZUBlAGTAZEBkAGOAY0BiwGKAYgBhwGGAYQBgwGBAYABfgF9AXsBegF4AXcBdgF0AXMBcQFwAW4BbQFrAWoBaAFnAWUBZAFiAWEBYAFeAV0BWwFaAVgBVwFVAVQBUgFRAU8BTgFMAUsBSQFIAUYBRQFDAUIBQAE/AT0BPAE6ATkBNwE2ATQBMwExATABLgEtASsBKgEoAScBJQEkASIBIQEfAR4BHAEbARkBGAEWARUBEwESARABDwENAQwBCgEJAQcBBgEEAQMBAQEAAf4A/QD7APoA+AD3APUA8wDyAPAA7wDtAOwA6gDpAOcA5gDkAOMA4QDgAN4A3QDbANoA2ADWANUA0wDSANAAzwDNAMwAygDJAMcAxgDEAMIA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S/xK/En8SfxI/Ej8R/xH/Eb8RfxF/ET8RPxD/EP8QvxC/EH8QfxA/D/8P/w+/D78Pfw9/Dz8PPw7/Dv8Ovw6/Dn8Ofw4/Dj8N/w3/Db8Nvw1/DX8NPw0/DP8M/wy/DL8Mfwx/DD8MPwv/C/8Lvwu/C78Lfwt/Cz8LPwr/Cv8Kvwq/Cr8Kfwp/Cj8KPwn/Cf8J/wm/Cb8Jfwl/CT8JPwk/CP8I/wi/CL8Ivwh/CH8Ifwg/CD8H/wf/B/8Hvwe/B78Hfwd/Bz8HPwc/Bv8G/wb/Br8Gvwa/Bn8GfwZ/Bj8GPwY/Bf8F/wX/Bb8FvwW/BX8FfwV/BX8FPwU/BT8E/wT/BP8EvwS/BL8EvwR/BH8EfwR/BD8EPwQ/BD8D/wP/A/8DvwO/A78DvwO/A38DfwN/A38DPwM/Az8DPwL/Av8C/wL/Av8CvwK/Ar8CvwK/An8CfwJ/An8CfwI/Aj8CPwI/Aj8CPwH/Af8B/wH/Af8B/wG/Ab8BvwG/Ab8BvwG/AX8BfwF/AX8BfwF/AX8BfwE/AT8BPwE/AT8BPwE/AT8BPwD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wC/AL8AvwC/AL8AvwC/AL8AvwC/AL8AvwC/AL8AvwC/AL8AvwC/AL8AvwC/AL8AvwC/AL8AvwC/AH8AvwC/AL8AvwC/AL8AvwC/AL8AvwC/AL8AvwC/AL8AvwC/AL8AvwC/AL8AvwC/AL8AvwC/AL8AvwD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wE/AT8BPwE/AT8BPwE/AT8BPwF/AX8BfwF/AX8BfwF/AX8BvwG/Ab8BvwG/Ab8BvwH/Af8B/wH/Af8B/wI/Aj8CPwI/Aj8CPwJ/An8CfwJ/An8CvwK/Ar8CvwK/Av8C/wL/Av8C/wM/Az8DPwM/A38DfwN/A38DvwO/A78DvwO/A/8D/wP/BD8EPwQ/BD8EfwR/BH8EfwS/BL8EvwS/BP8E/wT/BT8FPwU/BX8FfwV/BX8FvwW/Bb8F/wX/Bf8GPwY/Bj8GfwZ/Bn8Gvwa/Br8G/wb/Bv8HPwc/Bz8Hfwd/B78Hvwe/B/8H/wf/CD8IPwh/CH8Ifwi/CL8Ivwj/CP8JPwk/CT8Jfwl/Cb8Jvwn/Cf8J/wo/Cj8Kfwp/Cr8Kvwq/Cv8K/ws/Cz8Lfwt/C78Lvwu/C/8L/ww/DD8Mfwx/DL8Mvwz/DP8NPw0/DX8Nfw2/Db8N/w3/Dj8OPw5/Dn8Ovw6/Dv8O/w8/Dz8Pfw9/D78Pvw//D/8QPxB/EH8QvxC/EP8Q/xE/ET8RfxF/Eb8R/xH/Ej8SPxJ/En8SvxL/Ev8TPxM/E38TvxO/E/8T/xQ/FH8UfxS/FL8U/xU/FT8VfxV/Fb8V/xX/Fj8WfxZ/Fr8W/xb/Fz8XPxd/F78Xvxf/GD8YPxh/GL8Yvxj/GT8ZPxl/Gb8Zvxn/Gj8aPxp/Gr8a/xr/Gz8bfxt/G78b/xv/HD8cfxy/HL8c/x0/HT8dfx2/Hf8d/x4/Hn8evx6/Hv8fPx9/H38fvx//ID8gPyB/IL8g/yD/IT8hfyG/Ib8h/yI/In8ivyK/Iv8jPyN/I38jvyP/JD8kfyR/JL8k/yU/JX8lfyW/Jf8mPyZ/Jr8mvyb/Jz8nfye/J/8n/yg/KH8ovyj/KT8pPyl/Kb8p/yo/Kn8qvyq/Kv8rPyt/K78r/yw/LH8sfyy/LP8tPy1/Lb8t/y4/Ln8ufy6/Lv8vPy9/L78v/zA/MH8wvzC/MP8xPzF/Mb8x/zI/Mn8yvzL/Mz8zfzO/M/80PzQ/NH80vzT/NT81fzW/Nf82PzZ/Nr82/zc/N383vzf/OD84fzi/OP85Pzl/Ob85/zo/On86vzr/Oz87fzu/O/88Pzx/PL88/z0/PX89vz3/Pj8+fz6/Pv8/Pz9/P78//wA/QH9Av0D/QT9Bf0G/Qf9CP0J/Qv9DP0N/Q79D/0Q/RH9Ev0T/RT9Ff0W/Rf9GP0Z/Rv9HP0d/R79H/0g/SH9Iv0j/ST9Jf0n/Sj9Kf0q/Sv9LP0t/S79L/0w/TL9M/00/TX9Nv03/Tj9Of07/Tz9Pf0+/T/9QP1B/UP9RP1F/Ub9R/1I/Un9S/1M/U39Tv1P/VD9Uf1T/VT9Vf1W/Vf9Wf1a/Vv9XP1d/V79YP1h/WL9Y/1k/WX9Z/1o/Wn9av1r/W39bv1v/XD9cf1z/XT9df12/Xj9ef16/Xv9fP1+/X/9gP2B/YL9hP2F/Yb9h/2J/Yr9i/2M/Y79j/2Q/ZH9k/2U/ZX9lv2Y/Zn9mv2b/Z39nv2f/aD9ov2j/aT9pf2n/aj9qf2r/az9rf2u/bD9sf2y/bP9tf22/bf9uf26/bv9vP2+/b/9wP3C/cP9xP3G/cf9yP3J/cv9zP3N/c/90P3R/dP91P3V/df92P3Z/dv93P3d/d/94P3h/eP95P3l/ef96P3p/ev97P3t/e/98P3x/fP99P31/ff9+P35/fv9/P39/f/9AP4B/gP+BP4G/gf+CP4K/gv+DP4O/g/+EP4S/hP+Ff4W/hf+Gf4a/hv+Hf4e/iD+If4i/iT+Jf4n/ij+Kf4r/iz+Lv4v/jD+Mv4z/jX+Nv43/jn+Ov48/j3+Pv5A/kH+Q/5E/kX+R/5I/kr+S/5N/k7+T/5R/lL+VP5V/lb+WP5Z/lv+XP5e/l/+Yf5i/mP+Zf5m/mj+af5r/mz+bf5v/nD+cv5z/nX+dv54/nn+ev58/n3+f/6A/oL+g/6F/ob+iP6J/or+jP6N/o/+kP6S/pP+lf6W/pj+mf6b/pz+nv6f/qD+ov6j/qX+pv6o/qn+q/6s/q7+r/6x/rL+tP61/rf+uP66/rv+vf6+/sD+wf7D/sT+xv7H/sn+yv7M/s3+z/7Q/tL+0/7V/tb+2P7Z/tv+3P7e/t/+4f7i/uT+5f7n/uj+6v7r/u3+7v7w/vH+8/70/vb+9/75/vr+/P79/v/+AP8C/wP/Bf8G/wj/Cf8L/w3/Dv8Q/xH/E/8U/xb/F/8Z/xr/HP8d/x//IP8i/yP/Jf8m/yj/Kv8r/y3/Lv8w/zH/M/80/zb/N/85/zr/PP8+/z//Qf9C/0T/Rf9H/0j/Sv9L/03/T/9Q/1L/U/9V/1b/WP9Z/1v/XP9e/2D/Yf9j/2T/Zv9n/2n/av9s/23/b/9x/3L/dP91/3f/eP96/3v/ff9//4D/gv+D/4X/hv+I/4r/i/+N/47/kP+R/5P/lP+W/5j/mf+b/5z/nv+f/6H/ov+k/6b/p/+p/6r/rP+t/6//sf+y/7T/tf+3/7j/uv+8/73/v//A/8L/w//F/8b/yP/K/8v/zf/O/9D/0f/T/9X/1v/Y/9n/2//c/97/4P/h/+P/5P/m/+f/6f/r/+z/7v/v//H/8v/0//b/9//5//r//P/9////AAABAAMABAAGAAcACQAKAAwADgAPABEAEgAUABUAFwAZABoAHAAdAB8AIAAiACQAJQAnACgAKgArAC0ALwAwADIAMwA1ADYAOAA6ADsAPQA+AEAAQQBDAEQARgBIAEkASwBMAE4ATwBRAFMAVABWAFcAWQBaAFwAXgBfAGEAYgBkAGUAZwBoAGoAbABtAG8AcAByAHMAdQB2AHgAegB7AH0AfgCAAIEAgwCFAIYAiACJAIsAjACOAI8AkQCTAJQAlgCXAJkAmgCcAJ0AnwCgAKIApAClAKcAqACqAKsArQCuALAAsQCzALUAtgC4ALkAuwC8AL4AvwDBAMIAxADGAMcAyQDKAMwAzQDPANAA0gDTANUA1gDYANoA2wDdAN4A4ADhAOMA5ADmAOcA6QDqAOwA7QDvAPAA8gDzAPUA9wD4APoA+wD9AP4AAAEBAQMBBAEGAQcBCQEKAQwBDQEPARABEgETARUBFgEYARkBGwEcAR4BHwEhASIBJAElAScBKAEqASsBLQEuATABMQEzATQBNgE3ATkBOgE8AT0BPwFAAUIBQwFFAUYBSAFJAUsBTAFOAU8BUQFSAVQBVQFXAVgBWgFbAV0BXgFgAWEBYgFkAWUBZwFoAWoBawFtAW4BcAFxAXMBdAF2AXcBeAF6AXsBfQF+AYABgQGDAYQBhgGHAYgBigGLAY0BjgGQAZEBkwGUAZUBlwGYAZoBmwGdAZ4BnwGhAaIBpAGlAacBqAGqAasBrAGuAa8BsQGyAbMBtQG2AbgBuQG7AbwBvQG/AcABwgHDAcQBxgHHAckBygHLAc0BzgHQAdEB0gHUAdUB1wHYAdkB2wHcAd4B3wHgAeIB4wHlAeYB5wHpAeoB6wHtAe4B8AHxAfIB9AH1AfYB+AH5AfoB/AH9Af8BAAIBAgMCBAIFAgcCCAIJAgsCDAINAg8CEAIRAhMCFAIVAhcCGAIZAhsCHAIdAh8CIAIhAiMCJAIlAicCKAIpAisCLAItAi8CMAIxAjMCNAI1AjcCOAI5AjoCPAI9Aj4CQAJBAkICRAJFAkYCRwJJAkoCSwJNAk4CTwJQAlICUwJUAlUCVwJYAlkCWwJcAl0CXgJgAmECYgJjAmUCZgJnAmgCagJrAmwCbQJvAnACcQJyAnQCdQJ2AncCeQJ6AnsCfAJ+An8CgAKBAoIChAKFAoYChwKIAooCiwKMAo0CjwKQApECkgKTApUClgKXApgCmQKbApwCnQKeAp8CoAKiAqMCpAKlAqYCpwKpAqoCqwKsAq0CrwKwArECsgKzArQCtQK3ArgCuQK6ArsCvAK9Ar8CwALBAsICwwLEAsUCxwLIAskCygLLAswCzQLOAtAC0QLSAtMC1ALVAtYC1wLYAtkC2wLcAt0C3gLfAuAC4QLiAuMC5ALlAucC6ALpAuoC6wLsAu0C7gLvAvAC8QLyAvMC9AL1AvcC+AL5AvoC+wL8Av0C/gL/AgADAQMCAwMDBAMFAwYDBwMIAwkDCgMLAwwDDQMOAw8DEAMRAxIDEwMUAxUDFgMXAxgDGQMaAxsDHAMdAx4DHwMgAyEDIgMjAyQDJQMmAycDKAMpAyoDKwMsAy0DLgMvAzADMAMxAzIDMwM0AzUDNgM3AzgDOQM6AzsDPAM9Az4DPgM/A0ADQQNCA0MDRANFA0YDRwNHA0gDSQNKA0sDTANNA04DTwNPA1ADUQNSA1MDVANVA1YDVgNXA1gDWQNaA1sDXANcA10DXgNfA2ADYQNhA2IDYwNkA2UDZgNmA2cDaANpA2oDawNrA2wDbQNuA28DbwNwA3EDcgNzA3MDdAN1A3YDdgN3A3gDeQN6A3oDewN8A30DfQN+A38DgAOAA4EDggODA4MDhAOFA4YDhgOHA4gDiQOJA4oDiwOMA4wDjQOOA44DjwOQA5EDkQOSA5MDkwOUA5UDlQOWA5cDmAOYA5kDmgOaA5sDnAOcA50DngOeA58DoAOgA6EDogOiA6MDpAOkA6UDpQOmA6cDpwOoA6kDqQOqA6sDqwOsA6wDrQOuA64DrwOvA7ADsQOxA7IDsgOzA7QDtAO1A7UDtgO3A7cDuAO4A7kDuQO6A7sDuwO8A7wDvQO9A74DvgO/A78DwAPBA8EDwgPCA8MDwwPEA8QDxQPFA8YDxgPHA8cDyAPIA8kDyQPKA8oDywPLA8wDzAPNA80DzgPOA88DzwPQA9AD0QPRA9ID0gPSA9MD0wPUA9QD1QPVA9YD1gPWA9cD1wPYA9gD2QPZA9kD2gPaA9sD2wPcA9wD3APdA90D3gPeA94D3wPfA98D4APgA+ED4QPhA+ID4gPiA+MD4wPkA+QD5APlA+UD5QPmA+YD5gPnA+cD5wPoA+gD6APpA+kD6QPqA+oD6gPrA+sD6wPrA+wD7APsA+0D7QPtA+4D7gPuA+4D7wPvA+8D7wPwA/AD8APwA/ED8QPxA/ID8gPyA/ID8gPzA/MD8wPzA/QD9AP0A/QD9QP1A/UD9QP1A/YD9gP2A/YD9gP3A/cD9wP3A/cD+AP4A/gD+AP4A/gD+QP5A/kD+QP5A/kD+gP6A/oD+gP6A/oD+gP7A/sD+wP7A/sD+wP7A/sD/AP8A/wD/AP8A/wD/AP8A/wD/QP9A/0D/QP9A/0D/QP9A/0D/QP9A/0D/gP+A/4D/gP+A/4D/gP+A/4D/gP+A/4D/gP+A/4D/gP+A/4D/gP+A/4D/gP+A/4D/gP+A/4D/gM=';
const b64 = s => typeof atob === 'function' ? Uint8Array.from(atob(s), c => c.charCodeAt(0)) : new Uint8Array(Buffer.from(s, 'base64'));
// "SIN"[a] = 1023*cos(2*pi*a/4096) (static table at 0x5599c in the original; sin(a) = SIN[(a-0x400)&0xfff])
export const SIN = new Int16Array(b64(SIN_B64).buffer);

const i16 = x => (x << 16) >> 16;
const rol16 = v => ((v << 16) | (v >>> 16)) | 0;
const mulsh = (a, b) => Math.floor(a * b / 1024) | 0;        // imul + shrd eax,edx,10
const idiv = (a, b) => Math.trunc(a / b) | 0;                // cdq + idiv (truncating)

// ---------------------------------------------------------------- matrices (0x7984e / 0x79d25)
// 4x4 int32 matrix (row-major, [12..14] = translation) from position + 3 angles (12-bit, 4096 = full turn)
export function makeMatrix(m, px, py, pz, a1, a2, a3) {
  const c1 = SIN[a1 & 0xfff], s1 = SIN[(a1 - 0x400) & 0xfff];
  const c2 = SIN[a2 & 0xfff], s2 = SIN[(a2 - 0x400) & 0xfff];
  const c3 = SIN[a3 & 0xfff], s3 = SIN[(a3 - 0x400) & 0xfff];
  m[12] = px; m[13] = py; m[14] = pz;
  m[0] = mulsh(c3, c2); m[1] = mulsh(-s3, c2); m[2] = s2;
  m[4] = (mulsh(s3, c1) + mulsh(mulsh(s2, c3), s1)) | 0;
  m[5] = (mulsh(c3, c1) - mulsh(mulsh(s1, s2), s3)) | 0;
  m[6] = mulsh(-s1, c2);
  m[8] = (mulsh(s3, s1) - mulsh(mulsh(s2, c3), c1)) | 0;
  m[9] = (mulsh(c3, s1) + mulsh(mulsh(c1, s2), s3)) | 0;
  m[10] = mulsh(c1, c2);
  return m;
}
// out = A x B  (0x79d25, esi=A, ebx=B): out[r][c] = sum_k (A[r][k]*B[k][c])>>10
export function mulMatrix(out, A, B) {
  const t = new Int32Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    let s = 0;
    for (let k = 3; k >= 0; k--) s = (s + mulsh(A[r * 4 + k], B[k * 4 + c])) | 0;
    t[r * 4 + c] = s;
  }
  out.set(t);
  return out;
}

// ---------------------------------------------------------------- object files ('B!' 1a 0f|00)
// header: 4 bytes magic, u16 nverts, u16 nfaces, nverts*16 B vertices {x,y,z, nx,ny,nz (int16, normal 256=1.0), attr u16 (u|v<<8), pad},
// nfaces*16 B faces {w0 (unused), i1,i2,i3 (vertex indices), fnx,fny,fnz (face normal), pad..}. Magic byte 3 = 0 -> animated (morph) object, see re/parts/lib3d.md
export function parseObject(bytes) {
  const body = bytes.slice(4), nv = body[0] | (body[1] << 8), nf = body[2] | (body[3] << 8);
  const w = new Int16Array(body.buffer, 4, Math.floor((body.length - 4) / 2));
  const o = { nv, nf, v: w.subarray(0, nv * 8), f: w.subarray(nv * 8, (nv + nf) * 8), magic: bytes[3], radius: 0, frames: [] };
  // magic byte 3 == 0: morph object. After the base object come extra key frames of nv*16 bytes each (words 0..5 of a vertex = x,y,z,nx,ny,nz are interpolated)
  if (o.magic === 0) for (let k = (nv + nf) * 8; k + nv * 8 <= w.length; k += nv * 8) o.frames.push(w.subarray(k, k + nv * 8));
  o.base = Int16Array.from(o.v);     // pristine copy of the base vertices (morph() rewrites v in place like the original)
  return o;
}

// triangle rasterizer state: the original keeps these in globals (0x4d190..0x4d254) and some paths read stale values from the previous triangle
const R = {
  x1b0: 0, x1b4: 0, y1b8: 0, x1cc: 0, y1d0: 0, x1e4: 0, y1e8: 0, a228: 0, a22a: 0, a234: 0, a236: 0,
  s02: [0, 0, 0, 0], s01: [0, 0, 0, 0], s12: [0, 0, 0, 0],
  e190: 0, e194: 0, rows: 0, w: [0, 0, 0, 0], g: [0, 0, 0, 0],
};

export class Lib3D {
  constructor() {
    this.back = new Uint8Array(0x10000);   // 0x682d0: back buffer AND sqrt table (same memory in the original!)
    this.gs = new Uint8Array(0x10000);     // texture (res 16 in partb)
    this.fs = new Uint8Array(0x10000);     // 0x582d0 buffer: light/env map built by makeEnvMap()
    this.ds = new Uint8Array(0x10000);     // bump/displacement map (res 17 in partb)
    this.bg = null;                        // background image (320x200) restored by flip()
    this.cam = { x: 0, y: 0, z: 0, a: 0, b: 0, c: 0 };   // 0x55836.. / 0x55842..
    this.rot = { a: 0, b: 0, c: 0 };       // 0x55862..: global angle added to every object's angles for lighting normals
    this.dist = 0x50;                      // [0x57ab6] projection distance
    this.shift = 1;                        // [0x5594c]
    this.mode = 15;                        // [0x55948] shading mode
    this.flags = 0;                        // [0x582ac] bit0: no face sort
    this.camM = new Int32Array(16); this.objM = new Int32Array(16); this.rotM = new Int32Array(16); this.cmpM = new Int32Array(16);
    this.morphTable = Int16Array.from({ length: 128 }, (_, i) => i);
    this.reset();
  }
  // 0x787fc
  reset() { this.cam.x = this.cam.y = this.cam.z = this.cam.a = this.cam.b = this.cam.c = 0; this.rot.a = this.rot.b = this.rot.c = 0; this.sqrtTable(); }
  // 0x7871c : sqrt table in the back buffer: byte value n repeated 2n+1 times
  sqrtTable() { const b = this.back; let p = 0; for (let n = 0; n < 256; n++) for (let k = 0; k < 2 * n + 1; k++) b[p++] = n; }
  // 0x79cbf : approximate sqrt through the (shared!) table
  sqrt(v) {
    v >>>= 0; const t = this.back;
    if (v <= 0xffff) return t[v];
    if (v <= 0x3fffc) return t[v >>> 2] * 2;
    if (v <= 0xffff0) return t[v >>> 4] * 4;
    if (v <= 0xfeff01) return t[v >>> 8] * 16;
    return t[v >>> 16] << 8;
  }
  // 0x7873a : radial 256x256 map in this.fs. dl: 0 -> 16 grey levels (value>>2<<4), 2 -> v>>1, 3 -> v>>3<<5, 4 -> v>>1<<3, else raw. ramp = 128-byte table (0x6310+)
  // `dither` = [0x582ce]
  makeEnvMap(ramp, dl, dither = 0) {
    this.sqrtTable(); const T = this.back, F = this.fs; let acc = 0;
    for (let cx = 0x8000; cx >= 0; cx -= 2) {
      let cl = (cx & 255) >> 1, ch = cx >> 8;
      let bl = T[cl * cl + ch * ch]; if (bl > 0x7f) bl = 0x7f; bl = 0x7f - bl;
      let al = ramp[bl];
      if (dl === 0) {
        let ah = (al & 0x11) << 6 & 255; al >>= 2;
        if (dither) { const s = acc + ah; acc = s & 255; al += s >> 8; }
        al = (al << 4) & 255;
      } else if (dl === 2) al >>= 1;
      else if (dl === 3) al = (al >> 3 << 5) & 255;
      else if (dl === 4) al = (al >> 1 << 3) & 255;
      const x1 = (0x80 + cl) & 255, y1 = (0x80 + ch) & 255, x2 = ~(0x80 + cl) & 255, y2 = ~(0x80 + ch) & 255;
      F[y1 << 8 | x1] = al; F[y1 << 8 | x2] = al; F[y2 << 8 | x2] = al; F[y2 << 8 | x1] = al;
    }
  }
  // textures: gs = surface texture, ds = displacement map, bg = 320x200 background (64000 B). fs: use makeEnvMap
  setTextures({ gs, ds, bg }) { if (gs) this.gs = gs; if (ds) this.ds = ds; if (bg) this.bg = bg; }

  // 0x78c62 / 0x79808 : object -> engine object (with position/angles); computes the bounding radius
  // anim (morph objects only): { keys: [frame indices.. + wrap entry], shift, steps } like the table the original keeps next to the object struct
  newObject(data, x = 0, y = 0, z = 0, ax = 0, ay = 0, az = 0, anim = null) {
    let r = 0;
    for (let i = 0; i < data.nv; i++) {
      const vx = data.v[i * 8], vy = data.v[i * 8 + 1], vz = data.v[i * 8 + 2];
      const s = (Math.imul(vx, vx) + Math.imul(vy, vy) + Math.imul(vz, vz)) | 0, q = this.sqrt(s);
      if (q > r) r = q;
    }
    data.radius = r;
    return { x, y, z, ax, ay, az, data, anim: anim && { key: 0, step: 0, ...anim } };
  }
  // 0x79841 : morph weight table (128 int16 words; weight index = step within a key interval). Default = identity ramp 0..127 (the one partb ships)
  setMorphTable(t) { this.morphTable = Int16Array.from(t); }
  // 0x78fda : advance the animation step; after anim.steps steps go to next key; wraps at nKeys
  advanceAnim(o, nKeys) {
    const a = o.anim; a.step++;
    if (a.step !== a.steps) return;
    a.step = 0; a.key++; if (a.key === nKeys) a.key = 0;
  }
  // 0x78ffe : vertex = f0 + (((f1 - f0) * weight[step]) >> shift) for words 0..5 (x,y,z,nx,ny,nz), in place in o.data.v
  morph(o) {
    const a = o.anim, d = o.data, f0 = d.frames[a.keys[a.key]], f1 = d.frames[a.keys[a.key + 1]];
    const w = this.morphTable[a.step], sh = a.shift, v = d.v;
    for (let i = 0; i < d.nv; i++) for (let j = 0; j < 6; j++) {
      const p = i * 8 + j;
      v[p] = f0[p] + i16(Math.imul(i16(f1[p] - f0[p]), w) >> sh);
    }
  }
  // scene = list of objects (0x79111 / 0x7916b / 0x79184 / 0x79148)
  newScene() { return { objs: [] }; }

  // 0x78905 : copy back buffer lines 1..197 to vram, then restore the background into the back buffer
  flip(vram) {
    const b = this.back, bg = this.bg;
    for (let i = 320; i < 320 + 63040; i++) { vram[i] = b[i]; b[i] = bg[i]; }
  }
  // 0x78948 : same but refill the back buffer with a constant (clear)
  flipClear(vram, c) { const b = this.back; for (let i = 320; i < 320 + 63040; i++) { vram[i] = b[i]; b[i] = c; } }

  // ------------------------------------------------------------ frame render (0x79483)
  render(scene) {
    const cam = this.cam, N = scene.objs.length;
    makeMatrix(this.camM, cam.x, cam.y, cam.z, cam.a, cam.b, cam.c);
    const M = this.camM, sh = this.shift, d = this.dist;
    const vis = [];
    for (let i = 0; i < N; i++) {
      const o = scene.objs[i], rad = o.data.radius;
      const x = (o.x - cam.x) | 0, y = (o.y - cam.y) | 0, z = (o.z - cam.z) | 0;
      const X = (Math.imul(x, M[0]) + Math.imul(y, M[4]) + Math.imul(z, M[8])) | 0;
      const Y = (Math.imul(x, M[1]) + Math.imul(y, M[5]) + Math.imul(z, M[9])) | 0;
      const Z = (Math.imul(x, M[2]) + Math.imul(y, M[6]) + Math.imul(z, M[10])) | 0;
      const e = (d - (Z >> 10)) << sh;
      let sx, sy, r;
      if (e <= 0) { sx = i16(X >> 10); sy = i16(Y >> 10); r = i16(rad); }
      else { sx = i16(idiv(X, e) + 0xa0); sy = i16(idiv(Y, e) + 0x64); r = i16(idiv(rad << 10, e)); }
      let inv = true;
      if (i16(sx + r) > 0 && i16(sx - r) < 0x140 && i16(sy + r) > 0 && i16(sy - r) < 200 &&
          ((Z >> 10) - rad) < -d && Z > (0xff830000 | 0)) inv = false;
      if (!inv) vis.push((i << 16) | ((Z >> 10) & 0xffff));
    }
    if (!vis.length) return;
    const list = Int32Array.from(vis);
    if (list.length > 1) sortList(list, 0, (list.length - 1) * 4);
    // cam translation row is zeroed: positions are already camera relative (<<10)
    this.camM[12] = this.camM[13] = this.camM[14] = 0;
    for (let k = 0; k < list.length; k++) {
      const o = scene.objs[list[k] >>> 16];
      this.drawObject({
        x: (o.x - cam.x) << 10, y: (o.y - cam.y) << 10, z: (o.z - cam.z) << 10, ax: o.ax, ay: o.ay, az: o.az, data: o.data, radius: o.data.radius,
      }, true);
    }
  }

  // 0x789c4 : run the 5 pipeline stages of the current mode on one object (position already camera-relative << 10)
  drawObject(o, viaCam = false) {
    const md = MODES[this.mode];
    if (!md) throw new Error('lib3d: shading mode ' + this.mode + ' not implemented');
    const st = this.st = this.st || {};
    const dt = o.data; st.nv = dt.nv; st.nf = dt.nf; st.V = dt.v; st.F = dt.f;
    // stage 1 (0x78a35): matrices + vertex transform/projection
    makeMatrix(this.objM, o.x, o.y, o.z, o.ax, o.ay, o.az);
    makeMatrix(this.rotM, 0, 0, 0, i16(o.ax + this.rot.a), i16(o.ay + this.rot.b), i16(o.az + this.rot.c));
    if (viaCam) { mulMatrix(this.cmpM, this.objM, this.camM); this.project(this.cmpM); } else this.project(this.objM);
    // stage 2..5
    md.light.call(this); md.cull.call(this); md.setup.call(this); md.raster.call(this);
  }

  // 0x79b16 : x' = x*M0+y*M4+z*M8+M12 ... ; screen = 0xa0 + x'/(((dist - z'>>10)) << shift)
  project(M) {
    const { nv, V } = this.st;
    const V3 = this.V3 = this.V3 && this.V3.length >= nv * 4 ? this.V3 : new Int32Array(nv * 4 + 64);
    const V2 = this.V2 = this.V2 && this.V2.length >= nv * 2 ? this.V2 : new Int16Array(nv * 2 + 64);
    const d = this.dist, sh = this.shift;
    for (let i = 0; i < nv; i++) {
      const x = V[i * 8], y = V[i * 8 + 1], z = V[i * 8 + 2];
      const X = (Math.imul(x, M[0]) + Math.imul(y, M[4]) + Math.imul(z, M[8]) + M[12]) | 0;
      const Y = (Math.imul(x, M[1]) + Math.imul(y, M[5]) + Math.imul(z, M[9]) + M[13]) | 0;
      const Z = (Math.imul(x, M[2]) + Math.imul(y, M[6]) + Math.imul(z, M[10]) + M[14]) | 0;
      V3[i * 4] = X; V3[i * 4 + 1] = Y; V3[i * 4 + 2] = Z;
      const e = (d - (Z >> 10)) << sh;                       // shl ebp, imm patched with [0x5594c]
      let sx, sy;
      if (e <= 0) { sx = i16(X >> 10); sy = i16(Y >> 10); }
      else { sx = i16(idiv(X, e) + 0xa0); sy = i16(idiv(Y, e) + 0x64); }
      V2[i * 2] = sx; V2[i * 2 + 1] = sy;
    }
  }

  // 0x79a17 : rotate vectors (vertex normals at word offset 3 of each vertex, or face normals at word 4 of each face) by the lighting matrix
  rotateNormals(src, stride, off, count) {
    const M = this.rotM, N = this.N = this.N && this.N.length >= count * 4 ? this.N : new Int32Array(count * 4 + 64);
    for (let i = 0; i < count; i++) {
      const x = src[i * stride + off], y = src[i * stride + off + 1], z = src[i * stride + off + 2];
      N[i * 4] = (Math.imul(x, M[0]) + Math.imul(y, M[4]) + Math.imul(z, M[8])) | 0;
      N[i * 4 + 1] = (Math.imul(x, M[1]) + Math.imul(y, M[5]) + Math.imul(z, M[9])) | 0;
      N[i * 4 + 2] = (Math.imul(x, M[2]) + Math.imul(y, M[6]) + Math.imul(z, M[10])) | 0;
    }
  }
  // 0x78a15 (vertex normals) / 0x789f5 (face normals)
  lightVertex() { this.rotateNormals(this.st.V, 8, 3, this.st.nv); }
  lightFace() { this.rotateNormals(this.st.F, 8, 4, this.st.nf); }
  lightNone() {}

  // 0x78b08 : backface cull + depth key + sort. list entries = (faceIndex<<16)|key16
  cull() {
    const { nf, F } = this.st, V3 = this.V3, V2 = this.V2, lim = -(this.dist << 10);
    const out = [];
    for (let i = 0; i < nf; i++) {
      const a = F[i * 8 + 1], b = F[i * 8 + 2], c = F[i * 8 + 3];
      const xa = V2[a * 2], ya = V2[a * 2 + 1];
      let z = V3[a * 4 + 2];
      const xb = V2[b * 2], yb = V2[b * 2 + 1]; z = (z + V3[b * 4 + 2]) | 0; z >>= 1;
      const xc = V2[c * 2], yc = V2[c * 2 + 1]; z = (z + V3[c * 4 + 2]) | 0; z >>= 1;
      const d1 = i16(xb - xa), e1 = i16(yb - ya), d2 = i16(xc - xa), e2 = i16(yc - ya);
      const area = (Math.imul(d1, e2) - Math.imul(d2, e1)) | 0;
      if (area <= 0) continue;
      if (z >= lim || z <= (0xfaa2b580 | 0)) continue;
      out.push((i << 16) | (((z << 6) >>> 16) & 0xffff));
    }
    const list = this.faceList = Int32Array.from(out);
    if (this.flags & 1) return;
    if (list.length > 1) sortList(list, 0, (list.length - 1) * 4);
  }

  // mode 15 stage 4 (0x4da28): per-vertex rasterizer attributes: (v<<8|u)<<16 | attr word ;  u = (nx>>12)+0x80, v = (ny>>12)+0x80
  setupEnv() {
    const { nv, V } = this.st, N = this.N, A = this.A = this.A && this.A.length >= nv ? this.A : new Int32Array(nv + 16);
    for (let i = 0; i < nv; i++) {
      const u = ((N[i * 4] >> 12) + 0x80) & 255, v = ((N[i * 4 + 1] >> 12) + 0x80) & 255;
      A[i] = (((v << 8) | u) << 16) | (V[i * 8 + 6] & 0xffff);
    }
  }
  // mode 15 stage 5 (0x4dbd7 -> 0x51593)
  rasterEnv() {
    const { F } = this.st, V2 = this.V2, A = this.A, L = this.faceList;
    for (let k = 0; k < L.length; k++) {
      const f = L[k] >>> 16, a = F[f * 8 + 1], b = F[f * 8 + 2], c = F[f * 8 + 3];
      tri4(this, (V2[a * 2] & 0xffff) | (V2[a * 2 + 1] << 16), (V2[b * 2] & 0xffff) | (V2[b * 2 + 1] << 16), (V2[c * 2] & 0xffff) | (V2[c * 2 + 1] << 16), A[a], A[b], A[c]);
    }
  }
  // modes 2/3 (0x4d4e7/0x4d4b4 + 0x4d5af): 16-bit env uv per vertex, 2-attr triangles reading the env map (this.fs)
  setupEnv16(sh) {
    const { nv } = this.st, N = this.N, A = this.A16 = this.A16 && this.A16.length >= nv ? this.A16 : new Int32Array(nv + 16);
    for (let i = 0; i < nv; i++) A[i] = ((((N[i * 4 + 1] >> sh) + 0x80) & 255) << 8) | (((N[i * 4] >> sh) + 0x80) & 255);
  }
  setupEnv16_12() { this.setupEnv16(12); }
  setupEnv16_11() { this.setupEnv16(11); }
  rasterEnv16() {
    const { F } = this.st, V2 = this.V2, A = this.A16, L = this.faceList; this.tex2 = this.fs;
    for (let k = 0; k < L.length; k++) {
      const f = L[k] >>> 16, a = F[f * 8 + 1], b = F[f * 8 + 2], c = F[f * 8 + 3];
      tri2(this, (V2[a * 2] & 0xffff) | (V2[a * 2 + 1] << 16), (V2[b * 2] & 0xffff) | (V2[b * 2 + 1] << 16), (V2[c * 2] & 0xffff) | (V2[c * 2 + 1] << 16), A[a], A[b], A[c]);
    }
  }
  // mode 20 (0x4da28 + 0x4ddbf): face word0 == 1 -> 2-attr env triangle on this.gs, else 4-attr 'warp' triangle (ds words -> fs)
  rasterMode20() {
    const { F } = this.st, V2 = this.V2, A = this.A, L = this.faceList; this.tex2 = this.gs;
    for (let k = 0; k < L.length; k++) {
      const f = L[k] >>> 16, a = F[f * 8 + 1], b = F[f * 8 + 2], c = F[f * 8 + 3];
      const P = [a, b, c].map(i => (V2[i * 2] & 0xffff) | (V2[i * 2 + 1] << 16));
      if (F[f * 8] === 1) tri2(this, P[0], P[1], P[2], rol16(A[a]), rol16(A[b]), rol16(A[c]));
      else tri4(this, P[0], P[1], P[2], A[a], A[b], A[c], V_WARP320);
    }
  }
}

// shading modes: [light, cull, setup, raster] (stage 1 = transform is common). Original table at 0x784d1 (27 entries x 21 bytes).
// implemented: 15 (partb/partc), 3, 2, 20 (modes 2,3,20 verified only at rasterizer level). NOT implemented: 21 (0x4deb1, like 20 but 256-wide: 0x54548/0x52e96) and the 22 modes the demo never selects.
const P = Lib3D.prototype;
const MODES = {
  15: { light: P.lightVertex, cull: P.cull, setup: P.setupEnv, raster: P.rasterEnv },
  3: { light: P.lightVertex, cull: P.cull, setup: P.setupEnv16_12, raster: P.rasterEnv16 },
  2: { light: P.lightVertex, cull: P.cull, setup: P.setupEnv16_11, raster: P.rasterEnv16 },
  20: { light: P.lightVertex, cull: P.cull, setup: P.setupEnv, raster: P.rasterMode20 },
};
export { MODES };

// 0x7898d : the original's quicksort variant (pivot walks right; ties keep a specific order). keys = signed low 16 bits, list of int32
export function sortList(a, lo, hi) {            // lo/hi = byte offsets like the original (inclusive)
  while (hi > lo) {
    let e = lo, s = lo + 4;
    for (;;) {
      const dx = a[e >> 2], ax = a[s >> 2];
      if (i16(dx) > i16(ax)) { a[e >> 2] = ax; e += 4; a[s >> 2] = a[e >> 2]; a[e >> 2] = dx; }
      s = (s & ~0xffff) | ((s + 4) & 0xffff);
      if (s > hi) break;      // jbe
    }
    sortList(a, lo, e);
    lo = e + 4;
  }
}

// ---------------------------------------------------------------- 4-interpolant triangle rasterizer (0x51593 = mode 15; same code, other constants/kernels: 0x4f47c, 0x54548)
// P = (y<<16)|x, A = 4 attribute bytes (b0,b1 = texture uv, b2,b3 = displacement-map offset), interpolated in 8.8
// Variants (V): W = screen width (inside test, row stride), early = min y of the 2 other vertices to draw at all, y0 = rows start at 0 (else 1),
// ym/siLim/siLe/siSub = bottom clip constants, kernel = 'env' (gs[uv] + fs[ds[uv] + d]) or 'warp' (fs[gs16[v,2u] + d]), wordAdd = per-row attribute increments added per word (else dword pairs)
export const V_ENV = { W: 320, early: 1, y0: false, ym: 0xc7, siLim: 0xc7, siLe: false, siSub: 0xc6, kernel: 'env', wordAdd: false };       // 0x51593 (mode 15)
export const V_WARP320 = { W: 320, early: 0, y0: true, ym: 0xc8, siLim: 0xc8, siLe: false, siSub: 0xc7, kernel: 'warp', wordAdd: true };   // 0x4f47c (mode 20, type 0)
export const V_WARP256 = { W: 256, early: 0, y0: true, ym: 0xff, siLim: 0xff, siLe: false, siSub: 0xfe, kernel: 'warp', wordAdd: true };   // 0x54548 (mode 21, type 0)
const bt = (A, n) => (A >> (8 * n)) & 255;
function attrSlopes(D, cy, s) {
  s[0] = idiv(i16(bt(D, 0) << 8), cy); s[1] = idiv(i16(bt(D, 1) << 8), cy);
  s[2] = idiv(i16(bt(D, 2) << 8), cy); s[3] = idiv(i16(bt(D, 3) << 8), cy);
  for (let i = 0; i < 4; i++) s[i] = i16(s[i]);
}
function tri4(L, P0, P1, P2, A0, A1, A2, V = V_ENV) {
  R.g[0] = R.g[1] = R.g[2] = R.g[3] = 0;
  const inside = ((P0 & 0xffff) < V.W) + ((P1 & 0xffff) < V.W) + ((P2 & 0xffff) < V.W);
  if (inside === 0) return;
  const clipped = inside !== 3;
  let eax = P0, ebx = P1, ecx = P2; const esi = ebx, edx = ecx;
  if (ebx < eax) { const t = ebx; ebx = eax; eax = t; }
  if (ecx > eax) { const t = ecx; ecx = eax; eax = t; }
  const t = ecx === edx ? 2 : ecx === esi ? 1 : 0;
  if (ecx >= 0xc70000) return;
  const PX = [P0 & 0xffff, P1 & 0xffff, P2 & 0xffff, P0 & 0xffff, P1 & 0xffff].map(i16), PY = [P0 >> 16, P1 >> 16, P2 >> 16, P0 >> 16, P1 >> 16];
  const A = [A0, A1, A2, A0, A1];
  if (!(PY[t + 1] >= V.early || PY[t + 2] >= V.early)) return;
  // edges
  let cy = i16(PY[t + 2] - PY[t]);
  if (cy !== 0) {
    if (cy !== 1 && cy !== -1) attrSlopes((A[t + 2] - A[t]) | 0, cy, R.s02);
    R.x1b4 = idiv(i16(PX[t + 2] - PX[t]) << 16, cy);
  }
  R.y1b8 = cy;
  cy = i16(PY[t + 1] - PY[t]);
  if (cy !== 0) {
    if (cy !== 1 && cy !== -1) attrSlopes((A[t + 1] - A[t]) | 0, cy, R.s01);
    R.x1cc = idiv(i16(PX[t + 1] - PX[t]) << 16, cy);
  }
  R.y1d0 = cy;
  cy = i16(PY[t + 2] - PY[t + 1]);
  const cy12 = cy;
  if (cy !== 0) {
    if (cy !== 1 && cy !== -1) attrSlopes((A[t + 2] - A[t + 1]) | 0, cy, R.s12);
    R.x1e4 = idiv(i16(PX[t + 2] - PX[t + 1]) << 16, cy);
  }
  R.y1e8 = cy;
  const setup = (ob, s, x) => {                  // 0x4ff31
    const dy = i16(PY[t + ob] - PY[t]);
    let ex = Math.imul(x, dy);
    const s0 = i16(s[0] * dy), s1 = i16(s[1] * dy);
    R.a234 = (i16(dy * s[2]) + (bt(A[t], 2) << 8)) & 0xffff;
    R.a236 = (i16(dy * s[3]) + (bt(A[t], 3) << 8)) & 0xffff;
    R.a228 = ((bt(A[t], 0) << 8) + s0) & 0xffff;
    R.a22a = (s1 + (bt(A[t], 1) << 8)) & 0xffff;
    R.x1b0 = (ex + (PX[t] << 16)) | 0;
    const w = i16(PX[t + ob] - (R.x1b0 >> 16));
    if (w === 0 || w === 1 || w === -1) return;
    const Ao = A[t + ob];
    R.g[0] = idiv(i16((bt(Ao, 0) << 8) - R.a228), w); R.g[1] = idiv(i16((bt(Ao, 1) << 8) - R.a22a), w);
    R.g[2] = idiv(i16((bt(Ao, 2) << 8) - R.a234), w); R.g[3] = idiv(i16((bt(Ao, 3) << 8) - R.a236), w);
  };
  const initAttr = a => { R.w[0] = bt(a, 0) << 8; R.w[1] = bt(a, 1) << 8; R.w[2] = bt(a, 2) << 8; R.w[3] = bt(a, 3) << 8; };
  if (cy12 >= 0) {
    setup(1, R.s02, R.x1b4);
    R.e190 = R.e194 = (PX[t] << 16) | 0; initAttr(A[t]); R.rows = R.y1d0;
    spans(L, PY[t], R.x1b4, R.x1cc, R.s02, clipped, V);
    R.e190 = (PX[t + 1] << 16) | 0; R.e194 = R.x1b0;
    R.w[0] = R.a228; R.w[2] = R.a234; R.w[3] = R.a236; R.w[1] = R.a22a; R.rows = R.y1e8;
    spans(L, PY[t + 1], R.x1b4, R.x1e4, R.s02, clipped, V);
  } else {
    setup(2, R.s01, R.x1cc);
    R.e190 = R.e194 = (PX[t] << 16) | 0; initAttr(A[t]); R.rows = R.y1b8;
    spans(L, PY[t], R.x1b4, R.x1cc, R.s02, clipped, V);
    R.e194 = (PX[t + 2] << 16) | 0; R.e190 = R.x1b0;
    initAttr(A[t + 2]); R.rows = i16(-R.y1e8);
    spans(L, PY[t + 2], R.x1e4, R.x1cc, R.s12, clipped, V);
  }
}

// fast span loop (all 3 vertices inside the screen) and clipped one: one scanline per row, left edge e194, right edge e190
function spans(L, y, ebx, ecx, sl, clipped, V) {
  if (R.rows <= 0) return;
  const S = sl.slice(), W = V.W;
  const incAB = ((S[1] << 16) | (S[0] & 0xffff)) | 0, incCD = ((S[3] << 16) | (S[2] & 0xffff)) | 0;
  const g = R.g;
  const gE = (((g[3] & 0xffff) << 16) | (g[1] & 0xffff)) | 0, gC = (((g[2] & 0xffff) << 16) | (g[0] & 0xffff)) | 0;
  const gEr = rol16(gE), gCr = rol16(gC);
  const inc194 = (ebx + (W << 16)) | 0, inc190 = (ecx + (W << 16)) | 0;
  let ax = y;
  if (ax >= V.ym) return;
  if (V.y0) {
    if (ax < 0) {
      let k = i16(-ax); if (k > R.rows) k = R.rows;
      R.e190 = (R.e190 + Math.imul(ecx, k)) | 0; R.e194 = (R.e194 + Math.imul(ebx, k)) | 0;
      for (let i = 0; i < 4; i++) R.w[i] = (R.w[i] + i16(S[i] * k)) & 0xffff;
      R.rows = i16(R.rows - k); if (R.rows <= 0) return; ax = 0;
    }
  } else if (ax < 1) {
    const k = i16(1 - ax);
    if (k >= R.rows) return;
    R.e190 = (R.e190 + Math.imul(ecx, k)) | 0; R.e194 = (R.e194 + Math.imul(ebx, k)) | 0;
    for (let i = 0; i < 4; i++) R.w[i] = (R.w[i] + i16(S[i] * k)) & 0xffff;
    R.rows = i16(R.rows - k); ax = 1;
  }
  let si = i16(ax + R.rows);
  if (V.siLe ? si > V.siLim : si >= V.siLim) { si = i16(si - V.siSub); R.rows = i16(R.rows - si); if (R.rows <= 0) return; }
  const rowbase = W === 320 ? (((ax * 5) & 0xffff) << 6) & 0xffff : (ax << 8) & 0xffff;
  R.e194 = (R.e194 + (rowbase << 16)) | 0; R.e190 = (R.e190 + (rowbase << 16)) | 0;
  let rb = rowbase;
  do {
    let di = (R.e194 >>> 16) & 0xffff, dx = (R.e190 >>> 16) & 0xffff;
    let w0 = R.w[0], w1 = R.w[1], w2 = R.w[2], w3 = R.w[3], width;
    if (clipped) {
      if (dx >= rb) {
        if (di < rb) {
          const c = i16(di - rb);
          w0 = (w0 - i16(c * g[0])) & 0xffff; w1 = (w1 - i16(c * g[1])) & 0xffff; w2 = (w2 - i16(c * g[2])) & 0xffff; w3 = (w3 - i16(c * g[3])) & 0xffff;
          di = rb;
        }
        const lim = (rb + W) & 0xffff;
        if (di < lim) {
          if (dx >= lim) dx = lim;
          width = (dx - di) & 0xffff;
          if (width === 0 || (width & 0x8000)) width = 0;
        } else width = 0;
      } else width = 0;
    } else { width = (dx - di) & 0xffff; if (width === 0 || (width & 0x8000)) width = 0; }
    if (width) runSpan(L, di, width, (w1 + (w3 << 16)) | 0, (w0 + (w2 << 16)) | 0, gE, gC, gEr, gCr, V.kernel === 'warp');
    R.e194 = (R.e194 + inc194) | 0; R.e190 = (R.e190 + inc190) | 0;
    if (V.wordAdd) { for (let i = 0; i < 4; i++) R.w[i] = (R.w[i] + S[i]) & 0xffff; }
    else {
      const ab = ((R.w[0] & 0xffff) | (R.w[1] << 16)) + incAB | 0, cd = ((R.w[2] & 0xffff) | (R.w[3] << 16)) + incCD | 0;
      R.w[0] = ab & 0xffff; R.w[1] = (ab >> 16) & 0xffff; R.w[2] = cd & 0xffff; R.w[3] = (cd >> 16) & 0xffff;
    }
    rb = (rb + W) & 0xffff;
    R.rows = i16(R.rows - 1);
  } while (R.rows !== 0);
}

// per-pixel kernels. state E = (v3:v1), C = (v2:v0) (8.8 each).
//  env : out = G[v1,v0] + F[ D[v1,v0] + (v3,v2) ]     (8-bit wrap; the 2nd pixel of a pair adds with carry)
//  warp: out = F[ D16[v1, 2*v0] + (v3,v2) ]            (D16 = little endian words of the ds buffer)
function runSpan(L, di, si, E, C, gE, gC, gEr, gCr, warp) {
  const back = L.back, G = L.gs, F = L.fs, D = L.ds;
  const dw = (i) => D[i] | (D[(i + 1) & 0xffff] << 8);          // word table = the 'ds' buffer (res 17 in partb); in 'warp' kernels gs is loaded from [0x558dc] too
  const one = (bh, bl, Er, Cr) => {            // first lookup index bh:bl (E/C state not rotated -> bh,bl already extracted); Er/Cr = rotated state
    const idx = warp ? (bh << 8) | ((bl + bl) & 255) : (bh << 8) | bl;
    const bx = dw(idx);
    const h = ((bx >> 8) + ((Er >> 8) & 255)) & 255, l = ((bx & 255) + ((Cr >> 8) & 255)) & 255;
    return warp ? F[(h << 8) | l] : (G[idx] + F[(h << 8) | l]) & 255;
  };
  if (di & 1) {
    const bh = (E >> 8) & 255, bl = (C >> 8) & 255;
    E = rol16(E); C = rol16(C);
    back[di++ & 0xffff] = one(bh, bl, E, C);
    E = (rol16(E) + gE) | 0; C = (rol16(C) + gC) | 0;
    if (--si === 0) return;
  }
  for (let p = si >> 1; p > 0; p--) {
    let bh = (E >> 8) & 255, bl = (C >> 8) & 255;
    E = rol16(E); C = rol16(C);
    const al = one(bh, bl, E, C);
    E = (E + gEr) | 0; C = (C + gCr) | 0;
    bh = (E >> 8) & 255; bl = (C >> 8) & 255;
    E = rol16(E); C = rol16(C);
    let bp = (bh << 8) | bl;
    bh = (E >> 8) & 255; bl = (C >> 8) & 255;
    E = (E + gE) | 0;
    let ah;
    if (warp) { const idx = (bh << 8) | ((bl + bl) & 255); ah = F[(dw(idx) + bp) & 0xffff]; }
    else { const idx = (bh << 8) | bl; ah = (G[idx] + F[(bp + dw(idx)) & 0xffff]) & 255; }
    C = (C + gC) | 0;
    back[di++ & 0xffff] = al; back[di++ & 0xffff] = ah;
  }
  if (si & 1) {
    const bh = (E >> 8) & 255, bl = (C >> 8) & 255;
    E = rol16(E); C = rol16(C);
    back[di & 0xffff] = one(bh, bl, E, C);
  }
}

// ---------------------------------------------------------------- 2-interpolant env-map triangle (0x4e710 ; modes 2,3 and mode 20 type-1 faces). out = fs[v,u]
const slope8 = (a, b, n, cy) => i16(idiv(i16((((a >> (8 * n)) - (b >> (8 * n))) & 255) << 8), cy));   // ah = a.byte - b.byte (8 bit), al=0, idiv cx
function tri2(L, P0, P1, P2, A0, A1, A2, V = V_T2_320) {
  R.g[0] = R.g[1] = 0;
  const inside = ((P0 & 0xffff) < V.W) + ((P1 & 0xffff) < V.W) + ((P2 & 0xffff) < V.W);
  if (inside === 0) return;
  const clipped = inside !== 3 || !!V.alwaysClip;
  let eax = P0, ebx = P1, ecx = P2; const esi = ebx, edx = ecx;
  if (ebx < eax) { const t = ebx; ebx = eax; eax = t; }
  if (ecx > eax) { const t = ecx; ecx = eax; eax = t; }
  const t = ecx === edx ? 2 : ecx === esi ? 1 : 0;
  if (ecx >= V.ecxLim) return;
  const PX = [P0 & 0xffff, P1 & 0xffff, P2 & 0xffff, P0 & 0xffff, P1 & 0xffff].map(i16), PY = [P0 >> 16, P1 >> 16, P2 >> 16, P0 >> 16, P1 >> 16];
  const A = [A0, A1, A2, A0, A1];
  if (!(PY[t + 1] >= V.early || PY[t + 2] >= V.early)) return;
  const edge = (a, b, ya, yb, xa, xb, s, setx, sety) => {
    const cy = i16(PY[yb] - PY[ya]);
    if (cy !== 0) {
      if (cy !== -1) { s[0] = slope8(A[b], A[a], 0, cy); s[1] = slope8(A[b], A[a], 1, cy); }
      setx(idiv(i16(PX[xb] - PX[xa]) << 16, cy));
    }
    sety(cy); return cy;
  };
  edge(t, t + 2, t, t + 2, t, t + 2, R.s02, v => R.x1b4 = v, v => R.y1b8 = v);
  edge(t, t + 1, t, t + 1, t, t + 1, R.s01, v => R.x1cc = v, v => R.y1d0 = v);
  const cy12 = edge(t + 1, t + 2, t + 1, t + 2, t + 1, t + 2, R.s12, v => R.x1e4 = v, v => R.y1e8 = v);
  const setup = (ob, s, x) => {                  // 0x4eac9
    const dy = i16(PY[t + ob] - PY[t]);
    const ex = Math.imul(x, dy);
    const s0 = i16(s[0] * dy), s1 = i16(s[1] * dy);
    R.a228 = ((bt(A[t], 0) << 8) + s0) & 0xffff;
    R.a22a = (s1 + (bt(A[t], 1) << 8)) & 0xffff;
    R.x1b0 = (ex + (PX[t] << 16)) | 0;
    const w = i16(PX[t + ob] - (R.x1b0 >> 16));
    if (w === 0 || w === -1) return;
    const Ao = A[t + ob];
    R.g[0] = idiv(i16((bt(Ao, 0) << 8) - R.a228), w); R.g[1] = idiv(i16((bt(Ao, 1) << 8) - R.a22a), w);
  };
  const initAttr = (a, cl = 0) => { R.w[0] = (bt(a, 0) << 8) | cl; R.w[1] = (bt(a, 1) << 8) | cl; };
  if (cy12 >= 0) {
    setup(1, R.s02, R.x1b4);
    R.e190 = R.e194 = (PX[t] << 16) | 0; initAttr(A[t]); R.rows = R.y1d0;
    spans2(L, PY[t], R.x1b4, R.x1cc, R.s02[0], R.s02[1], clipped, V);
    R.e190 = (PX[t + 1] << 16) | 0; R.e194 = R.x1b0;
    R.w[0] = R.a228; R.w[1] = R.a22a; R.rows = R.y1e8;
    spans2(L, PY[t + 1], R.x1b4, R.x1e4, R.s02[0], R.s02[1], clipped, V);
  } else {
    setup(2, R.s01, R.x1cc);
    R.e190 = R.e194 = (PX[t] << 16) | 0; initAttr(A[t]); R.rows = R.y1b8;
    spans2(L, PY[t], R.x1b4, R.x1cc, R.s02[0], R.s02[1], clipped, V);
    R.e194 = (PX[t + 2] << 16) | 0; R.e190 = R.x1b0;
    initAttr(A[t + 2], R.x1b0 & 255); R.rows = i16(-R.y1e8);       // no `xor cl,cl` here: the low byte of x1b0 leaks into the attribute fractions
    spans2(L, PY[t + 2], R.x1e4, R.x1cc, R.s12[0], R.s12[1], clipped, V);
  }
}
function spans2(L, y, ebx, ecx, S0, S1, clipped, V = V_T2_320) {
  if (R.rows <= 0) return;
  const g0 = R.g[0], g1 = R.g[1];
  const W = V.W, inc194 = (ebx + (W << 16)) | 0, inc190 = (ecx + (W << 16)) | 0;
  let ax = y;
  if (ax >= V.ym) return;
  if (V.y0 ? ax < 0 : ax < 1) {
    let k = i16((V.y0 ? 0 : 1) - ax);
    if (V.y0) { if (k > R.rows) k = R.rows; } else if (k >= R.rows) return;
    R.e190 = (R.e190 + Math.imul(ecx, k)) | 0; R.e194 = (R.e194 + Math.imul(ebx, k)) | 0;
    R.w[0] = (R.w[0] + i16(S0 * k)) & 0xffff; R.w[1] = (R.w[1] + i16(S1 * k)) & 0xffff;
    R.rows = i16(R.rows - k); if (V.y0) { if (R.rows <= 0) return; ax = 0; } else ax = 1;
  }
  let si = i16(ax + R.rows);
  if (V.siLe ? si > V.siLim : si >= V.siLim) { si = i16(si - V.siSub); R.rows = i16(R.rows - si); if (R.rows <= 0) return; }
  let rb = W === 320 ? (((ax * 5) & 0xffff) << 6) & 0xffff : (ax << 8) & 0xffff;
  R.e194 = (R.e194 + (rb << 16)) | 0; R.e190 = (R.e190 + (rb << 16)) | 0;
  const back = L.back, F = L.tex2 || L.fs;
  do {
    let di = (R.e194 >>> 16) & 0xffff, dx = (R.e190 >>> 16) & 0xffff;
    let u = R.w[0], v = R.w[1], width;
    if (clipped) {
      if (dx >= rb) {
        if (di < rb) { const c = i16(di - rb); u = (u - i16(c * g0)) & 0xffff; v = (v - i16(c * g1)) & 0xffff; di = rb; }
        const lim = (rb + W) & 0xffff;
        if (di < lim) { if (dx >= lim) dx = lim; width = (dx - di) & 0xffff; if (width === 0 || (width & 0x8000)) width = 0; } else width = 0;
      } else width = 0;
    } else { width = (dx - di) & 0xffff; if (width === 0 || (width & 0x8000)) width = 0; }
    if (width) {
      if (di & 1) { back[di++ & 0xffff] = F[(v >> 8 << 8) | (u >> 8)]; v = (v + g1) & 0xffff; u = (u + g0) & 0xffff; width--; }
      for (let p = (width >> 1) & 255; p > 0; p--) {
        const a = F[(v >> 8 << 8) | (u >> 8)]; v = (v + g1) & 0xffff; u = (u + g0) & 0xffff;
        const b = F[(v >> 8 << 8) | (u >> 8)]; v = (v + g1) & 0xffff; u = (u + g0) & 0xffff;
        back[di++ & 0xffff] = a; back[di++ & 0xffff] = b;
      }
      if ((width & 1) || (width >> 9)) back[di & 0xffff] = F[(v >> 8 << 8) | (u >> 8)];
    }
    R.e194 = (R.e194 + inc194) | 0; R.e190 = (R.e190 + inc190) | 0;
    R.w[0] = (R.w[0] + S0) & 0xffff; R.w[1] = (R.w[1] + S1) & 0xffff;
    rb = (rb + W) & 0xffff;
    R.rows = i16(R.rows - 1);
  } while (R.rows !== 0);
}

export const _tri4 = tri4, _tri2 = tri2, _R = R;
export const _tri4w320 = (L, a, b, c, d, e, f) => tri4(L, a, b, c, d, e, f, V_WARP320), _tri4w256 = (L, a, b, c, d, e, f) => tri4(L, a, b, c, d, e, f, V_WARP256);

// ---- additive (part I): 256-wide targets, mode 21 (0x4deb1: 0x54548 / 0x52e96 into this.tgt)
export const V_T2_320 = { W: 320, early: 1, ecxLim: 0xc70000, y0: false, ym: 0xc7, siLim: 0xc7, siLe: false, siSub: 0xc6 };       // 0x4e710
export const V_T2_256 = { W: 256, early: 0, ecxLim: 0xc80000, y0: true, ym: 0xff, siLim: 0xff, siLe: true, siSub: 0xff, alwaysClip: true };   // 0x52e96 (+span 0x5324f)
Lib3D.prototype.rasterMode21 = function () {
  const { F } = this.st, V2 = this.V2, A = this.A, L = this.faceList, back = this.back; this.back = this.tgt; this.tex2 = this.gs;
  try {
    for (let k = 0; k < L.length; k++) {
      const f = L[k] >>> 16, a = F[f * 8 + 1], b = F[f * 8 + 2], c = F[f * 8 + 3];
      const P = [a, b, c].map(i => (V2[i * 2] & 0xffff) | (V2[i * 2 + 1] << 16));
      if (F[f * 8] === 1) tri2(this, P[0], P[1], P[2], rol16(A[a]), rol16(A[b]), rol16(A[c]), V_T2_256);
      else tri4(this, P[0], P[1], P[2], A[a], A[b], A[c], V_WARP256);
    }
  } finally { this.back = back; }
};
MODES[21] = { light: P.lightVertex, cull: P.cull, setup: P.setupEnv, raster: Lib3D.prototype.rasterMode21 };
export const _tri2w256 = (L, a, b, c, d, e, f) => { L.tex2 = L.gs; tri2(L, a, b, c, d, e, f, V_T2_256); };
export const V_WARP256B = { ...V_WARP256, siLe: true, siSub: 0xff }; export const _tri4w256b = (L, a, b, c, d, e, f) => tri4(L, a, b, c, d, e, f, V_WARP256B);
