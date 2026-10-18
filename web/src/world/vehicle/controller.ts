// One fixed physics step of the off-road car: input → drive command → Rapier vehicle controller, plus
// drag, air control, auto-upright, landing/crash detection and per-wheel telemetry for FX and camera.
// No React here: Vehicle.tsx calls `step()` from useBeforePhysicsStep, and setup.test.ts calls it in a
// headless Rapier world, so the shipped handling is the tested handling.
import type { DynamicRayCastVehicleController, RigidBody } from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import { clamp } from "@/world/lib/damping";
import { PLANET_GRAVITY } from "@/world/planet/config";
import { VEHICLE, type VehicleTuning } from "./constants";
import {
  airControl,
  crashTrauma,
  driveCommand,
  landingTrauma,
  smoothSteer,
  stabiliseYaw,
  uprightStep,
  type DriveInput,
  type UprightState,
} from "./drive";
import { FRONT_WHEELS, REAR_WHEELS, WHEEL_COUNT } from "./setup";

/** Rapier `QueryFilterFlags.EXCLUDE_SENSORS`, inlined so this module doesn't import Rapier's runtime (and its WASM) eagerly. */
export const QUERY_EXCLUDE_SENSORS = 8;

export interface WheelTelemetry {
  /** World-space contact point (or the hanging wheel's lowest point when airborne) */
  contact: Vector3;
  inContact: boolean;
  /** 0..1: how hard the tyre is sliding/spinning (drives smoke) */
  slip: number;
  /** Current suspension length (m), for the wheel visuals */
  suspensionLength: number;
  /** Wheel rotation about its axle (rad) */
  rotation: number;
  /** Steer angle (rad, + = left) */
  steer: number;
}

/** Events raised during a step (read and cleared by the caller). */
export interface StepEvents {
  /** Trauma (0..1) to add to the camera shake this step */
  trauma: number;
  /** Vertical speed of a landing that happened this step (0 = none) */
  landingSpeed: number;
}

const _q = new Quaternion();
const _fwd = new Vector3();
const _right = new Vector3();
const _up = new Vector3();
const _planetUp = new Vector3();
const _v = new Vector3();
const _w = new Vector3();
const _tmp = new Vector3();
const _axis = new Vector3();
const _n = new Vector3();
const _g = new Vector3();

/** Gravity acceleration at a position. The game's is centre-pointing (applied by PlanetGravity). */
export type GravityFn = (position: Vector3, out: Vector3) => Vector3;
export const planetGravity: GravityFn = (p, out) => out.copy(p).normalize().multiplyScalar(-PLANET_GRAVITY);

export class VehicleDriver {
  readonly wheels: WheelTelemetry[] = Array.from({ length: WHEEL_COUNT }, () => ({
    contact: new Vector3(),
    inContact: false,
    slip: 0,
    suspensionLength: VEHICLE.suspensionRest,
    rotation: 0,
    steer: 0,
  }));
  steer = 0;
  forwardSpeed = 0;
  lateralSpeed = 0;
  speed = 0;
  wheelsInContact = 0;
  /** Seconds since the last wheel contact (0 while any wheel touches) */
  airTime = 0;
  grounded = true;
  /** 0..1 how much the suspension is working (compression speed), for the rumble */
  suspensionActivity = 0;
  upright: UprightState = { flippedFor: 0, assisting: false };
  readonly events: StepEvents = { trauma: 0, landingSpeed: 0 };

  private prevSpeed = 0;
  /** After a teleport/reset the car drops onto its wheels; that first touchdown isn't a "landing" */
  private settling = false;
  private prevLengths = new Float32Array(WHEEL_COUNT).fill(VEHICLE.suspensionRest);

  constructor(
    private readonly vc: DynamicRayCastVehicleController,
    private readonly t: VehicleTuning = VEHICLE,
    /**
     * Gravity for the chassis. The car opts out of PlanetGravity (gravityScale 0) and applies the same
     * centre-pointing gravity inside its step, so the parking hold can cancel it
     * exactly regardless of the order Rapier step callbacks run in.
     */
    private readonly gravityAt: GravityFn = planetGravity,
  ) {}

  /** Forget motion history (after a teleport/reset) so it isn't read as a crash or landing. */
  reset(): void {
    this.steer = 0;
    this.prevSpeed = 0;
    this.airTime = 0;
    this.grounded = false;
    this.upright = { flippedFor: 0, assisting: false };
    this.settling = true;
    this.prevLengths.fill(this.t.suspensionRest);
    this.events.trauma = 0;
    this.events.landingSpeed = 0;
  }

  step(input: DriveInput, dt: number): void {
    const t = this.t;
    const vc = this.vc;
    const rb: RigidBody = vc.chassis();
    if (dt <= 0) return;

    // Chassis frame in world space
    const r = rb.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    _fwd.set(0, 0, 1).applyQuaternion(_q);
    _right.set(-1, 0, 0).applyQuaternion(_q); // car +X is its left side
    _up.set(0, 1, 0).applyQuaternion(_q);
    const p = rb.translation();
    _planetUp.set(p.x, p.y, p.z).normalize();
    const lv = rb.linvel();
    _v.set(lv.x, lv.y, lv.z);

    this.forwardSpeed = _v.dot(_fwd);
    this.lateralSpeed = _v.dot(_right);
    this.speed = _v.length();
    // Speed into the ground before the suspension acts: what a landing hits with
    const verticalIn = -_v.dot(_planetUp);

    // --- Drive ---
    this.steer = smoothSteer(this.steer, clamp(input.steer, -1, 1), dt, t);
    const cmd = driveCommand(
      { throttle: input.throttle, steer: this.steer, handbrake: input.handbrake },
      this.forwardSpeed,
      this.lateralSpeed,
      dt,
      t,
    );
    for (const i of FRONT_WHEELS) {
      vc.setWheelSteering(i, cmd.steerAngle);
      vc.setWheelEngineForce(i, cmd.engineFront);
      vc.setWheelBrake(i, cmd.brakeFront);
    }
    for (const i of REAR_WHEELS) {
      vc.setWheelSteering(i, 0);
      vc.setWheelEngineForce(i, cmd.engineRear);
      vc.setWheelBrake(i, cmd.brakeRear);
      vc.setWheelFrictionSlip(i, t.frictionSlipRear * cmd.rearGrip);
    }

    // Wheel rays must ignore sensors (marker zones), or every 6×6×4 m zone acts as a solid block.
    vc.updateVehicle(dt, QUERY_EXCLUDE_SENSORS);

    // Gravity as an impulse (what PlanetGravity does for every other body). After the suspension
    // solve, so the dampers don't read the gravity kick as compression speed
    this.gravityAt(_tmp.set(p.x, p.y, p.z), _g).multiplyScalar(rb.mass() * dt);
    rb.applyImpulse(_g, true);

    // --- Contacts, airtime, landing ---
    let contacts = 0;
    let activity = 0;
    for (let i = 0; i < WHEEL_COUNT; i++) {
      const wt = this.wheels[i];
      wt.inContact = vc.wheelIsInContact(i);
      if (wt.inContact) contacts++;
      const len = vc.wheelSuspensionLength(i) ?? t.suspensionRest;
      activity += Math.abs(len - this.prevLengths[i]) / dt;
      this.prevLengths[i] = len;
      wt.suspensionLength = len;
      wt.rotation = vc.wheelRotation(i) ?? 0;
      wt.steer = vc.wheelSteering(i) ?? 0;
      const cp = wt.inContact ? vc.wheelContactPoint(i) : vc.wheelHardPoint(i);
      if (cp) wt.contact.set(cp.x, cp.y, cp.z);
      if (!wt.inContact) wt.contact.addScaledVector(_up, -(len + t.wheelRadius));
    }
    this.suspensionActivity = clamp(activity / WHEEL_COUNT / 1.5, 0, 1);

    const wasAirTime = this.airTime;
    this.wheelsInContact = contacts;
    this.events.landingSpeed = 0;
    if (contacts > 0) {
      if (this.settling) {
        this.settling = false;
      } else if (wasAirTime >= t.landingMinAir && verticalIn > 0) {
        this.events.landingSpeed = verticalIn;
        this.events.trauma += landingTrauma(verticalIn, t);
      }
      this.airTime = 0;
    } else {
      this.airTime += dt;
    }
    this.grounded = contacts > 0 || this.airTime < t.airborneDelay;

    // --- Wheel slip (smoke) ---
    const angv = rb.angvel();
    _w.set(angv.x, angv.y, angv.z);
    const yawRate = _w.dot(_up);
    const throttle = clamp(input.throttle, -1, 1);
    const absFwd = Math.abs(this.forwardSpeed);
    const burnout = throttle > 0.3 && this.forwardSpeed < 7 && this.forwardSpeed > -1 ? throttle * (1 - Math.max(0, this.forwardSpeed) / 7) : 0;
    for (let i = 0; i < WHEEL_COUNT; i++) {
      const wt = this.wheels[i];
      if (!wt.inContact) {
        wt.slip = 0;
        continue;
      }
      const isRear = i >= 2;
      const z = isRear ? t.wheelRearZ : t.wheelFrontZ;
      // Sideways speed at this axle: chassis lateral plus the yaw rate swinging the axle sideways
      let slipSpeed = Math.abs(this.lateralSpeed - yawRate * z);
      if (isRear && input.handbrake) slipSpeed = Math.max(slipSpeed, absFwd);
      const spin = burnout * (isRear ? 9 : 4);
      wt.slip = clamp((Math.max(slipSpeed, spin) - 2) / 6, 0, 1);
    }

    // --- Drift stabiliser ---
    if (contacts >= 2) {
      const stable = stabiliseYaw(yawRate, this.forwardSpeed, this.lateralSpeed, dt, t);
      if (stable !== yawRate) {
        _w.addScaledVector(_up, stable - yawRate);
        rb.setAngvel(_w, true);
      }
    }

    // --- Parking hold: Rapier's brake only cancels last step's velocity, so on a slope gravity always
    // wins one step and the car creeps. Cancel the ground-plane velocity, which already includes this
    // step's gravity impulse (applied right after the suspension solve) ---
    const parked = input.throttle === 0 && Math.abs(this.forwardSpeed) < t.parkSpeed && contacts >= 3;
    if (parked) {
      _n.set(0, 0, 0);
      for (let i = 0; i < WHEEL_COUNT; i++) {
        const cn = this.wheels[i].inContact ? vc.wheelContactNormal(i) : null;
        if (cn) _n.add(_tmp.set(cn.x, cn.y, cn.z));
      }
      if (_n.lengthSq() > 1e-6) {
        _n.normalize();
        const v3 = rb.linvel();
        _tmp.set(v3.x, v3.y, v3.z);
        _tmp.addScaledVector(_n, -_tmp.dot(_n)).multiplyScalar(-rb.mass());
        rb.applyImpulse(_tmp, true);
      }
    }

    // --- Drag (tangent velocity only, so it never fights gravity) ---
    if (contacts > 0) {
      const vUp = _v.dot(_planetUp);
      _tmp.copy(_v).addScaledVector(_planetUp, -vUp).multiplyScalar(-t.drag * rb.mass() * dt);
      rb.applyImpulse(_tmp, true);
    }

    // --- Air control (Over the Hill): pitch with throttle, roll with steer ---
    if (contacts === 0 && this.airTime > t.airborneDelay) {
      const pitchRate = _w.dot(_tmp.set(1, 0, 0).applyQuaternion(_q));
      const rollRate = _w.dot(_fwd);
      const air = airControl({ throttle: input.throttle, steer: input.steer }, pitchRate, rollRate, dt, t);
      // Positive about car +X pitches the nose (+Z) down; positive about +Z swings the roof towards -X,
      // the car's right side, i.e. rolls right
      _w.addScaledVector(_tmp, air.pitch).addScaledVector(_fwd, air.roll);
      rb.setAngvel(_w, true);
    }

    // --- Auto-upright when flipped and stuck ---
    const upDot = _up.dot(_planetUp);
    const before = this.upright.assisting;
    this.upright = uprightStep(this.upright, upDot, this.speed, dt, t);
    if (this.upright.assisting) {
      // Rotate chassis up towards planet up about their common perpendicular
      _axis.crossVectors(_up, _planetUp);
      if (_axis.lengthSq() < 1e-6) _axis.copy(_fwd); // exactly upside down: roll over sideways
      _axis.normalize().multiplyScalar(t.uprightRate);
      rb.setAngvel(_axis, true);
      if (!before) {
        _tmp.copy(_planetUp).multiplyScalar(t.uprightLift * rb.mass());
        rb.applyImpulse(_tmp, true);
      }
    }

    // --- Crash: sudden loss of speed in one step ---
    const dv = this.prevSpeed - this.speed;
    if (dv > 0) this.events.trauma += crashTrauma(dv, t);
    this.prevSpeed = this.speed;
  }
}
