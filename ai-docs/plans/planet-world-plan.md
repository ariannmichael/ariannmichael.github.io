# Planet World (v2) — Plan

**Created:** 2026-10-17  **Branch:** `planet`  **Builds on:** `3d-portfolio-town-plan.md` (v1 flat town, on `main`)
**Changelog:** `ai-docs/plans/3d-portfolio-town-changelog.md` (section "v2 Planet")
**Coordination:** `ai-docs/plans/agent-workstreams.md` (rules) plus the v2 ownership table below.

## Objective

Turn the flat Kenney town into a **small drivable planet**: a tiny globe you can drive all the way around. It has distinct **biomes** (one per career district), **interiors you can drive into**, **off-road driving like *Over the Hill*** (hilly terrain, suspension, dirt), **camera shake**, **wheel smoke**, a **skybox**, and a **PSX (PlayStation 1) visual style**.

## TL;DR

1. **Globe:** an icosphere planet (radius ~150 m, so one lap is ~950 m, about 45–60 s), displaced by deterministic noise into hills, ridges and plateaus. There is one trimesh collider, and gravity points at the centre (custom per-body force; Rapier's world gravity is 0).
2. **Biomes:** 7 career biomes plus 1 wild off-road badlands. Each has its own terrain shape, ground palette (vertex colours) and Kenney kits. Placements use `lat/lon/yaw` and snap to the terrain surface, oriented to the local "up".
3. **Off-road vehicle:** the Rapier `DynamicRayCastVehicleController` (raycast suspension, 4 wheels) replaces the sphere-kart. Up is the surface normal, and the car keeps the sedan model. It has camera shake (speed, landings, impacts) and wheel smoke particles (sliding, burnouts, dirt).
4. **Interiors:** buildings big enough to drive into (lab corridors, factory hall, arcade hall, dungeon cave, pit garage).
5. **PSX look:**
   - Low-res render target (~320–480 px tall) with nearest upscale
   - Vertex snapping and affine texture warp (material shader patch)
   - Colour quantisation plus ordered dithering
   - Distance fog
   - A user toggle (default on), and a "Classic/Smooth" fallback for accessibility
6. **Skybox:** a procedural gradient sky with dithered clouds, sun and stars. The tint follows the biome the car is in.
7. **Perf:** Lighthouse on `/` scored 38 under SwiftShader (11 s main-thread blocking). v2 must stream biomes by distance and avoid main-thread spikes at load.

## Decisions (made by Claude; change on request)

- **Build on a branch:** `main` keeps v1 (flat town) as a shippable fallback for the 2026-11-10 Speed King launch. `planet` merges when it's better.
- **Biomes map to districts** (career metaphor kept):

| Biome | District | Look |
|---|---|---|
| Hometown meadow | home | suburban houses, campus, skate park |
| Downtown plateau | engineering | towers |
| Clinic lakeside | healthcare | — |
| Desert mesa | financial | — |
| Alien crater | opensource | space lab interior |
| Theme park + spooky woods + pirate cove | gamedev | arcade interior, dungeon cave |
| Dirt canyon raceway | raceway | — |
| Badlands | none | pure off-road, no markers |

- **Vehicle:** `car-kit/suv` (Ariann, 2026-10-17). The spare-tyre node `wheel-back` is static, and the four `wheel-*-left/right` nodes are driven.
- **PSX is on by default,** and the quality menu turns it off. `prefers-reduced-motion` disables camera shake.

## Workstreams (v2)

| Agent | Owns | Depends on |
|---|---|---|
| **terrain** | `web/src/world/planet/{terrain,noise,gravity,PlanetGround,biomeField}*` + tests | contracts |
| **vehicle** | `web/src/world/vehicle/**`, `web/src/world/camera/**`, `web/src/world/fx/**` | contracts (terrain via `terrainHeight`, gravity via `upAt`) |
| **psx-sky** | `web/src/world/psx/**`, `web/src/world/scene/**` | contracts |
| **integration** | `web/src/world/town/**`, `web/src/world/zones/**`, `web/src/world/Experience.tsx`, `web/src/world/lib/**`, `web/src/ui/**` (a11y fixes + PSX toggle) | all of the above (codes against contracts) |
| **biomes-a / biomes-b** (after terrain + integration) | `web/src/world/layout/planet/**` (split by biome) | terrain, integration |

Coordinator-owned contracts: `web/src/world/planet/{config,frame,types,biomes}.ts`, `web/src/state/useAppStore.ts`.

## Checklist

### Phase P0 — Contracts & branch (coordinator)
- [x] P0.1 Branch `planet`
- [x] P0.2 `planet/config.ts` (radius, gravity), `planet/frame.ts` (lat/lon ↔ direction, surface frame, placement pose), `planet/types.ts`, `planet/biomes.ts` (biome table), and a `terrain.ts` stub (`terrainHeight(dir)`)
- [x] P0.3 Store: `psx` flag, `setPsx`

### Phase P1 — Terrain & gravity (terrain agent)
- [ ] P1.1 Deterministic noise (no new dependency), with per-biome terrain shapes blended smoothly at the borders
- [ ] P1.2 Icosphere mesh (subdivision tuned so the trimesh has ≤ ~40k triangles) with vertex colours per biome (PSX-friendly flat palette) and dirt tracks/paths painted by noise
- [ ] P1.3 One fixed trimesh collider, plus a planet gravity system (force toward the centre on every dynamic body, mass-aware)
- [ ] P1.4 `terrainHeight(dir)` (exact enough to match the rendered mesh within ~5 cm) and `biomeAt(dir)`
- [ ] P1.5 Flatten pads: biome layouts can request flat areas (for buildings and interiors) via `FLAT_PADS`

### Phase P2 — Off-road vehicle, camera, FX (vehicle agent)
- [ ] P2.1 A raycast-suspension vehicle (Rapier `DynamicRayCastVehicleController`) on custom gravity, with the sedan visuals and wheel nodes driven by the suspension
- [ ] P2.2 Arcade off-road feel: weight transfer, airtime, landing, recovery (auto-upright when flipped, plus R to reset)
- [ ] P2.3 Follow camera with surface-normal up, terrain-aware (no clipping into hills), and camera shake (speed rumble, landing impulse, collision impulse). Respects reduced motion
- [ ] P2.4 Wheel smoke and dust particles (instanced billboards; colour from the biome's ground; triggered by slip, burnout or dirt)
- [ ] P2.5 Keep the existing contracts: `vehicleState`, `useInputStore`, teleport/reset semantics, and pause

### Phase P3 — PSX + skybox (psx-sky agent)
- [ ] P3.1 Low-res render pipeline (render target at a fixed internal height, nearest upscale) with a toggle
- [ ] P3.2 Material patch: vertex snapping (clip-space quantisation), affine UVs, nearest texture filtering
- [ ] P3.3 Post pass: colour depth reduction plus a Bayer dither and fog
- [ ] P3.4 Procedural skybox (gradient, dithered clouds, sun, night stars) with a biome tint hook
- [ ] P3.5 Off switch for accessibility and perf, and keep frame cost low on mobile

### Phase P4 — Integration (integration agent)
- [ ] P4.1 Planet renderer: instanced Kenney placements from `lat/lon/yaw` (reuse the current instancing, with arbitrary orientation)
- [ ] P4.2 Zones/markers on the sphere (sensors and labels oriented to local up), district tracking by biome, teleport/spawn on the planet
- [ ] P4.3 Wire `Experience`: planet, gravity, vehicle, PSX, sky, and biome streaming by distance
- [ ] P4.4 UI: a PSX toggle in the HUD and quality menu, a "Classic/Smooth" option, and the Lighthouse a11y fixes (`aria-prohibited-attr`, `label-content-name-mismatch`)

### Phase P5 — Biomes & interiors (biomes agents)
- [ ] P5.1 The 8 biomes authored as data, each using distinct kits and palettes, with all markers for jobs and games
- [ ] P5.2 Drivable interiors: lab corridors (modular-space-kit), factory hall (factory-kit), arcade hall (mini-arcade), dungeon cave (modular-dungeon/mini-dungeon), pit garage (racing-kit)
- [ ] P5.3 Off-road routes: dirt trails between biomes, jumps, the raceway circuit on terrain

### Phase P6 — QA & ship
- [ ] P6.1 Screenshot QA of every biome and interior (headless harness), plus a perf pass (draw calls, triangles, load blocking time)
- [ ] P6.2 Human testing doc
- [ ] P6.3 Merge `planet` → `main` when it beats v1 (Ariann's call)

## Open questions
1. Ship v1 (the flat town) **now** for the launch while v2 is built, or wait for v2?
2. ~~Vehicle~~ **Answered:** SUV.
