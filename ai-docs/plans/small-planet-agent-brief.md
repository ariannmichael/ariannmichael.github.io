# Small Planet: brief for the town (layout) agents

Plan: `ai-docs/plans/small-planet-plan.md`. Repo: `/Users/ariann/Documents/Personal/portfolio`, branch `planet`, web app in `web/`.
Shell setup for every command: `export PATH="$HOME/.nvm/versions/node/v24.11.1/bin:$PATH"; cd /Users/ariann/Documents/Personal/portfolio/web`.

## What changed (already done by the coordinator)
- `PLANET_RADIUS` is now **90 m** (was 150). Curvature is 1.7× stronger.
- The biome centres moved, and every layout must anchor on the new centre. Prefer reading it from `BIOMES` (`web/src/world/planet/biomes.ts`) over hard-coding.

| Biome | New centre (lat, lon) | Roads leave toward (compass, clockwise from north) |
|---|---|---|
| home | (30.7, 0) | 219° (SW, to opensource), 141° (SE, to raceway) |
| engineering | (30.7, 90) | 219° (SW, to raceway), 141° (SE, to badlands) |
| healthcare | (30.7, 180) | 219° (SW, to badlands), 141° (SE, to gamedev) |
| financial | (30.7, −90) | 219° (SW, to gamedev), 141° (SE, to opensource) |
| raceway | (−30.7, 45) | 321° (NW, to home), 39° (NE, to engineering) |
| badlands | (−30.7, 135) | 321° (NW, to engineering), 39° (NE, to healthcare) |
| gamedev | (−30.7, −135) | 321° (NW, to healthcare), 39° (NE, to financial) |
| opensource | (−30.7, −45) | 321° (NW, to financial), 39° (NE, to home) |

- Town centres are ~118 m apart, so each town must shrink. **Budget** (`web/src/world/layout/planet/budget.test.ts`):
  - every placement footprint (bbox half-diagonal × scale) **and** every marker **and** the spawn must lie within **40 m** of the biome centre;
  - pads, including `radius + blend`, must lie within **46 m**.
- **New planar sites:** use them for interiors and any building wider than ~12 m.
  - `FlatPad.planar: true`: the pad flattens to its tangent plane, a true flat floor, instead of a curved shell. Gravity over it points along its normal, so it feels level.
  - `PlanetPlacement.plane: { lat, lon }`: the piece stands on the tangent plane through that point. Set it to the planar pad's centre, so modular walls, floors and roofs line up square.
  - Yaw stays as it is (local, as your helper gives it); the heading is projected onto the plane.
  - Example: a hall pad `{ ...at(n, e), radius: 14, blend: 8, planar: true }`, and every hall piece `{ ...place(...), plane: at(n, e) }`.
- `grid()` (author.ts) and `localGrid` now give yaw in the grid frame. `site()` already did.
- Roads (the roadmap) are routed by the coordinator from each town's **spawn** to its neighbours' spawns, avoiding footprints, parking rings and small jump pads.

## Your job
Re-author your biomes to fit the budget while keeping each town's identity:
1. **Keep every marker** (same ids, kinds, labels) and **every drive-in interior** (7 in total: container dock in engineering, pit garage in raceway, factory hall in healthcare, drive-thru in financial, space-lab corridors in opensource, arcade hall and dungeon in gamedev). Keep each biome's signature landmarks: tallest Afya tower, giant snowflake, finance tower on the mesa, crater and rocket, coaster loop, lighthouse, start gantry, grandstands, billboard, and so on.
2. **Shrink:** tighten spacing, drop filler and duplicate props first, scale down very large pieces when needed (`scale`), and shrink the raceway circuit and the desert mesa.
3. **Spawn** goes on an open, flat spot (on a pad or plaza) 5–25 m from the centre, facing into town.
   - Keep **two clear lanes ≈ 12 m wide** from the spawn to the 40 m edge, toward the two road bearings in the table: no placements taller than 0.6 m, no markers, no small raised or sunken pads.
   - Flat road tiles are fine in a lane.
4. Parking rings (markers) stay reachable: there must be a drivable path from the spawn to every marker and into every interior. Use your existing checkers (`a/check.ts`, `b/checkLayout.ts`, `c/check.ts`).
5. Update your own biome tests where they hard-code old coordinates or sizes, but keep what they protect (clear paths, gentle approaches, landmarks present).

## Ownership
Edit **only** your layout files, your helper folder (`a/`, `b/` or `c/`) and your biome tests.
- **Never** edit:
  - `web/src/world/planet/*`
  - `web/src/world/lib/*`
  - `author.ts`
  - `index.ts`
  - `budget.test.ts`
  - `layouts.test.ts`
  - roads files
  - other agents' biomes
- If a contract blocks you, say so in your final report and don't work around it.

## Done when
Run all of these with `npx` from `web/`:
- `npx vitest run src/world/layout/planet`: your biome tests, `budget.test.ts` for your biomes and `layouts.test.ts` all pass.
- `npx tsc --noEmit` is clean for your files; `npx eslint <your files>` is clean.
- **Don't run `npm run build` or `npm run dev`** (shared `.next`; the coordinator does visual QA).
- `roads.test.ts`, `roadGeometry.test.ts` and the road/verge tests in `terrain.test.ts` will fail until the coordinator rebakes the roads. Ignore them.

## Final report
For each biome, give:
- a short changelog of what moved or was dropped;
- the spawn position (north, east from the centre) and its yaw;
- the max footprint distance from the centre;
- anything you couldn't keep, and any concerns.
