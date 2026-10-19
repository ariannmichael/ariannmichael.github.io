// Kenney kit table for scripts/prepare-models.mjs.
//
// World units are metres and one road tile is TILE = 8 m (src/world/layout/types.ts).
// `scale` is NOT baked into the .glb files: the renderer multiplies every model of a kit by it.
// It IS baked into the bounds in src/world/models/manifest.generated.ts.
//
// Reference sizes after scaling (measured with scripts/inspect-model.mjs):
//   city road tile 1 u -> 8 m | car-kit sedan-sports 2.55 u -> 4.34 m long, 2.21 m wide
//   mini-characters person ~0.70 u -> ~1.75 m | racing asphalt 0.69 u -> 5.5 m (2.5 car widths)
//
// Fields:
//   id      kit id used in ModelRef "<kit>/<model>"
//   folder  folder under KENNEY_DIR
//   subdir  model folder inside the kit (most kits ship "Models/GLB format"; the older racing and
//           space kits only have flat-colour .glb files under "Models/GLTF format")
//   scale   uniform kit scale (raw Kenney units -> metres)
//   offset  optional [x, y, z] in RAW units, baked into the .glb (added to every root node) so the
//           kit's base 1x1 grid cell is centred on the origin like the city kits
//   why     one-line rationale for the scale

export const KITS = [
  // --- Town grid: 1 Kenney city unit = 1 road tile ---------------------------------------------
  { id: "city-roads", folder: "kenney_city-kit-roads", scale: 8, why: "Road tiles are 1 u square, so x8 makes one tile = TILE = 8 m. Street lights come out ~4.8 m and traffic lights ~4.1 m." },
  { id: "city-commercial", folder: "kenney_city-kit-commercial_2.1", scale: 8, why: "Shares the city 1 u grid with the roads: building-a becomes 7 x 7.5 m, 10 m tall, and the skyscrapers 23-44 m." },
  { id: "city-suburban", folder: "kenney_city-kit-suburban_20", scale: 8, why: "Same city grid: houses are ~10 x 8 m footprints and 6-9 m tall, and the trees 4.5-6 m." },
  { id: "city-industrial", folder: "kenney_city-kit-industrial_2.0", scale: 8, why: "Same city grid: halls are 8-20 m wide, the water tower 17 m and chimneys up to 15 m." },

  // --- Vehicles and the people scale --------------------------------------------------------------
  { id: "car-kit", folder: "kenney_car-kit", scale: 1.7, why: "sedan-sports 2.55 u -> 4.34 m long and 2.2 m wide, comfortably one lane of an 8 m road tile. Trucks come out 5.5-5.9 m." },
  { id: "mini-characters", folder: "kenney_mini-characters", scale: 2.5, why: "The base body is ~0.67-0.72 u tall -> 1.7-1.8 m. Hair and hats push some to ~1.95 m (chibi proportions)." },
  { id: "mini-arcade", folder: "kenney_mini-arcade", scale: 2.5, why: "The Mini series shares the character body (employee 0.72 u), so the same x2.5 gives 1.8 m arcade cabinets and 2.5 m walls." },
  { id: "mini-market", folder: "kenney_mini-market", scale: 2.5, why: "Mini series: shelves ~2.1 m, a 1.2 m shopping cart and 2.5 m walls." },
  { id: "mini-skate", folder: "kenney_mini-skate", scale: 2.5, why: "Mini series: the half-pipe is 2.5 m wide and 2 m tall, ramps 0.8 m. Each 1 u piece is 2.5 m." },
  { id: "mini-forest", folder: "kenney_mini-forest_1.0", scale: 2.5, why: "Mini series (archer = same body): trees 4.2-5.7 m and tents 2.5 m." },
  { id: "mini-dungeon", folder: "kenney_mini-dungeon", scale: 2.5, why: "Mini series (character-human 0.755 u -> 1.9 m): walls 2.5-2.75 m and the chest 1.1 m." },
  { id: "graveyard-kit", folder: "kenney_graveyard-kit_5.0", scale: 2.5, why: "Chibi characters like the Mini series (keeper 0.86 u -> 2.15 m): gravestones ~1.4 m, pines ~5.7 m and the large crypt 2.5 m tall." },
  { id: "holiday-kit", folder: "kenney_holiday-kit", scale: 2.5, why: "Cabin walls are 1 u per storey -> 2.5 m. Decorated trees are 5.7 m and the snowman 2.7 m (a big snowman). The trainset is a toy on purpose." },

  // --- Racing: aligned with the road grid -------------------------------------------------------
  // Unity export quirk: every model sits under a "<name>(Clone)" root translated by (-0.35, -0.01, -0.65),
  // so the base cell spans x[-0.35,0.65], z[-1.65,-0.65]. The offset recentres it on the origin.
  { id: "racing-kit", folder: "kenney_racing-kit", subdir: "Models/GLTF format", scale: 8, offset: [-0.15, 0.01, 1.15], why: "Track tiles are 1 u, so x8 makes one tile = TILE. Asphalt is 0.69 u -> 5.5 m (2.5 sedan widths) and kerb to kerb 6.7 m (3 widths). The kit's own race cars become ~11 m long, so use car-kit vehicles instead." },

  // --- Engineering / industrial props -------------------------------------------------------------
  { id: "factory-kit", folder: "kenney_factory-kit_3.0", scale: 2, why: "Doors 1.6 u -> 3.2 m and the wide roll-up door 3.6 x 3.2 m. Conveyors are 2 m wide, robot arms 6.4 m and structure walls 6 m. Four 1 u cells fit one tile." },

  // --- Landmark / toy-scale kits (scaled for silhouette, not realism) ------------------------------
  { id: "coaster-kit", folder: "kenney_coaster-kit", scale: 4, why: "Landmark: the looping is 4 u -> 16 m tall and a 4 u straight is 16 m (= 2 tiles). Cars come out 2.8 m wide (chunky). Park entrance 12 x 10 m. The track origin is at rail level with supports down to y = -1 u, so place pieces at y = 4 m." },
  { id: "train-kit", folder: "kenney_train-kit", scale: 2, why: "Cross-section is realistic at x2 (locomotives 2.4-2.9 m wide, 3.2-4.6 m tall). Cars are short (~5.2 m, toy proportions). A 4 u rail piece is exactly 1 tile, and rail origins sit 1 u (2 m) above the base of the supports." },
  { id: "space-kit", folder: "kenney_space-kit", subdir: "Models/GLTF format", scale: 4, offset: [-2, 0, -1.5], why: "Landmark: corridors are 4 m (drivable), hangar_largeA 8 x 12 m, and a stacked rocket ~17 m. Astronauts (3.2 m) and desks are oversized, so use mini-characters for people. Two 1 u cells fit one tile. The offset recentres the (2, 0, 1.5) root." },
  { id: "modular-space-kit", folder: "kenney_modular-space-kit_1.0", scale: 2, why: "Raw units are already metre-like (4 m corridors). x2 makes one corridor cell = 8 m = one tile, so the car can drive through the Open Source Lab. Interiors are 8.5 m tall." },
  { id: "pirate-kit", folder: "kenney_pirate-kit", scale: 2, why: "Landmark: tower-complete-large 10.2 u -> 20 m (usable as a lighthouse), ships 18-26 m long with ~20 m masts, palms 8.4 m. Small props (barrels 2.7 m) are oversized." },
  { id: "fantasy-town", folder: "kenney_fantasy-town-kit_2.0", scale: 4, why: "Modular walls are 1 u -> 4 m storeys, two modules per tile. Trees are 9.6-12 m, the windmill 12.5 m and lanterns 6 m (street-light size)." },
  { id: "platformer-kit", folder: "kenney_platformer-kit", scale: 4, why: "Blocks are 1 u -> 4 m (two per tile), trees ~8 m. Coins, stars and keys become 1.5 m collectibles, playful for the Game Dev Park." },
  { id: "food-kit", folder: "kenney_food-kit", scale: 10, why: "Real scale would be invisible from a car, so it's roadside-giant scale: donut 2.5 m, burger 4 m, pizza 8.4 m (one tile), soda cup 4.3 m." },
];
