# Mick the Plumber: Pipe Panic — v2 (platformer rebuild)

## Brief
- **Concept:** SMB3-inspired side-scrolling pixel platformer: Mick runs, jumps, ducks, and wrenches water valves open/closed to traverse a flooded stone-and-steel sewer and reach the Master Valve.
- **Quality bar:** polished
- **Scope:** L (full rebuild; v1 auto-runner retired)
- **Why v2:** v1 gameplay/physics judged below par. Player agency, momentum physics, traversal puzzles, obstacle variety, visual richness, and clarity are the five upgrade axes.

## Core Concept
One handcrafted level (~2-3 min skilled, longer first time), three zones: **Stone Works → Steel Mains → The Cistern**. Real platforming physics with momentum and a run button. The signature mechanic: **valves**. Water blocks progress (flooded pits, high ledges, sheer walls); Mick's wrench turns valves that drain, redirect, or jet water to open a path. "Mick the Plumber" (song.mp3) plays as the soundtrack (loop with soft fade if the run outlasts it); lamps and slime pulse subtly on its 92 BPM grid (cosmetic only: physics are never beat-locked).

## Physics (binding numbers, 60fps basis, 1 tile = 32px; integrate with dt)
- Walk: accel 900 px/s², max 160 px/s. **Run (hold RUN):** max 280 px/s, reached after ~1s sustained (P-meter feel; show a small speed gauge that fills).
- Friction 1400 px/s² on release; **skid** when reversing above 200 px/s: decel 2200, dust puff, skid pose.
- Gravity 2600 px/s²; **held-jump gravity 1500** until apex or release (variable height). Jump velocity −520 px/s walking, −580 at full run. Terminal fall 900 px/s.
- **Coyote time 90ms; jump buffer 120ms.** Landing squash 80ms. These are non-negotiable: they are most of "feel."
- **Duck:** DOWN while grounded: hitbox 48→28px tall; under low pipes. **Slide:** DOWN while running: 300ms slide (keeps momentum, low hitbox, can slide under hazards; small dust trail).
- Stomp: landing on a stompable enemy bounces Mick (−400) and kills it.
- Hit: knockback (180 px/s away, −300 up), 1.2s i-frames (flicker), 1 heart lost. 3 hearts; heart pickups exist. Fall in water/pit: lose heart, respawn at last checkpoint.

## The Valve System (signature; teach each type on first encounter)
Interact: stand in valve zone → floating prompt appears → hold WRENCH 0.6s (wheel spins, clank-ratchet feedback).
- **DRAIN VALVE (red wheel)** at flooded pits: turning drains the pit over 1s; stays drained **12s** (big countdown ring on the valve + water visibly rising near the end as warning). Cross the pit floor before refill.
- **FLOW VALVE (blue wheel):** opens an overhead pipe that fills a dry basin; a floating barrel-platform rises with the water to reach a high ledge/cliff. Stays open (permanent once solved).
- **GEYSER VALVE (brass wheel):** opens a floor pipe geyser: a vertical water jet that carries Mick up a sheer wall (stand on jet, ride up; jet cycles 3s on / 1s off once opened).
- **MASTER VALVE (gold, level end):** hold to turn through a 3-stage crank (longer, dramatic) → floods the sewer behind glass, "SHIFT COMPLETE."
- **Checkpoints:** hand-crank posts; turning one (quick crank) sets respawn + flashes green.

## Obstacles & Enemies (7 + pits)
1. **Gunk blob:** floor walker, turns at edges; stomp or whack kills.
2. **Drip slime:** ceiling crack telegraphs (growing drip 1s) then drop; splat becomes brief floor slick (slippery: friction ×0.3 for 2s).
3. **Burst pipe:** horizontal spray on 2s cycle; blocks passage while spraying; whack to patch permanently (+200, steam burst).
4. **Pipe crab:** pops from open pipe ends on timer, snips, retreats; whack when extended.
5. **Grinder fan:** spinning wall fan, constant hazard, time your pass during its slow phase (speed cycles).
6. **Crumble grate:** rusted platform, shakes 0.5s after standing then falls; respawns 3s.
7. **Rolling barrel:** released on slopes in Steel Mains; jump or slide-under (they break on walls).
Plus: flooded pits (drainable or lethal water per section), bottomless shafts in The Cistern.

## Level & Difficulty Arc
- **Zone 1 Stone Works (teaching):** walk/run/jump/duck signposts, first gunk blobs, first drip slime, first DRAIN valve pit, checkpoint.
- **Zone 2 Steel Mains (combination):** burst pipes + crabs + barrels, FLOW valve cliff climb, crumble grates over water, checkpoint.
- **Zone 3 The Cistern (mastery):** GEYSER wall ascent, grinder fans, mixed hazards over bottomless shafts, final gauntlet, MASTER VALVE.
- Score: enemies, patched pipes, coins→ **brass fittings** collectibles (line them along the optimal path to guide the eye), end bonus for hearts left + time.

## Clarity (a v2 pillar; do not skimp)
- Title → **HOW TO PLAY card**: control diagram (keyboard + touch), objective in one line: "Reach the Master Valve at the end of the sewer. Use your wrench on VALVES to move water out of your way."
- In-level **signposts** (first-use teaching, SMB3 style): "HOLD ⚡ TO RUN", "DOWN TO DUCK", "DOWN WHILE RUNNING = SLIDE", valve prompts name themselves ("DRAIN VALVE: HOLD J").
- HUD: hearts, fittings, score, speed gauge, zone banner on entry. Idle >5s → soft arrow toward objective.
- Pause (P/⏸): controls recap + resume/restart/mute.

## Art Direction ("64-bit" rich pixel, binding)
- Crisp integer-scaled pixel art, `imageSmoothingEnabled=false`, no blur anywhere. Sprites via in-code pixel arrays rendered to offscreen atlases (same pipeline as v1, higher res).
- **Tiles 32px**, multiple variants each: gray stone brick (clean/cracked/mossy/wet-dark), grayer riveted steel plate (clean/rusted/vented), grates, copper + steel pipes (straights, elbows, flanges), background arches (darker parallax stone), hanging chains, wall lamps (warm glow pools).
- **Slime as a motif:** animated green drips sliding down stone, glistening puddle edges, slime stalactites in crack seams. Green (#5AC54F/#8CE04B) against warm grays (#6E6A5E stone) and cool grays (#8B98A6 steel): the palette contrast Kevin asked for.
- Water: translucent teal (#2E86ABcc) with animated surface line, bubbles when draining, white churn on geysers.
- **Mick 32×48:** idle(2), walk(4), run(4, leaning), skid, jump, fall, duck, slide, whack(3), crank(2), hurt, victory. Mustache, teal overalls, orange cap, big boots, giant wrench: not Mario.
- Camera: smooth-follow with 60px look-ahead in facing direction, vertical deadzone; screen never jerks.
- Parallax: 3 background layers (far arch silhouettes / mid stonework+chains / play layer) + foreground pipe strips at 1.15×.

## Controls
- Desktop: ←/→ or A/D move, DOWN/S duck-slide, SPACE/W jump, **SHIFT run**, **J wrench/interact**, P pause, M mute.
- Mobile: left virtual D-pad (◀ ▶ ▼), right two buttons (JUMP big, WRENCH/RUN: WRENCH doubles as RUN when held while moving: one thumb, SMB-style simplicity). Buttons ≥64px, bottom corners, semi-transparent. touch-action:none.

## Stack + Why
- **html** single file, vanilla Canvas. Tile engine + AABB swept collision (order: horizontal then vertical; no tunneling at 280 px/s: cap dt at 1/30 and substep if needed). No frameworks: same reasoning as v1, engine is ~small and bespoke.

## Scope Notes
- **v1(=this rebuild):** everything above, one level, 3 zones.
- **Later:** level 2 ("slo mo plumber reprise" night shift), boss (The Clog), time-attack medals.

## Polish Hooks
1. Movement feel itself: skid dust, landing squash, run wind lines at top speed: the game should feel good running on flat ground with zero hazards.
2. Valve turns: ratchet clicks, wheel spin blur, the water RESPONDING (drain glug + level dropping visibly, geyser roar): cause→effect spectacle.
3. Master Valve finale: 3-stage crank, rumble, wall of water behind glass, SHIFT COMPLETE stamp + stats.
