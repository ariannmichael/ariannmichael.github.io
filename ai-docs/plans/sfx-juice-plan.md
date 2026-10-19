# SFX & Game Juice: plan and agent brief

**Objective:** feedback on 2026-10-18: "add sfx for the car motor, also when it hits something, and any other sfx that I'm missing. Also add any game juice that we are missing." The portfolio planet has camera shake and wheel dust, but **no audio at all** (the mute toggle does nothing) and little feedback. Add synthesised audio and world/HUD juice that make driving feel great, in the PSX / Over the Hill spirit, without hurting load time or accessibility.

## TL;DR
- **Audio:** everything is synthesised with Web Audio. There are no audio files: no download cost, no licence risk, and the engine can follow RPM continuously.
- **Engine:** a layered, load-reactive engine with fake gear shifts.
- **Car sounds:** tyre squeal and gravel, wind, suspension clunks, impacts (world vs props), landing thump, takeoff whoosh, horn (H), and reset/teleport whooshes.
- **UI and ambience:** UI clicks, card and GPS sounds, zone and discovery chimes, and per-biome ambience.
- **World juice:** skid marks, impact sparks and debris, landing dust rings, speed lines, brake, reverse and head lights, exhaust puffs and backfires, body squash and lean, marker ring pulse, and camera FOV punches.
- **HUD juice:** a PSX speedometer, trick popups (BIG AIR, flips, crashes), a district-discovered stamp, card and prompt spring animations, and button press feedback.
- Three agents work in parallel, each owning its own folders, linked through a coordinator-owned event bus.

## Contracts (coordinator, done)
- **`web/src/world/events/gameEvents.ts`:**
  - `onGameEvent(listener)` returns an unsubscribe function.
  - Events: `crash` (strength 0..1, speedLost), `bump` (strength, dynamic = hit a loose prop), `takeoff`, `landing` (impact m/s, airTime, strength), `reset` and `teleport`. Each carries a `position`.
- **`vehicleState`** (`web/src/world/vehicle/vehicleState.ts`), polled per frame:
  - `speed`, `forwardSpeed`, `velocity`, `grounded`, `airTime`, `wheelsInContact`, `suspensionActivity`;
  - per-wheel `slip`, `contact` and `inContact`;
  - `throttle` (−1..1), `steer`, `handbrake`;
  - `up`, `chassisUp`, `forward`, `heading`, `teleportCount`, `landingCount`.
  - `VEHICLE.maxSpeed` = 26.5 m/s (`web/src/world/vehicle/constants.ts`).
- **App moments** come from `useAppStore` (`web/src/state/useAppStore.ts`); subscribe to it for:
  - `mode` (intro, drive or card), `openCardId`, `gpsOpen`, `activeZone`;
  - `muted`, `psx`, `quality`;
  - any visited/discovered state.
  - Check its actual fields.
- **Keys:** `KEYMAP` has a `horn` control (KeyH); use drei `useKeyboardControls`. The world sits inside drei `<KeyboardControls map={KEYMAP}>`.
- **Mount points**, already mounted by the coordinator; fill them in:
  - `web/src/world/audio/AudioSystem.tsx` → `<AudioSystem />` inside the Canvas, after the world is ready;
  - `web/src/world/fx/Juice.tsx` → `<Juice />` inside the Canvas (outside Physics);
  - `web/src/ui/JuiceHud.tsx` → `<JuiceHud />` in `Overlay` while the 3D world runs.
- **Reduced motion:** `usePrefersReducedMotion()` in `web/src/ui/lib/hooks.ts`. Camera shake already respects it.
- **PSX:** `LABEL_LAYER` (`web/src/world/psx/config.ts`) draws crisp full-resolution overlays after the low-res pass. Materials are PSX-patched automatically (opt out with `material.userData.psxSkip = true`).

## Rules for all agents
- Shell setup: `export PATH="$HOME/.nvm/versions/node/v24.11.1/bin:$PATH"; cd /Users/ariann/Documents/Personal/portfolio/web`.
- **Ownership:** edit only your listed files. Other agents are working at the same time, including three layout agents editing `web/src/world/layout/planet/**`. Never edit:
  - `web/src/world/layout/**`, `web/src/world/planet/**`
  - `Experience.tsx`, `Vehicle.tsx`, `vehicle/controller.ts`
  - `gameEvents.ts`, `controls.ts`
  - other agents' files
- If you need a contract change, say so in your final report instead of making it.
- **Performance budget:**
  - No per-frame allocation in hot paths; pool particles (see `world/fx/particles.ts` and `dustSystem.ts` for the existing pattern).
  - At most +3 draw calls for the world-juice systems combined (instanced or merged).
  - Audio: at most ~12 simultaneous voices. Never create nodes per frame; reuse or schedule them.
  - Mobile must stay smooth. Respect `quality === "low"` (fewer particles, simpler audio).
- **Accessibility:** respect reduced motion (no flashes, punches or popups that move much). Audio respects `muted`, and nothing plays before a user gesture (browser autoplay rules).
- **No new npm dependencies** unless truly necessary; say why in your report.
- **Tests:** add vitest unit tests for the pure logic (mappings, envelopes, detectors, pools). Keep the whole touched suite green.
  - Run `npx vitest run <your folders>`, `npx tsc --noEmit` and `npx eslint <your files>`.
  - Layout, budget and road test failures belong to other agents; ignore them.
- **Don't run `npm run build` or `npm run dev`** (shared `.next`). The coordinator does the build and browser QA.
- Match the code style: comments explain *why*, named constants, small pure modules plus thin React components.
- **Final report:**
  - what you added (each sound or effect, and what triggers it);
  - files;
  - tunables;
  - known limits;
  - anything the coordinator must wire up.

## Agent 1: Audio (`web/src/world/audio/**`, plus the `muted` default in `web/src/state/useAppStore.ts` only)
- **Engine and context:**
  - One `AudioContext`, created and resumed on the first user gesture (pointerdown or keydown), with a master gain, a compressor and an SFX/ambience/UI bus split.
  - Suspend when the tab is hidden; duck (not stop) while a card or the GPS is open.
  - **Mute:** sound is ON by default (change `muted` to default false), but only after the first gesture. Persist the user's choice in `localStorage`, wrapped in try/catch.
- **Car sounds:**
  - **Engine:** an RPM model from speed plus throttle, with fake gears (pitch climbs, then drops on an upshift), load (throttle) brightening the tone, idle burble, rev limiter bounce, and a rev with throttle in the air. Build it from oscillators plus filtered noise, and keep it smooth (`setTargetAtTime`).
  - **Tyres:** squeal from per-wheel slip on hard ground, and a gravel/dirt crunch layer from speed when grounded.
  - **Wind:** rises with speed and in the air.
  - **Suspension:** clunks or rattles from `suspensionActivity`.
  - **Impacts** from `crash` and `bump`:
    - world hits get a heavy thud plus metal crunch, scaled by strength;
    - prop hits get a lighter knock or plastic clack;
    - add per-hit random pitch, and rate-limit them.
  - **Landing:** a thump plus suspension creak, scaled by impact.
  - **Takeoff:** a whoosh.
  - **Reset/teleport:** a whoosh or swoosh.
  - **Horn:** H, a two-tone beep.
  - **Backfire pops** when lifting off the throttle at high RPM: occasional, and timed with world-juice's flames by the same rule. Put the shared detector in a pure function that agent 2 can import from `web/src/world/audio/backfire.ts`, and say so in your report.
- **UI sounds**, via store subscriptions plus one document-level delegated listener for `button`/`a` clicks and hovers inside the overlay:
  - card open and close;
  - GPS open, close and select;
  - "Press E" prompt appearing (zone enter);
  - first visit to a district (a jingle);
  - PSX and quality toggles;
  - Download CV.
- **Ambience:** per biome, crossfaded by the biome under the car. Find how `DistrictTracker` and `Sky` know the biome, or compute it with `biomeAt` from `planet/terrain`. Keep it procedural, light and quiet:
  - meadow: birds and breeze
  - downtown: city hum and distant traffic
  - clinic lakeside: water lapping
  - desert: dry wind
  - crater: alien drone
  - game park: dusk crickets and a faint music box
  - raceway: distant crowd
  - badlands: low wind
- **Tests:** RPM and gear mapping, the envelope/param mapping functions, and the backfire detector. Mock or skip `AudioContext` in tests.

## Agent 2: World juice (`web/src/world/fx/**` except `WheelDust.tsx`/`dustSystem.ts` (extend only if needed), `web/src/world/vehicle/VehicleModel.tsx` (visuals only), `web/src/world/zones/Zones.tsx` (marker visuals only), `web/src/world/camera/shake.ts` and `FollowCamera.tsx` (FOV and punch only))
- **Skid marks:** dark tyre-mark ribbons on the ground from per-wheel slip while in contact. Use a fading ring buffer in one geometry, on the terrain via the wheel contact points plus a small lift and polygon offset.
- **Impact sparks and debris** at the event position on `crash`/`bump`: orange sparks for world hits, coloured chips for prop hits.
- **Landing:** a dust ring burst, plus squash on the car body.
- **Speed lines:** streaks near the camera above about 70% of top speed; disabled with reduced motion.
- **Car body:**
  - **Lights:**
    - brake lights glow when braking (throttle < 0 while moving forward, or handbrake);
    - reverse lights when reversing;
    - headlights (a cheap emissive plus a small spot) on night-side biomes.
  - **Exhaust:** puffs on throttle, and backfire flames from agent 1's detector (`web/src/world/audio/backfire.ts`). If it isn't there yet, write the same rule locally and note it.
  - **Body motion:** squash and stretch on landing, lean into turns and pitch under brake/accel. Apply visual-only offsets to the body mesh, never the physics body; check how `VehicleModel` is structured.
- **Markers:** the parking ring pulses and brightens as the car approaches, the label pops when the zone becomes active, and there's a small burst when a card opens.
- **Camera:** a FOV punch on landing and crash, and a slight extra FOV at high speed if not already done (check `cameraMath` `followFov`). Respect reduced motion.
- **Tests:** the pure parts (ring buffer, mappings, emit rules).

## Agent 3: HUD juice (`web/src/ui/**`: `JuiceHud.tsx`, new components and CSS modules, and existing UI components for animation and feedback)
- **Speedometer:** a small PSX-styled one with chunky numbers and a needle or bar, near the bottom right. It must not overlap the touch controls or the bottom-left hint; check the existing layout and safe areas.
  - Read `vehicleState` in a `requestAnimationFrame` loop and write to the DOM directly (no React re-render per frame).
  - Use km/h.
- **Trick popups** in an arcade font style (the site already ships the Kenney Mini Square Mono font at `/fonts/kenney-mini-square-mono.ttf`):
  - "BIG AIR 1.4s" on landings after long airtime;
  - "FLIP!" or "BARREL ROLL!" by tracking chassis rotation while airborne;
  - "NICE LANDING" for a soft landing after air;
  - "CRASH!" on big crashes.
  - Use `gameEvents` plus `vehicleState`, with a short pop, settle and fade. Reduced motion: a plain fade, no scale bounce.
- **District discovered:** a stamp or toast the first time you enter each career district ("DISTRICT DISCOVERED · Downtown Plateau · 3/7"). Use the store's visited state.
- **Polish:**
  - InfoCard open/close: a spring pop-in and a quick out.
  - The "Press E" prompt: a bounce-in.
  - GPS menu: a slide/pop, and the selected destination flashes.
  - Button press feedback: scale down on press.
  - All motion respects reduced motion.
- **Tests:**
  - **Flip detection:** a pure function that accumulates rotation about the car axes during airtime.
  - **Popup selection:** which popup each event produces.
  - **Speed formatting.**
  - Keep the existing UI tests green.
