import { Vga, Resources, browserLoader } from './engine.js';
import { SCRIPT } from './script.js';
import { ChiptuneJsPlayer } from './lib/chiptune3.js';

const go = document.getElementById('go'), cv = document.getElementById('c'), hud = document.getElementById('hud'), g = cv.getContext('2d');
const stage = document.getElementById('stage'), crt = document.getElementById('crt'), crtc = document.getElementById('crtc'), SRC_ROWS = 200;
try { crtc.checked = localStorage.crt === '1'; } catch {}
// CRT overlay (display only): one scanline band per source row; stage height = k*200 device px so the band period is a whole number of device pixels (no moire).
function crtLayout() {
  const dpr = devicePixelRatio, k = Math.floor(Math.min(innerHeight, innerWidth * 3 / 4) * dpr / SRC_ROWS), ok = k >= 2;
  crtc.disabled = !ok; crtc.parentElement.style.opacity = ok ? '' : .4;
  crtc.parentElement.title = ok ? '' : 'window too small for the CRT effect';
  const on = ok && crtc.checked;
  crt.style.display = on ? 'block' : 'none';
  stage.style.width = on ? `${Math.round(k * SRC_ROWS * 4 / 3) / dpr}px` : '';
  stage.style.height = on ? `${k * SRC_ROWS / dpr}px` : '';
  stage.style.aspectRatio = on ? 'auto' : '';
  if (on) crt.style.cssText += `;background:radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.12) 100%),linear-gradient(transparent 40%,rgba(0,0,0,.34));background-size:100% 100%,100% ${k / dpr}px`;
}
crtc.onchange = () => { try { localStorage.crt = crtc.checked ? '1' : '0'; } catch {} crtLayout(); crtc.blur(); };
addEventListener('resize', crtLayout); document.addEventListener('fullscreenchange', crtLayout);
matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener?.('change', crtLayout);
const img = g.createImageData(320, 200), px = new Uint32Array(img.data.buffer);
const TICK = 1000 / 70;
go.onclick = async () => {
  go.style.display = 'none'; stage.style.display = 'block'; crtLayout();
  const vga = new Vga(), res = new Resources(browserLoader);
  let pos = 0, time = 0, paused = false, seeking = false, simPos = null;   // simPos: timeline-driven pos while fast-forwarding
  const timeline = await (await fetch('timeline.json')).json();           // [seconds, order<<8|row], from the MOD simulation
  const timelinePos = t => { let lo = 0, hi = timeline.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (timeline[m][0] <= t) lo = m; else hi = m - 1; } return timeline[lo][1]; };
  const music = new ChiptuneJsPlayer({ repeatCount: 0, stereoSeparation: 70 });
  music.onProgress(p => { pos = (p.order << 8) | p.row; time = p.pos; });
  await new Promise(r => music.onInitialized(r));
  const ctx = { vga, res: res.get, pos: () => simPos ?? pos };
  const parts = await Promise.all(SCRIPT.map(async s => (await import(`./parts/${s.part}.js`))[s.x || 'default']));
  await res.preload(parts.flatMap(p => p.resources || []));
  music.load('stars.xm');

  const starts = [];                                     // tick at which each part started (learned while running)
  let i = -1, f = 0, done = false, last = performance.now(), acc = 0;
  const step = () => {
    const nx = SCRIPT[i + 1];
    if (nx && (i < 0 || done) && (ctx.pos() > nx.start || !nx.start)) { i++; f = 0; done = false; starts[i] = ticks; vga.blend = false; parts[i].init(ctx); }
    vga.beginTick();
    if (i >= 0 && !done && parts[i].frame(ctx, f++) === false) done = true;
  };
  // Seek: parts are stateful, so rebuild by replaying from the start (or from now when going forward) on the MOD timeline, without drawing.
  let ticks = 0;                                         // simulated ticks since start
  const seekTo = async t => {
    t = Math.max(0, Math.min(t, music.duration - 1)); const target = Math.round(t * 70);
    seeking = true; hud.textContent = 'seeking…';
    music.pause();
    if (target < ticks) {                                // rewind: restart at the latest known part start before target (parts begin from a black screen)
      let k = SCRIPT.findLastIndex((_, n) => starts[n] <= target);
      vga.clear(); vga.pal.fill(0); i = k - 1; f = 0; done = k > 0; ticks = k < 0 ? 0 : starts[k]; if (k < 0) i = -1;
    }
    for (let n = 0; ticks < target; ticks++) {
      simPos = timelinePos(ticks / 70); step();
      if (++n % 300 === 0) await new Promise(r => setTimeout(r));   // keep UI alive
    }
    simPos = null; music.setPos(t); if (!paused) music.unpause(); time = t; acc = 0; last = performance.now(); seeking = false;
  };
  const togglePause = () => { paused = !paused; paused ? music.pause() : (music.unpause(), last = performance.now(), acc = 0); };
  addEventListener('keydown', e => {
    if (e.code === 'Space' || e.key === 'k') { togglePause(); e.preventDefault(); }
    else if ((e.key === 'ArrowRight' || e.key === 'l') && !seeking) seekTo(time + 5);
    else if ((e.key === 'ArrowLeft' || e.key === 'j') && !seeking) seekTo(time - 5);
    else if (e.key === 'c' && !crtc.disabled) { crtc.checked = !crtc.checked; crtc.onchange(); }
    else if (e.key === 'f') document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen();
  });
  const fmt = s => `${(s / 60) | 0}:${String(s % 60 | 0).padStart(2, '0')}`;
  const loop = now => {
    acc += now - last; last = now;
    if (!paused && !seeking) while (acc >= TICK) { step(); ticks++; acc -= TICK; }
    else acc = 0;
    if (!seeking) hud.textContent = `${paused ? '⏸ ' : ''}${fmt(time)} / ${fmt(music.duration || 0)}  ${SCRIPT[i]?.part ?? ''}`;
    vga.toRGBA(px); g.putImageData(img, 0, 0); requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};
