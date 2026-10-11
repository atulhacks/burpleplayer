export type Vec3 = [number, number, number];
export type DanceMove = "toe-tap" | "heel-kick" | "shuffle";
export interface DancerPose {
  character: Vec3;
  characterRotation: Vec3;
  bodyPosition: Vec3;
  bodyRotation: Vec3;
  bodyScale: Vec3;
  leftArm: Vec3;
  rightArm: Vec3;
  leftFoot: Vec3;
  rightFoot: Vec3;
  leftFootRotation: Vec3;
  rightFootRotation: Vec3;
  swing: number;
  departure: number;
  beat: number;
  move: DanceMove;
  stage: "seated" | "hopping-off" | "dancing" | "returning";
}

export const DANCE_MOVES: DanceMove[] = ["toe-tap", "heel-kick", "shuffle"];
export const SEATED_HEIGHT = 1.5295;
const TAU = Math.PI * 2;
const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const smooth = (n: number) => {
  const x = clamp(n);
  return x * x * (3 - 2 * x);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Onset timing comes from the Rust spectrum, never from a browser audio file. */
export class RhythmTracker {
  bpm = 112;
  energy = 0;
  bass = 0;
  pulse = 0;
  lastSignal = -Infinity;
  private lastOnset = -Infinity;
  private average = 0;
  private previousBass = 0;
  private intervals: number[] = [];

  reset() {
    this.bpm = 112;
    this.energy = this.bass = this.pulse = this.average = this.previousBass = 0;
    this.lastSignal = this.lastOnset = -Infinity;
    this.intervals = [];
  }

  push(bands: readonly number[], time: number) {
    const values = Array.from({ length: 16 }, (_, i) =>
      clamp((bands[i] ?? 0) / 255),
    );
    const bass = (values[0] + values[1] + values[2]) / 3;
    this.energy = values.reduce((a, b) => a + b, 0) / 16;
    this.bass = bass;
    this.lastSignal = time;
    const onset =
      bass > 0.08 &&
      bass > this.average * 1.18 + 0.025 &&
      bass - this.previousBass > 0.025;
    this.average += (bass - this.average) * 0.08;
    this.previousBass = bass;
    if (!onset || time - this.lastOnset < 0.27) return;
    const interval = time - this.lastOnset;
    this.lastOnset = time;
    this.pulse = 1;
    if (interval >= 0.32 && interval <= 1.05) {
      this.intervals.push(interval);
      this.intervals = this.intervals.slice(-8);
      if (this.intervals.length >= 3) {
        const sorted = [...this.intervals].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        this.bpm += (clamp(60 / median, 70, 180) - this.bpm) * 0.35;
      }
    }
  }

  advance(dt: number, time: number) {
    this.pulse *= Math.exp(-dt * 8);
    if (time - this.lastSignal > 0.25) {
      this.energy *= Math.exp(-dt * 5);
      this.bass *= Math.exp(-dt * 5);
    }
  }
}

/** Shared deterministic choreography: runtime transforms and Blender clip baking. */
export function dancerPose(
  departure: number,
  beat: number,
  time: number,
  energy: number,
  returning = false,
): DancerPose {
  departure = clamp(departure);
  const travel = smooth((departure - 0.14) / 0.86);
  const dance = smooth((departure - 0.87) / 0.13);
  const swing = Math.sin((time * TAU) / 4) * mix(0.065, 0.026, departure);
  const y = SEATED_HEIGHT - 6.485;
  const seatedY = 6.485 + y * Math.cos(swing) - 0.67 * Math.sin(swing);
  const seatedZ = y * Math.sin(swing) + 0.67 * Math.cos(swing);
  const landing = Math.sin(Math.PI * travel) ** 2 * 0.68;
  const compression =
    Math.sin(Math.PI * clamp((departure - 0.76) / 0.24)) ** 2 * 0.11;
  const cycle = ((beat % 2) + 2) % 2;
  const leftLift = Math.max(0, Math.sin(Math.PI * cycle)) ** 2;
  const rightLift = Math.max(0, -Math.sin(Math.PI * cycle)) ** 2;
  const wave = Math.sin(beat * Math.PI);
  const bounce = (1 - Math.cos(beat * TAU)) * 0.045;
  const strength = 0.35 + clamp(energy) * 0.65;
  const index = Math.floor(Math.max(0, beat) / 8) % 3;
  const previous = (index + 2) % 3;
  const change = smooth((beat % 8) / 0.75);
  const weights = [0, 0, 0];
  weights[index] += change;
  weights[previous] += 1 - change;
  const kick = weights[1];
  const shuffle = weights[2];
  const release = smooth(departure / 0.3);
  const armSwing = wave * strength * 0.5;
  const lean = wave * (0.065 + shuffle * 0.09) * strength;
  const pose: DancerPose = {
    character: [
      mix(0, shuffle * wave * 0.18, dance),
      mix(seatedY, 0, travel) + landing,
      mix(seatedZ, 1.45, travel),
    ],
    characterRotation: [swing * (1 - travel), 0, 0],
    bodyPosition: [
      wave * 0.035 * dance,
      (bounce * strength - compression) * dance,
      0,
    ],
    bodyRotation: [
      0.025 * Math.sin(beat * TAU) * dance,
      shuffle * wave * 0.24 * dance,
      lean * dance,
    ],
    bodyScale: [
      1 + compression * 0.3,
      1 - compression * 0.5,
      1 + compression * 0.25,
    ],
    leftArm: [
      0,
      0,
      release * 0.75 + dance * (1.25 + armSwing - kick * leftLift * 0.65),
    ],
    rightArm: [
      0,
      0,
      -release * 0.75 - dance * (1.25 - armSwing - kick * rightLift * 0.65),
    ],
    leftFoot: [
      -shuffle * wave * 0.12 * dance,
      leftLift * (0.07 + kick * 0.28) * strength * dance,
      -kick * leftLift * 0.22 * dance,
    ],
    rightFoot: [
      shuffle * wave * 0.12 * dance,
      rightLift * (0.07 + kick * 0.28) * strength * dance,
      -kick * rightLift * 0.22 * dance,
    ],
    leftFootRotation: [
      -leftLift * (0.13 + kick * 0.6) * strength * dance,
      shuffle * wave * 0.22 * dance,
      -leftLift * 0.08 * strength * dance,
    ],
    rightFootRotation: [
      -rightLift * (0.13 + kick * 0.6) * strength * dance,
      -shuffle * wave * 0.22 * dance,
      rightLift * 0.08 * strength * dance,
    ],
    swing,
    departure,
    beat,
    move: DANCE_MOVES[index],
    stage:
      departure === 0
        ? "seated"
        : departure === 1
          ? "dancing"
          : returning
            ? "returning"
            : "hopping-off",
  };
  return pose;
}

export class DancerController {
  departure = 0;
  beat = 0;
  time = 0;
  private finishing = false;
  private finishBeat = 0;

  update(
    dt: number,
    playing: boolean,
    reduced: boolean,
    bpm: number,
    energy: number,
  ): DancerPose {
    dt = clamp(dt, 0, 0.05);
    this.time += dt;
    if (reduced) {
      this.departure = 0;
      this.finishing = false;
      return dancerPose(0, 0, 0, 0);
    }
    if (playing) this.finishing = false;
    else if (this.departure === 1 && !this.finishing) {
      this.finishing = true;
      this.finishBeat = Math.ceil(this.beat + 0.001);
    }
    const finishStep =
      !playing && this.finishing && this.beat < this.finishBeat;
    if (playing || finishStep) this.beat += (dt * clamp(bpm, 70, 180)) / 60;
    const leave = playing || finishStep;
    this.departure = clamp(
      this.departure + dt * (leave ? 1 / 1.35 : -1 / 1.55),
    );
    if (this.departure === 0) this.finishing = false;
    return dancerPose(this.departure, this.beat, this.time, energy, !leave);
  }
}
