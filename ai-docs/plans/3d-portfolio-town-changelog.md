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
