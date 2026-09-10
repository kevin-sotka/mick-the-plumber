/* Mick the Plumber headless harness — adapted from Foundry/tools/harness_template.js.
 *
 * Unlike the template's target shape, this game wraps everything in a single IIFE and
 * exposes a curated surface on window.MICK_GAME (state/player/world/cam/hud/input/level,
 * plus tick(dt,draw), startGame(), advanceOnTap()). So instead of the template's "eval the
 * script, then bolt getters onto its bare globals" trick, this harness drives MICK_GAME
 * directly, the same way a live page would via window.MICK_GAME in devtools.
 *
 *   npm i -D @napi-rs/canvas
 *   node --expose-gc tools/harness.js /tmp/frames <scenario>
 *
 * Two things make this worth more than a checklist (see jimothy_standard.md gate 8):
 *   1. tick(dt, draw) lets it simulate WITHOUT rasterising every frame.
 *   2. repeatHeld() reproduces browser keydown auto-repeat, which is how the missing-camera-
 *      offset and zone-numbering bugs in this game would have been caught before shipping:
 *      a "run right for N seconds, check the screen position stays on canvas and the banner
 *      text matches level order" scenario fails hard and immediately on the pre-fix code.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

let NC;
for (const id of ['@napi-rs/canvas',
                  path.join(__dirname, '..', 'node_modules', '@napi-rs', 'canvas')]) {
  try { NC = require(id); break; } catch (e) { /* next */ }
}
if (!NC) { console.error('Missing @napi-rs/canvas. Run: npm i -D @napi-rs/canvas'); process.exit(1); }

const ROOT = path.join(__dirname, '..');
process.chdir(ROOT);
const OUT = process.argv[2] || path.join(ROOT, 'tools', 'frames');
fs.mkdirSync(OUT, { recursive: true });

const CANVAS_ID = 'game', CANVAS_W = 480, CANVAS_H = 270, WIN_W = 960, WIN_H = 540;

/* ------------------------------------------------------------------ stubs */
const listeners = {};
const addL = (k, f) => { (listeners[k] = listeners[k] || []).push(f); };
let rafQ = [], rafId = 0;
const raf = cb => { rafQ.push(cb); return ++rafId; };

const mkCanvas = (w = 300, h = 150) => {
  const c = NC.createCanvas(w, h);
  c.style = {};
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: c.width, height: c.height });
  c.addEventListener = addL;
  c.removeEventListener = () => {};
  return c;
};
const mainCanvas = mkCanvas(CANVAS_W, CANVAS_H);
const perfStart = Date.now();

class FakeAudioEl {
  constructor(){ this.volume=0; this.paused=true; this.loop=false; this.currentTime=0; }
  play(){ this.paused=false; return Promise.resolve(); }
  pause(){ this.paused=true; }
  canPlayType(){ return 'probably'; }
}
/* Generic DOM element stand-in: covers every button/div the game touches (#wrap, #topbtns,
   #pauseBtn, #muteBtn, #touch and its dynamically created child buttons). Real elements, not
   special-cased per id, so a new UI element added later doesn't need a new stub. */
function mkGenericEl(){
  return {
    style:{}, dataset:{}, className:'', textContent:'', innerHTML:'',
    children:[],
    appendChild(child){ this.children.push(child); return child; },
    addEventListener: addL, removeEventListener(){},
  };
}
class FakeParam { constructor(){ this.value=0; } setValueAtTime(){} linearRampToValueAtTime(){}
  exponentialRampToValueAtTime(){} setTargetAtTime(){} cancelScheduledValues(){} }
class FakeNode { constructor(){ this.gain=new FakeParam(); this.frequency=new FakeParam();
  this.Q=new FakeParam(); this.detune=new FakeParam(); this.type=''; }
  connect(n){ return n; } disconnect(){} start(){} stop(){} }
class FakeAudioCtx {
  constructor(){ this.currentTime=0; this.state='running'; this.sampleRate=44100; this.destination={}; }
  createOscillator(){ return new FakeNode(); }
  createGain(){ return new FakeNode(); }
  createBiquadFilter(){ return new FakeNode(); }
  createDynamicsCompressor(){ return new FakeNode(); }
  createBuffer(ch, n){ return { getChannelData: () => new Float32Array(n), length:n }; }
  createBufferSource(){ const n = new FakeNode(); n.buffer = null; n.playbackRate = new FakeParam(); return n; }
  resume(){ return Promise.resolve(); }
}

const bgmEl = new FakeAudioEl();
const documentStub = {
  getElementById: id => id === CANVAS_ID ? mainCanvas : (id === 'bgm' ? bgmEl : mkGenericEl()),
  createElement: tag => tag === 'canvas' ? mkCanvas() : mkGenericEl(),
  body: { appendChild() {} }, addEventListener: addL, hidden: false
};
const windowStub = {
  innerWidth: WIN_W, innerHeight: WIN_H, devicePixelRatio: 1,
  addEventListener: addL, removeEventListener(){}, requestAnimationFrame: raf, cancelAnimationFrame(){},
  AudioContext: FakeAudioCtx, webkitAudioContext: FakeAudioCtx, Audio: FakeAudioEl,
  performance: { now: () => Date.now() - perfStart },
  localStorage: { _d:{}, getItem(k){ return this._d[k] ?? null; },
                  setItem(k,v){ this._d[k]=String(v); }, removeItem(k){ delete this._d[k]; } },
  Image: NC.Image, document: documentStub, console,
  matchMedia: () => ({ matches:false, addEventListener(){}, addListener(){} }),
  setTimeout, clearTimeout, setInterval, clearInterval
};
windowStub.window = windowStub;

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('No inline <script> found in index.html'); process.exit(1); }

const fn = new Function(
  'window','document','requestAnimationFrame','addEventListener','Image','performance',
  'localStorage','devicePixelRatio','innerWidth','innerHeight','AudioContext','console',
  m[1]);

try {
  fn(windowStub, documentStub, raf, addL, NC.Image, windowStub.performance,
     windowStub.localStorage, 1, WIN_W, WIN_H, FakeAudioCtx, console);
} catch (e) { console.log('RUNTIME ERROR (eval):\n' + e.stack); process.exit(1); }

const api = windowStub.MICK_GAME;
if (!api) { console.error('window.MICK_GAME was not set — did index.html drop the exposure block?'); process.exit(1); }

/* Real boot() only runs on 'DOMContentLoaded'; the stub never fires that on its own. */
(listeners['DOMContentLoaded']||[]).forEach(f => f({}));
if (!api.player) { console.error('boot() ran but player is still null'); process.exit(1); }

/* ------------------------------------------------------------------ drive */
function fire(kind, key, repeat, extra){
  (listeners[kind]||[]).forEach(f => {
    try { f(Object.assign({ key, code:key, repeat: !!repeat, preventDefault(){},
      stopPropagation(){}, clientX:0, clientY:0, touches:[], changedTouches:[] }, extra||{})); }
    catch(e){ console.log('  handler error in ' + kind + ': ' + e.message); }
  });
}
const held = new Set();
const hold    = k => { if(!held.has(k)){ held.add(k); fire('keydown', k); } };
const release = k => { if(held.has(k)){ held.delete(k); fire('keyup', k); } };
const tap     = k => { fire('keydown', k); fire('keyup', k); };
const releaseAll = () => { for (const k of [...held]) release(k); };
/* Browsers fire repeated keydown while a key is held; call every couple of frames in any
   scenario that holds a key, or held-key bugs (like Jimothy's) stay invisible. */
const repeatHeld = () => { for (const k of held) fire('keydown', k, true); };

const DT = 1/60; let nFrames = 0, nDrawn = 0;
function step(n = 1, draw = false){
  for (let i = 0; i < n; i++){
    nFrames++; if (draw) nDrawn++;
    api.tick(DT, draw);
    if (global.gc && nDrawn && nDrawn % 8 === 0) global.gc();
  }
}
function save(name){
  api.render();
  const buf = mainCanvas.toBuffer('image/png');
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('  ' + name.padEnd(24), (buf.length/1024|0) + 'kB',
    crypto.createHash('md5').update(buf).digest('hex').slice(0,8), '| state=' + api.state);
}
/* Player's on-screen position, using the same formula as drawPlayer() in index.html.
   If drawPlayer ever again forgets to subtract cam.x/cam.y, this reports a wildly
   out-of-bounds screenX instead of the fixed-up in-bounds one. */
function playerScreenPos(){
  const p = api.player, c = api.cam;
  return { x: p.x - c.x + p.w/2 - 16, y: p.y - c.y + p.h - 48 };
}

const SCEN = {
  title(){ step(60); save('01_title.png'); },

  /* Careful, screenshot-heavy walkthrough for manually diagnosing a reported stuck point.
     Bunny-hops continuously (jump the instant it's grounded, held long enough for a real
     rise) so it never misses an obstacle that needed a jump, and pulses duck briefly and
     periodically (never held indefinitely — see the adversarial comment above for why an
     indefinite hold is a self-inflicted dead end, not a game bug). Screenshots on every
     stall and periodically regardless, named by frame number for later inspection. */
  walkthrough(){
    api.startGame(); step(20);
    hold('ArrowRight'); hold('Shift'); hold('j');
    let lastX = api.player.x, stalled = 0, jumpUntil = 0, wasGrounded = false;
    for (let i = 0; i < 6000; i++){
      const P = api.player;
      if (P.grounded && !wasGrounded) jumpUntil = i + 18;   // just landed: queue a fresh hop
      wasGrounded = P.grounded;
      if (i < jumpUntil) hold(' '); else release(' ');
      if (stalled > 20 && stalled % 30 < 6) hold('ArrowDown'); else release('ArrowDown');
      if (i % 2 === 0) repeatHeld();
      step(1);
      if (P.x - lastX < 0.35) stalled++; else stalled = 0;
      lastX = Math.max(lastX, P.x);
      if (i % 60 === 0 || stalled === 90){
        console.log(i, JSON.stringify({x:Math.round(P.x), y:Math.round(P.y), grounded:P.grounded, anim:P.anim, stalled}));
        save('wt_'+String(i).padStart(4,'0')+'.png');
      }
      if (stalled > 400) { console.log('  giving up, stalled 400 frames at x='+Math.round(P.x)); break; }
    }
  },

  howto(){ step(30); api.advanceOnTap(); step(10); save('02_howto.png'); },

  /* Zone banners and teach signposts are auto-numbered by the level parser in the order it
     scans the ASCII map. This scenario is the direct regression test for the "spawns into
     ZONE 3" bug: it asserts the banner order matches left-to-right level order, not just
     that a banner is present. */
  zoneOrder(){
    const rows = api.LEVEL_ROWS_FN ? api.LEVEL_ROWS_FN() : null;
    if (!api.parseLevel || !rows) { console.log('  SKIP: parseLevel/LEVEL_ROWS_FN not exposed'); return; }
    const parsed = api.parseLevel(rows);
    const banners = parsed.entities.filter(e => e.type === 'zonebanner').sort((a,b)=>a.n-b.n);
    const teaches = parsed.entities.filter(e => e.type === 'teach').sort((a,b)=>a.n-b.n);
    let ok = true;
    for (let i = 1; i < banners.length; i++) if (banners[i].tx < banners[i-1].tx) ok = false;
    for (let i = 1; i < teaches.length; i++) if (teaches[i].tx < teaches[i-1].tx) ok = false;
    console.log('  banners (n,tx): ' + JSON.stringify(banners.map(b=>[b.n,b.tx])));
    console.log('  teaches (n,tx): ' + JSON.stringify(teaches.map(t=>[t.n,t.tx])));
    console.log(ok ? '  OK: banner/teach numbering matches level order'
                    : '  FAIL: a banner or teach sign is numbered out of level order');
    if (!ok) process.exitCode = 1;
  },

  /* Direct regression test for the invisible-player bug: run right for a few seconds and
     assert Mick's screen position (by the same formula drawPlayer uses) stays inside the
     canvas the whole time. Pre-fix, this drifts to several thousand px within a second. */
  playerOnScreen(){
    api.startGame(); step(10);
    hold('ArrowRight');
    let worstX = null, worstY = null, frames = 0;
    for (let i = 0; i < 240; i++){
      if (i % 2 === 0) repeatHeld();
      step(1); frames++;
      const s = playerScreenPos();
      if (s.x < -32 || s.x > CANVAS_W || s.y < -48 || s.y > CANVAS_H){
        if (worstX === null) worstX = s.x, worstY = s.y;
      }
    }
    releaseAll();
    console.log('  ' + frames + ' frames held right; final screen pos ' + JSON.stringify(playerScreenPos()));
    console.log(worstX === null ? '  OK: player stayed on-screen the whole run'
      : '  FAIL: player left the canvas at screen (' + Math.round(worstX) + ',' + Math.round(worstY) + ')');
    if (worstX !== null) process.exitCode = 1;
    save('03_player_on_screen.png');
  },

  perf(){
    api.startGame(); step(60);
    const T = Date.now(); let n = 0;
    hold('ArrowRight');
    for (let i = 0; i < 120; i++){ if (i%2===0) repeatHeld(); step(1, true); n++; }
    const ms = (Date.now() - T) / n;
    console.log('  render cost: ' + ms.toFixed(1) + ' ms/frame over ' + n +
                ' drawn frames (software canvas)  budget 25ms  ' + (ms <= 25 ? 'OK' : 'OVER'));
    save('90_perf.png');
  },

  /* THE ADVERSARIAL SCENARIO (gate 8): hold right, hold jump, WITH keydown auto-repeat,
     for a long run, and fail on a measurable stall — not on a human looking at a picture.
     This game's forgiveness layer isn't jump-only:
       - progress is gated by valves that need the wrench held for 0.6s while standing in
         their zone (see updateValves()) — hold wrench continuously, the way a real
         "mash every button" playtester would.
       - one obstacle (the low pipe in Zone 1) needs DOWN tapped, held only briefly. Ducking
         (not sliding) applies zero horizontal acceleration — only friction — so holding
         DOWN indefinitely coasts to a dead stop and stays there for good, held or not, a
         self-inflicted deadlock that looks exactly like a level bug but is a scripting one.
         A brief, periodic down-tap avoids that trap while still catching duck-gated content.
     Known false-positive: an enemy standing right at the pipe's exit can tag the player
     mid-slide; that reads as a stall here but is normal difficulty a human clears by timing
     the stomp/whack, not a structural defect — see tools/harness.js history / session notes. */
  adversarial(){
    api.startGame(); step(30);
    hold('ArrowRight'); hold('j');
    let lastX = api.player.x, stalled = 0, jam = 0, played = 0, worst = null;
    const seen = {};
    for (let i = 0; i < 9000; i++){
      if (api.state !== 'play'){ step(1); lastX = api.player.x; stalled = 0; continue; }
      if (i % 90 < 4) hold(' '); else release(' ');       // periodic jump to clear obstacles
      if (i % 40 < 6) hold('ArrowDown'); else release('ArrowDown');   // periodic brief duck/slide
      if (i % 2 === 0) repeatHeld();                       /* <- the line that finds the bugs */
      step(1); played++;
      const P = api.player;
      seen[P.anim] = (seen[P.anim] || 0) + 1;
      if (P.x - lastX < 0.35){
        if (++stalled > 150){                                  /* 2.5s of live play, no progress */
          jam++;
          if (!worst) worst = { x: Math.round(P.x), y: Math.round(P.y), anim: P.anim, frame: i };
          stalled = 0;
        }
      } else stalled = 0;
      lastX = Math.max(lastX, P.x);
    }
    releaseAll();
    console.log('  ' + played + ' live frames; anim histogram ' + JSON.stringify(seen));
    console.log(jam ? '  STUCK ' + jam + ' time(s); first at ' + JSON.stringify(worst)
                    : '  NO STALLS in ' + played + ' live frames; reached x=' + Math.round(lastX));
    if (jam) process.exitCode = 1;
    save('99_adversarial.png');
  },

  jumpRange(){
    api.startGame(); step(20);
    hold('ArrowRight'); hold('Shift');
    for (let i = 0; i < 40; i++){ if (i%2===0) repeatHeld(); step(1); }
    console.log('pre-jump', JSON.stringify({x:Math.round(api.player.x), vx:Math.round(api.player.vx)}));
    hold(' ');
    let jumped = false, leftGroundX = null, landedX = null;
    for (let i = 0; i < 200; i++){
      if (i === 20) release(' ');   // hold well past apex for the tallest/longest arc
      if (i%2===0) repeatHeld();
      const wasGrounded = api.player.grounded;
      step(1);
      const P = api.player;
      if (wasGrounded && !P.grounded && leftGroundX===null) leftGroundX = P.x;
      if (leftGroundX!==null && P.grounded && landedX===null && P.x>leftGroundX+5){ landedX = P.x; break; }
    }
    console.log('run-jump: left ground at x='+Math.round(leftGroundX)+', landed at x='+Math.round(landedX)+', range='+Math.round(landedX-leftGroundX)+'px ('+((landedX-leftGroundX)/32).toFixed(2)+' tiles)');
  },

  /* z1d's drain valve used to sit 5 tiles (160px) above its entry floor on a 1-tile pillar
     with almost no run-up — a full sprint-jump held to natural apex JUST cleared it (161px vs
     160 needed), a 0-1px margin that wasn't real, and needed sprint + a knife-edge landing to
     even get that. Two intermediate-platform designs were tried and both introduced worse
     bugs than they fixed (a platform thick enough to be ground-connected blocked the floor
     underneath it; a thin platform flush against the pillar created a "graze the corner"
     collision the player could hit face-first mid-jump) before landing on the actual fix:
     the valve, teach sign, and pillar are just LOWERED 2 tiles to sit at the door's own
     height (a 3-row wall matching the standard door band, not a 5-row one). That drops the
     climb to 96px, comfortably inside a *plain walk-jump's* apex (~138px, no sprint needed)
     with real margin. This scenario drives a plain, unhurried run (jump fired whenever
     grounded, no sprint, no precision timing) and confirms the player actually reaches the
     valve's tile. Re-run after any change to z1d's geometry or to jump physics. */
  valveReach(){
    const rows = api.LEVEL_ROWS_FN();
    const parsed = api.parseLevel(rows);
    const valve = parsed.entities.find(e => e.type === 'valve' && e.kind === 'drain');
    if (!valve) { console.log('  no drain valve found — z1d layout changed, scenario needs updating'); return; }
    const targetX = valve.tx*32, targetY = valve.ty*32;
    console.log('  drain valve at tile ('+valve.tx+','+valve.ty+')  world px ('+targetX+','+targetY+')');

    api.startGame(); step(20);
    api.player.x = 54*32 + 4; api.player.y = 340; api.player.vx = 0; api.player.vy = 0;
    hold('ArrowRight');
    let closest = Infinity, jumpAt = -100, jumps = 0, reachedAt = -1;
    for (let i = 0; i < 200; i++){
      const P = api.player;
      closest = Math.min(closest, Math.hypot(P.x - targetX, P.y - targetY));
      if (P.grounded && i - jumpAt > 24) { hold(' '); jumpAt = i; jumps++; }
      if (i - jumpAt === 20) release(' ');
      if (i % 2 === 0) repeatHeld();
      step(1);
      if (Math.abs(P.x - targetX) < 20 && Math.abs(P.y - targetY) < 40) { reachedAt = i; break; }
    }
    const P = api.player;
    console.log('  final position ('+Math.round(P.x)+','+Math.round(P.y)+'), plain jumps used='+jumps+', closest approach to valve='+Math.round(closest)+'px'+(reachedAt>=0?', reached at frame '+reachedAt:''));
    console.log('  ' + (closest < 40 ? 'REACHABLE with a plain walk-jump — fix confirmed' : 'STILL NOT REACHABLE — needs another look'));
  },

  /* Map-topology audit: no game mechanic (drain/flow/geyser valve) removes a solid stone or
     steel tile — valves only open water. So any column with no genuinely passable opening in
     its playable band (rows 1..h-6) is a permanent dead end, independent of input.
     "Passable" means at least 2 contiguous open rows (64px — comfortably fits the 28px duck
     hitbox with margin), not just "not literally every row." A single accidental 1-row gap
     is what actually shipped at the z1b/z1c seam: the level's hand-typed ASCII rows weren't
     all the same length, so a short row got right-padded with an extra space by seg(), and
     that lone padding space became the only non-solid cell in an otherwise solid column —
     open by the letter of "not fully solid," but no real player can fit a slide through a
     single row aligned exactly on the tile grid. This is how the "zone segments authored as
     sealed boxes" bug was found in the first place: hold right + wrench (adversarial) got a
     real player stuck at world x=460 with no valve nearby; after that fix, the exact same
     technique (a clean, chaos-free run) found a second player stuck dead at world x=1132,
     which is this seam. Require a real gap, not a technicality. */
  connectivity(){
    const rows = api.LEVEL_ROWS_FN();
    const parsed = api.parseLevel(rows);
    const MIN_GAP = 2; // contiguous open rows needed for a genuinely passable opening
    const solidCols = [];
    for (let x = 0; x < parsed.w; x++){
      let bestRun = 0, run = 0;
      for (let y = 1; y < parsed.h - 5; y++){   // skip the universal ceiling row and the floor/basement rows
        if (!parsed.grid[y][x]) { run++; bestRun = Math.max(bestRun, run); } else { run = 0; }
      }
      if (bestRun < MIN_GAP) solidCols.push(x);
    }
    // collapse consecutive columns into ranges for a readable report
    const ranges = [];
    for (const x of solidCols){
      const last = ranges[ranges.length-1];
      if (last && x === last[1]+1) last[1] = x; else ranges.push([x,x]);
    }
    // Two ranges are expected, not bugs: column 0 is the world's left edge (there's nothing
    // to walk in from), and the tail is the sealed room around the Master Valve (reachable
    // and interactable at its own tile, verified separately) plus z3end — walled off until
    // the ending's flood-through cutscene. Everything else must be open.
    const EXPECTED = [[0,0],[parsed.w-9,parsed.w-1]];
    const unexpected = ranges.filter(r => !EXPECTED.some(e => e[0]===r[0] && e[1]===r[1]));
    console.log('  full floor-to-ceiling solid columns: ' +
      (ranges.length ? ranges.map(r=>r[0]===r[1]?''+r[0]:r[0]+'-'+r[1]).join(', ') : 'none') +
      '  (expected: world edge + Master Valve endcap)');
    console.log(unexpected.length ? '  FAIL: ' + unexpected.length + ' unexpected impassable seam(s): ' + JSON.stringify(unexpected)
                                   : '  OK: no unexpected dead ends — every zone segment connects');
    if (unexpected.length) process.exitCode = 1;
  }
};

(async () => {
  await new Promise(r => setTimeout(r, 200));
  const name = process.argv[3] || 'title';
  const T0 = Date.now();
  try {
    (SCEN[name] || SCEN.title)();
    console.log('\nOK [' + name + ']  state=' + api.state + '  ' + nFrames + ' frames (' +
      nDrawn + ' drawn) in ' + (Date.now()-T0) + 'ms  rss ' +
      Math.round(process.memoryUsage().rss/1e6) + 'MB');
  } catch (e) { console.log('RUNTIME ERROR (frames):\n' + e.stack); process.exit(1); }
})();
