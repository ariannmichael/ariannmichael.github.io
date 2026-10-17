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
