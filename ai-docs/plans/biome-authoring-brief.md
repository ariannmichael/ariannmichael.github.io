# Biome Authoring Brief (v2 planet, P5)

Shared brief for the biome agents. **Read it fully before writing any layout.**

## Context
- **The project:** a Next.js 16 static-export portfolio at `/Users/ariann/Documents/Personal/portfolio/web` (branch `planet`). It is a tiny drivable planet (radius 150 m, gravity toward the centre), driven in a Kenney SUV with off-road raycast suspension, a PSX look and a biome-tinted sky.
- **Done and working:** the engine, terrain, vehicle, PSX and integration. You author **data only**: placements, markers, pads and the spawn for your biomes.
- **Rules:** `ai-docs/plans/agent-workstreams.md`. Start every shell command with the Node 24 PATH prefix (`export PATH="$HOME/.nvm/versions/node/v24.11.1/bin:$PATH";`). No installs, no commits, stay in your files.
- **Plan:** `ai-docs/plans/planet-world-plan.md` (P5).

## Read these
- **Biome table:** `web/src/world/planet/biomes.ts`. Your biomes' centre, `radiusDeg`, terrain, palette, theme and kits.
- **Types:** `web/src/world/planet/types.ts` (PlanetPlacement, PlanetMarker, FlatPad, BiomeLayout).
- **Coordinates:** `web/src/world/planet/frame.ts` (`offsetLatLon`, `metresToDeg`, `angleBetween`).
- **Authoring helpers:** `web/src/world/layout/planet/author.ts`. `grid(center)` gives `at(north, east)`, `place(...)` and `marker(...)` in metres around an anchor.
- **Worked example:** `web/src/world/layout/planet/_sandbox.ts`.
- **Models:** `web/src/world/models/index.ts` (`hasModel`, `getModel` bounds in metres, `listModels(kit)`) and `web/scripts/kits.config.mjs` (kit scales with a rationale each).
  - To see a model's node tree and bounds: `node scripts/inspect-model.mjs public/models/<kit>/<model>.glb` (run from `web/`).
- **Placement and collider maths:** `web/src/world/lib/planetPlacement.ts` (pose, oriented collider box, marker sensor box). Use it in your tests.
- **Content ids:** `web/src/content/jobs.ts` and `games.ts`.

## Coordinates (from the integration agent)
- **Angles:** degrees. lat 90 = +Y. lat 0, lon 0 = +Z. Positive lon turns toward +X.
- **yaw:** counter-clockwise seen from above. 0 means the model's +Z faces north; 90 = west, −90 = east.
- **y:** metres above the terrain at that exact point.
- **Authoring:** work relative to an anchor with `grid(anchor).at(north, east)`.
- **Never call `surfacePose` or `terrainHeight` at module top level.** That creates an import cycle, because terrain reads pads from the layouts.

## Pads (important)
- **What they do:** terrain reads `pads` from `PLANET_LAYOUTS` once, on the first height query, then freezes them. A pad flattens the terrain to its centre height (+ `height`) within `radius`, then blends back over `blend` metres (default 8).
- **Put a pad under every building, road run, plaza and interior.** A placement only snaps to the height at its centre, so on slopes buildings sink on one side and roads float.
- **Radius:** at least about 6 m (the terrain mesh edges are about 4 m).
- **Jumps and ramps:** use pads with a positive `height` and a small `radius`/`blend`, which makes earthen kickers and mounds. These are perfect for the Over the Hill off-road feel. Negative `height` digs bowls and craters.
- **Leave natural terrain between settlements.** The planet is meant for off-road driving.

## Colliders
- **Default:** static placements get a box from the model's bounds, oriented to the placement. Road tiles, `tile-*` pieces and anything under 0.3 m tall are drive-through.
- **Drivable interiors:**
  - Compose them from **wall, floor and ceiling pieces** (each gets its own box). Don't use one big closed building, because its box would block the doorway.
  - Use `collider: "none"` on decorative shells you want to drive into.
  - Leave doorways at least 4 m wide and ceilings at least 3.5 m high. The SUV is 2.55 m wide and 2.2 m tall.
- **`body: "dynamic"`** gives a separate knockable body (cones, crates, barrels).

## Markers
- **One per content id**, across the whole planet. The marker's biome must have a `district`; badlands markers are ignored.
- **Placement:** the sensor is 6×4×6 m, aligned to local up. Keep markers at least about 8 m apart, on flat drivable ground (on a pad), never inside a collider, and right in front of the building or landmark they belong to.
- **`label`:** short, max about 20 characters (e.g. "Afya · Current role").

## Spawn
- `spawn` (lat, lon, yaw) is where the GPS and `/district/<id>/` land the car. Put it on a pad with clear ground ahead, facing the main landmark.

## Budgets per biome
- ≤ 220 placements
- ≤ 40 unique models
- ≤ 8 mini-characters (each is its own skeleton clone)
- ≤ 12 dynamic bodies
- Everything within the biome's `radiusDeg` of its centre: the core within about 0.8 × radius, so `biomeAt` agrees at markers and spawn.

## Distinctness (the whole point)
- Each biome must look **unmistakably different**: different kits, building styles and props, matching the biome's palette and theme in `biomes.ts`.
- **Avoid** reusing the same houses or towers across biomes, except where the theme calls for it.
- **Off-road first:** between landmarks, let the terrain breathe. Add a few earthen jumps (raised pads), rocks and trees from the biome's kits, and dirt trails. The terrain already draws trails between biome centres.

## Tests (per biome file: `web/src/world/layout/planet/<biome>.test.ts`)
- Every model ref exists.
- Marker ids are valid content ids (or `about`/`contact`/`cv`) with the matching kind.
- `biomeAt` at the spawn and at every marker equals the layout's biome. Import `biomeAt` inside the test, which is fine there.
- No marker sensor centre lies inside any non-dynamic collider box, and the spawn isn't inside one either. Use the `planetPlacement` helpers.
- Markers are at least 8 m apart.
- The budgets above are respected.

## Visual QA (required)
- **Harness:** `/private/tmp/claude-501/-Users-ariann-Documents-Personal-portfolio/cd9e1eba-84bc-4561-9cd3-96fd9114c108/scratchpad/harness/shoot.mjs` (puppeteer-core with system Chrome and SwiftShader). Usage is in the file header; `--drive` holds W, then W+A.
- **Steps:**
  1. `npm run build`.
  2. Serve `web/out` on **your own port** (given in your prompt) with `npx -y serve out -l <port>`, as a background command.
  3. Screenshot `/district/<id>/` for each of your districts (the intro orbit, plus `--drive`).
- **Toggle PSX off** to check details in smooth mode: add `?psx=0` if supported; otherwise rely on the PSX shots.
- **Check for:** nothing floating or sunk, interiors you can actually enter, each biome reading as distinct, and labels readable.
- **Iterate,** then stop your server.

## Verify
From `web/`: `npm run typecheck && npm run lint && npm test && npm run build` must all pass. Other biome agents work in parallel on other files. If a failure is clearly in their files, report it rather than fixing it.

## Final report
- A short description and ASCII sketch per biome
- Marker positions
- Interiors and how to enter them
- Counts against the budgets
- The screenshots you checked
- Anything that looked off that you couldn't fix (engine issues go to the coordinator)
