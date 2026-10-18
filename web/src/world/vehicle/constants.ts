// Vehicle tuning. Everything that changes how the car feels lives here.
// Units: metres, seconds, radians, kg, newtons. Speeds in m/s (25 m/s = 90 km/h, fast on a 150 m planet).
//
// The car is a Rapier DynamicRayCastVehicleController: a dynamic chassis box with four ray-cast wheels.
// Rapier's suspension force is `stiffness × compression × chassisMass` (per wheel), so the spring and
// damper numbers below are per unit mass and don't change if `mass` changes.

/** Car-kit scale (manifest value); geometry below is already in metres at this scale */
export const DEFAULT_CAR_SCALE = 1.7;

/** The car model. Swap here (and re-check VEHICLE geometry below) to change vehicles. */
export const VEHICLE_REF = "car-kit/suv";

/**
 * Animated nodes inside suv.glb (front = +Z). Order matches the controller's wheel indices:
 * 0 front-left, 1 front-right, 2 back-left, 3 back-right. ("wheel-back" is the spare tyre on the
 * tailgate, a child of "body"; it stays static.)
 */
export const VEHICLE_WHEEL_NODES = ["wheel-front-left", "wheel-front-right", "wheel-back-left", "wheel-back-right"] as const;

export const VEHICLE = {
  // --- Chassis ---
  mass: 220,
  /**
   * Chassis box half extents (m) and centre in car space (car origin = the model origin, i.e. the
   * bottom of the stock wheels). The SUV body spans x ±1.275, y 0.34–2.21, z ±2.295; the box is a
   * little inside that so glancing contacts feel fair, and covers the roof so a rollover rests on it.
   */
  chassisHalf: [1.12, 0.84, 2.18] as const,
  chassisCenterY: 1.3,
  /**
   * Centre of mass in car space: an arcade cheat, below the floor (≈0.27 m above the ground, far below
   * the box centre at 1.3 m) so the tall, narrow SUV doesn't trip over in hard corners. Nudged forward
   * (engine) between the asymmetric axles.
   */
  centerOfMassY: 0.12,
  centerOfMassZ: 0.12,
  /** Multiplier on the box's inertia: a "heavier-feeling" chassis that rotates more calmly */
  inertiaScale: 1.6,
  linearDamping: 0.02,
  angularDamping: 0.6,
  restitution: 0.05,
  friction: 0.4,

  // --- Wheels (suv hubs: raw x ±0.3, y 0.3, front z +0.76, rear z -0.56, times the kit scale) ---
  /** Visual hub x (the model's) */
  wheelX: 0.3 * DEFAULT_CAR_SCALE,
  /**
   * Physics track half-width: wider than the visual hubs (0.51 m). The stock SUV track would roll over
   * at < 1 g; with this and the low CoM the static stability factor (0.72 / 0.27 ≈ 2.7) beats the tyre
   * grip, so hard cornering slides instead of flipping. Jumps and rocks can still flip it.
   */
  trackX: 0.72,
  wheelFrontZ: 0.76 * DEFAULT_CAR_SCALE,
  wheelRearZ: -0.56 * DEFAULT_CAR_SCALE,
  wheelRadius: 0.3 * DEFAULT_CAR_SCALE,
  /** The stock hub height; the off-road build hangs the wheels `rideLift` lower (raised body) */
  hubY: 0.3 * DEFAULT_CAR_SCALE,
  rideLift: 0.15,

  // --- Suspension (off-road: soft, long travel, well damped) ---
  /** Spring rest length (m). Also the droop limit: in the air the wheel hangs at this length */
  suspensionRest: 0.6,
  /** Max compression from rest (m). Rest 0.6 - travel 0.5 = 0.1 m bump stop: 0.5 m of total travel */
  suspensionTravel: 0.5,
  /** Per-unit-mass stiffness. Static sag = g·share / (2k) ≈ 0.22 m at 18 m/s², ~1.4 Hz ride */
  suspensionStiffness: 20,
  /** Per-unit-mass damping (critical ≈ 2√(4k)/4 ≈ 4.5 per wheel) */
  suspensionCompression: 2.4,
  suspensionRelaxation: 2.8,
  /** Cap on a single wheel's suspension force, as a multiple of the car's weight (landings) */
  maxSuspensionForceG: 6,

  // --- Tyres ---
  /** Friction coefficient (traction limit = slip × suspension force) on loose dirt */
  frictionSlipFront: 1.7,
  frictionSlipRear: 1.55,
  sideFrictionStiffness: 1,
  /** Rear grip multiplier once the car is sliding (kinetic < static): lets drifts hold */
  driftGrip: 0.5,
  /** Rear grip multiplier with the handbrake: the rear steps out on demand */
  handbrakeGrip: 0.22,
  /** Slip angle (rad) where grip starts to drop, and where it reaches `driftGrip` */
  slipAngleStart: 0.07,
  slipAngleFull: 0.3,
  /**
   * Drift stabiliser (arcade): past this slip angle, yaw that would increase the slip is damped at
   * `driftYawDamping` × excess (1/s), so drifts settle at a stylish angle instead of spinning out
   */
  driftMaxAngle: 0.5,
  driftYawDamping: 30,

  // --- Engine / brakes ---
  /** AWD, rear-biased: climbs hills like AWD, power-oversteers like RWD */
  rearTorqueShare: 0.7,
  /** Total drive force at standstill (N); ≈ 13 m/s², enough to climb ~30° slopes at 18 m/s² gravity */
  engineForce: 2900,
  /** The engine force fades to zero at this speed; with drag the car tops out at ~24.5 m/s on the flat */
  maxSpeed: 26.5,
  reverseForce: 1600,
  maxReverseSpeed: 9,
  /** Service brake impulse per wheel per step (N·s). ≈ 22 m/s² total */
  brakeImpulse: 20,
  /** Rear handbrake impulse per wheel per step */
  handbrakeImpulse: 30,
  /** Below this speed with no throttle the parking brake holds all four wheels (m/s) */
  parkSpeed: 1.2,
  /** Rolling resistance when coasting (m/s² equivalent) */
  coastDecel: 1.6,
  /** Linear air/rolling drag (1/s) on the tangent velocity */
  drag: 0.035,

  // --- Steering ---
  /** Max front-wheel angle at low speed (rad) */
  maxSteer: 0.58,
  /** Fraction of the max angle left at top speed */
  highSpeedSteer: 0.35,
  /** How fast the steering input follows the keys (1/s) */
  steerResponse: 9,
  /** How fast steering returns to centre when released (1/s) */
  steerReturn: 14,

  // --- Air control and recovery ---
  /** Seconds with no wheel contact before we count as airborne (ignores tiny hops) */
  airborneDelay: 0.12,
  /** Angular acceleration from input while airborne (rad/s²) */
  airPitchAccel: 5,
  airRollAccel: 4,
  /** Air-control never spins the car faster than this (rad/s) */
  airMaxRate: 3.5,
  /** chassisUp · planetUp below this counts as flipped (≈ 70° tilt) */
  flippedDot: 0.35,
  /** Seconds flipped (and nearly stopped) before the auto-upright kicks in */
  flippedDelay: 1.5,
  /** Below this speed (m/s) a flipped car is considered stuck */
  flippedMaxSpeed: 4,
  /** Upright assist angular speed (rad/s) and the up-dot where it lets go */
  uprightRate: 3.2,
  uprightDoneDot: 0.92,
  /** Small hop while righting so the roof doesn't scrape (m/s along local up) */
  uprightLift: 3.5,

  // --- Spawn / safety ---
  /** Spawn height above the terrain (m): the car drops onto its suspension */
  spawnHeight: 1.5,
  /** Respawn if the car ends up this far below the terrain surface (tunnelled) */
  fallBelowSurface: 6,
  /** Duration of the black fade when teleporting (s) */
  teleportFade: 0.45,

  // --- Feedback (camera shake) ---
  /** Vertical landing speed (m/s) below which a landing doesn't shake */
  landingShakeMin: 3,
  /** Vertical landing speed that gives full trauma */
  landingShakeMax: 16,
  /** Minimum airtime (s) for a touchdown to count as a landing */
  landingMinAir: 0.25,
  /** Speed lost in one physics step (m/s) that counts as a crash, and the loss for full trauma */
  crashDvMin: 3,
  crashDvMax: 14,
  /** Contact force (in multiples of the car's weight) for the contact-force event and full trauma */
  contactForceMinG: 4,
  contactForceMaxG: 30,
} as const;

export type VehicleTuning = typeof VEHICLE;
