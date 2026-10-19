# Human Testing: Planet Portfolio (v2)

**Goal:** check the site in **real browsers on real devices** before go-live. Headless QA used software rendering, so feel, frame rate and touch need a human.
**Branch:** `planet`. **How to run it locally** (from `web/`):

```bash
export PATH="$HOME/.nvm/versions/node/v24.11.1/bin:$PATH"
npm run build
npx serve out -l 4173
```

Then open `http://localhost:4173`. To test on a phone on the same Wi-Fi, use your Mac's LAN IP instead of `localhost`.
**Debug aids:**
- Append `?debug` to any URL. That enables `window.__vehicleState`, `window.__teleport(lat, lon, yaw)` and `window.__renderInfo()` in the console.
- Analytics don't count localhost visits.

Mark each item ✅ / ❌ and write notes under any ❌.

## 1. First load (desktop Chrome)
- [ ] The name, headline, **Download CV** and **Plain view** appear immediately, before the 3D scene.
- [ ] The loader bar (a little car on a road) shows progress and disappears once the start area is ready, in about 5 s or less on a decent connection.
- [ ] The intro orbit shows the **planet curvature**, then the camera settles behind the SUV when you press a key.
- [ ] The console has no errors (warnings from three or Rapier are fine).

## 2. Driving feel (Over the Hill style)
- [ ] W/↑ accelerates and S/↓ brakes then reverses. A/D steers, and steering is lighter at high speed.
- [ ] **Space** (handbrake) makes the rear slide out in a turn, and you can recover with counter-steer.
- [ ] Hills: you can climb gentle and medium slopes; very steep cliffs stop you.
- [ ] Jumps: the earthen kickers launch the SUV, and W/S/A/D tilt it in the air. Landings feel weighty.
- [ ] **Camera shake** on rough ground, big landings and crashes. It's noticeable but not nauseating.
- [ ] **Wheel smoke and dust** on burnouts, drifts and fast driving on dirt. The dust colour roughly matches the ground.
- [ ] Flip the car (e.g. a hard landing on its side): after ~1.5 s it rights itself. **R** resets it upright where you are.
- [ ] Drive **all the way around the planet**: no holes in the ground, no invisible walls in open country, and gravity always pulls "down" toward the planet.

## 3. Biomes: each must look clearly different
Use **GPS** (button, or **M**) to teleport to each one, then drive around.

| Biome | What to look for | ✅/❌ |
|---|---|---|
| Hometown Meadow | Green hills, house (About me), contact plaza, CV billboard, UFCG campus (2 stops), skate park, proj4me office | |
| Downtown Plateau | Grey towers on a raised plateau, Stefanini plaza, GoFasti warehouse with a giant snowflake | |
| Clinic Lakeside | Teal ground, Afya tower (the tallest), Afya Educacional hall with antennas, DrChrono clinic, a lake basin | |
| Desert Mesa | Golden canyons, a ramp up the mesa to the FullStack tower, giant food props | |
| Alien Crater | Purple ground, **dark sky with stars**, crater bowl, rocket, OpenMined hangar | |
| Game Dev Park | **Dusk sky with stars** (night side), coaster loop, arcade, launch pad with ships, graveyard trail to the lighthouse, stage | |
| Speed King Canyon | Red dirt, a dirt circuit with berms and jumps, grandstands, start gantry, big billboard | |
| Badlands (drive there; it isn't in the GPS) | Big jumps, bowl, wrecks, smashable crates | |

- [ ] The sky colour changes smoothly as you drive between biomes.
- [ ] Nothing floats or sinks into the ground in any biome.

## 3b. Roadmap (roads between biomes)
- [ ] From any town, a paved road leads out to the neighbouring towns. Every biome is reachable by road. Between towns it is the **same road as inside the towns** (raised sidewalks and kerbs, two lanes, the same grey and centre line), so you can't see where a town tile ends and the stretch between towns begins.
- [ ] At each road end there is a green sign. Arriving, it names the town and lists its stops. Leaving, it says "> destination", the distance and the stops there.
- [ ] Roads are drivable at speed: no sudden steps, no sideways tilt, no terrain poking through the asphalt.
- [ ] Roads don't run through buildings, jumps or parking rings. Sign posts are solid (you bump into them).
- [ ] Road tiles inside towns (Hometown loop, Downtown streets, Raceway) line up straight with no twisted tiles.
- [ ] **Joins:** where a road enters a town (from a tile edge, or from the small crossroad in Badlands, Healthcare, Gamedev, Financial and Alien Crater), width, height and kerbs match with no gap, step, overlap or flicker. Where two roads share a hub, nothing folds or double-draws.

## 4. Drive-in interiors
Drive in, move around inside, and drive out. The camera should never get stuck inside a wall.

| Interior | Where | ✅/❌ |
|---|---|---|
| Container loading dock | Downtown Plateau, east of the warehouse | |
| Pit garage | Speed King Canyon, beside the start straight | |
| DrChrono factory hall (monolith → microservices) | Clinic Lakeside | |
| Drive-thru payments hall | Desert Mesa, on the road to the tower | |
| Space lab corridors | Alien Crater, south entry gate | |
| Arcade hall | Game Dev Park | |
| Dungeon mound (Rat Catcher) | Game Dev Park | |

## 5. Stops, cards and content
- [ ] Every stop has a readable floating label, including from far away, and the labels are hidden behind buildings.
- [ ] Parking in a marker (a **red glowing ring with a column of light**, like GTA San Andreas) shows "Press E to open …". The column brightens as you drive in and is brightest when active. **E** opens the card, and **Esc** or clicking outside closes it.
- [ ] Driving is paused while a card or the GPS is open.
- [ ] **Job cards:** dates, role and highlights are correct. Afya shows "Current role". There are **no GoDaddy +12% or −0.2 s numbers**.
- [ ] **Speed King card:** cover art, the countdown to **Nov 10, 18:00 UTC** (10:00 PST), the Steam widget, and "Wishlist on Steam" that opens Steam.
- [ ] **itch games:** each card has Play or a link to its itch.io page.
- [ ] The **CV stop** (billboard) downloads `Ariann_Michael_CV.pdf`, and the header reads "Ariann Michael Farias".
- [ ] The GPS lists all 7 career biomes and marks the ones you've visited.

## 6. Look & settings
- [ ] There is **no PSX look** and no PSX toggle: clean rendering with real shadows on HQ, crisp labels, and the top-right bar shows GPS, sound, Lite and Plain view.
- [ ] **The car is red** (body and roof), seen from the chase camera and in the intro. Windows, tyres and lights keep their own colours.
- [ ] At dusk the ground has no fine diagonal pattern or shimmer.
- [ ] The **HQ ↔ Lite** toggle works. Lite is visibly cheaper (no shadows, fewer particles).
- [ ] The mute toggle works (audio may not exist yet; just check the button works).
- [ ] With **reduced motion** turned on in your OS: no camera shake, a calmer intro, and a "Try Plain view" notice.

## 7. Mobile (iPhone Safari and an Android Chrome; portrait and landscape)
- [ ] It loads without crashing, starts on **Lite**, and the frame rate is playable (no long freezes). Note the device, the browser and roughly how smooth it feels.
- [ ] The intro shows the whole globe, with a big **"Tap to drive"** button. Tapping it starts driving.
- [ ] The on-screen joystick steers and throttles; holding the brake while steering works with two thumbs; Interact (**OPEN**) and Reset work. Lifting a finger, switching apps or opening a card never leaves the car stuck driving.
- [ ] The Interact button is dimmed until you are inside a marker, then lights up; tapping it opens the card.
- [ ] The layout fits: a compact name pill with the CV download, the GPS/sound/Lite/Plain bar, the speedometer clear of the buttons. Nothing overlaps the joystick or buttons, and the notch and home-bar areas are respected.
- [ ] The Safari address bar showing or hiding doesn't cut off the controls or leave a gap.
- [ ] Pinching, double-tapping and pulling down don't zoom or refresh the page while playing.
- [ ] **Sound starts on the first tap** (iOS). The engine is audible and the sound button works.
- [ ] Cards and the GPS menu are readable and scroll, and the close button (44 px) can be tapped.
- [ ] Rotating to landscape and back keeps everything usable.
- [ ] `/plain/` is readable on the phone with proper side margins; the "Plain view" link works from the HUD.
- [ ] The browser tab shows the **old site's icon** (a purple circle with a cream "A"), not the Next.js default, and Add to Home Screen shows the same "A" on purple.

## 8. Other pages
- [ ] `/plain/`: the full résumé, readable in light and dark mode, with Download CV working.
- [ ] `/district/raceway/` (and the others): the car spawns in that biome.
- [ ] Share `https://ariannmichael.github.io/district/raceway/` in a chat app after go-live: a preview image appears.
- [ ] Keyboard only (Tab): every HUD button and card control can be reached and has a visible focus ring.

## 9. Browsers
- [ ] Chrome (desktop)
- [ ] Safari (desktop)
- [ ] Firefox (desktop)
- [ ] iOS Safari
- [ ] Android Chrome

## 10. v2.1 small planet (plan: `ai-docs/plans/small-planet-plan.md`)
The planet radius dropped from 150 m to 90 m. The 8 towns sit on a square antiprism (two rings at lat ±30.7°), each packed into about 40 m, and one paved road loop links them all.

### 10a. Small-globe look (intro)
- [ ] On first load, the intro orbit reads clearly as a **small planet**: you see the curve of the horizon and several towns at once, and it doesn't look like a flat map.
- [ ] The fog and distance haze hide the far side cleanly, with no popping of whole towns as the camera settles.
- [ ] Labels stay readable and don't pile up over each other during the orbit.
- [ ] Once driving, the horizon drops away noticeably as you drive between towns, but towns themselves feel level, not tilted.

### 10b. Drive the 8-town road loop
Start at Hometown and stay on the asphalt the whole way: **Hometown → Speed King Canyon → Downtown Plateau → Badlands → Clinic Lakeside → Game Dev Park → Desert Mesa → Alien Crater → Hometown**. It's about 790 m.
- [ ] Every link exists, and you can drive the whole loop without leaving the road.
- [ ] No sudden steps, sideways tilt, folded or flipped road pieces, or terrain poking through the asphalt. Pay special attention at the **Clinic → Game Dev Park** road end (a turn there used to fold the ribbon).
- [ ] Between towns the road climbs and dips gently; nowhere is too steep to drive up at normal speed.
- [ ] The road enters each town through its open lane and doesn't run into buildings, jumps, parking rings or markers.

### 10c. Signs at road ends
- [ ] Every road end has a green sign, so 2 per link and 16 in total.
- [ ] Arriving, the sign names the town and lists its stops. Leaving, it shows "> destination", the distance (it should match the shorter loop, roughly 75–125 m) and the stops there.
- [ ] The signs are upright, readable from the car, and don't block the lane. Their posts are solid.

### 10d. Every town (GPS teleport, then drive around)
Check that each town still has all of its stops, fits together without clipping, and that the car can reach every stop from the spawn.

| Town | What to check | ✅/❌ |
|---|---|---|
| Hometown Meadow | ±12 m road loop; house and About (west), contact (south-west), UFCG hall + 2 stops (north), skate park (north-east), proj4me (east), CV billboard (south exit) | |
| Downtown Plateau | Raised plateau, one avenue + one street; Stefanini (NW block), GoFasti + snowflake (NE block) square and level | |
| Speed King Canyon | ~130 m circuit, start straight on the north side; grid spawn; pit garage on the straight; 3 grandstands; billboard faces the grid; no bad bump at the pit's edge | |
| Badlands | Spawn on the north apron facing the kicker line; jumps, ridge, whoops, bowl, crater and wrecks all in reach | |
| Clinic Lakeside | Lake, med school (Afya 2021), Afya tower (tallest) + plaza stop, antenna, DrChrono hall | |
| Desert Mesa | Road from the spawn through the drive-thru and up the ramps onto the mesa; finance tower (tallest) + fullstack stop on top; giant food along the road | |
| Alien Crater | Crater bowl, rocket, OpenMined hangar; lab entry gate reachable from the crater | |
| Game Dev Park | All 5 game stops; coaster loop + station; lighthouse; beached ship; the stage doesn't clip the coaster station; the Pong stop works next to the arcade wall | |

### 10e. Every interior (drive in, through and out)
Big buildings now stand on flat "planar" pads. Floors should feel level (the car shouldn't roll toward the middle), and walls should be square with no gaps at their joins.

| Interior | Route | ✅/❌ |
|---|---|---|
| Container loading dock (Downtown) | Sunk 2.5 m; drive through west → east | |
| Pit garage (Speed King Canyon) | In from the start straight and back out | |
| DrChrono factory hall (Clinic) | Through the roll-up doors at both ends, past the monolith and the 3 microservices | |
| Drive-thru hall (Desert Mesa) | Along the 8 m lane past the service windows, then on up the ramps | |
| Space lab (Alien Crater) | Entry gate → corridor → octagonal room → north door → corner → exit gate; the laser gate on the west door | |
| Arcade hall (Game Dev Park) | Through west → east; the east exit opens just past the town's edge | |
| Dungeon mound (Game Dev Park) | Through north → south | |

- [ ] In every interior the camera never gets stuck in a wall or roof.
- [ ] Parking on a pad and letting go: the car stays put and doesn't creep downhill or toward the pad's centre.

### 10f. Engine sound (unmute, then drive)
- [ ] **Deep character:** the pitch stays low even flat out (the limiter is at about 4900 rpm), with a low body thump and a darker exhaust tone, not a high or honky buzz.
- [ ] **Idle lope:** at standstill the engine has an uneven, lumpy "potato-potato" V8 idle, not a steady buzz or an obvious LFO wobble.
- [ ] **Rev climb:** with the throttle held, the pitch climbs smoothly and the tone gets harder and brighter under load. It should sound like combustion, not a synthesiser.
- [ ] **Upshift gaps:** accelerating from a stop, you hear a short throttle cut and a pitch drop at each of the 4 upshifts, then the climb starts again.
- [ ] **Downshifts:** braking down through the gears gives a short rev-match blip.
- [ ] **Limiter:** holding the throttle in the air (or flat out in a high gear) bounces off the limiter with a rapid cut-cut-cut, and it isn't painfully loud.
- [ ] **High-rev smoothness:** at high revs the lope is gone and the note is smooth and even.
- [ ] The overall engine volume sits well with the ambience and the hit sounds: not too quiet, and no clipping or crackle.

### 10g. Polish round (2026-10-18 feedback)
- [ ] **Declutter:** every town feels open. There are only a few crates and barrels, set against buildings and never in your way. You can drive from the spawn to every stop and through every interior without squeezing between props (at least 7 m clear).
- [ ] **Grounded:** nothing floats. Look under buildings, props, the stage and coaster in Gamedev, the rocket and hangars in Alien Crater, the water tower and mesa props in Financial, and the Afya tower and antenna in Healthcare. Nothing should show daylight underneath. (The `grounded.test.ts` audit checks this automatically.)
- [ ] **Healthcare hall approach:** from the spawn to the hall's south door at about 30 km/h the car stays on the ground. Above about 45 km/h a small hop at the hall's edge is a known limit.
- [ ] **Sign titles** sit on one line and don't overlap their own text. Distant signs don't flicker grey.
- [ ] **Raceway start:** the start straight runs under a gantry, with no oversized tile floating over the ground.
- [ ] **Engine:** deep and slow-revving, like a big V8 (low rumble, not honky or buzzy); idle is clearly audible on laptop speakers.

## Notes / bugs found
