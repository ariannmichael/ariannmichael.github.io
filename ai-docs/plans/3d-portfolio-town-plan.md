# 3D Portfolio Town — Implementation Plan

**Owner:** Ariann Michael  **Created:** 2026-10-17  **Revised:** 2026-10-17 (switched from Synty to Kenney CC0 assets)  **Status:** Not started
**Hard milestone:** Milestone 1 live by **2026-11-07**, ready for the Speed King Steam launch (**2026-11-10**)
**Working mode:** Mentor Mode. Claude gives the code and explains it line by line, and Ariann types it in. Claude may write docs (this plan, changelog, investigations).

---

## Objective

Replace the current static portfolio at `ariannmichael.github.io` with a **browser-based 3D driving portfolio**: a small low-poly town built from **Kenney (CC0) assets** that visitors explore in a vehicle. Each **district represents a kind of work**:

- Engineering District (software jobs)
- Healthcare District
- Financial District
- Open Source Lab
- Game Dev Park (itch.io games)
- Speed King Raceway (Steam game)

The site must also give recruiters a **fast, accessible, non-3D path** to the CV (plain view, GPS teleport, CV download in the overlay).

---

## TL;DR

1. **Stack:** **Next.js (App Router, static export `output: 'export'`)** + React + TypeScript, `three` + `@react-three/fiber` + `@react-three/drei` + `@react-three/rapier` (physics) + `zustand` (state). Deployed as a static site to GitHub Pages via GitHub Actions. Next pre-renders `/plain` and `/district/[id]` as real HTML pages (good for SEO and link previews), and the 3D canvas is a client-only component. English only. GoatCounter analytics. The site name is **"Ariann Michael"**.
2. **Assets:** **Kenney kits only (CC0, so no licence restrictions).** They live in `~/Documents/Personal/Kenney`, ship as GLB, and each kit uses one 512 px `colormap.png` palette. Districts are laid out in **Godot 4.7** (used only as a level editor), exported to `.glb`, optimized with **gltf-transform** (meshopt + WebP), and loaded in R3F.
3. **Scene contract:** static geometry goes in district `.glb` files. Godot empties named `MARKER_*` mark interaction points, and invisible boxes named `COL_*` become physics colliders. Interactive props (screens, vehicle, Pong puck) are separate small `.glb` files placed at markers.
4. **Content is data:** a single typed `src/content/` module (jobs, games, skills, links) feeds both the 3D world and the accessible **Plain View**. Plain View ships first as a safety net.
5. **Vehicle:** an arcade "sphere kart". A Rapier ball rolls on the ground and the visible vehicle follows it and steers. The model is the Kenney Car Kit **`sedan-sports`**. Experience data comes from **LinkedIn** (the source of truth), and the site deploys to the existing **`ariannmichael.github.io`** repo.
6. **Milestone 1 (by 2026-11-07):** Plain View, Home/Campus, Engineering District, Speed King Raceway (Kenney Racing Kit, the same kit Speed King uses), Steam widget + countdown + trailer, GPS teleport menu, loading screen, OG image, deploy.
7. **Milestone 2+:** Healthcare, Financial, Open Source Lab, Game Dev Park (roller coaster landmark, Mini Arcade, itch.io embeds, giant air-hockey Pong), skill pickups, achievements, day/night, minimap, ghost-lap time trial, AI traffic, train.

---

## Why Kenney (decision record)

- **Licence:** CC0 (public domain). Commercial and web use are allowed, extraction from the browser doesn't matter, and crediting is optional (we will credit anyway). This removes the Synty grey area; see `ai-docs/investigations/synty-web-license.md`.
- **Web-friendly:** every kit is GLB already. Each textured kit has **one 512 px palette** (`colormap.png`), and some older kits (Racing, Space) use flat material colours with no texture at all, which makes for tiny downloads.
- **Consistent style** across kits, and the **same style as Speed King**, which already uses Kenney Racing Kit, Car Kit, city roads and characters.
- **Synty is no longer used anywhere in the portfolio**, including Speed King vehicles that contain Synty parts (e.g. the wheelchair "lady" driver uses a Synty Kids texture).

---

## Architecture Overview

```
~/Documents/Personal/Kenney/          ← Kenney kits (CC0)
        │  copy only the GLB + Textures/colormap.png you need
        ▼
portfolio/level/   (Godot 4.7 project — authoring only)
  districts/*.tscn  → Scene ▸ Export As ▸ glTF 2.0
        │
        ▼
portfolio/level-export/*.glb  (raw, git-ignored)
        │  tools/optimize-models.sh  (gltf-transform)
        ▼
portfolio/web/public/models/*.glb   (optimized, shipped)
        │
        ▼
portfolio/web/  (Next.js static export + React + R3F app)
  src/content/   typed data (jobs, games, skills)  ──► Plain View (HTML)
  src/world/     Canvas, Town, Districts, Vehicle, Physics
  src/ui/        Overlay, InfoCard, GPS menu, Loader
        │  GitHub Actions
        ▼
https://ariannmichael.github.io
```

### Repository layout (target)

```
portfolio/
├── ai-docs/                    plans, changelogs, investigations, human testing
├── level/                      Godot project
│   ├── assets/<kit>/           copied Kenney GLB + Textures/colormap.png (CC0, so it can be committed; commit only the files you use)
│   ├── districts/              base.tscn, home.tscn, engineering.tscn, raceway.tscn, ...
│   └── town.tscn               instances all districts (preview only)
├── level-export/               raw .glb exports (GIT-IGNORED)
├── tools/
│   └── optimize-models.sh      gltf-transform pipeline
└── web/
    ├── public/
    │   ├── .nojekyll           REQUIRED: otherwise GitHub Pages (Jekyll) hides the `_next/` folder
    │   ├── models/             optimized .glb (shipped)
    │   ├── media/              trailers, gameplay clips, screenshots, og-image
    │   └── cv/Ariann_Michael_CV.pdf
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx              <html>, metadata, fonts, GoatCounter script
    │   │   ├── page.tsx                "/" → overlay + <WorldLoader/> (3D)
    │   │   ├── plain/page.tsx          "/plain" → Plain View (pre-rendered HTML)
    │   │   └── district/[id]/page.tsx  "/district/raceway" etc. (generateStaticParams + per-district OG metadata)
    │   ├── content/            jobs.ts, games.ts, skills.ts, links.ts, types.ts
    │   ├── state/              useAppStore.ts (zustand)
    │   ├── world/              WorldLoader.tsx (next/dynamic, ssr:false), Experience.tsx, Town.tsx, Vehicle.tsx, districts/*
    │   ├── ui/                 Overlay.tsx, InfoCard.tsx, GpsMenu.tsx, Loader.tsx, PlainView.tsx
    │   └── hooks/              useControls.ts, useDeviceTier.ts
    ├── next.config.ts          output: 'export', images.unoptimized, trailingSlash
    └── tsconfig.json
```

### Key conventions (the "scene contract")

| Godot node name | Meaning on the web |
|---|---|
| `MARKER_<id>` (Node3D empty) | Interaction point. `<id>` matches a content id, e.g. `MARKER_drchrono`, `MARKER_speedking`, `MARKER_spawn` |
| `COL_<anything>` (MeshInstance3D box) | Becomes a fixed Rapier cuboid collider. Hidden at runtime |
| `GROUND` (single mesh) | Drivable ground. Gets a trimesh collider (the only trimesh) |
| `SCREEN_<id>` | Mesh whose material is replaced at runtime with a video/canvas texture |
| Everything else | Static visual geometry. It may be merged/instanced by gltf-transform |

### Performance budgets

| Metric | Budget |
|---|---|
| Initial JS (gzip) | ≤ 450 KB |
| Time to Plain-View/overlay text visible | < 1.5 s on 4G |
| Base town + 1st district `.glb` | ≤ 3 MB total |
| Each additional district `.glb` | ≤ 1.5 MB |
| Palette textures | Keep at 512² (already tiny). WebP in the shipped files |
| Draw calls | ≤ 150 (Kenney kits have one material per kit, so `join` merges very well) |
| Frame rate | 60 fps on an M1 laptop, ≥ 30 fps on a mid-range Android |

---

## Detailed Plan

> Check off items **as they are completed**. Update the changelog (`ai-docs/plans/3d-portfolio-town-changelog.md`) after **each step**. Wait for approval after each step.

### Phase 0 — Decisions & Prerequisites

- [x] **0.1 Licensing**: resolved by switching to Kenney (CC0). See the decision record above and `ai-docs/investigations/synty-web-license.md`
  - [ ] 0.1.1 Add a credit line to the footer and Plain View: "3D assets by Kenney (kenney.nl), CC0"
  - [ ] 0.1.2 Rule: no Synty asset (or Speed King part made from Synty) enters `level/` or `web/`
- [x] **0.2 Download the missing free Kenney kits** (from kenney.nl into `~/Documents/Personal/Kenney`). Done 2026-10-17; all are CC0 and verified against fresh downloads
  - [x] 0.2.1 **City Kit (Roads)** → `kenney_city-kit-roads/` (95 GLB: road tiles incl. `road-roundabout`, bridges, traffic lights, signs, construction props)
  - [x] 0.2.2 **City Kit (Commercial) 2.1** → `kenney_city-kit-commercial_2.1/` (41 GLB: `building-a…n`, `building-skyscraper-a…e`, awnings, parasols, low-detail LOD buildings)
  - [x] 0.2.3 **City Kit (Suburban) 2.0** → `kenney_city-kit-suburban_20/` (40 GLB: `building-type-a…u`, fences, driveways, paths, trees)
  - [x] 0.2.4 **Mini Characters** → `kenney_mini-characters/` (26 GLB: 12 characters, plus `wheelchair`/`wheelchair-power` and accessibility aids, which are a CC0 nod to Speed King's wheelchair)
  - **Measured sizes (input for scale test 3.1.3):** road tile = 1 × 1 unit (roundabout 3 × 3). `building-a` ≈ 0.9 × 1.3 × 0.9. `building-skyscraper-a` ≈ 1.4 × 2.9 × 1.4. `building-type-a` ≈ 1.3 × 0.8 × 1.0. `sedan-sports` = 1.3 × 1.25 × 2.55. → **City kits need roughly ×8 relative to the sedan** (e.g. an 8 m road tile for a ~4 m car, with the sedan at ×1.6). Racing Kit still to measure
- [x] **0.3 Answer the open questions** at the bottom of this document (2026-10-17). All answered except **Q8 (media)**, which isn't needed until Phase 6.4 and is tracked in step 0.5. CV edits are listed in `ai-docs/sources/cv-update.md`
- [ ] **0.4 Tooling**
  - [ ] 0.4.1 Pin **Node 24 LTS** (updated from 22: 24 is the active LTS, and 22 is in maintenance only). nvm already has `v24.11.1`. Add `portfolio/.nvmrc` containing `24` and run `nvm use` in the project. CI reads the same file via `node-version-file: .nvmrc`. `"engines"` goes into `web/package.json` in step 1.2. The Homebrew Node 25 stays as the system default; it just isn't used for this project
  - [ ] 0.4.2 Install the global CLIs **under Node 24** (nvm keeps globals per Node version): `@gltf-transform/cli`, `gltfjsx`
  - [ ] 0.4.3 Install the GitHub CLI (`brew install gh`) and run `gh auth login`. It's needed in Phase 1 for the repo, Pages settings and Actions logs
  - [x] 0.4.4 Use Godot **4.7** for `level/`. Verified installed: `4.7.stable.official.5b4e0cb0f` (`/Applications/Godot4.7.app`). Do not open `level/` with the other 4.x builds you have installed
- [ ] **0.5 Gather media**
  - [ ] 0.5.1 Speed King: trailer (mp4/webm), 4–6 screenshots, capsule art, logo
  - [ ] 0.5.2 Each itch game: cover image plus a 5–10 s silent gameplay loop (webm ≤ 1.5 MB)
  - [ ] 0.5.3 itch.io **embed codes** for each HTML5 game (itch dashboard → game → Distribute → Embed game; the URL looks like `https://itch.io/embed-upload/<id>`)
  - [ ] 0.5.4 Current CV PDF copied to `web/public/cv/Ariann_Michael_CV.pdf`

### Phase 1 — Project Scaffold & Deploy Pipeline (deploy on day one)

- [ ] **1.1 Repository**
  - [ ] 1.1.1 `git init` in `portfolio/`, add `.gitignore` (`node_modules`, `dist`, `level/.godot/`, `level-export/`, `.DS_Store`)
  - [ ] 1.1.2 Deploy target: the **existing `ariannmichael/ariannmichael.github.io` repo** (decided 2026-10-17). Clone it, push its current `main` to a `legacy-site` branch and tag it, then replace `main` with this project (`git remote add origin` → that repo)
- [ ] **1.2 Next.js app**
  - [ ] 1.2.1 `npx create-next-app@latest web` with TypeScript, ESLint, App Router and the `src/` directory. No Tailwind unless you want it (decide here)
  - [ ] 1.2.2 Install the runtime deps: `three @react-three/fiber @react-three/drei @react-three/rapier zustand`
  - [ ] 1.2.3 Install the dev deps: `@types/three r3f-perf leva`, plus Prettier
  - [ ] 1.2.4 `next.config.ts`: `output: 'export'` (static HTML into `web/out/`), `images: { unoptimized: true }` (the image optimizer needs a server, which GitHub Pages doesn't have), `trailingSlash: true` (so `/plain/` maps to `plain/index.html` on Pages), and `transpilePackages: ['three']` if needed. No `basePath`, because it's a user site served at the root
  - [ ] 1.2.5 `src/world/WorldLoader.tsx`: `next/dynamic(() => import('./Experience'), { ssr: false })`. three.js, WebGL and Rapier's WASM only exist in the browser, so the canvas must never render on the server. Any file using hooks or R3F starts with `'use client'`
  - [ ] 1.2.6 Render a placeholder `<Canvas>` with a spinning box and `<OrbitControls>` to prove the stack works in `next dev` **and** in the exported build (`npx serve out`)
  - [ ] 1.2.7 Add an empty `public/.nojekyll`
- [ ] **1.3 GitHub Actions → Pages**
  - [ ] 1.3.1 `.github/workflows/deploy.yml`: checkout → `actions/setup-node` with `node-version-file: .nvmrc` (Node 24) → `npm ci` → `npm run build` in `web/` → `actions/upload-pages-artifact` with `path: web/out` → `actions/deploy-pages`
  - [ ] 1.3.2 Repo Settings → Pages → Source: GitHub Actions
  - [ ] 1.3.3 Verify the placeholder is live at the public URL
- [ ] **1.4 Testing baseline**
  - [ ] 1.4.1 Vitest for the content/utils, with a smoke test that every content id has the required fields
  - [ ] 1.4.2 Add `npm run typecheck` and `npm test` to CI before the build

### Phase 2 — Content Layer & Plain View (the safety net)

- [ ] **2.1 Types** (`web/src/content/types.ts`)
  - [ ] 2.1.1 `Job` { id, company, role, district, start, end, location, summary, highlights[], metrics[] {label, value}, stack[] }
  - [ ] 2.1.2 `Game` { id, title, platform: 'steam' | 'itch', tagline, genre, url, embedUrl?, steamAppId?, releaseDate?, cover, clip?, district }
  - [ ] 2.1.3 `Skill` { id, name, category, level }
  - [ ] 2.1.4 `DistrictId` union type, `Links` (email, github, linkedin, itch, steam, cv)
- [ ] **2.2 Data**. **Source of truth for experience: LinkedIn (https://www.linkedin.com/in/ariann-michael)**. LinkedIn blocks automated fetching (HTTP 999), so Ariann provides a **"Save to PDF"** of the profile (profile → Resources/More → Save to PDF) saved as `ai-docs/sources/linkedin-profile.pdf`. Where LinkedIn and the CV disagree, LinkedIn wins
  - [x] 2.2.0 Read the LinkedIn PDF and reconcile it with the CV in `ai-docs/sources/experience-reconciliation.md` (done 2026-10-17; conflicts C1–C8 are listed there)
  - [ ] 2.2.1 `jobs.ts`: copy roles, dates, highlights, metric chips and stacks **from the reconciliation doc**. In order: Afya (Squad Lead, 2026–present, **current**), DrChrono by EverHealth, GoFasti (client: PlanetBids), FullStack (client: GoDaddy), Afya Educacional, OpenMined, Stefanini Brasil, Proj4me (internship), UFCG Monitor, and UFCG BS CS (education). Add a `client?: string` field to `Job` for PlanetBids/GoDaddy and `current?: boolean` for the "Current role" badge
  - [ ] 2.2.2 `games.ts`: Speed King (Steam 4669300, release 2026-11-10, OutOfBoundsGames), Shoot 'Em All, Rat Catcher, Lead Me To The Light, Get Notes, Super Mega Ultra Pong
  - [ ] 2.2.3 `skills.ts`: grouped as on the CV (Frontend, Backend, Architecture, Testing, Infra) plus Game Dev (Godot, Unity)
- [ ] **2.3 Plain View** (`web/src/ui/PlainView.tsx`)
  - [ ] 2.3.1 Semantic HTML: `header` (name, role, CV button), `section`s for Experience / Games / Skills / Contact, and a footer with the Kenney credit
  - [ ] 2.3.2 WCAG: heading order, focus styles, link text, contrast ≥ 4.5:1, `prefers-reduced-motion`
  - [ ] 2.3.3 A real pre-rendered page at **`/plain/`** (`src/app/plain/page.tsx`, a Server Component with no `'use client'` and no three.js in its bundle), linked from a "Plain view" button that is always visible in the 3D overlay
  - [ ] 2.3.4 Fix the issues from the old site: typos, the broken CV button, missing GoFasti/DrChrono, missing Get Notes/Pong
- [ ] **2.4 SEO basics**
  - [ ] 2.4.1 Next `metadata` export in `layout.tsx`: title "Ariann Michael · Senior Software Engineer & Game Developer", description, `metadataBase: https://ariannmichael.github.io`, canonical, Open Graph and Twitter tags (image added in Phase 7)
  - [ ] 2.4.2 The `/` page server-renders the overlay text (name, role, CV link, Plain view link) as HTML, so there's useful content even before or without JavaScript
  - [ ] 2.4.3 JSON-LD `Person` schema with sameAs links (GitHub, LinkedIn, itch, Steam)
- [ ] **2.5 Deploy** the Plain View. From this point the site is never "broken" for recruiters

### Phase 3 — Asset Pipeline (Kenney GLB → Godot → glTF → web)

- [ ] **3.1 Godot project setup** (`level/`)
  - [ ] 3.1.1 New Godot 4.7 project at `portfolio/level`
  - [ ] 3.1.2 Copy only the GLBs you need into `level/assets/<kit>/`, **keeping the `Textures/colormap.png` folder next to them**. Kenney GLBs reference the texture externally (`"uri": "Textures/colormap.png"`), so they render untextured without it
  - [ ] 3.1.3 **Scale test for each kit:** Kenney kits don't share one scale (e.g. Racing Kit road tiles vs Car Kit vehicles vs City Kit tiles). Place one piece from each kit next to a 1 m `BoxMesh`, pick a world scale (1 unit = 1 m, with the vehicle about 2 m long), and record a **scale factor per kit** in `level/README.md`
  - [ ] 3.1.4 Apply each kit's scale at **import** (Import dock → Root Scale on the kit folder's import defaults), not per instance, so every placed piece is correct automatically
  - [ ] 3.1.5 **Snapping:** turn on grid snap at the kit's tile size (City/road kits are modular tiles) so roads line up
- [ ] **3.2 Materials**
  - [ ] 3.2.1 Keep Kenney's imported materials (palette texture or flat colours). There's no material work for the MVP
  - [ ] 3.2.2 Emissive variants for neon/lit windows (Game Dev Park, night mode), made later as `StandardMaterial3D` overrides with emission
- [ ] **3.3 Pipeline proof (round-trip test)**
  - [ ] 3.3.1 Scene `districts/_test.tscn`: ground plane named `GROUND`, one City Kit building, one Car Kit vehicle, one `COL_building` box, one `MARKER_test` empty
  - [ ] 3.3.2 Scene → Export As → glTF 2.0 (`.glb`) → `level-export/_test.glb`. Godot embeds the textures in the exported `.glb`
  - [ ] 3.3.3 Inspect it at https://gltf.report. Check that the node names survived, the textures are embedded, and the scale is correct
- [ ] **3.4 Optimization script** (`tools/optimize-models.sh`)
  - [ ] 3.4.1 For each `level-export/*.glb`, run `gltf-transform optimize` (dedup, instance, join, weld, prune) with `--compress meshopt` and `--texture-compress webp`
  - [ ] 3.4.2 Keep the palettes at 512². **Do not** resize below 256, because palette swatches bleed into each other
  - [ ] 3.4.3 Make sure `MARKER_*`, `COL_*`, `GROUND` and `SCREEN_*` survive. `join` merges meshes that share a material, so keep `COL_`/`SCREEN_` meshes on distinct materials or export them in a separate file. Verify with gltf.report
  - [ ] 3.4.4 Output to `web/public/models/`. Print the size of each file and fail if it is over budget
- [ ] **3.5 Load in R3F**
  - [ ] 3.5.1 `useGLTF('/models/_test.glb')` with the meshopt decoder (confirm drei's `useGLTF` has the meshopt decoder configured)
  - [ ] 3.5.2 Write a `parseSceneContract(scene)` util that traverses the scene and returns `{ markers: Map<id, Vector3+Quaternion>, colliders: Box[], ground: Mesh, screens: Map<id, Mesh> }`, and hides the `COL_*` meshes
  - [ ] 3.5.3 Unit-test `parseSceneContract` with a hand-built `THREE.Group`
  - [ ] 3.5.4 Use `gltfjsx --types` **only** for small interactive models (vehicle, screens, puck). Town files are loaded with `useGLTF` + traversal

### Phase 4 — Core World: Scene, Vehicle, Physics, Camera

- [ ] **4.1 Scene shell** (`world/Experience.tsx`)
  - [ ] 4.1.1 `<Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>` with `<Physics>` (Rapier) and `<Suspense>`
  - [ ] 4.1.2 Lighting for the Kenney look: a `hemisphereLight` (sky/ground colours) plus one `directionalLight` with soft shadows. Its shadow camera follows the vehicle
  - [ ] 4.1.3 `fog` plus a gradient sky colour (Kenney's flat style suits a flat or gradient sky)
- [ ] **4.2 Physics world**
  - [ ] 4.2.1 `GROUND` → `<RigidBody type="fixed" colliders="trimesh">`
  - [ ] 4.2.2 `COL_*` boxes → `<CuboidCollider>`s inside one fixed `RigidBody`
  - [ ] 4.2.3 Debug toggle (`<Physics debug>`) wired to a leva control in dev only
- [ ] **4.3 Arcade sphere vehicle** (`world/Vehicle.tsx`)
  - [ ] 4.3.1 Dynamic `RigidBody` with a `BallCollider` (radius ≈ 0.5), plus linear and angular damping tuned for an arcade feel
  - [ ] 4.3.2 The visual model is a separate `group` that copies the ball's position each frame and keeps its own heading (yaw)
  - [ ] 4.3.3 Throttle applies an impulse along the forward vector. Steering rotates the heading and scales with speed
  - [ ] 4.3.4 Visual juice: body tilts into turns, wheels spin, front wheels steer, and a small bounce follows the vertical velocity
  - [ ] 4.3.5 Reset to the last spawn marker on `R` or when falling below y = −10
  - [ ] 4.3.6 **Vehicle model: Kenney Car Kit `sedan-sports`** (decided 2026-10-17)
    - [ ] 4.3.6.1 Source: `~/Documents/Personal/Kenney/kenney_car-kit/Models/GLB format/sedan-sports.glb` plus `Textures/colormap.png`. It doesn't go through Godot: optimize it directly with gltf-transform **without** `join`, so the wheels stay separate
    - [ ] 4.3.6.2 Known structure (inspected 2026-10-17). Nodes: `body` (child `spoiler`), `wheel-front-left`, `wheel-front-right`, `wheel-back-left`, `wheel-back-right`. Each wheel node sits at its hub (x ±0.3, y 0.3, z ±0.66) and its mesh is centred on the node, so a wheel **spins by rotating its node around local X**, and the front wheels **steer by rotating around Y**
    - [ ] 4.3.6.3 Dimensions: 1.3 × 0.95 × 2.55 units, front = **+Z**, wheel radius 0.3, wheel bottoms at y = 0. Decide the world scale (e.g. ×1.5) in the scale test (3.1.3)
    - [ ] 4.3.6.4 `gltfjsx --types` → `web/src/world/VehicleModel.tsx`, exposing refs to the four wheel nodes
    - [ ] 4.3.6.5 Do **not** use the Speed King wheelchair "lady" (Synty texture), `nissan_gtr.glb` (real-brand trademark, unknown source) or `Gorilla.glb` (unknown source)
    - [ ] 4.3.6.6 Later (Phase 10): a vehicle-select screen (sedan-sports, plus the Speed King firetruck / police / garbage truck, which are 100% Kenney) as a cross-promo
- [ ] **4.4 Controls** (`hooks/useControls.ts`)
  - [ ] 4.4.1 drei `<KeyboardControls>` map: WASD/arrows, Space = brake/drift, R = reset, E/Enter = interact, M = GPS menu, H = horn/siren (the firetruck/police siren is a Speed King nod)
  - [ ] 4.4.2 Touch: an on-screen joystick (custom pointer-events component, no dependency) plus an interact button. Shown only on coarse pointers
  - [ ] 4.4.3 Gamepad (optional): Gamepad API polled in `useFrame`
- [ ] **4.5 Follow camera**
  - [ ] 4.5.1 Third-person camera behind and above the vehicle, smoothly lerped (with a frame-rate-independent damping factor)
  - [ ] 4.5.2 Zoom out slightly with speed
  - [ ] 4.5.3 Cinematic "intro orbit" around the town while assets finish loading, then fly down to the vehicle

### Phase 5 — Interaction System & Overlay UI

- [ ] **5.1 App state** (`state/useAppStore.ts`, zustand)
  - [ ] 5.1.1 `mode: 'intro' | 'drive' | 'card' | 'plain'`, `activeZone`, `openCardId`, `visitedDistricts`, `achievements`, `quality: 'high' | 'low'`
- [ ] **5.2 Interaction zones**
  - [ ] 5.2.1 For each `MARKER_<id>` that has matching content, place a Rapier **sensor** (`CuboidCollider sensor`) with `onIntersectionEnter/Exit` that sets `activeZone`
  - [ ] 5.2.2 Floating 3D label above each marker (drei `<Billboard>` + `<Text>`) showing the company or game name
  - [ ] 5.2.3 "Press E" or "Tap" prompt in the overlay when `activeZone` is set
- [ ] **5.3 Info Card** (`ui/InfoCard.tsx`)
  - [ ] 5.3.1 HTML overlay card showing the role, dates, highlights, metric chips and stack. It's accessible: it's a `dialog`, traps focus, and closes on Esc
  - [ ] 5.3.2 Game card variant: cover, tagline, Play button (itch) or Steam widget, and a trailer
  - [ ] 5.3.3 Driving pauses while a card is open
- [ ] **5.4 Persistent overlay** (`ui/Overlay.tsx`)
  - [ ] 5.4.1 Top-left: name, role, **Download CV** button. Top-right: GPS, Plain view, sound and quality toggles
  - [ ] 5.4.2 Controls hint (fades out after the first input)
- [ ] **5.5 GPS / teleport menu** (`ui/GpsMenu.tsx`)
  - [ ] 5.5.1 Lists the districts. Selecting one teleports the vehicle to `MARKER_spawn_<district>` with a short camera fade
  - [ ] 5.5.2 Deep links: **`/district/<id>/`** pages (`generateStaticParams` over the district ids) render the same world but spawn the vehicle at that district. Each has its own `generateMetadata` (title and OG image), so sharing `/district/raceway/` shows a Speed King preview. Job cards open with `?job=<id>`, read client-side with `useSearchParams` inside a `<Suspense>` boundary (required by static export)
- [ ] **5.6 Loader** (`ui/Loader.tsx`)
  - [ ] 5.6.1 drei `useProgress` drives a vehicle-on-a-track progress bar. The overlay text (name, CV, Plain view) shows **before** the 3D is ready

### Phase 6 — Milestone 1 Districts

- [ ] **6.1 Town base** (`districts/base.tscn` → `base.glb`)
  - [ ] 6.1.1 Roads from **City Kit (Roads)**: a **main avenue as the career timeline** and a central roundabout
  - [ ] 6.1.2 Map footprint ≈ 300 × 300 m, with every district 10–15 s of driving from the roundabout
  - [ ] 6.1.3 Trees and nature from **Mini Forest** / **Platformer Kit**. A water edge for the harbour (Pirate Kit ships moored there)
  - [ ] 6.1.4 Perimeter barriers (`COL_*`) and "Under construction" plots for the Milestone 2 districts (Car Kit `cone`, Racing Kit `barrierRed`/`barrierWhite`, Factory Kit pieces)
- [ ] **6.2 Home / Campus district** (`home.glb`)
  - [ ] 6.2.1 **City Kit (Suburban)** house is "About me" (`MARKER_about`), next to Contact (`MARKER_contact`)
  - [ ] 6.2.2 UFCG campus: a City Kit (Commercial) building plus a **Mini Skate** courtyard (`MARKER_ufcg`)
  - [ ] 6.2.3 Proj4me as a small office next to campus (`MARKER_proj4me`). It's the first stop on the avenue
  - [ ] 6.2.4 CV billboard (Racing Kit `billboard` with a `SCREEN_cv` face). Drive through it to download the PDF (`MARKER_cv`)
  - [ ] 6.2.5 `MARKER_spawn` and `MARKER_spawn_home`
- [ ] **6.3 Engineering District** (`engineering.glb`)
  - [ ] 6.3.1 Office towers from **City Kit (Commercial)**
  - [ ] 6.3.2 Stefanini (`MARKER_stefanini`), with a mentoring plaza
  - [ ] 6.3.3 **GoFasti (for PlanetBids)** (`MARKER_gofasti`): a data-warehouse building with a giant **snowflake** on the roof (the Snowflake analytics work, using Holiday Kit snow pieces) and an "AI onboarding" kiosk out front (+20% profiles, +37% memberships)
  - [ ] 6.3.4 Temporarily also hosts the **Afya (current role, with a badge)**, DrChrono, FullStack and Afya Educacional cards until their districts exist in Milestone 2 (markers move later, content ids stay the same)
- [ ] **6.4 Speed King Raceway** (`raceway.glb`), the **launch centerpiece**
  - [ ] 6.4.1 A real circuit from **Racing Kit** (the same kit Speed King uses): `roadStart`/`roadStartPositions`, corners, `roadRamp`, `grandStand*`, `pitsGarage*`, `bannerTower*`, `overheadLights`, `flagCheckers`
  - [ ] 6.4.2 Giant billboard (Racing Kit `billboardDouble_exclusive` with a `SCREEN_speedking` face) playing the trailer as a `VideoTexture` (muted, looping, starts only when visible)
  - [ ] 6.4.3 Car Kit `cone`s and `debris-*` pieces as dynamic physics props you can knock over
  - [ ] 6.4.4 Speed King info card: Steam widget iframe `https://store.steampowered.com/widget/4669300/`, a countdown to 2026-11-10 that switches to "Out now" automatically, screenshots, and OutOfBoundsGames credit
  - [ ] 6.4.5 Start/finish line `MARKER_lap_start` (the time trial itself comes in Phase 10)
- [ ] **6.5 Device tier & fallback** (`hooks/useDeviceTier.ts`)
  - [ ] 6.5.1 No WebGL2 → auto Plain View. `prefers-reduced-motion` → offer Plain View and disable camera shake
  - [ ] 6.5.2 Low tier (drei `PerformanceMonitor`) → no shadows, dpr 1, no video textures
- [ ] **6.6 Content check:** every Milestone 1 marker has content and every content item is reachable (Vitest check)

### Phase 7 — Milestone 1 Launch Polish (target 2026-11-07)

- [ ] **7.1 Social & SEO**
  - [ ] 7.1.1 OG image (1200×630): a nice screenshot of the raceway with the vehicle, name and "Speed King out Nov 10"
  - [ ] 7.1.2 Fill in the OG/Twitter meta tags. Verify with the LinkedIn Post Inspector
- [ ] **7.2 Analytics**
  - [ ] 7.2.1 **GoatCounter**: create the `ariannmichael` site at goatcounter.com, add its script via `next/script` in `layout.tsx`, and call `window.goatcounter.count({ path: 'event-name', event: true })` for the events `cv_download`, `steam_click`, `itch_play`, `district_visit`, `plain_view`
- [ ] **7.3 Performance pass**
  - [ ] 7.3.1 `r3f-perf` in dev: check draw calls, triangles and frame time against the budgets
  - [ ] 7.3.2 Lighthouse on Plain View: Performance ≥ 90, Accessibility ≥ 95
  - [ ] 7.3.3 Real-device test: iPhone Safari and a mid-range Android Chrome
- [ ] **7.4 Human testing doc:** `ai-docs/human_testing/3d-portfolio-milestone-1.md` (desktop, mobile, keyboard-only, screen reader, deep links)
- [ ] **7.5 Launch:** deploy, tag `v1.0.0`, and post the link (with `/district/raceway/`) alongside the Speed King launch announcements

### Phase 8 — Milestone 2: Professional Districts

- [ ] **8.1 Healthcare District** (`healthcare.glb`)
  - [ ] 8.1.1 Clean City Kit (Commercial) buildings, a Car Kit **`ambulance`** parked out front, and a big red-cross sign (drei geometry or a simple extruded shape)
  - [ ] 8.1.2 DrChrono clinic (`MARKER_drchrono`) with a digital board showing "Billing runtime: 0.30s" (canvas texture on `SCREEN_drchrono`)
  - [ ] 8.1.3 **DrChrono factory annex**, from Factory Kit + City Kit Industrial. One big "Django monolith" building feeds **moving conveyor belts** (animated UV offset) out to small "Rust microservice" machines, which shows the decomposition literally
  - [ ] 8.1.4 Afya campus (`MARKER_afya-2026`, `MARKER_afya-2021`): the **current job**, so it's the biggest building, with a "You are here / Current role" banner. It has a broadcast antenna (Space Kit `machine_wireless`) for the 2021 real-time chat and live platform. One campus, two cards ("came back as Squad Lead")
- [ ] **8.2 Financial District** (`financial.glb`)
  - [ ] 8.2.1 The tallest City Kit (Commercial) skyscrapers, plus Mini Market `cash-register` props on the plaza
  - [ ] 8.2.2 FullStack / GoDaddy (`MARKER_fullstack`) with an LED ticker (scrolling canvas texture on `SCREEN_ticker`). Text: "INTERNATIONAL PAYMENTS ▲ · SUBSCRIPTIONS · RENEWALS · FEWER FAILED TRANSACTIONS ▼". **No +12%/−0.2s numbers** (decision C3, 2026-10-17)
- [ ] **8.3 Open Source Lab** (`opensource.glb`)
  - [ ] 8.3.1 Space Kit hangars, generators and wireless machines, plus Modular Space Kit pieces. OpenMined (`MARKER_openmined`) with PySyft and PyGrid
  - [ ] 8.3.2 Emissive "data flow" lines on the ground (animated UVs)
- [ ] **8.4 Move the markers** from Engineering to the new districts, and update the GPS menu and deep links

### Phase 9 — Milestone 2: Game Dev Park

- [ ] **9.1 Park layout** (`gamedev.glb`): a small theme park with a **Coaster Kit** `park-entrance`, and a roller coaster (`coaster-steel-track`/`-looping`) looping over the district as a **landmark visible from anywhere**. Optional: an animated coaster car running on the track
- [ ] **9.2 Arcade hall** (`MARKER_arcade`): built from **Mini Arcade** (`arcade-machine`, `pinball`, `claw-machine`, `dance-machine`, `prize-wheel`, walls/floor). The arcade screens become `SCREEN_*` meshes playing the game clips
- [ ] **9.3 Per-game spots**
  - [ ] 9.3.1 Shoot 'Em All: a **Space Kit** hangar with `craft_speeder*` ships (it's a shmup), plus a stage with "rock" lighting
  - [ ] 9.3.2 Rat Catcher: a sewer/dungeon entrance from **Mini Dungeon** / **Modular Dungeon**
  - [ ] 9.3.3 Get Notes: a music shop built from **Mini Market** walls and shelves
  - [ ] 9.3.4 Lead Me To The Light: a **Pirate Kit** `tower-complete-large` used as a lighthouse at the map edge, with a rotating `SpotLight` beam, surrounded by a dark **Graveyard Kit** area lit only by **Fantasy Town** `lantern`s
- [ ] **9.4 itch.io play overlay**
  - [ ] 9.4.1 The game card's "Play" button opens a fullscreen modal with the itch embed iframe, loaded only on click
  - [ ] 9.4.2 Pause the 3D render loop while a game is open (`frameloop="demand"`)
  - [ ] 9.4.3 Fallback link to the itch page, and an "Open on itch.io" link on mobile
- [ ] **9.5 Giant Pong / air-hockey minigame** (`MARKER_pong`)
  - [ ] 9.5.1 Mini Arcade `air-hockey`, scaled up into a parking-lot-sized table with wall colliders and a dynamic puck
  - [ ] 9.5.2 Goal sensors and a score display. Scoring a goal unlocks the "Super Mega Ultra Pong" card

### Phase 10 — Systems & Delight

- [ ] **10.1 Skill pickups:** floating boxes like Speed King power-ups (Food Kit items such as a sausage are a nod to Speed King's abilities), one per skill, plus a "Skills 14/22" counter. Saved in `localStorage` (wrapped in try/catch)
- [ ] **10.2 Achievements:** toasts with confetti. Visit all districts, light the lighthouse, score in Pong, beat Ariann's lap
- [ ] **10.3 Time trial:** lap timer on the raceway plus a ghost of Ariann's recorded lap (positions recorded at 20 Hz, saved as JSON, played back with interpolation)
- [ ] **10.4 Day/night:** follows `prefers-color-scheme` with a manual toggle. At night the emissive windows, street lights and lanterns turn on and the lighthouse beam is visible
- [ ] **10.5 Minimap:** a top-down orthographic render or a static SVG with the vehicle's position and heading
- [ ] **10.6 Road signs:** direction signs at the roundabout (drei `<Text>` on simple sign meshes)
- [ ] **10.7 Ambient life:** **Train Kit** train circling the map, Car Kit **AI traffic** (taxi, sedan, van, delivery) following spline loops, Pirate Kit ships bobbing in the harbour
- [ ] **10.8 Vehicle select:** firetruck / police / garbage truck / karts, mirroring Speed King's select screen
- [ ] **10.9 Seasonal:** **Holiday Kit** decorations automatically in December
- [ ] **10.10 Audio** (off by default): engine sound pitched by speed, siren/horn, UI clicks. Respect the mute toggle
- [ ] **10.11 Konami code** (optional): "Shoot 'Em All mode" (palette swap plus Space Kit ships flying over)

### Phase 11 — Final Polish & Audit

- [ ] **11.1** Accessibility audit (axe plus manual keyboard and screen reader) of the overlay, cards, GPS and Plain View
- [ ] **11.2** Performance audit against the budgets. Lazy-load districts that are far from the vehicle
- [ ] **11.3** Cross-browser: Chrome, Safari, Firefox, iOS Safari, Android Chrome
- [ ] **11.4** Update the human testing doc, then tag `v2.0.0`
- [ ] **11.5** Write the case study (README plus an "How I built this" section in Plain View)

---

## Asset Shopping List (Kenney, CC0)

| District | Kit(s) (✓ = already downloaded) | Key models |
|---|---|---|
| Roads / base | City Kit Roads (**download**, or reuse Speed King's `assets/models/roads/`), ✓ Mini Forest, ✓ Platformer | road tiles, trees, grass |
| Home / Campus | City Kit Suburban (**download**), City Kit Commercial (**download**), ✓ Mini Skate | houses, `half-pipe`, `ramp`, `benches` |
| Engineering | City Kit Commercial (**download**), ✓ Factory Kit 3.0, ✓ City Kit Industrial 2.0 | towers, `conveyor*`, `building-a…t`, `chimney-*` |
| Healthcare | City Kit Commercial, ✓ Car Kit, ✓ Space Kit | `ambulance`, `machine_wireless` |
| Financial | City Kit Commercial, ✓ Mini Market | skyscrapers, `cash-register` |
| Open Source Lab | ✓ Space Kit, ✓ Modular Space Kit | `hangar_*`, `machine_generator*`, `machine_wireless*`, room/corridor pieces |
| Game Dev Park | ✓ Coaster Kit, ✓ Mini Arcade, ✓ Mini Market, ✓ Mini/Modular Dungeon, ✓ Pirate Kit, ✓ Graveyard Kit, ✓ Fantasy Town, ✓ Space Kit | `park-entrance`, `coaster-steel-*`, `arcade-machine`, `air-hockey`, `tower-complete-large`, `lantern`, `craft_speeder*` |
| Raceway | ✓ Racing Kit, ✓ Car Kit | `roadStart*`, `grandStand*`, `pitsGarage*`, `billboard*`, `bannerTower*`, `cone`, `debris-*` |
| Vehicle | Speed King's Kenney vehicles / ✓ Car Kit | firetruck, police, garbage truck, `kart-oo*` |
| Ambient | ✓ Train Kit, ✓ Car Kit, ✓ Pirate Kit, ✓ Holiday Kit | trains, traffic cars, ships, decorations |
| Characters | Speed King's `assets/models/kenney/characters/` or a Kenney characters kit (**download**) | driver, pedestrians |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Milestone 1 slips past the launch | Plain View ships in Phase 2. Raceway gets priority over Home/Engineering polish |
| Mixed scales between Kenney kits | Per-kit scale factors set at import (3.1.3–3.1.4) and recorded in `level/README.md` |
| Missing textures (external `colormap.png`) | Copy the `Textures/` folder with the GLBs. Godot embeds them on export, which gltf.report verifies |
| Mobile performance | Device tiers, meshopt + WebP, shadows off on low tier, load districts by distance |
| `join` merges away named nodes | Keep markers as empties and give `COL_`/`SCREEN_` meshes distinct materials. Verify with gltf.report |
| Vehicle feel takes long to tune | Sphere-kart approach. Tuning values in leva during development |
| Recruiters bounce off 3D | Name, CV and Plain View visible before the 3D loads, plus GPS teleport and deep links |

---

## Open Questions

1. ~~**Deploy target**~~ **Answered:** the existing `ariannmichael/ariannmichael.github.io` repo, with the old site kept in a `legacy-site` branch (step 1.1.2). Custom domain: none for now.
2. ~~**Speed King vehicle**~~ **Answered:** use Speed King's 100% Kenney vehicles (firetruck, police, garbage truck) or Car Kit karts (step 4.3.6).
3. ~~**Synty licence**~~ **Resolved:** switched to Kenney CC0.
4. ~~**PlanetBids**~~ **Answered:** PlanetBids was **GoFasti's client**, shown as "GoFasti · for PlanetBids". Remaining experience conflicts (C1–C8, mainly **C3: GoDaddy +12%/−0.2s** and **C7: Afya 2026 highlights**) are in `ai-docs/sources/experience-reconciliation.md`.
11. ~~**CV PDF**~~ **Answered: update it.** The changes are listed in `ai-docs/sources/cv-update.md`. Ariann applies them in the LaTeX source (not on this Mac) and drops the new PDF into `web/public/cv/` (step 0.5.4).
5. ~~**Vite vs Next.js**~~ **Answered: Next.js** (static export).
6. ~~**Language**~~ **Answered: English only.**
7. ~~**Analytics**~~ **Answered: GoatCounter.**
8. **Media (still open):** do you already have a Speed King trailer file and gameplay clips for the itch games? Needed by Phase 6.4.
9. ~~**Name on site**~~ **Answered: "Ariann Michael".**
10. ~~**Hero vehicle**~~ **Answered:** Kenney Car Kit `sedan-sports` (step 4.3.6).
