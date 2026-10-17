# Agent Workstreams — 3D Portfolio Town

**Created:** 2026-10-17. Ariann asked Claude to implement the plan directly (Mentor Mode is overridden for this build) and to use parallel agents.
**Plan:** `ai-docs/plans/3d-portfolio-town-plan.md`  **Changelog:** `ai-docs/plans/3d-portfolio-town-changelog.md`

## Deviation from the plan: no Godot in the build path

Agents can't drive the Godot editor, so **districts are authored as TypeScript data** (`web/src/world/layout/types.ts`): Kenney pieces placed on an 8 m tile grid. They're rendered with instancing, and colliders are generated from each model's bounding box. Godot stays optional for manual tweaking later. This replaces the `MARKER_`/`COL_`/`GROUND` Godot scene contract with typed `Placement`/`Marker` data.

## Rules for every agent

1. **Node 24:** start every shell command with `export PATH="$HOME/.nvm/versions/node/v24.11.1/bin:$PATH";`. `nvm use` doesn't work in non-interactive shells here.
2. **Next.js 16.4 has breaking changes:** read the relevant guide in `web/node_modules/next/dist/docs/` before writing Next-specific code. The app is a **static export** (`output: 'export'`), so no server features (no route handlers, cookies, server actions or redirects, and dynamic routes need `generateStaticParams`).
3. **Stay inside your owned paths.** If you need a change in a file you don't own (including the shared contracts below), **don't make it**. Describe it in your final report.
4. **Do not edit `web/package.json` or the lockfile, and do not install packages.** Every dependency is already installed: three, @react-three/fiber, @react-three/drei, @react-three/rapier, zustand, leva, r3f-perf, vitest, @testing-library/react, jsdom, @gltf-transform/{core,extensions,functions}, meshoptimizer, sharp. If something is missing, report it.
5. **Do not commit or push.** Claude (the coordinator) commits after reviewing.
6. **Code style:** TypeScript strict, double quotes, semicolons, 2-space indent, `@/` imports. CSS Modules plus the tokens in `src/app/globals.css` (no Tailwind). Light comments that explain *why*.
7. **Accessibility:** semantic HTML, keyboard reachable, visible focus, `prefers-reduced-motion` respected.
8. **Before finishing,** run from `web/`: `npm run typecheck && npm run lint && npm test && npm run build`. Everything must pass, or you report exactly what fails and why. Other agents work in parallel, so if a failure is clearly in another agent's paths, say so instead of fixing it.
9. **Final report:** files created or changed, what works, what's stubbed, and any contract changes you need.

## Shared contracts (owned by the coordinator; read them, don't edit them)

- `web/src/content/types.ts`: Job, Game, Skill, District, Links, Profile, DistrictId
- `web/src/content/index.ts`: `getContent(id)`, `getDistrict(id)` and re-exports
- `web/src/state/useAppStore.ts`: mode, activeZone, openCardId, gpsOpen, teleportTo/teleportNonce/spawnDistrict, visitedDistricts, quality, muted
- `web/src/state/useInputStore.ts`: on-screen steer/throttle/brake/interact/reset (UI writes, vehicle reads)
- `web/src/world/layout/types.ts`: `TILE = 8`, Placement, Marker, DistrictLayout, ModelRef `"<kit>/<model>"`
- `web/src/world/models/types.ts`: KitInfo, ModelInfo
- `web/src/app/globals.css`: design tokens
- `web/next.config.ts`, `web/package.json`, `web/tsconfig.json`, `web/vitest.config.mts`

## Workstreams and ownership

| Agent | Owns | Phase |
|---|---|---|
| **content** | `web/src/content/{profile,links,jobs,games,skills}.ts`, `web/src/content/*.test.ts`, `web/src/app/plain/**`, `web/src/ui/plain/**`, `web/src/app/layout.tsx` (metadata, JSON-LD, GoatCounter) | 2 |
| **assets** | `web/scripts/**`, `web/public/models/**`, `web/src/world/models/**` (except `types.ts`) | 3 |
| **world** | `web/src/world/**` except `models/**` and `layout/districts/**`; `web/src/hooks/**` | 4 (+ the 5.2 sensors/labels) |
| **ui** | `web/src/ui/**` except `ui/plain/**`; `web/src/app/page.tsx`; `web/src/app/district/**` | 5 |
| **districts** (runs after assets and world finish) | `web/src/world/layout/districts/**` | 6 |
