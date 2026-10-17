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
