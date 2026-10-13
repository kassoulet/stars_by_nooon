// Whole-demo smoke test: simulated music clock (linear order rate), logs part start/end ticks and exceptions.
import { Vga, Resources } from '../engine.js';
import { SCRIPT } from '../script.js';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const res = new Resources(async n => new Uint8Array(fs.readFileSync(path.join(here, '..', 'assets', String(n).padStart(2, '0') + '.dec'))));
const parts = []; for (const s of SCRIPT) parts.push((await import(`../parts/${s.part}.js`))[s.x || 'default']);
await res.preload(parts.flatMap(p => p.resources || []));
const vga = new Vga(); let tick = 0; const secPerOrder = 2.47;
const pos = () => { const t = tick / 70 / secPerOrder, o = Math.floor(t); return (o << 8) | Math.floor((t - o) * 64); };
const ctx = { vga, res: res.get, pos };
let i = -1, f = 0, done = false; const max = 70 * 400;
for (; tick < max; tick++) {
  const p = pos(), nx = SCRIPT[i + 1];
  if (nx && (i < 0 || done) && (p > nx.start || !nx.start)) { i++; f = 0; done = false; console.log('start', SCRIPT[i].part + (SCRIPT[i].x || ''), 'tick', tick, 'pos', p.toString(16)); parts[i].init(ctx); }
  if (i >= 0 && !done) { try { if (parts[i].frame(ctx, f++) === false) { done = true; console.log('  end tick', tick, 'frames', f, 'pos', p.toString(16)); } } catch (e) { console.log('ERR', SCRIPT[i].part, e.stack.split('\n').slice(0, 3).join('|')); break; } }
}
console.log('final tick', tick, 'part', i, 'done', done);
