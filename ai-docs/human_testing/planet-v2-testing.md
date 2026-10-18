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
- [ ] Parking on a yellow ring shows "Press E to open …". **E** opens the card, and **Esc** or clicking outside closes it.
- [ ] Driving is paused while a card or the GPS is open.
- [ ] **Job cards:** dates, role and highlights are correct. Afya shows "Current role". There are **no GoDaddy +12% or −0.2 s numbers**.
- [ ] **Speed King card:** cover art, the countdown to **Nov 10, 18:00 UTC** (10:00 PST), the Steam widget, and "Wishlist on Steam" that opens Steam.
- [ ] **itch games:** each card has Play or a link to its itch.io page.
- [ ] The **CV stop** (billboard) downloads `Ariann_Michael_CV.pdf`, and the header reads "Ariann Michael Farias".
- [ ] The GPS lists all 7 career biomes and marks the ones you've visited.

## 6. PSX look & settings
- [ ] **PSX on (default):** chunky pixels, dithered sky, slight vertex wobble when moving, and crisp labels.
- [ ] The **PSX → Smooth** toggle switches instantly to clean rendering (with real shadows on HQ).
- [ ] The **HQ ↔ Lite** toggle works. Lite is visibly cheaper (no shadows, fewer particles).
- [ ] The mute toggle works (audio may not exist yet; just check the button works).
- [ ] With **reduced motion** turned on in your OS: no camera shake, a calmer intro, and a "Try Plain view" notice.

## 7. Mobile (iPhone Safari and an Android Chrome)
- [ ] It loads without crashing, and the frame rate is playable (no long freezes).
- [ ] The on-screen joystick steers and throttles, the brake works when held, and Interact and Reset work.
- [ ] The overlay fits the screen (notch and safe areas), and nothing overlaps the joystick.
- [ ] Cards are readable and scroll, and the close button can be tapped.
- [ ] Rotating to landscape and back keeps everything usable.

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

## Notes / bugs found
