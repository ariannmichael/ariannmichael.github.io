// @vitest-environment node
// Headless physics test: the real Rapier vehicle controller with the shipped tuning and VehicleDriver,
// on a planet (ball collider, centre-pointing gravity force, zero world gravity) and on a tilted plane
// (gravity rotated to make a slope). Guards the feel: settles, top speed, braking, climbing, recovery.
import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import { beforeAll, describe, expect, it } from "vitest";
import { PLANET_GRAVITY, PLANET_RADIUS } from "@/world/planet/config";
import { VEHICLE } from "./constants";
import { VehicleDriver } from "./controller";
import type { DriveInput } from "./drive";
import { chassisInertia, configureVehicleController } from "./setup";

const DT = 1 / 60;
const PLANE_Y = 1000;
const idle: DriveInput = { throttle: 0, steer: 0, handbrake: false };

beforeAll(async () => {
  await RAPIER.init();
});

interface Rig {
  world: RAPIER.World;
  rb: RAPIER.RigidBody;
  driver: VehicleDriver;
  run: (input: DriveInput, seconds: number, each?: () => void) => void;
}

/** `gravityAt(position)` returns the gravity acceleration vector at a position. */
function makeRig(
  ground: "planet" | "plane",
  pos: Vector3,
  rot: Quaternion,
  gravityAt: (p: Vector3, out: Vector3) => Vector3,
): Rig {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = DT;
  const fixed = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  if (ground === "planet") world.createCollider(RAPIER.ColliderDesc.ball(PLANET_RADIUS), fixed);
  // Plane far up +Y so "planet up" (normalised position) is +Y, as on a real planet's surface
  else world.createCollider(RAPIER.ColliderDesc.cuboid(2000, 1, 2000).setTranslation(0, PLANE_Y - 1, 0), fixed);

  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w })
      .setCanSleep(false)
      .setCcdEnabled(true)
      .setLinearDamping(VEHICLE.linearDamping)
      .setAngularDamping(VEHICLE.angularDamping),
  );
  const [hx, hy, hz] = VEHICLE.chassisHalf;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(0, VEHICLE.chassisCenterY, 0)
      .setFriction(VEHICLE.friction)
      .setMassProperties(
        VEHICLE.mass,
        { x: 0, y: VEHICLE.centerOfMassY - VEHICLE.chassisCenterY, z: VEHICLE.centerOfMassZ },
        chassisInertia(),
        { x: 0, y: 0, z: 0, w: 1 },
      ),
    rb,
  );
  const vc = world.createVehicleController(rb);
  configureVehicleController(vc);
  const driver = new VehicleDriver(vc, VEHICLE, gravityAt);

  const run = (input: DriveInput, seconds: number, each?: () => void) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      // The driver applies gravity itself (the car opts out of PlanetGravity), as in the game
      driver.step(input, DT);
      world.step();
      each?.();
    }
  };
  return { world, rb, driver, run };
}

const radial = (p: Vector3, out: Vector3) => out.copy(p).normalize().multiplyScalar(-PLANET_GRAVITY);

function planetRig(upsideDown = false) {
  const rot = upsideDown ? new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI) : new Quaternion();
  const h = upsideDown ? 2.6 : VEHICLE.spawnHeight;
  return makeRig("planet", new Vector3(0, PLANET_RADIUS + h, 0), rot, radial);
}

const up = (rb: RAPIER.RigidBody) => {
  const r = rb.rotation();
  return new Vector3(0, 1, 0).applyQuaternion(new Quaternion(r.x, r.y, r.z, r.w));
};
const radialUp = (rb: RAPIER.RigidBody) => {
  const t = rb.translation();
  return new Vector3(t.x, t.y, t.z).normalize();
};

describe("ray-cast vehicle on the planet", () => {
  it("wheel rays ignore sensors: a marker zone under the car is not solid ground", () => {
    const { world, rb, driver, run } = planetRig();
    // A 6×4×6 m marker sensor centred on the ground under the spawn, like zones/Zones.tsx
    const zone = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(3, 2, 3).setTranslation(0, PLANET_RADIUS + 2, 0).setSensor(true),
      zone,
    );
    run(idle, 3);
    const t = rb.translation();
    const height = Math.hypot(t.x, t.y, t.z) - PLANET_RADIUS;
    expect(driver.wheelsInContact).toBe(4);
    expect(height).toBeLessThan(VEHICLE.rideLift + 0.08); // on the ground, not perched 4 m up on the sensor
  });

  it("drops from the spawn height and settles on all four wheels at the raised ride height", () => {
    const { rb, driver, run } = planetRig();
    run(idle, 3);
    expect(driver.wheelsInContact).toBe(4);
    const t = rb.translation();
    const height = Math.hypot(t.x, t.y, t.z) - PLANET_RADIUS;
    // Car origin rests `rideLift` above the ground (wheel bottoms at y = -rideLift in car space)
    expect(height).toBeGreaterThan(VEHICLE.rideLift - 0.08);
    expect(height).toBeLessThan(VEHICLE.rideLift + 0.08);
    expect(up(rb).dot(radialUp(rb))).toBeGreaterThan(0.99);
    expect(driver.speed).toBeLessThan(0.2);
  });

  it("reaches ~25 m/s top speed and stays on the ground over the curvature", () => {
    const { rb, driver, run } = planetRig();
    run(idle, 1.5);
    let max = 0;
    run({ ...idle, throttle: 1 }, 14, () => (max = Math.max(max, driver.forwardSpeed)));
    expect(max).toBeGreaterThan(22);
    expect(max).toBeLessThan(26.5);
    expect(driver.wheelsInContact).toBeGreaterThanOrEqual(3);
    expect(up(rb).dot(radialUp(rb))).toBeGreaterThan(0.95);
  });

  it("accelerates briskly: past 12 m/s within 2 s", () => {
    const { driver, run } = planetRig();
    run(idle, 1.5);
    run({ ...idle, throttle: 1 }, 2);
    expect(driver.forwardSpeed).toBeGreaterThan(12);
  });

  it("brakes from speed to a stop quickly, then reverses", () => {
    const { driver, run } = planetRig();
    run(idle, 1.5);
    run({ ...idle, throttle: 1 }, 4);
    expect(driver.forwardSpeed).toBeGreaterThan(15);
    run({ ...idle, throttle: -1 }, 1.6);
    expect(driver.forwardSpeed).toBeLessThan(2);
    run({ ...idle, throttle: -1 }, 3);
    expect(driver.forwardSpeed).toBeLessThan(-5);
    expect(driver.forwardSpeed).toBeGreaterThan(-VEHICLE.maxReverseSpeed - 0.5);
  });

  it("coasts down without input", () => {
    const { driver, run } = planetRig();
    run(idle, 1.5);
    run({ ...idle, throttle: 1 }, 3);
    const v0 = driver.forwardSpeed;
    run(idle, 2);
    expect(driver.forwardSpeed).toBeLessThan(v0 - 2);
    expect(driver.forwardSpeed).toBeGreaterThan(0);
  });

  it("steering right turns the car to its right (towards car -X)", () => {
    const { rb, driver, run } = planetRig();
    run(idle, 1.5);
    run({ ...idle, throttle: 0.6 }, 2);
    const t0 = rb.translation();
    run({ ...idle, throttle: 0.6, steer: 1 }, 1);
    const t1 = rb.translation();
    // At the north pole, car -X is world -X (identity rotation)
    expect(t1.x - t0.x).toBeLessThan(-1);
    expect(driver.wheelsInContact).toBeGreaterThanOrEqual(3);
  });

  it("hard cornering at speed slides rather than rolls over", () => {
    const { rb, driver, run } = planetRig();
    run(idle, 1.5);
    run({ ...idle, throttle: 1 }, 3);
    let minUp = 1;
    let minContacts = 4;
    run({ ...idle, throttle: 1, steer: 1 }, 4, () => {
      minUp = Math.min(minUp, up(rb).dot(radialUp(rb)));
      minContacts = Math.min(minContacts, driver.wheelsInContact);
    });
    expect(minUp).toBeGreaterThan(0.95);
    expect(minContacts).toBeGreaterThanOrEqual(3);
  });

  it("a handbrake drift holds an angle and recovers with counter-steer (no spin-out)", () => {
    const { rb, driver, run } = planetRig();
    run(idle, 1.5);
    run({ ...idle, throttle: 1 }, 3);
    let maxSlip = 0;
    run({ throttle: 1, steer: 0.7, handbrake: true }, 0.5);
    run({ throttle: 1, steer: 0.4, handbrake: false }, 0.8, () => {
      maxSlip = Math.max(maxSlip, Math.atan2(Math.abs(driver.lateralSpeed), Math.abs(driver.forwardSpeed)));
    });
    expect(maxSlip).toBeGreaterThan(0.25);
    run({ throttle: 1, steer: -0.3, handbrake: false }, 1.5);
    expect(driver.forwardSpeed).toBeGreaterThan(8);
    expect(Math.abs(driver.lateralSpeed)).toBeLessThan(2);
    expect(up(rb).dot(radialUp(rb))).toBeGreaterThan(0.9);
  });

  it("handbrake at speed with steer kicks the rear out (slip angle) without rolling over", () => {
    const { rb, driver, run } = planetRig();
    run(idle, 1.5);
    run({ ...idle, throttle: 1 }, 3.5);
    let maxSlip = 0;
    let maxSmoke = 0;
    run({ throttle: 0.5, steer: 1, handbrake: true }, 1.2, () => {
      maxSlip = Math.max(maxSlip, Math.atan2(Math.abs(driver.lateralSpeed), Math.abs(driver.forwardSpeed)));
      maxSmoke = Math.max(maxSmoke, driver.wheels[2].slip);
    });
    expect(maxSlip).toBeGreaterThan(0.25);
    expect(maxSmoke).toBeGreaterThan(0.5);
    run(idle, 2);
    expect(up(rb).dot(radialUp(rb))).toBeGreaterThan(0.9);
  });

  it("burnout from standstill makes the rear tyres smoke", () => {
    const { driver, run } = planetRig();
    run(idle, 1.5);
    run({ ...idle, throttle: 1 }, 0.1);
    expect(driver.wheels[2].slip).toBeGreaterThan(0.5);
  });

  it("flipped on its roof: auto-upright after ~1.5 s, back on its wheels", () => {
    const { rb, driver, run } = planetRig(true);
    run(idle, 1);
    expect(up(rb).dot(radialUp(rb))).toBeLessThan(0);
    let assisted = false;
    run(idle, 4, () => (assisted ||= driver.upright.assisting));
    expect(assisted).toBe(true);
    run(idle, 1.5);
    expect(up(rb).dot(radialUp(rb))).toBeGreaterThan(0.9);
    expect(driver.wheelsInContact).toBeGreaterThanOrEqual(3);
  });

  it("detects a landing and reports its impact speed", () => {
    const { driver, run } = makeRig("planet", new Vector3(0, PLANET_RADIUS + 5, 0), new Quaternion(), radial);
    let landing = 0;
    let trauma = 0;
    run(idle, 2, () => {
      landing = Math.max(landing, driver.events.landingSpeed);
      trauma += driver.events.trauma;
      driver.events.trauma = 0;
    });
    // Free fall from ~4.4 m at 18 m/s² hits at ≈ 12 m/s
    expect(landing).toBeGreaterThan(8);
    expect(trauma).toBeGreaterThan(0.2);
  });

  it("the drop after a teleport/reset is not counted as a landing", () => {
    const { driver, run } = makeRig("planet", new Vector3(0, PLANET_RADIUS + 5, 0), new Quaternion(), radial);
    driver.reset();
    let landing = 0;
    run(idle, 2, () => (landing = Math.max(landing, driver.events.landingSpeed)));
    expect(landing).toBe(0);
  });
});

describe("hill climbing", () => {
  // Gravity tilted backwards by `deg`: identical to driving up a slope of that angle
  const slope = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return (_p: Vector3, out: Vector3) => out.set(0, -Math.cos(a), -Math.sin(a)).multiplyScalar(PLANET_GRAVITY);
  };

  it("climbs a 35° slope from a standstill", () => {
    const { driver, run } = makeRig("plane", new Vector3(0, PLANE_Y + VEHICLE.spawnHeight, 0), new Quaternion(), slope(35));
    run({ ...idle, handbrake: true }, 1);
    run({ ...idle, throttle: 1 }, 4);
    expect(driver.forwardSpeed).toBeGreaterThan(6);
  });

  it("a 50° wall is too steep: the car slides back down", () => {
    const { driver, run } = makeRig("plane", new Vector3(0, PLANE_Y + VEHICLE.spawnHeight, 0), new Quaternion(), slope(50));
    run({ ...idle, handbrake: true }, 1);
    run({ ...idle, throttle: 1 }, 4);
    expect(driver.forwardSpeed).toBeLessThan(0);
  });

  it("the handbrake holds the car on a 20° slope", () => {
    const { driver, run } = makeRig("plane", new Vector3(0, PLANE_Y + VEHICLE.spawnHeight, 0), new Quaternion(), slope(20));
    run({ ...idle, handbrake: true }, 3);
    expect(Math.abs(driver.forwardSpeed)).toBeLessThan(0.5);
  });
});
