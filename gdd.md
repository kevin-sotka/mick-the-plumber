# Mick the Plumber: Pipe Panic

## Brief (from the prompt)
- **Concept:** Pixel-art side-scrolling runner: Mick auto-runs through a leaky sewer-city, jumping gunk and wrench-whacking bursting pipes in time with his own theme song.
- **Quality bar:** polished
- **Scope:** M
- **Budget:** default (M = 4.5M units); fitted plan all-Sonnet build+polish

## Core Concept
Mick, a mustachioed pixel plumber (teal overalls, orange cap, big boots, giant wrench: deliberately NOT the other famous plumber), auto-runs right through a scrolling sewer-city while "Mick the Plumber" (song.mp3, 2:24, 92 BPM, first onset 0.046s) plays. Pipes burst on the beat grid ahead of him; whack them in time to patch. Missed pipes flood the sewer: the water level is the health bar. Survive the whole song to clock out.

## Core Loop
Run → read what's coming (burst pipe at whack-height vs. gunk blob on the floor) → JUMP or WHACK at the right moment → combo meter ("FLOW") climbs → water rises on misses.

## Win / Lose
- **Win:** song ends with water below the top → "SHIFT COMPLETE" + score, whacked-pipe %, max flow combo.
- **Lose:** water reaches the top → slow-mo game over ("GLUG."), restart button.

## Objects & Entities
Player (Mick: run cycle 4 frames, jump, whack, hit-stun), burst pipes (wall-mounted, spray animation), gunk blobs (floor obstacle), rising water plane, score/FLOW combo UI, water-level gauge, parallax layers (city silhouette / brick+pipe wall / foreground pipes).

## Mechanics (cause → effect)
- Pipes burst on the 92 BPM beat grid (pattern generated from seed, density ramps A→B→C sections; use elapsed-audio-time, not wall clock, so it stays synced).
- WHACK within ±150ms of a burst pipe as Mick passes → pipe patched, sparks+steam burst, +100 × FLOW multiplier, FLOW +1 (caps ×8).
- Miss a pipe → water rises one notch, FLOW resets, screen-bottom splash.
- Touch a gunk blob → hit-stun + water rises one notch. JUMP clears blobs.
- Every 30s survived → speed +8% (scroll speed only; beat grid unchanged).

## UI Needs
- [v1] Title screen with pixel logo + "TAP TO START" (audio unlock), score, FLOW meter, water gauge, win/lose screens with restart, mute button.
- [later] Local high-score table, "slo mo plumber reprise" easter-egg game-over track.

## Chosen Stack + Why
- **Stack:** html (single-file, vanilla Canvas)
- **Why:** one scene, one input axis; a runner needs a tight rAF loop, not an engine. Matches platform matrix "lightest stack that delivers."

## Art Direction (binding)
- **Pixel sprites are developed in-code:** sprite sheets as JS pixel-map arrays (strings per row, char→palette color), rendered once to offscreen canvases, drawn scaled 4× with `imageSmoothingEnabled=false` and `image-rendering: pixelated`. 16×24 Mick, 16×16 props. No external images.
- **Palette:** sewer teal `#1F6F6B`, deep navy bg `#0E1B2C`, copper `#B87333`, rust `#8C3B1F`, brick `#5A3A2E`, slime glow `#8CE04B`, water `#2E86AB`, cream UI `#F4E9D8`.
- **Feel:** chunky retro-arcade, CRT-ish scanline overlay (subtle), squash/stretch on jump, hitstop on whack.

## Scope Notes
- **v1:** one endless-ish level lasting exactly the song, 2 obstacle types, combo, water health, win/lose, mobile+desktop input.
- **Later:** reprise easter egg, more obstacle types, level 2 with "slo mo plumber reprise."

## Mobile Considerations
Two-zone touch: LEFT half = JUMP, RIGHT half = WHACK (labeled at start). Desktop: Space/W = jump, J/Enter = whack. Landscape-friendly canvas that letterboxes; controls also work portrait. No hover anything. Audio starts only on first tap (autoplay policy).

## Polish Hooks
1. The on-beat WHACK: hitstop 60ms + spark burst + steam + wrench "clang" flash: this is the game's money moment.
2. Water creep: ambient dread; ripples, floating debris, Mick's splashing feet when it's high.
3. "SHIFT COMPLETE" win flourish: confetti of tiny wrenches, Mick wipes brow.
