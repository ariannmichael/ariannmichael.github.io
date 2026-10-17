// Vehicle tuning. Everything that changes how the car feels lives here.
// Units: metres, seconds, radians. Speeds in m/s (22 m/s ~ 80 km/h, which feels fast in a small town).

export const VEHICLE = {
  // --- Physics body (sphere kart) ---
  /** Radius of the invisible physics ball */
  ballRadius: 0.6,
  /** Mass of the ball in kg (cones are light, so the car shoves them around) */
  mass: 8,
  /** Tiny built-in damping; the real drag model is in drive.ts */
  linearDamping: 0.05,
  angularDamping: 2,
  restitution: 0.15,

  // --- Longitudinal ---
  /** Top forward speed */
  maxSpeed: 22,
  /** Top reverse speed */
  maxReverseSpeed: 8,
  /** Forward acceleration at standstill (fades out towards maxSpeed) */
  engineAccel: 18,
  reverseAccel: 10,
  /** Deceleration when braking (Space, or pressing against the direction of travel) */
  brakeDecel: 32,
  /** Exponential coast drag with no input (1/s) */
  coastDrag: 0.7,

  // --- Lateral / steering ---
  /** Max yaw rate (rad/s) at full lock and ideal speed */
  steerRate: 2.7,
  /** Below this speed steering fades to zero (no turning on the spot) */
  steerRampSpeed: 4,
  /** Fraction of steering lost at top speed, for stability */
  highSpeedSteerLoss: 0.4,
  /** How fast the steering input follows the keys (1/s); keeps digital input smooth */
  steerResponse: 10,
  /** Sideways grip (1/s): how quickly sideways sliding is killed */
  grip: 9,
  /** Grip while the handbrake (Space) is held: low, so it drifts */
  driftGrip: 1.8,
  /** Ball centre may be this far above its resting height and still count as grounded */
  groundedTolerance: 0.25,
  /** Steering authority while airborne */
  airSteer: 0.3,

  // --- Visual juice ---
  /** Max body roll into turns (rad) */
  maxRoll: 0.07,
  /** Body pitch per m/s^2 of longitudinal acceleration (rad) */
  pitchPerAccel: 0.004,
  maxPitch: 0.06,
  /** Smoothing rate for roll/pitch (1/s) */
  tiltResponse: 8,
  /** Max front wheel steering angle (rad) */
  maxWheelSteer: 0.45,
  /** Wheel radius in raw Kenney units (scaled by the car-kit scale) */
  wheelRadiusRaw: 0.3,
  /** Suspension spring for the body bounce */
  bounceStiffness: 180,
  bounceDamping: 0.35,
  /** Fraction of a sudden change in vertical speed (landing, kerb) passed to the body bounce */
  bounceKick: 0.5,
  maxBounce: 0.12,

  // --- Safety ---
  /** Below this height the car is respawned */
  fallResetY: -10,
  /** Spawn height above the ground for the ball centre (it drops onto the road) */
  spawnDrop: 0.4,
  /** Duration of the black fade when teleporting (s) */
  teleportFade: 0.45,
} as const;

/** Fallback car-kit scale when the manifest has no car-kit entry yet */
export const DEFAULT_CAR_SCALE = 1.7;

export const SEDAN_REF = "car-kit/sedan-sports";

/** Node names inside sedan-sports.glb (verified in public/models/car-kit/sedan-sports.glb, front = +Z) */
export const SEDAN_NODES = {
  body: "body",
  wheelFL: "wheel-front-left",
  wheelFR: "wheel-front-right",
  wheelBL: "wheel-back-left",
  wheelBR: "wheel-back-right",
} as const;
