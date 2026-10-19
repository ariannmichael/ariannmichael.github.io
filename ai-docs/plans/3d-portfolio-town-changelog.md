# 3D Portfolio Town — Changelog

Companion to `ai-docs/plans/3d-portfolio-town-plan.md`. Entries follow the plan's phases and steps.

---

## Pre-implementation (2026-10-17)

Planning work done before Phase 0, recorded for context.

- **Plan created and revised:** `ai-docs/plans/3d-portfolio-town-plan.md`. The stack is Vite + React + R3F + Rapier, Godot 4.7 as level editor, deploying to GitHub Pages.
- **Asset licence investigation:** `ai-docs/investigations/synty-web-license.md`. The Synty EULA doesn't clearly cover a non-game website, so the project **switched to Kenney (CC0)**.
- **Experience reconciliation:** `ai-docs/sources/experience-reconciliation.md` (with `ai-docs/sources/linkedin-profile.pdf`). LinkedIn is the source of truth. PlanetBids = GoFasti's client. Afya (Squad Lead) is the current role.
- **Decisions:** vehicle = Kenney `sedan-sports`. Deploy to the existing `ariannmichael.github.io` repo. GoDaddy +12%/−0.2s numbers are **left out** (C3).

---

## Phase 0 — Decisions & Prerequisites

### Step 0.2 — Download the missing Kenney kits ✅ (2026-10-17)

**What was done**
- Found the official download URLs on kenney.nl for City Kit (Roads), City Kit (Commercial) 2.1, City Kit (Suburban) 2.0 and Mini Characters.
- Downloaded each one to its own scratch folder and checked it before moving it: every kit's `License.txt` says **CC0**, and the archives contain only model and texture files plus an `Overview.html` preview page.
- Ariann had already downloaded Roads, Commercial and Suburban (`kenney_city-kit-suburban_20`) at 17:48. A file-by-file `diff` showed they are **identical** to the fresh downloads, so the existing folders were kept. The duplicate `kenney_city-kit-suburban_2.0` that Claude had created was deleted, and the scratch downloads were removed.
- Added **Mini Characters** (`kenney_mini-characters/`), which was missing. It covers step 0.2.4 and includes a CC0 wheelchair model.
- Measured the bounding boxes of representative models to give the scale test (step 3.1.3) real numbers. Road tiles are 1 unit and the sedan is 2.55 units long, so the city kits need about ×8 relative to the vehicle.

**Files**
- `~/Documents/Personal/Kenney/kenney_mini-characters/`: new (outside the repo)
- `ai-docs/plans/3d-portfolio-town-plan.md`: step 0.2 checked off, with kit contents and measured sizes
- `ai-docs/sources/experience-reconciliation.md` and plan step 8.2.2: recorded decision C3 (no GoDaddy numbers)
- `ai-docs/plans/3d-portfolio-town-changelog.md`: created

**Why**
Roads, Commercial and Suburban are the building blocks of every district. Measuring sizes now prevents scale surprises during the Godot layout.

### Step 0.3 — Answer the open questions ✅ (2026-10-17)

**Decisions recorded**
- **Q5: Next.js** instead of Vite, as a static export (`output: 'export'`) to GitHub Pages.
- **Q6: English only.**
- **Q7: GoatCounter** analytics.
- **Q9:** the site name is **"Ariann Michael"**.
- **Q11: update the CV.** The source is LaTeX, not on this Mac, so the exact edits are in `ai-docs/sources/cv-update.md` for Ariann to apply.
- **C7: Afya 2026 highlights provided.** Leads the Core Features team: the shared components used by all AfyaOne teams (SSO, opt-in, user preferences, profiling).
- **Q8 (media): still open.** Not needed until Phase 6.4.

**Plan changes for Next.js**
- TL;DR, architecture and repo layout now use the App Router (`src/app/`), with `layout.tsx`, `page.tsx`, `plain/page.tsx` and `district/[id]/page.tsx`.
- Step 1.2 rewritten:
  - `create-next-app`
  - `next.config.ts` with `output: 'export'`, `images.unoptimized`, `trailingSlash`
  - `WorldLoader.tsx` using `next/dynamic` with `ssr: false` (three.js, WebGL and Rapier WASM only exist in the browser)
  - `public/.nojekyll` (without it, GitHub Pages' Jekyll hides the `_next/` folder)
- Step 1.3: the Pages artifact path is `web/out`.
- Step 2.3.3: Plain View is a real pre-rendered `/plain/` page (Server Component, no three.js in its bundle) instead of a hash route.
- Step 2.4: SEO through Next's `metadata` export. The `/` page server-renders the overlay text.
- Step 5.5.2: deep links are static `/district/<id>/` pages with per-district OG metadata, plus a `?job=<id>` query read inside `<Suspense>`.
- Step 7.2.1: GoatCounter via `next/script`, with custom events.

**Files**
- `ai-docs/plans/3d-portfolio-town-plan.md`: the Next.js changes above, Q5–Q11 marked answered, step 0.3 checked off
- `ai-docs/sources/experience-reconciliation.md`: Afya 2026 highlights, C7 resolved
- `ai-docs/sources/cv-update.md`: created (11 CV edits plus a checklist)

**Why**
Next's static export keeps GitHub Pages hosting but adds real pre-rendered pages. That means better SEO for `/plain/` and proper link previews for district deep links, which helps the Speed King launch posts.

#### Step 0.3 addendum (2026-10-17)
- Afya 2026 stack provided: **Next.js, NestJS, MongoDB, ArgoCD, AWS, GitHub Actions**. Recorded in `ai-docs/sources/experience-reconciliation.md`. Added a stack bullet to the Afya entry and ArgoCD to Skills in `ai-docs/sources/cv-update.md`.

### Step 0.4 — Tooling ✅ (2026-10-17, done by Claude at Ariann's request)
- `.nvmrc` = `24` (Node v24.11.1 via nvm). Non-interactive shells need an explicit PATH export because `nvm use` doesn't take effect there.
- `@gltf-transform/cli` 4.5.1 and `gltfjsx` 6.5.3 installed globally under Node 24.
- `gh` 2.102.0 installed with Homebrew. **`gh auth login` is still pending** (interactive). Git over SSH already authenticates.
- Godot 4.7 verified (no longer in the build path, see below).

---

## Build mode change — agents (2026-10-17)

Ariann asked Claude to "do everything" and to use agents to go faster. Mentor Mode is overridden for this build.

- **Coordination doc:** `ai-docs/plans/agent-workstreams.md` (rules, file ownership, shared contracts).
- **Deviation:** no Godot. Districts are TypeScript layout data on an 8 m grid, rendered with instancing.
- **Running in parallel:** the content (Phase 2), assets (Phase 3), world (Phase 4 + 5.2) and UI (Phase 5) agents. The districts agent (Phase 6) follows.

## Phase 1 — Scaffold & deploy pipeline

### Steps 1.1.1, 1.2, 1.3.1 ✅ (2026-10-17, Claude)
- `git init` (main). Root `.gitignore`.
- `web/`: Next 16.4.2 (`create-next-app`, App Router, `src/`, ESLint, no Tailwind).
  - Removed `cacheComponents`/`partialPrefetching` (they need a Node server) and set `output: 'export'`, `trailingSlash`, `images.unoptimized`, `transpilePackages: ['three']`.
  - Added `public/.nojekyll`.
  - Scripts: `typecheck`, `test`, `models`, `check`. `engines` node 24.
  - Deps: three, R3F, drei, rapier, zustand, plus dev tools: vitest, testing-library, leva, r3f-perf, gltf-transform, meshoptimizer, sharp. `@types/node` is ^24.
- **Shared contracts:**
  - `src/content/types.ts` + `index.ts` (`getContent`, `getDistrict`) + `districts.ts`
  - `src/state/useAppStore.ts`, `src/state/useInputStore.ts`
  - `src/world/layout/types.ts` (TILE = 8 m, Placement/Marker/DistrictLayout)
  - `src/world/models/types.ts` (KitInfo with shared texture, ModelInfo)
  - Design tokens in `globals.css`
- Placeholder `AppShell` → `WorldLoader` (`next/dynamic`, `ssr:false`) → `Experience`. Typecheck, lint and build pass, and `out/` is exported.
- `.github/workflows/deploy.yml`: Node from `.nvmrc`, `npm ci`, typecheck, lint, test, build, upload `web/out`, deploy-pages.
- **Media:** copied cover art from the old site (`public/media/games/`: rat-catcher, shoot-em-all, lead-me-to-the-light) and downloaded the Speed King Steam header (`speed-king.jpg`, 460×215).
- **Old site inspected** (read-only clone): 3 commits on `main`, a static HTML/CSS/JS site. It will be preserved as a `legacy-site` branch before `main` is replaced (step 1.1.2, needs Ariann's confirmation).
- **Commits:** `2679c1d` (scaffold + contracts), `2fcd2ba` (model manifest contract + workstreams doc).

## Phase 2 — Content Layer & Plain View

### Steps 2.1–2.4 ✅ (except 2.4.2, which the UI agent owns, and 2.5 deploy) (2026-10-17, content agent + Claude)
**Content agent:**
- **Data:** `src/content/{jobs,games,skills,profile}.ts` from `ai-docs/sources/experience-reconciliation.md`. 10 entries: Afya 2026 (current), DrChrono, GoFasti·PlanetBids, FullStack·GoDaddy, Afya Educacional, OpenMined, Stefanini, Proj4me, UFCG Monitor, and the UFCG degree. **No GoDaddy numbers.**
- **Plain View:** `/plain/` is a Server Component (`src/app/plain/page.tsx`) with components in `src/ui/plain/`:
  - Header, Experience/Education, Games, Skills (+ languages), Contact, and a footer with the Kenney CC0 credit.
  - `format.ts` uses a fixed month table, so output is the same in every timezone.
  - `analytics.ts` exports `trackEvent()` for GoatCounter.
- **Root `layout.tsx`:** Open Graph and Twitter metadata (no image yet), Person JSON-LD built from content (with `<` escaped), and GoatCounter via `next/script`.
- **Tests:** `content.test.ts` and `format.test.ts`, 17 tests in total.
- **Decisions:**
  - Rat Catcher's genre is set to "Indie" because nothing is known about it.
  - Speed King copy says "Release date Nov 10, 2026" (no "Wishlist"), so it stays true after launch.
  - English is listed as "fluent", but LinkedIn says Native/Bilingual. **Ariann to choose.**
  - No canonical URL in the root layout, because Next's shallow merge would point every route at `/`. Each route sets its own (the UI agent was told).

**Claude (coordinator):**
- **Global tokens fixed for WCAG AA** (the content agent flagged light-mode contrast at 3.6:1):
  - `--accent` #e8572a → #c2410c (5.2:1 with white)
  - `--accent-2` #2a7de8 → #1d63c4 (5.1:1 on `--bg`)
  - A solid focus ring
  - Dark mode `--accent-text` is #1d1b16 (6:1 on #ff6a3d)
- **Game covers wired in:** `cover` paths in `games.ts`, rendered in the Plain View with `next/image` (unoptimized for static export). The featured Speed King card uses a two-column layout on wide screens.
- Passed the canonical-URL guidance, the token change and the `trackEvent` location to the UI agent.

**Still open:** the GoatCounter site must be created by Ariann. The CV PDF is missing from `web/public/cv/` (the link 404s until it's added).

## Phase 3 — Asset pipeline (Kenney → web) ✅ (2026-10-17, assets agent)
- `web/scripts/prepare-models.mjs` + `kits.config.mjs` (a scale and one-line rationale per kit) + `inspect-model.mjs` (debug tool). Run with `npm run models`, or `npm run models -- <kit>…` to rebuild only some kits.
- **Output:** 23 kits and 1,939 models in `web/public/models/<kit>/<model>.glb`, **17.3 MB** in total.
  - Meshopt-compressed. Node hierarchy and names are preserved, and positions aren't quantized, so the wheel nodes keep their transforms.
  - Each textured kit shares one **lossless** WebP palette (`colormap.webp`, 2–13 KB). Racing and space kits use flat colours.
- `web/src/world/models/manifest.generated.ts` and `index.ts` (`getModel`, `hasModel`, `getKit`, `listModels`, `footprint`, `rotatedBounds`). 10 tests.
- **Key scales:** city kits and racing ×8 (tile = 8 m), car-kit ×1.7 (the sedan is 4.34 m long), mini kits and characters ×2.5, coaster ×4, pirate ×2 (tower = 20 m lighthouse), food ×10 (giant roadside props).
- **Rendering notes** were passed to the world agent: the kit scale isn't baked in, palette materials are shared, characters are skinned, models face +Z, and some origins are off-centre.

## Phase 5 — Overlay UI ✅ (2026-10-17, UI agent)
- **Server-rendered `AppShell`:** name, headline, Download CV and Plain view as static HTML, plus client islands.
- **Overlay:**
  - A WebGL2 check, with a fallback panel when it's missing
  - The loader (a car on a road)
  - The controls hint
  - The "Press E / Tap" prompt
  - A reduced-motion notice
- **`HudControls`:** GPS, sound and quality buttons.
- **Shared `Modal`:** a dialog with a focus trap, Esc to close, click-outside to close and focus return.
- **`InfoCard`:**
  - Job cards
  - Game cards: the Steam widget, a countdown, Wishlist → Buy, and the itch Play modal, which loads the iframe only after a click
  - About, Contact and CV cards
- **`GpsMenu`:** Milestone 1 districts teleport, Milestone 2 districts show "Under construction", and visited districts get a badge.
- **`TouchControls`:** a joystick plus brake, interact and reset buttons, writing to `useInputStore`.
- **Routes:**
  - `?job=` deep link.
  - `/district/[id]/` (all 7 pages pre-rendered), with per-page canonical, OG and Twitter metadata.
  - Canonical `/` and `viewport-fit=cover` on the home page.
- **Tests:** 26 UI tests.
- **Claude fix:** the release instant changed from 17:00 to **18:00 UTC** (10:00 PST on Nov 10), and the test fixture was updated to match.

## CV PDF ✅ (2026-10-17, Claude)
- `web/scripts/generate-cv.mjs` (`npm run cv`) imports the same content `.ts` files as the site (Node 24 type stripping) and prints an ATS-friendly US Letter PDF with headless Chrome → `web/public/cv/Ariann_Michael_CV.pdf` (2 pages).
- The header uses the full name "Ariann Michael Farias" (LinkedIn), with a CV-toned summary. Regenerate it whenever the content changes.
- English is now set to "bilingual" (Ariann's answer).

## Deploy prep (2026-10-17, Claude)
- Old site preserved on GitHub: branch `legacy-site` and tag `legacy-v1` at `5c2454b`. This was additive; `main` is untouched.
- Pages currently runs `build_type: legacy` from `main`/root. At go-live: switch it to `workflow`, then push the new history onto `main` as a merge with unrelated histories (**no force-push**; the old commits stay in `main`'s history).
- GoatCounter is free for reasonable public use (no paid plans; donations are optional).

## Phase 4 + 5.2 — 3D world core ✅ (2026-10-17, world agent)
- **`Experience`:**
  - Canvas setup: PCF shadows on high quality, `flat` (no tone mapping, so the Kenney palette stays true), fog and a gradient sky. `PerformanceMonitor` drops to Lite.
  - Rapier physics runs at a fixed 1/60 step and pauses while a card or the GPS is open.
  - All GLBs and palettes start downloading in parallel at load.
- **Town:** one `InstancedMesh` per model primitive, honouring node transforms. Per-kit shared palette materials (sRGB, `flipY` false, nearest filtering).
  - Colliders come from rotated, off-centre-aware bounds. Roads and flat tiles are drive-through.
  - Dynamic knockable props. Skinned mini-characters are cloned and play their idle animation. Missing models show as magenta placeholders.
- **Vehicle:** an arcade sphere-kart (frictionless ball, CCD, driving in `useBeforePhysicsStep`) with the sedan visual: roll, pitch, wheel spin, front-wheel steering and a bounce spring. All tuning lives in `vehicle/constants.ts`.
- **Camera:** an intro orbit that blends into the follow camera (frame-rate-independent damping, speed field of view), plus a teleport fade. Calmer with reduced motion.
- **Zones:** 6×6 m sensors per marker that react only to the vehicle, with Billboard/Text labels. E/Enter or the touch interact button opens the card; the CV marker downloads the PDF directly.
  - Touch axes are merged with the keyboard. M/G toggles the GPS. The first input switches to drive mode.
  - `markVisited` is checked 4 times a second.
- **Tests:** 52 world tests. Repo total: 11 files, 90 tests, all passing.

## Integration QA (2026-10-17, Claude)
- A headless-Chrome harness (puppeteer-core in the session scratchpad, system Chrome with SwiftShader) rendered and **drove** the town. The town, sedan, roads, cones and labels all render, and the follow camera tracks while driving. The console has only library deprecation warnings.
- **Checked:**
  - `/plain/` in light mode: correct.
  - Home at 390×844: the HUD stacks correctly.
  - `?job=speed-king` deep link: the card shows the cover, a live countdown (23 days), the Steam widget and the publisher.
- **Label font:** drei `<Text>` now uses a local **Kenney Future** TTF (`web/public/fonts/kenney-future.ttf`, CC0) instead of downloading troika's CDN font.
- **Districts agent launched** for the Milestone 1 layouts (home, engineering, raceway), with the screenshot harness so it can check its own output.

## Phase 6 — Milestone 1 districts ✅ (2026-10-17, districts agent + Claude)
- `web/src/world/layout/districts/{home,engineering,raceway,plots,helpers}.ts`:
  - A connected City Kit road network (an avenue, a roundabout and a west ring road) and a closed racing-kit circuit with grandstands, pits and a billboard.
  - Every job and game is reachable through a marker. Milestone 2 construction plots are in place.
  - 647 placements, 115 unique models, 111+ tests (no overlaps, markers clear of colliders, roads connected).
- **Claude:**
  - 3D labels shrink near the camera and hide very close or very far (`labelScale`, tested).
  - Clearer UFCG and Afya labels, and line height fixed for the Kenney font.
- **Known gaps:** no ramp on the circuit (needs a ramp or trimesh collider), and mini-characters get box colliders.

## Phase 7.1 — OG image (2026-10-17, Claude)
- `web/public/og-image.png` (1200×630): a clean raceway render with a name/title panel. Wired into the root layout's Open Graph and Twitter metadata (`summary_large_image`).
- **TODO:** the `/district/[id]` pages replace the openGraph block, so add `images` there too.

## Status at usage-limit stop (2026-10-17)
- **Done:** Phases 0–6, 7.1 (except the district OG images), the CV PDF, and the legacy site backup.
- **Left:**
  - Add the OG image to the district pages
  - Real-device and Lighthouse pass (7.3)
  - Human testing doc (7.4)
  - Go-live (switch Pages to Actions, then merge-push to `main`), **waiting on Ariann's approval**
  - GoatCounter site creation (Ariann)
  - CV header name choice (Ariann)

## Phase 7.1 / 7.3 follow-up (2026-10-17, Claude, on `main`)
- **OG image** added to the `/plain/` and `/district/[id]` metadata (they replace the layout's openGraph). All 9 pages now emit `og:image`.
- **Lighthouse** (local static build, headless Chrome with SwiftShader):

  | Page | Perf | A11y | Best practices | SEO | Notes |
  |---|---|---|---|---|---|
  | `/plain/` | 96 | 100 | 82 | 100 | LCP 2.7 s, TBT 10 ms |
  | `/` | 38 | 95 | 82 | 100 | LCP 21 s, TBT 11.2 s |

  - The `/` perf number is inflated by software WebGL, but load-time main-thread work is real. It's tracked in the v2 plan.
  - `/` a11y fails: `aria-prohibited-attr` and `label-content-name-mismatch`. Assigned to the v2 integration agent.
- **Caveman plugin:** installed but disabled in `~/.claude/settings.json` (`caveman@caveman: false`). Its SKILL.md is followed manually this session; settings are unchanged.

---

# v2 Planet World (branch `planet`)

Ariann's feature request (2026-10-17):
- camera shake
- wheel smoke particles
- distinct biomes using different models, with interiors you can drive into
- skybox
- a globe you can drive around
- off-road driving like *Over the Hill*
- PSX visuals
- as many subagents as needed

Plan: `ai-docs/plans/planet-world-plan.md`.

### P0 — Contracts ✅ (Claude)
- Branch `planet`.
- `web/src/world/planet/config.ts` (R = 150 m, g = 18 m/s²), `frame.ts` (lat/lon ↔ direction, surface frame, `surfacePose`, `offsetLatLon`, 6 tests), `types.ts` (BiomeLayout, PlanetPlacement, PlanetMarker, FlatPad, Biome), `biomes.ts` (8 biomes: 7 career + badlands), and a `terrain.ts` stub.
- `layout/planet/index.ts` (empty `PLANET_LAYOUTS`).
- Store: `psx` + `setPsx` (default on).
- Root `/package-lock.json` (empty, created by `npx serve`) removed and git-ignored.
- **Launched 4 parallel agents:** terrain (P1), vehicle + camera + FX (P2), psx-sky (P3), integration (P4). The biome agents (P5) follow.

### P1 — Terrain & gravity ✅ (terrain agent, commit `9a9c490`)
- **Mesh:** a class I geodesic icosphere at subdivision 44: **38,720 triangles**, ~3.8 m edges, the same mesh for render and collider. The render geometry is non-indexed with per-face normals and colours (PS1 facets). Building it takes about 80 ms, and the trimesh about 21 ms.
- **`terrainHeight` is exact against the mesh**, found by intersecting with the triangle under the direction (error ≤ 1e-4 m), so props, wheels and camera agree.
- **Biome blending:** biomes blend over soft 8–15° borders. Heights run −8..+18 m. Rolling biomes have a p95 slope of about 23°; ridged ones (financial, opensource, badlands) are steeper, with terraces.
- **Dirt trails** along great circles, connecting each biome to its 2 nearest neighbours.
- **Gravity:** centre-pointing impulses on every awake dynamic body (`gravityScale` honoured). Rapier's world gravity is 0.
- **Coordinator:** `frame.test.ts` updated for real terrain heights.

### P3 — PSX & sky ✅ (psx-sky agent, commit `983150b`)
- **`PsxPipeline`:** a low-res target (360 px tall on desktop, 270 on phones or "low"), nearest upscale, 15-bit colour with a 4×4 Bayer dither.
- **Global material patch** (hooked on `Material.prototype`): vertex snapping to a 240-row grid, affine UVs at 0.35, nearest maps. Depth, Raw and troika text materials are skipped.
- **Procedural sky:** based on local up, with dithered clouds, sun and stars. It tints by biome and snaps on teleport, and it owns `scene.fog` (60–180 m in PSX mode).
- **Lighting:** a fixed sun (Game Dev Park ends up on the night side, with dusk and stars). Night fill keeps every biome readable. Real shadows only in high quality with PSX off; otherwise a blob shadow.

### P2 — Off-road SUV, camera shake, wheel dust ✅ (vehicle agent) + P4 — Integration ✅ (integration agent), commit `f2713d1`
- **Vehicle:** `car-kit/suv` on Rapier's `DynamicRayCastVehicleController`.
  - AWD (70% rear), 0.5 m suspension travel, top speed about 25 m/s.
  - Handbrake drift, air control, auto-upright, landing and crash detection.
  - Headless Rapier tests: it climbs 35°, holds on 20° and recovers from a flip.
  - **Approved deviations:** the chassis uses `gravityScale={0}` and applies its own centre gravity; R resets in place (GPS still teleports to district spawns).
- **Camera:** the follow camera's up is local planet up; it is terrain-clamped with line-of-sight lift. The intro orbit shows the curvature. Trauma-based shake (rumble, landings, crashes), off with reduced motion.
- **Wheel dust:** a single instanced draw call of PSX puffs (pool of 400, 140 on low), coloured from `groundColorAt`.
- **Integration:**
  - Experience runs with zero-gravity Physics plus `PlanetGravity` and `PlanetGround`.
  - Streaming placement renderer (load within 70°, unload past 90°, spread over idle frames) with oriented colliders.
  - Zones on local up, `DistrictTracker` by `biomeAt`, PSX toggle in the HUD.
  - The GPS lists all 7 biomes.
  - Physics mounts after first paint plus an idle callback.
- **Lighthouse on `/`** (sandbox content): **a11y 100** (fixed `aria-prohibited-attr` with `role="img"`, and the HQ button's name mismatch); perf 57 (was 38), TBT 1.8 s (was 11.2 s).
- **v1 flat layouts removed on this branch** (`main` keeps them).

### P5 kickoff (Claude)
- Biome stubs (one file per biome) and `layout/planet/author.ts` (`grid(center)` → `at`/`place`/`marker`). `PLANET_LAYOUTS` collects all 8. Shared brief: `ai-docs/plans/biome-authoring-brief.md`.
- **3 biome agents in parallel:** A (home, engineering, raceway), B (healthcare, financial, opensource), C (gamedev, badlands).
- **Label font:** switched to **Kenney Mini Square Mono**. A render of every Kenney font showed this is the only one whose "K" doesn't read as "H" ("SPEED HING" bug).

### Decisions (2026-10-18, Ariann)
- **Ship v2 only:** v1 is never released. The planet must be live before 2026-11-10.
- **CV header name: "Ariann Michael Farias"**, confirmed. That is already the value in `web/scripts/generate-cv.mjs` (`CV_NAME`), so the PDF needs no change. The site keeps "Ariann Michael".
- **GoatCounter site created** by Ariann (`ariannmichael`). The site already loads `https://ariannmichael.goatcounter.com/count` with `//gc.zgo.at/count.js` (via `next/script`, `afterInteractive`, the equivalent of `async`), so no code change was needed. The endpoint answered 200. Claude's check sent one test pageview, `/test-from-build`.

### P5 — Biomes & interiors ✅ (biome agents A/B/C plus Claude, 2026-10-18)
**A** (commit `1ee42f1`):
- **Hometown Meadow:** a road loop with the house (about), contact plaza, CV billboard, UFCG campus (2 markers), a skate park and the proj4me office.
- **Downtown Plateau:** a raised grid with the Stefanini mentoring plaza and the GoFasti warehouse with an 8× snowflake and an AI kiosk. **Drive-through container loading dock.**
- **Speed King Canyon:** a dirt stadium circuit (~240 m lap) with an asphalt start straight and gantry, berms, kickers and grandstands. **Drive-in pit garage.**

**B** (commit `5837817`):
- **Clinic Lakeside:** the Afya tower (current role, tallest), the Afya Educacional hall with antennas, the DrChrono clinic and a lake basin. **Drive-through DrChrono factory hall:** a monolith machine splitting into 3 microservice units.
- **Desert Mesa:** **a drive-thru payments hall**, then a ramp of pads up to the FullStack tower on a 15 m mesa, with giant roadside food props.
- **Alien Crater:** a bowl with rim jumps and the OpenMined glass hangar. **Drive-through modular-space-kit lab** (entry gate, corridors, room, laser gate, exit).

**C** (commit `dc97bdb`):
- **Game Dev Park** (night side), with one zone per itch game: a **drive-in arcade** with giant air-hockey Pong outside, the Shoot 'Em All launch pad with ships, the Rat Catcher **drive-in dungeon mound**, the lantern graveyard leading to the lighthouse cove, and the Get Notes stage. Plus a coaster loop landmark.
- **Badlands:** kicker line, tabletop, blind hill, ridge, whoops, bowl, crater, wrecks and smashable crates.

**Claude:**
- **Import-cycle crash fixed** (found by C): the pure sphere maths moved to `planet/sphere.ts`, which has no terrain import. `frame.ts` re-exports it, and layouts must import from `sphere`/`author`.
- Integration sandbox removed. Marker tests now use an inline fixture.
- **New `layouts.test.ts`:** exactly one layout per biome; every job and game reachable exactly once, in its career biome; one each of about/contact/cv. **39 files, 275 tests, all green.**

**Open → QA-fix agents** (running):
- PSX label legibility (labels become smudges at 360 px)
- Arcade/dungeon doorway stall
- Dock ceiling renders black
- Trails over plazas
- Load performance

### P6 — QA round (2026-10-18)
- **PSX labels** (QA agent, commit `f374291`): labels sit on layer 1 and render at full resolution after the PSX blit, depth-tested against the copied low-res scene depth. They're unfogged in PSX mode and cost about 0.08 ms per frame. Claude added growth past 60 m (×1.8 at 160 m) for the intro orbit.
- **Interiors** (QA agent, commit `649fd4e`): every interior was driven in, through and out in the browser via a new `?debug` `window.__teleport`. The arcade and dungeon became drive-through with markers moved beside the door lanes. The dock roof now uses lit space-kit slabs, and dirt trails fade out on pads (mesh and `terrainHeight` still exact).
  - **Root cause it found: wheel raycasts hit marker sensors.** Every zone acted as a solid 6×6×4 m block. **Claude fixed it** in `vehicle/controller.ts` (`updateVehicle(dt, EXCLUDE_SENSORS=8)`), with a regression test in the headless Rapier sim that fails without the fix (commit `a6dd216`).
- **Performance** (QA agent, commit `f06b5e6`):
  - Priority download queue: spawn biome first, neighbours after spawn-ready, far biomes in idle time.
  - Groups stay hidden until `compileAsync` finishes; colliders are added 64 per frame.
  - The loader tracks only the spawn biome; the controls hint is server-rendered; there's an error boundary around the world.
  - **Lighthouse `/`: perf 36 → 59, LCP 15 s → 2.5 s.**
- **WebGL probe** (Claude, commit `7f19478`): the throwaway WebGL2 context became a feature check, and the world mounts after a presented paint plus idle. **TBT 11 s → 5.5 s.** LCP under SwiftShader is bimodal (2.5 s or 11.6 s from run to run); real GPUs should do much better. That needs real-device testing.
- **Human testing doc:** `ai-docs/human_testing/planet-v2-testing.md`.
- **In progress:** a camera agent working on collision with buildings and interiors (the camera clipped into the dungeon mound).
- **Camera collision ✅** (camera agent plus Claude's mount):
  - **Spring arm:** a 0.3 m sphere sweep from a pivot 2.4 m above the car, pulling in fast and easing out over ~1.3 s.
  - **Ceiling probe:** caps the camera height under roofs.
  - **Queries:** they skip dynamic bodies and sensors (flags 12). Cost is one ray plus one shape cast per frame, with no per-frame allocations in our code.
  - **Wiring:** `CameraCollisionBridge`, mounted by Claude in `Experience` inside `<Physics>`, hands the Rapier world to `FollowCamera`.
  - **Checked:** the dungeon no longer goes grey, and the car stays visible in every interior.
  - **Tests:** 43 files, 300 tests.

### v2 fix: road tile alignment (2026-10-18)
- **Bug:** road tiles in Hometown, Downtown, Raceway, Game Dev Park and Badlands were twisted against each other. `grid()` took yaw against the *local* north at each tile, and meridians converge, so local north drifts from grid north (up to ~16° at ±48 m in mid-latitude biomes, ~70° in Badlands at −65°).
- `web/src/world/layout/planet/author.ts`: `grid().place` converts yaw from the grid frame to the local frame (finite-difference grid north); new `grid().spawn(n, e, yaw)` does the same for spawns. Positions are unchanged.
- `web/src/world/layout/planet/c/helpers.ts`: `localGrid` is now an alias of `grid` (author.ts is cycle-safe since the sphere.ts split), so C biomes get the fix too.
- `home.ts`, `engineering.ts`, `raceway.ts`, `gamedev.ts`, `badlands.ts`: spawns go through `spawn()`.
- New `author.test.ts`: placed headings match grid directions (<0.05°) away from the anchor.

### v2: roadmap road network (2026-10-18), plan step P5b.2
**Why:** the user asked for "a road connecting all biomes, like a roadmap, to make the experiences easier to find". The old dirt trails ran centre-to-centre, meandered, cut through towns and were hard to see.
- **New `web/src/world/planet/roads.ts`:**
  - `ROAD_LINKS`: a loop plus a badlands branch; 9 roads, about 2 km.
  - Runtime queries: `prepareRoads`, `getRoads`, `nearestRoadXYZ`, `roadBedXYZ` (beds blended where roads meet), `applyRoadBed`, `roadVergeXYZ`.
  - Constants: half width 3.2 m, flat shoulder 2.5 m, feather 4 m.
- **New `web/src/world/planet/roadRoute.ts`:** the offline router. Per link:
  - A strip grid of 2 m cells around the spawn-to-spawn great circle.
  - Blocked cells from `obstacles.ts`, plus the clearance.
  - A* costs:
    - grade² (hard cap 0.42)
    - side slope²
    - crowding near footprints
  - The start/goal free area is the one that best reaches both spawns. Walled-in spawns fall back to the nearest reachable cell, or to routing in reverse.
  - Smoothing: string pulling, per-corner Chaikin, then constrained Laplacian relaxation plus resampling every 2 m.
  - Bed: the ground (pads, no roads) with a gaussian low-pass, then a grade limiter (≤ 0.24).
- **New `web/src/world/planet/obstacles.ts`:** footprint circles for routing and signs:
  - Placements, using bbox centre and radius. Flat pieces under 0.6 m and dynamic props are skipped.
  - Parking rings.
  - Small raised or sunken pads (jumps).
- **New `web/src/world/planet/roads.generated.ts`:** the baked polylines and bed heights (about 43 KB). Rebake with `npm run roads` after changing links or layouts.
- **New `web/src/world/planet/roadRoute.gen.test.ts`:** the generator entry point; skipped unless `ROADS_WRITE=1`.
- **`web/package.json`:** `roads` script.
- **`web/src/world/planet/terrain.ts`:**
  - Removed the trail arcs, grooves and `trackMask*`/`trailMaskXYZ`.
  - `analyticHeightXYZ(x, y, z, pads, roads)` order: road bed, then pads; then the road re-levels the outer part of pad blend rings, so asphalt never tilts sideways down a pad rim.
  - New `groundHeightNoRoadsXYZ`, used by the router.
  - New `vergeMaskXYZ`, used for colour.
  - `naturalHeightXYZ` no longer has a groove.
- **`web/src/world/planet/terrainColor.ts`:** dirt colour now comes from the road verge mask.
- **New `web/src/world/roads/roadGeometry.ts`:**
  - `buildRoadRibbon`: one indexed ribbon, 5 vertices across, `terrainHeight` + 0.14 m. Rows already paved by an earlier road are skipped at hubs, so there's no z-fighting.
  - `roadSigns`: a spot search along the road and on either side, clear of roads and footprints.
- **New `web/src/world/roads/Roads.tsx`:**
  - The ribbon uses a procedural 32×64 asphalt texture (nearest filter, white edges, dashed yellow centre) with polygon offset.
  - Each sign has two posts with colliders and a green board. Its faces, on the label layer:
    - **Welcome:** the town name and its stops.
    - **Onward:** "> destination", the distance and that town's stops.
  - Signs are hidden beyond 110 m.
- **`web/src/world/Experience.tsx`:** mounts `<Roads />` after `<PlanetGround />` inside `<Physics>`.
- **Tests:**
  - New `roads.test.ts`: links baked, network connected, ends near spawns, clearance, bed grade < 0.3, bed maths.
  - New `roadGeometry.test.ts`: ribbon faces outward on the ground, signs clear and upright.
  - `terrain.test.ts`: trail tests replaced with verge and bed tests.
- **Known limits:**
  - Raceway → Downtown arrives at the north side of the circuit, about 68 m from the spawn, because the berms and grandstands wall the spawn off.
  - Badlands roads end about 36 m from its centre, at the edge of the jump field.
  - At town hubs the asphalt meets the Kenney road tiles with a visible seam.
- **QA:**
  - 312 tests pass; typecheck and lint are clean; build OK.
  - Terrain build: 60 ms geometry + 42 ms collider.
  - Headless screenshots: roads through Game Dev Park, the desert and the clinic; the welcome and onward signs are readable.

## v2.1: Small planet (plan: `ai-docs/plans/small-planet-plan.md`)

### S1: Contracts (2026-10-18)
**Why:** "the world is too big", meaning the planet looks too big. The goal is a strong globe feel, with towns shrunk to match.
- **`planet/config.ts`:** `PLANET_RADIUS` 150 → 90.
- **`planet/biomes.ts`:** centres on a square antiprism (lat ±30.7°, 90° apart, offset 45°), 74.9° ≈ 118 m apart.
- **`planet/types.ts`:** new `FlatPad.planar` and `PlanetPlacement.plane`.
- **`planet/terrain.ts`:** planar pads flatten to the tangent plane, with target `(R + t)/cos θ − R`.
- **`lib/planetPlacement.ts`:** `planePose`. The ray along the placement direction meets the anchor plane, up is the anchor up, and the heading is projected onto the plane.
- **New `planet/up.ts`:** `groundUpXYZ`, which is radial, blended to the planar pad normal.
  - `gravity.ts` (all dynamic bodies), `vehicle/controller.ts` (car gravity and upright reference) and `Vehicle.tsx` (`vehicleState.up`, which feeds the camera and HUD) all use it, so floors over planar pads feel level.
- **`planet/terrainGrid.ts`:** `SUBDIVISIONS` 44 → 27. That keeps ~3.7 m triangles: a finer mesh picked up steep fine noise octaves, and this is also 14,580 triangles instead of 38,720.
- **`planet/biomeField.ts`:** `BORDER_DEG` 22 → 40, so biome base-height changes spread across the whole corridor between towns (the slope p95 stays under 35°).
- **`planet/roads.ts`:** `ROAD_LINKS` is now the 8-town loop that matches the antiprism zigzag.
- **`roads.generated.ts`:** emptied until the towns are re-authored and the roads rebaked.
- **New `layout/planet/budget.test.ts`:** footprints, markers and spawn within 40 m of the centre; pads with blend within 46 m.
- **New `planet/planar.test.ts`:** planar pad flatness, gravity up, and plane placement pose.
- **Tests updated for R = 90:**
  - `terrain.test.ts`, `terrainMesh.test.ts`, `cameraMath.test.ts` and `planetPhysics.test.ts` take R from config.
  - `author.test.ts` offsets ±30 m.
  - Continuity tolerance is now 8 cm.
- **Comments:** fixed the ones that assumed 150 m.
- **New `ai-docs/plans/small-planet-agent-brief.md`:** the brief for the three town agents (S2).

### S2.1: Home, Downtown, Speed King Canyon for the small planet (agent A, 2026-10-18)
- **`home.ts`:** footprints ≤ 39.65 m. Spawn at (−6, 0), facing the campus.
  - The road loop is now ±12 m.
  - The house and About stop are west; contact is south-west; UFCG is north, with its main hall on a planar pad and both stops on the quad.
  - The skate park (×1.4) is north-east, proj4me is east, and the CV billboard is at the south exit.
  - Dropped: most of the outer forest, neighbour house p, the soft bowl, and 2 of the 4 kickers.
- **`engineering.ts`:** footprints ≤ 39.24 m. Spawn at (−22, 0), on the avenue facing north.
  - Plateau: radius 32, blend 12, raised 2.5 m. One avenue and one street, with a single crossroads.
  - Stefanini is in the NW block; GoFasti and the snowflake are in the NE block. Both stand on planar pads.
  - The loading dock is planar, sunk 2.5 m: 2 containers per wall, 8 m wide, and you drive through it west → east.
  - Dropped: windmills, the solar farm, buildings j/l/m, skyscraper-e, the background skyline and the kickers.
- **`raceway.ts`:** footprints ≤ 38.57 m. Spawn at (13, −14) on the grid, facing east.
  - The circuit is about 130 m per lap, with the start straight on the north side.
  - The pit garage (×1.5) stands on a planar pad and opens onto the straight.
  - 3 grandstands, and the billboard (×1.5) faces the grid.
  - Berms, kickers and a roller remain.
  - Dropped: the mesas, pits office, radar, light posts, 3 grandstands and most barriers.
- **`a/check.ts`:**
  - `checkTown`: the budget, spawn placement and lanes.
  - `unreachable`: a 1 m flood fill from the spawn that avoids colliders and steep steps.
  - Helpers for levels and grades.
  - Each biome test now checks budget, lanes, reachability, interiors and pad levels.
- **Concerns:**
  - Nested pad `height`s are hand-tuned against each pad's own natural centre height, so they are brittle if the terrain or centres change. The tests pin them. A follow-up could add pad heights relative to a parent pad.
  - The pit's planar pad may leave a 0.25 m bump at the start straight's edge.

### S2.2: Clinic Lakeside, Desert Mesa, Alien Crater for the small planet (agent B, 2026-10-18)
**Why:** the towns had to fit the 40 m budget on the 90 m planet, keep every marker and drive-in interior, and keep big modular buildings square on the tighter curve.
- **`b/site.ts`:**
  - `frame(north, east, yaw, { planar, planeAt })`: a sub-frame can now be planar. Every piece placed through it gets `plane` (the frame origin, or `planeAt` in sub-frame metres), so it stands on that tangent plane. Pair it with a `planar` pad on the same anchor.
  - New `toNE(p)`: the inverse of `at`, giving anchor-frame (north, east) metres for a lat/lon. Used by the lane check.
- **`b/checkLayout.ts`:**
  - `TOWN_RADIUS = 40`.
  - `laneBlockers(layout, from, bearing, halfWidth = 6)`: lists placements taller than 0.6 m, markers and small raised or sunken pads inside a road lane from the spawn out to the 40 m edge.
  - `polyline(site, pts, step)`: samples an anchor-frame route as lat/lon for grade and reachability checks.
  - `topOf(p)`: placement top height, for "tallest landmark" checks.
- **`healthcare.ts` (Clinic Lakeside):** spawn at (−18, 0) on the plaza's south edge, with road lanes SW 219° and SE 141°.
  - The DrChrono factory hall (20 × 24 m) stands on a planar pad and is driven through with roll-up doors at both ends. Inside, one "Django monolith" machine feeds three "Rust microservice" machines.
  - The lake, med school, Afya tower and antenna are packed around the plaza. Pads are cut about 3 m into the hill (hall floor −3 m, med school −2.8 m).
- **`financial.ts` (Desert Mesa):** spawn at (−18, −8). The main road runs north-east along a raised spine across the canyon.
  - The drive-thru hall is mini-market walls scaled 1.6 (4 m tall) around an 8 m lane, on a planar pad. Its floor is at 5.5 m.
  - Ramp pads every 2 m climb from 6.3 m to 8.3 m onto the planar mesa top at 8.6 m, where the finance tower and the fullstack stop stand. The cliffs drop about 4 m to the canyon floor.
  - Giant food lines the road, and the windmill, water tower, solar, industrial yard and canyon jumps are kept.
- **`opensource.ts` (Alien Crater):** spawn at (20, −6) facing south-west into the crater, with road lanes NW 321° and NE 39°.
  - The lab is modular-space-kit at scale 2: entry gate → corridor → octagonal room → north door → corner → exit gate, plus a laser gate on the room's west door.
  - It now uses `room-small` (a 24 m octagon) on a planar pad. `room-large` is 40 m across, too big for a 40 m town. The corridor pads are levelled to the room plane's height at its doors.
  - Shells have `collider: "none"`, and walls get colliders from `template-wall` slabs tucked 0.1 m behind the shells' inner faces.
  - The crater bowl, rocket and OpenMined glass hangar are kept.
- **Tests (`healthcare`, `financial`, `opensource`):**
  - Both road lanes are clear from the spawn.
  - Markers and interiors are reachable from the spawn.
  - Landmark checks: the Afya tower and the finance tower are the tallest buildings.
  - Financial: the road to the tower is drivable, the ramp climbs steadily and the mesa stands above the canyon.
  - Opensource: the lab drive-through order and its pad levels.

### S2.3: Game Dev Park + Badlands for the small planet (agent C, 2026-10-18)
- **`gamedev.ts`:** 131 placements, footprints ≤ 39.5 m. Spawn at (20, 0) facing south, on the plaza north of the gate.
  - **Arcade hall:** shrunk to 18×18 m on a planar pad; you now drive through it west → east.
  - **Dungeon:** on a raised planar pad, driven through north → south.
  - **Launch pad:** on a planar pad.
  - **Coaster:** trimmed to the loop plus 2 station pieces.
  - **Graveyard trail and lighthouse:** shortened.
  - **Cove:** a single beached ship.
  - All 5 game markers are kept.
- **`badlands.ts`:** 35 placements, ≤ 39.4 m. Spawn at (16, 0) on the north apron, facing down the kicker line. The jumps, ridge, whoops, bowl, crater, wrecks and crates are compressed into the south two-thirds.
- **`c/check.ts`:** new `laneHits` (road lanes) and `unreachable` (flood fill from the spawn).
- **Tests:** new ones for lanes, reachability and the spawn. New exports `GAMEDEV_SPAWN` and `BADLANDS_SPAWN`.
- **QA watch-list:**
  - the arcade east exit opens just past the 40 m edge;
  - the stage is 0.8 m from the coaster station;
  - the Pong sensor sits 0.2 m outside the hall's west wall.

### S3.1: Roads rebaked for the 8-town loop (coordinator, 2026-10-18)
**Why:** S1 emptied `roads.generated.ts` because the old network ran between v2 spawns. With all 8 towns re-authored, the roads had to be rebaked along the new loop: home → raceway → engineering → badlands → healthcare → gamedev → financial → opensource → home.
- **`web/src/world/planet/roads.generated.ts`:** rebaked with `npm run roads` (`ROADS_WRITE=1 vitest run src/world/planet/roadRoute.gen.test.ts`). It has 8 links, about 790 m of road in total:

  | Link | Length |
  |---|---|
  | home → raceway | ≈ 94 m |
  | raceway → engineering | ≈ 104 m |
  | engineering → badlands | ≈ 124 m |
  | badlands → healthcare | ≈ 110 m |
  | healthcare → gamedev | ≈ 90 m |
  | gamedev → financial | ≈ 76 m |
  | financial → opensource | ≈ 94 m |
  | opensource → home | ≈ 98 m |

  The two v2 spur links (raceway → badlands, engineering → healthcare) are gone.
- **`web/src/world/planet/roadRoute.ts`, `resample()`:**
  - **Before:** the final point was merged into the previous sample only when the leftover tail stub was under 0.5 m.
  - **Now:** it merges any stub shorter than `0.6 × ROAD_STEP` (1.2 m).
  - **Why:** at the end of the healthcare → gamedev road, a 0.57 m stub met a 15° turn. The inner edge offset at a turn is about turn × half-width = 0.26 rad × 3.2 m ≈ 0.84 m, which is more than the stub length. That folded the ribbon's inner edge back on itself, flipped a face normal, and failed the `roadGeometry` "faces outward" test.
- **`web/src/world/planet/roads.ts`:** the `ROAD_LINKS` loop was set in S1. Its doc comment now describes the antiprism zigzag.
- **Checks:** `roads.test.ts` (links baked, network connected, ends near spawns, clearance, bed grade, bed maths) and `roadGeometry.test.ts` (ribbon faces outward, signs clear and upright) both pass.

### S3.2: Camera, fog, labels and streaming for the 90 m planet
**Why:** the old values assumed R = 150. The intro showed only part of the planet, and fog washed out its edge.
- **Intro orbit (`web/src/world/camera/cameraMath.ts`, `FollowCamera.tsx`):**
  - The camera now circles the spawn's up axis and looks at the planet centre. `CAMERA.orbitRadius` and `orbitHeight` are replaced by `orbitTilt` (0.25 rad) and `orbitFrame` (1.2 × `PLANET_RADIUS`).
  - New `orbitDistance(fovDeg, aspect)` = R × orbitFrame / sin(min half-FOV): about 234 m on landscape screens and about 460 m on portrait, so the whole globe fits on any screen.
  - `orbitPosition(up, angle, distance, out)`.
  - `cameraMath.test.ts`: the orbit test is rewritten, and a new test checks the globe fits at 16:9, 1:1 and 9:19.5.
- **Fog (`web/src/world/psx/config.ts`, `scene/Sky.tsx`):**
  - Fog ranges are now multiples of the follow camera's ground horizon, `horizonDistance(4.5)` ≈ 28.8 m. They reproduce the old values exactly at R = 150.
  - PSX: 60/180 → about 46/138. Smooth: 90/320 → about 69/248.
  - New `fogLift(cameraRadius)` pushes the fog out with altitude: zero while driving, out to about the planet's edge in the intro. `SkyRig` adds it every frame.
  - Tests: `psx/config.test.ts`.
- **Labels (`web/src/world/zones/Zones.tsx`):** `LABEL_HIDE_FAR` 160 → `PLANET_RADIUS`, `LABEL_GROW_FROM` 60 → `0.4 × PLANET_RADIUS`. Both are exported; `labelScale.test.ts` is rewritten against them.
- **Streaming (`web/src/world/town/Town.tsx`):** `STREAM_LOAD_DEG` 70 → 85, `STREAM_UNLOAD_DEG` 90 → 105. A tall building clears the horizon up to about 50° away on the small planet, and the intro globe shows about 81° around the spawn.
- **Left alone:** the far plane stays at 1000, and `SIGN_HIDE_FAR` stays at 110. Shadows, marker FX and the follow camera measure from the car, so they are unchanged.

### S3.3–S3.4 and S4: Full QA, feedback round, docs, commit (in progress)
**Status (2026-10-18, evening):**
- **Done:** S4.1–S4.5 and the S4.6 declutter (see the J1.1, J1.2, Declutter and Visual pass sections below).
- **In progress:**
  - S4.6/S4.7, the QA fixes plus a unified, connected road look;
  - S4.8, the floating-structures audit.
- **Then:** final screenshot QA, full check and commit.
- See `small-planet-plan.md` Phase S4.
- **Fix: healthcare hall approach** (`web/src/world/layout/planet/healthcare.ts`):
  - `healthcare.test.ts` "reachable from the spawn" failed after the S3.1 rebake: maxGrade 0.499, against a limit of 0.35.
  - **Cause:** the planar hall pad's blend ring pulls toward its tangent plane, which sits about d²/2R (1.2–2.2 m) above the sphere 15–20 m out. That leaves a raised rim outside the south door. Between that ring and the spawn pad's ring the route crossed unpadded natural ground, a knoll near (−17, 12), and the healthcare→gamedev road-bed feather steepened it further. The result was steps of 0.46 per metre into the rim.
  - Widening `ROAD_BED_FEATHER` to 6 didn't help (0.458) and broke a ribbon test, so it was reverted.
  - **Fix:** a connector pad `s.pad(-16, 14, 5, { blend: 6, height: -0.4 })`, about −3.1 m, the spawn's level. It is listed before the planar pads, so the hall core still wins. The approach is now one steady climb of about 0.15–0.18 grade. The test is unchanged, and the pad reaches about 32 m, within the 46 m budget.
  - Roads were rebaked afterwards (a small diff near healthcare).
- **S3.3 checks:**
  - `npm run typecheck` and `npm run lint` are clean.
  - `npm run build` passes: 12 static pages, including 7 district pages (badlands has no district by design).
  - `npx vitest run` passes: 473 tests, plus 2 timing-sensitive tests (`roads.test.ts`, `terrainMesh.test.ts` "builds within budget") that failed only while the build loaded the machine and pass when re-run alone (14/14).
  - Screenshot QA, first pass (on the pre-declutter tree) found:
    1. a healthcare hump: the planar pad rim rises by about d²/2R, a 1.4 m crest, and the car goes airborne;
    2. folded road ribbons at the badlands hub;
    3. two signs intersecting at the raceway, plus sign title overlap and flicker;
    4. a step where the engineering road meets the avenue;
    5. ribbon kerbs overlapping town tiles at raceway and home;
    6. the gamedev back-view camera ending up inside geometry;
    7. possibly a floating road behind the financial spawn.
    A fix pass is in progress.

### Declutter: more room to drive (2026-10-18)
**Why:** user feedback on 2026-10-18: there were too many crates, the assets were too crowded, and it was hard to drive between them.
- **Small props cut per town** (crates, barrels, cones, fences, debris, tyres and the like): home 19 → 8, raceway 25 → 7, engineering 16 → 4, healthcare 21 → 7, financial 13 → 3, opensource 10 → 1, gamedev 27 → 9, badlands 19 → 8.
- **Secondary buildings dropped or spread out:**
  - engineering lost 6 fillers;
  - home lost a house and a hall;
  - healthcare lost building-d, and its Afya tower moved 7 m clear of the hall;
  - the opensource OpenMined HQ moved to (0, −31).
- **Interiors and lanes widened:**
  - raceway pit garage scaled 1.5 → 2 (7 m bays), with its spawn moved to e −16;
  - gamedev arcade doors 6 → about 9 m, dungeon doors 4.5 → about 7 m;
  - engineering loading dock is 9.4 m between walls.
- **Rule:** every route from the spawn to each marker and through each interior is at least 7 m clear. Narrower gaps are either 7 m or more, or under 2.5 m so the car can't try them. Measured with a 0.5 m grid search over colliders.
- **Remaining exceptions:** the opensource lab's modular-kit gates (4.8 m) and corridors (6.4 m), which would need the whole lab rescaled, and dead-end machine pockets inside interiors.
- **Tests:**
  - `raceway.test.ts`: the garage geometry follows its new scale.
  - `healthcare.test.ts`: the plaza route ends at the marker's new spot.
  - `financial.test.ts`: the food-kit count is now 8 or more (it was a clutter count).
  - No reachability, grade or lane test was weakened.
- **Files:** the 8 layout files under `web/src/world/layout/planet/`; roads rebaked (`roads.generated.ts`).

### Visual pass: red car, no PSX, GTA-style markers (2026-10-18)
**Why:** user feedback on 2026-10-18: "Make the vehicle red", "Remove the PSX visual", and make the experience circles "red and with a glow like the circles in GTA San Andreas".
- **Red car** (new `web/src/world/vehicle/paint.ts` + `paint.test.ts`, `VehicleModel.tsx`):
  - The player car is `car-kit/suv` (`VEHICLE_REF`), and car-kit models share one palette texture.
  - The player car gets its own copy of that palette with the paint region (UV u 0.4375–0.5, v 0.25–0.5) recoloured to #c8102e, keeping the original shading.
  - The roof and cabin part of the grey column (v 0.5–0.625) is painted too, so the chase camera sees a red car rather than a grey one with a red stripe.
  - Bumpers, arches, windows, tyres and lamps keep their colours, and every other car-kit model keeps the shared material.
  - The painted material is disposed on unmount, and the car falls back to the shared one if it can't be built.
- **PSX removed completely:**
  - Deleted `web/src/world/psx/`, tests included.
  - The fog maths moved to new `web/src/world/scene/fog.ts` (`FOG_RANGE` uses the old smooth values, plus `fogLift` and `horizonDistance`), with its tests in `fog.test.ts`.
  - The PSX toggle is gone from `HudControls.tsx`; Lite stays.
  - `Experience.tsx`, `Lighting.tsx` and `Sky.tsx` now depend on quality alone.
  - The labels in `Zones.tsx` and `Roads.tsx` moved to the default render layer, so they still show.
  - Leftovers removed from `ModelGroupView.tsx`, `carLights.ts` and `skidMarks.ts`.
  - The store's `psx` field and `setPsx` are gone, along with the audio `psxOn`/`psxOff` cues (`audioDirector.ts`, `uiSfx.ts`).
- **GTA San Andreas markers** (new `web/src/world/zones/markerFx.ts`, `Zones.tsx`, `fx/juiceRules.ts` `MARKER_FX`):
  - A red light tube 3.4 m tall that fades upward, with faint rising bands.
  - A bright ground ring with a whiter core and a soft outer glow.
  - A halo at the base that always faces the camera.
  - Geometry and materials are shared by every marker. Brightness differs at rest, near the car and when active (0.85 / 1.25 / 1.6), and all markers share one pulse.
  - The tube and disc use normal alpha blending, because additive blending went yellow over the green ground; only the halo is additive.
  - No bloom or postprocessing was added.
  - The trigger, radius, label and "Press E" prompt are unchanged, and reduced motion freezes the animation.

### S4.6 and S4.7: QA fixes and one connected road style (2026-10-18)
**Why:** the first screenshot QA pass found 7 issues. The user then asked: "for all roads use the same tile, and make it correctly connected."
- **Healthcare hump (`web/src/world/planet/terrain.ts`):**
  - `applyPads` now holds a planar pad's blend-ring target at the rim height (`cosRim` on `PreparedPad`). Before, the tangent plane kept rising by d²/2R across the ring, growing a raised rim. The plane is now exact out to the pad radius.
  - Ring overshoot: healthcare hall 0.47 → 0.16 m, gamedev 0.43 → 0.20 m, home 0.09 → 0.05 m. The biggest left are the engineering dock (0.72 m) and the healthcare med school (0.77 m).
  - The healthcare connector pad went from −0.4 to −0.8 for the hall's new radius (16.5). The crest above the straight line from spawn to hall rim is 0.24 m.
  - The car now lifts off at about 44–50 km/h (it was 41–43). A 46 km/h run still hopped about 1.4 m at the rim; softening it further needs a wider blend than the 46 m pad budget allows.
- **One road look** (`web/src/world/roads/roadGeometry.ts`, `Roads.tsx`):
  - `buildRoadRibbon` builds the Kenney road tile's real cross-section: raised sidewalks, kerbs, dark gutters, two lanes and a centre line, at the tiles' 8 m × 1.02 scale.
  - UVs point at the swatches of `/models/city-roads/colormap.webp`, and `Roads.tsx` renders the ribbon with the same `paletteMaterial` as the tiles, plus a polygon offset. The old canvas asphalt texture is gone.
  - Chosen over replacing the towns' tile rows with ribbon, which would have needed loop corners and crossroads.
- **Flush joins:**
  - New `RoadPort` (`planet/types.ts`) and `roadPorts` on `BiomeLayout`, with `planet/roadPorts.ts`. Each road ends on a town's tile edge.
  - New `layout/planet/roadHubs.ts`, merged by `layout/planet/index.ts`. Home, engineering and raceway use their own tiles; badlands, healthcare, gamedev, financial and opensource get a crossroad on a small level patch.
  - `roadRoute.ts` starts each road on its port edge, runs straight for 8 m, then turns onto its route.
  - New `FlatPad.onGround` makes a pad's height relative to the ground the earlier pads left.
  - All 8 roads were rebaked.
- **Fixes by issue:**
  - **Badlands hub:** crossroad hub; turn radius at least 5.9 m out of every port (it was 1.0–2.4 m); `buildRoadRibbon` drops any row whose outer edge steps backwards, pinned by a test.
  - **Signs:** `SIGN_SPACING` keeps boards at least 8 m apart, with the test "keeps every two boards apart". Sign titles no longer wrap: the font shrinks so the longest name fits on one line. A `depthOffset` on the text and z 0.11 for the text faces are meant to stop the grey half-triangle on distant signs. That part is not verified in a screenshot.
  - **Engineering:** a `road-intersection` T tile at the avenue's south end. The road bed is pinned to the tile's ground along the 8 m lead, and a test checks the ribbon's end row matches the tile edge within 5 mm.
  - **Raceway and home:** T junctions at home's south loop corners and a crossroad hub north of the raceway start straight. A test checks that no ribbon row lies on a street tile or another ribbon.
  - **Gamedev camera:** already gone after the declutter, so `FollowCamera.tsx` is unchanged.
  - **Financial:** a crossroad hub at (−24, −11), lowered 0.9 m to the spawn's level; the spawn pad height went from 7.46 to 6.65 m, with upDot 0.998.
- **Road tiles grounded:**
  - Standard 8 m tiles sink 6 cm (`TILE_SINK` in `layout/planet/index.ts`). Gaps dropped from 0.17–0.26 m to at most 0.16 m on level ground and about 0.2 m on slopes. In `grounded.test.ts`, road tiles are a bounded entry (tolerance 0.22 m) instead of exempt.
  - The 16 m raceway `roadStart` piece (0.97 m gap) was replaced by two `roadStraight` tiles plus the `racing-kit/overhead` gantry (`collider: "none"`).
  - Per-tile planar pads were tried and dropped: their raised rims pushed neighbouring pieces out of tolerance.
- **Planar-site edges:** the rim is a hard clamp. The opensource lab bound tightened from 0.6 to 0.56 m; the worst residual is 0.55 m at `template-wall-half`, in the blend ring.
- **Tests:** `roads.test.ts` now checks road ends sit on their port edges, square to them; the in-town lead and turn use `PORT_CLEARANCE` (4.68 m centre-line gap). `roadGeometry.test.ts` and `grounded.test.ts` were extended as above.
- **Results:** typecheck and lint clean, 480 tests pass, and the build passes.

### Final QA and the dusk pattern (2026-10-19)
- **Screenshot QA on the settled tree:** all 8 towns (spawn, looking back, road exit and arrival), the badlands and gamedev crossroads, 6 of the 8 mid-road stretches, and the interiors (dock, pit garage, factory hall, drive-thru hall, space lab, arcade, dungeon). No blockers: the car is red everywhere, the markers are red light columns, roads read as one style with flush kerbs, sign titles fit on one line, and nothing floats.
- **Dusk pattern (fixed):**
  - Cause: the film grain in `scene/CozyPass.tsx`, not shadows or fog (Lite, with shadows off, looked the same; removing the grain made it clean).
  - The classic `fract(sin(dot(p, …)))` hash, fed pixel coordinates in the thousands, produces a structured diagonal lattice instead of noise, and the grain is weighted by `(1.3 − luminance)`, about 3× stronger on dark pixels, so dusk and night showed it.
  - Fix: the Hoskins hash (no `sin`), and the time term wrapped with `mod(…, 64.0)`. Noise checked as uniform in a test render. Swiftshader's `sin()` precision probably exaggerated the pattern in the harness, but the old hash was structurally poor on any GPU.
- **Healthcare approach at about 30 km/h:** the car stays on the ground (`wheelsInContact` never below 2) but tips about 25–28° over the crest near the south door.
- **Follow-ups, not blockers (plan S4.12):**
  - Alien Crater lab east exit: steep slope, upDot 0.67 at 20 km/h.
  - The same crest at healthcare.
  - Desert Mesa hub stub reads as a floating slab.
  - Steep exit slopes at the financial hall, arcade and dungeon.
  - Gamedev spawn-back camera right behind a boulder.

### S4.11: Mobile (2026-10-19)
**Why:** user request on 2026-10-19: "make it possible to be seen and played in mobile". Tested with emulated phones (iPhone 390×844 portrait and 844×390 landscape, Android 360×740, tablet 768×1024) using touch events and a 4× CPU throttle. Screenshots are in the session scratchpad under `mobile/shots/`.
- **Page basics:** `layout.tsx` exports `viewport.themeColor`; the home and district pages add `maximumScale: 1` and `userScalable: false` (not `/plain/`, which stays pinch-zoomable). `AppShell.module.css`: `height: 100dvh`, `overscroll-behavior: none`, `touch-action: manipulation` (`none` on the canvas wrapper), and no selection, callout or tap highlight. iOS Safari ignores `user-scalable`, so `touch-action: none` on the canvas and controls is the real protection there.
- **Layout:**
  - Under `max-width: 640px` or `max-height: 500px` the brand is a compact pill (name plus a 44 px icon-only CV button).
  - The speedometer is compact, above the right buttons in portrait and bottom-centre in landscape.
  - Interact (76 px) and brake (80 px) are bigger; Interact shows a hand icon with "OPEN", dimmed until a zone is active and then lit and pulsing.
  - The close button is 44 px (48 px on coarse pointers); cards use `touch-action: pan-y` and `overscroll-behavior: contain`; the GPS list scrolls.
  - Nothing overlaps the stick or buttons, and there is no horizontal scroll. Desktop is unchanged.
- **Controls (`TouchControls.tsx`):** window `blur`, `pagehide` and `visibilitychange` release all input and re-centre the knob; `preventDefault` on pointerdown; the context menu is blocked on the control strip. Verified with synthesised multi-touch: stick up gives throttle 0.88 at about 18.5 m/s, stick right gives steer 0.8, a second finger on the brake keeps the steer, and releasing everything zeroes all inputs.
- **Performance:**
  - New `world/lib/mobileQuality.ts` (+ test): `initialQuality` and `pickDpr`. `Overlay.tsx` starts coarse pointers and screens up to 820 px on Lite. `Experience.tsx` takes `dpr` from `pickDpr` (touch: 1.5 on Lite, 2 on HQ, with a pixel budget of 0.8 M Lite and 1.3 M HQ), and the canvas uses `antialias: false` because the scene renders into the cozy target, which has its own MSAA (4 samples on HQ, 0 on Lite).
  - A 390×844@3x phone canvas went from 780×1688 to 585×1266.
  - Under a 4× throttle with software GL, intro and driving averaged about 32 ms and 25 ms on Lite. That is swiftshader-capped, not a true before/after.
  - New `ContextLost` panel ("The 3D view paused", with Plain view and Reload) for `webglcontextlost`; the no-WebGL panel was checked on a phone.
- **Audio:** `audioRuntime.ts` `GESTURES` now also lists `pointerup`, `touchend` and `click`, because iOS only counts those as user activation. The tractor sample is not requested before the first tap.
- **Intro:** new `TapToDrive` button ("Tap to drive / then drag the stick to steer") on coarse pointers during the intro. The globe is fully framed in portrait at 360 and 390 px and in landscape.
- **Plain view:** `.hero`, `.section` and `.footer` used `padding: … 0`, which overrode `.container`'s gutter and left the text flush to the screen edge on phones; they now use `padding-block`.
- **Icon:** a new `app/apple-icon.png` (180×180, a crop of the og-image scene). The agent's first version showed a half-cut name and caption, so I replaced it with a clean crop around the car.
- **Results:** typecheck, lint and build clean; 487 tests pass.
- **Not verifiable without a real device:** iOS Safari's URL bar and `100dvh` behaviour, notch insets, the real iOS audio unlock, GPU frame times and thermal throttling, Android long-press, and the Interact button lighting up inside a real marker end to end. The production first load is about 194 KB gzipped of JS, with the world and the biome models loading after the first paint; no slow-network run was done.

### S4.8: Grounded structures (2026-10-18)
**Why:** user feedback on 2026-10-18: "some structures are not touching the ground."
- **New permanent audit, `web/src/world/layout/planet/grounded.test.ts`:**
  - **Contact points:** each model's real contact points come from its optimized .glb (gltf-transform plus the meshopt decoder): the vertices within 0.08 m of its lowest vertex, at kit scale. Bounding-box corners would flag every tree canopy.
  - **Comparison:** each point is posed like the instance (`placementPose`) and compared with `meshHeightXYZ`.
  - **Floating:** a point more than 0.15 m above the ground, unless it rests on another placement's top.
  - **Sunk:** the highest contact point more than min(1 m, half the model's height) underground.
  - Dynamic bodies skip the float check because they settle under gravity.
  - `AUDIT_OUT=<prefix>` writes a per-town TSV report.
  - **Allowlist:** awnings (they hang from the facade), road tiles (pending S4.7), and the opensource lab, bounded at 0.6 m because of the planar-rim residual.
- **Fixes, worst gaps in metres:**
  - **Home:** core pad 33 → 37.5 m; house 0.36 and building-f 1.02 lowered; the awning, which floated 1.5 m in front of the hall, moved onto the facade.
  - **Engineering:** skyscraper-a (2.81, half off the plateau) moved to (−6, −27); water tower 0.92 moved; dock container stack lowered.
  - **Raceway:** racing-kit origins sit at tile corners 5–7 m away, so the pieces took that corner's height. Fixed with per-barrier `BARRIER_Y` and pit `PIT_Y` −0.5; stands, towers and flags sunk.
  - **Gamedev:**
    - park gate 1.25 lowered;
    - coaster station 0.49, train 0.55 and stage deck: the stage pad now sits under the deck;
    - hall pad r 16.5, dungeon pad r 17, launch pad +0.5.
  - **Healthcare:**
    - antenna relay (3.22) moved onto the med-school roof;
    - clinic pad 6 → 7.5;
    - hall pad 14.5 → 16.5, blend 7.
  - **Opensource:**
    - lab room 2.08: room pad 13.5 → 15.5, blend 9;
    - rocket (1.26) and small hangar (3.21) get their own pads;
    - HQ pad 9.5.
  - **Financial:** hall pad 13 → 15; four level yard pads for the water tower (3.49), tank, windmill and solar; food props moved to level patches.
  - **Badlands:** wreck and stones (2.2–2.5) moved to the bowl and crater floors; rocks and trunks moved or sunk.
- **Results:** roads rebaked; 74 files and 492 tests pass; typecheck clean.
- **Handed on:**
  - road-tile gaps (raceway `roadStart` 0.97 m is the worst) go to S4.7;
  - the planar-rim residual and the hall/spawn pad changes at healthcare and financial go to S4.6 to re-check.

## SFX & game juice (plan: `ai-docs/plans/sfx-juice-plan.md`)

### J0: Contracts (2026-10-18, coordinator)
- **New `web/src/world/events/gameEvents.ts`:** a typed event bus (`onGameEvent`, `emitGameEvent`) with crash, bump, takeoff, landing, reset and teleport events. Listener errors are isolated.
- **`web/src/world/vehicle/controller.ts`:** `StepEvents` gains `landingAirTime`, `crashSpeedLost`, `crashStrength` and `takeoff` (airborne for 0.25 s).
- **`web/src/world/vehicle/Vehicle.tsx`:**
  - Emits landing, takeoff and crash after each physics step, bump from contact-force events (flagging whether the other body is a loose prop), and reset/teleport.
  - Publishes `throttle`, `steer` and `handbrake` to `vehicleState`.
- **`web/src/world/vehicle/vehicleState.ts`:** new `throttle`, `steer` and `handbrake` fields.
- **`web/src/world/controls.ts`:** new `horn` control (KeyH).
- **Mount points:**
  - New `web/src/world/audio/AudioSystem.tsx` and `web/src/world/fx/Juice.tsx`, mounted in `Experience.tsx` once the world is ready.
  - New `web/src/ui/JuiceHud.tsx`, mounted in `Overlay.tsx`.
- **Agents launched:** audio (Web Audio synthesis), world juice and HUD juice.

### J3: HUD juice (agent 3, 2026-10-18)
- **New `web/src/ui/juice/`:**
  - `flip.ts`: flip tracker, relative to the ground, as the car moves around the planet.
  - `popups.ts`: popup rules.
  - `speed.ts`: speed formatting.
  - `discovery.ts`, `motion.ts`
  - Components: `Speedometer`, `TrickPopups`, `DistrictToast`, `JuiceLayer`.
  - `JuiceHud.module.css`, plus tests.
- **Speedometer:** bottom right, only while driving. A rAF loop writes to the DOM (no React re-renders); it shows a gear chip, km/h digits and a 12-segment bar.
- **Trick popups** (from `landing`/`crash` events):
  - flips, barrel rolls and 360s, with DOUBLE/TRIPLE prefixes;
  - BIG AIR, NICE LANDING;
  - CRASH!, with a 1.5 s cooldown.
- **District discovered stamp:** shows a count out of 7 and is announced in an aria-live region.
- **Polish:**
  - InfoCard spring in, with a 150 ms out animation (new `Modal` `closing` prop, which also makes the modal `inert`).
  - GPS spring and stagger, and the chosen destination blinks for 330 ms before the jump.
  - "Press E" prompt bounce.
  - Press feedback on buttons.
- **Reduced motion:** popups and the stamp switch to an opacity fade (via the Web Animations API).
- **Checks:** `src/ui` 53 tests pass; tsc and eslint clean.

### J2: World juice (agent 2, 2026-10-18)
- **New in `web/src/world/fx/`:**
  - `fxPool.ts`: instanced particle pool with radial acceleration, drag and puff/chip/streak shapes.
  - `fxSystem.ts`: impact sparks, prop chips, landing dust ring, exhaust puffs, backfire flames (using the audio agent's `stepBackfire`), speed lines (above 70% of top speed) and confetti when a card opens.
  - `skidMarks.ts`: a ring buffer of 640 quads that fade in the shader. Drawn where wheel slip ≥ 0.32, on local up.
  - `bodyMotion.ts`: lean and pitch springs, plus landing squash. Applied only to the glTF `body` node.
  - `carLights.ts`: brake, reverse and head lamps in one additive mesh. Headlights follow `skyState.night`; the SpotLight only exists on HQ.
  - `juiceRules.ts`: the pure rules.
  - Tests for all of the above.
- **`web/src/world/vehicle/VehicleModel.tsx`:** body motion and lamps.
- **`web/src/world/zones/Zones.tsx`:** the ring brightens and pulses within 32–4 m, and the label pops when its zone becomes active.
- **`web/src/world/camera/shake.ts` and `FollowCamera.tsx`:** a spring FOV punch (+5° on landing, −4° on a crash, capped at ±7°).
- **Totals:** +3 draw calls, with no allocation per frame. Reduced motion turns off speed lines, the punch, confetti, squash and the pulse/pop, and halves the lean.
- **Checks:** fx, camera, zones and vehicle: 113 tests pass; tsc and eslint clean.
- **QA watch-list:**
  - lamp and exhaust positions (estimated from the bounding box);
  - spot brightness at night;
  - how the speed lines look at 360p;
  - the one-time recompile when quality is toggled.

### J1: Audio (agent 1, 2026-10-18)
- **All synthesised with Web Audio:** no files and no new dependencies.
- **New in `web/src/world/audio/`:**
  - Shell and wiring: `AudioSystem.tsx`, `audioDirector.ts`.
  - `audioRuntime.ts`: one context unlocked on the first gesture; car, ambience and UI buses into a compressor and master gain; suspended when muted or the tab is hidden; buses lowered while a card or the GPS is open.
  - Pure logic: `engineModel.ts`, `backfire.ts`, `mapping.ts`, `ambiencePresets.ts`, `voices.ts`, `envelope.ts`, `mutePref.ts`.
  - Sound builders: `synth.ts`, `sfx.ts`, `carSounds.ts`, `ambience.ts`, `uiSfx.ts`.
  - Tests: 55 pass.
- **Sounds:**
  - **Engine:** a starter crank on the first run, then an RPM model with five fake gears (upshift drop, downshift blip), clutch slip, wheelspin, free revs and the limiter in the air, and reverse. The idle burble fades as revs rise, and throttle opens the filter.
  - **Car:** tyre squeal (on roads and hard biomes), gravel crunch and scrabble, wind, and suspension rattle and clunks.
  - **Hits:** world hits are a thud plus metal crunch; prop hits a knock. Each gets ±12% pitch, and hits within 120 ms merge.
  - **Moves:** landing thump and creak (hard landings bottom out), takeoff whoosh, reset swoosh, teleport sweep, and a horn on H (up to 3 s).
  - **Backfire pops:** a deterministic detector (no `Math.random`) shared with the world-juice flames. Both sides call it once per frame with `dt = min(raw, 0.1)`.
  - **UI:** card and GPS sounds, the "Press E" pop, a district jingle, PSX and quality toggles (only when clicked), a CV chime, an unmute tone, and button clicks and hovers.
  - **Ambience** per biome, crossfaded: meadow birds, city hum, lake water, desert wind, alien drone, crickets and music box, crowd, hawk.
- **Mute:** now defaults to off (sound on after the first gesture). The choice is saved in localStorage under `portfolio.sound.muted` (`web/src/state/useAppStore.ts`).
- **Performance:** at most 5 one-shot sounds (4 on low) with priority stealing, about 12 voices in total, and no nodes created per frame. Low quality drops some layers.
- **Limits:**
  - The first gesture is usually silent while the context resumes.
  - Squeal uses the road distance under the car body, not each wheel.
  - No horn button on the touch HUD.

### J1.1: Engine sound rework (2026-10-18)
**Why:** the user's feedback on 2026-10-18 was that the motor sound was "not great". The old engine (a saw, a detuned saw, a sub triangle and an AM LFO "burble") sounded like a synth buzz with an LFO wobble, not combustion.
- **New `web/src/world/audio/engineWave.ts` (+ `engineWave.test.ts`):**
  - Builds the Fourier series of one four-stroke cycle: 8 exponentially decaying exhaust pulses (`CYLINDERS = 8`, `ENGINE_HARMONICS = 96`).
  - It is played through `OscillatorNode.setPeriodicWave` at the cycle rate, rpm / 120.
  - **`lumpyWave()`:** uneven cylinder strengths put energy at orders 1, 2 and 4. That gives the idle lope, the "potato" half-order.
  - **`smoothWave()`:** equal pulses, so energy appears only at the firing orders.
  - `harmonicLevel()` is there for the tests.
- **`web/src/world/audio/carSounds.ts`:**
  - Replaced the saw, detuned saw, sub triangle and AM LFO burble with a crossfade between the lumpy and smooth waves.
  - Combustion noise is gated by the pulse wave.
  - Fixed resonances shape the sound: a body peak at 115 Hz and a pipe peak at 480 Hz.
  - Makeup gains are 2.4 (lumpy) and 1.6 (smooth), because the pulse waves have lower RMS than a saw.
- **`web/src/world/audio/mapping.ts`:**
  - `burble` is now the 0..1 crossfade toward the lumpy wave: `lumpIdle` 1 at idle down to `lumpHigh` 0.2 at high revs, and slightly lower under load.
  - `burbleRate` (the old LFO rate) was removed.
- **Tuning from offline renders** (`node-web-audio-api`, the real `CarSounds` graph driven by `stepEngine`):
  - **DC block:** a 25 Hz high-pass right after the shaper in `carSounds.ts`. The lopsided pulses through tanh left a DC offset that swung with load, up to −0.10 (19% of peak) at full throttle; with the high-pass it is about 0.
  - **Idle level:** `ENGINE_SOUND.cutoffIdle` 210 → 400 in `mapping.ts`. Idle sat below 100 Hz (spectral centroid 96 Hz) and was near-silent on laptop speakers; this makes it about 2.6 dB louder perceptually with no change at full load.
  - **Limiter chatter:** `ENGINE.limiterDrop` 420 → 250 in `engineModel.ts`. The bounce was about 4.6 Hz, which sounded lazy; real limiters chatter faster.
  - **Checks:** no clipping (peaks about −5 dBFS), no aliasing (energy above 8 kHz is 52 dB or more below the total), and no clicks at gear changes or limiter cuts.

### J1.2: Deeper engine (2026-10-18)
**Why:** user feedback on 2026-10-18: "the motor sound is awful, get a more deep [one]".
- **Lower rev range (`engineModel.ts`):** a big, slow-revving V8.
  - Idle 850 → 750 rpm, upshift 5500 → 4500, downshift 2300 → 1900.
  - Limiter 6000 → 4900, redline 6400 → 5200.
  - Launch slip 1900 → 1600, wheelspin 1400 → 1100.
  - The firing tone now tops out around 330 Hz instead of 400.
- **Lower resonances (`carSounds.ts`):**
  - Body peak 115 Hz/+6 dB → 85 Hz/+8 dB; pipe peak 480 Hz/+4 dB → 230 Hz/+5 dB.
  - Rasp band 1600 → 700 Hz, now tracking `500 + 1.2 × firing`.
  - `IDLE_CYCLE_HZ` set to 6.25 to match the new idle.
- **Darker filter (`mapping.ts`):** `cutoffRpm` 950 → 600, `cutoffLoad` 2100 → 1300, `raspLoad` 0.16 → 0.08, and `lumpHigh` 0.2 → 0.4, which keeps the V8 half-order rumble at high revs.
- **More half-order (`engineWave.ts`):** the bank imbalance (order 4) goes from 0.22 to 0.3.
- **Backfire threshold (`backfire.ts`):** `BACKFIRE.minRpm` is now derived as `ENGINE.shiftUpRpm − 1200` (it was a fixed 4300) so it follows the new rev range.
- **Tests:** the burble test now expects < 0.5 at 5000 rpm.
- **Offline render, before → after:**

  | Scenario | Spectral centroid | Energy above 5 kHz |
  |---|---|---|
  | idle | 107 → 92 Hz | |
  | rev | 207 → 158 Hz | |
  | pull | 460 → 314 Hz | −37 → −49 dB |
  | limiter | 518 → 397 Hz | −37 → −50 dB |

  No clipping (peak 0.86).

### J1.3: Tractor engine sample (2026-10-18)
**Why:** user request on 2026-10-18: "change the motor sound to use the ~/Documents/tractor-engine". Replaces the synthesised engine with a real recording, re-pitched by rpm.
- **Asset (`public/audio/tractor-engine-loop.wav`, new):** from `~/Documents/tractor-engine.mp3` (43.8 s stereo 24 kHz). Analysis (wasm mp3 decode in a throwaway Node project — no ffmpeg on the machine): steady idle throughout, firing at 31.6 Hz / crank 15.8 Hz → **~950 rpm**. Cut the steadiest 8 s (from 22.5 s), equal-power 400 ms crossfade for a seamless loop, peak-normalised to −1 dB, mono 16-bit WAV (375 KB, decodes in every browser; fetched lazily on first gesture, not with the page).
- **Engine graph (`carSounds.ts`):** periodic-wave synth (lumpy/smooth waves, tanh shaper, body/pipe resonators, rasp gate) replaced by: looping sample → pre gain → 25 Hz DC block → load-driven low-pass → level. rpm → `playbackRate` compressed to 0.8..2.4× (`RATE_IDLE`/`RATE_MAX`; the limiter ≈ 2300 real tractor rpm). The mapping's cutoffs are scaled ×2.4 (`CUTOFF_SCALE`) for a full-range recording; `e.drive` (1.4..3.2) becomes a 0.8..1.5 pre-gain push.
- **Robustness:** the decoded buffer is cached at module level (`engineBuffer`), so quality-switch rebuilds reuse it without a refetch; the load callback bails if `dispose()` ran first (no orphaned source); fetch failure logs one warning and the engine stays silent.
- **Untouched:** starter → catch → idle flare (rate ≈ 1.35 at the 2100 rpm flare), gears, limiter bounce, backfires, horn, tyre/gravel/wind layers — they all modulate rpm/load, which now drives playback rate.
- **Cleanups:** removed the now-unused `wave()` helper and the `softClipCurve`/`engineWave` imports from `carSounds.ts`; `engineWave.ts` itself stays (its tests still cover it).
- **Checks:** typecheck ✓, eslint on `carSounds.ts` ✓ (`npm run check`'s lint step fails on pre-existing untracked `src/zzqa/*` files, unrelated), 492 tests pass.

### J1.4: Cozy post-processing (2026-10-18)
**Why:** user request on 2026-10-18: "update the post processing to feel a bit more cozy". There was no post-processing at all (`flat` render, look carried by fog + lighting); added a zero-dependency fullscreen grade rather than pulling in `@react-three/postprocessing` (repo stays at 7 runtime deps).
- **New `scene/CozyPass.tsx`:** renders the scene into a `WebGLRenderTarget`, then a fullscreen clip-space triangle applies the grade and draws to the screen. A positive-priority `useFrame` (priority 1) disables r3f auto-render, so the pass owns the frame's two renders; it runs after all priority-0 callbacks, so the scene is fully posed.
- **The grade:** amber shadows (candlelight — darker pixels lean warm), gentle S-curve (0.18 mix), +7% saturation, warm-brown vignette (corners lose blue most, red least — never gray/black), and grain stepped at 8 fps (chunky PSX feel, stronger in shadows, also hides fog-gradient banding). All knobs in one `COZY` const table.
- **Colour-space correctness:** the target texture is `SRGBColorSpace` (encode into the target, hardware decode on sample, grade in linear) and the shader ends with `#include <colorspace_fragment>` (ShaderMaterial doesn't auto-append the output encode) — without these the image gets gamma-applied twice and goes muddy.
- **MSAA:** canvas `antialias` doesn't apply to render targets, so the target carries `samples: 4` on quality high (0 on lite).
- **House style:** the mutable bundle (target/triangle/material/camera) is built in an effect behind a `useRef` and rebuilt on quality switch — the new `react-hooks/immutability` lint rule rejects mutating `useMemo` results in `useFrame`, and refs are the sanctioned pattern.
- **`Experience.tsx`:** `<CozyPass />` mounted inside the Canvas after `<Lighting />`.
- **Checks:** typecheck ✓, eslint on both files ✓, 492 tests pass. `?debug` note: `window.__renderInfo()` now sums two render passes per frame.

### J1.5: CV billboard reface (2026-10-18)
**Why:** user request on 2026-10-18: "remove the Tankco outdoor that is close to the circle to download my cv". Investigation: the ad is an embedded texture (`tankcoBanner.png`, material `tankco`) inside `racing-kit/billboard.glb` — every billboard variant ships the same one, and `public/models` is regenerated by `npm run models`, so patching the GLB is not durable. User chose (over removing the billboard) to keep it and reface it as a CV signpost.
- **`town/materials.ts`:** new `cvBillboardMaterial()` — a module-cached `MeshStandardMaterial` with a 256×128 canvas texture ("DOWNLOAD / MY CV" + down arrow, cream + brick red), configured via `configurePalette` (sRGB, glTF `flipY = false`, nearest filtering, no mipmaps) so it stays chunky PSX and samples the glTF UVs correctly.
- **`town/ModelGroupView.tsx`:** `FlatModel`'s material resolver swaps `tankco` → `cvBillboardMaterial()` only when `group.ref === "racing-kit/billboard"`. The model is placed only at home; the raceway's billboards are different models (`billboardDouble_exclusive`) and keep their Tankco ads, per the user's choice.
- **No layout/asset changes:** `home.ts` untouched; the ad swap survives `npm run models` regens because it is runtime, not asset-level.
- **Checks:** typecheck ✓, eslint on both files ✓, 492 tests pass, dev server serves the page (HTTP 200). Caveat logged for the user: the tankco UV mapping wasn't visually verifiable in-session (no image support) — if the text crops, the canvas layout needs a nudge.

### J1.6: Speed King Canyon rearranged (2026-10-18)
**Why:** user request on 2026-10-18: "the Speed King Canyon is still a bit convoluted, rearrange the assets, make it cohesive, and all the assets must be touching the ground correctly".
- **Zones instead of scatter (`raceway.ts` rewrite, same file structure):**
  - **Paddock:** the camera tower moved from a lone spot in the west infield to the start line's infield grass (with its spotter character), beside the speed-king marker; tent + kart + mechanic stay tight against the pit garage's east wall.
  - **One spectator row (south):** the two grandstands moved from e ±11 to e ±13.5 with the billboard between them and the red/green flags relocated to just past the low wall's ends (n −18.4, e ±9.2) so nothing clips the stands' corners; the third grandstand (awning, ex-(24,16) north-east, near the Downtown lane) was removed; the two south trees + tractor + loose tyre (moved from (−28,22) to beside the tractor) now bookend/maintain the row.
  - **Simplified terrain:** removed the four hairpin berms and the west-hairpin apex roller pads — decorative bumps that forced per-barrier y-tuning. Pads are now floor + pit planar + two kickers; `raceway.test.ts` pads-level test updated to match.
- **Grounding:** the old 11-entry hand-tuned `BARRIER_Y` table is gone. Diagnosis (scratch test, since deleted): heights all agree — the float was **sphere curvature**: barrier models have a Kenney corner origin ~5 m from the footprint centre, so `placeC` anchors the pose's tangent plane well inside the ring and the barrier rides the 90 m planet's curve by a near-uniform ~0.4 m (worst corners 0.40–0.47). One constant `BARRIER_SINK = −0.43` grounds all 11 barriers (residual ±0.05, within tolerances); the ring pulled in from radius 18.5 to 18.
- **Untouched:** track geometry, road tiles, spawn, marker, pit garage cluster and its tests, lanes (checkTown [321, 39]) — the baked roads needed no regen (changes only removed obstacles from the lane strips).
- **Checks:** raceway/grounded/layouts tests ✓, full suite 492 ✓, typecheck ✓, eslint ✓, `next dev` serves HTTP 200.




