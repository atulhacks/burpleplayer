/** The reviewed Blender timing, with interruptible departure/return and beat-paced dances. */
export type PerformanceStage =
  "seated" | "hopping-off" | "dancing" | "returning";
export type PerformancePose = {
  time: number;
  blendTime: number;
  blend: number;
  swing: number;
  stage: PerformanceStage;
  beat: number;
  move: "toe-tap" | "heel-kick" | "shuffle";
  departure: number;
};
const clamp = (x: number, low = 0, high = 1) =>
  Math.max(low, Math.min(high, x));
const smooth = (x: number) => {
  x = clamp(x);
  return x * x * x * (x * (6 * x - 15) + 10);
};
const seatSwing = (time: number) => 0.055 * Math.sin((time * Math.PI) / 2);

export class PerformanceController {
  stage: PerformanceStage = "seated";
  time = 0;
  private idle = 0;
  private correction = 0;
  private dance = 2.9;
  private finishBeat: number | null = null;
  private blend = 0;
  private blendFrom = 2.9;
  private joining = false;
  private velocity = 0;

  update(
    dt: number,
    playing: boolean,
    reduced: boolean,
    bpm: number,
  ): PerformancePose {
    dt = clamp(dt, 0, 0.05);
    let swing = 0,
      blendTime = this.time,
      blend = 0;
    if (reduced) {
      this.stage = "seated";
      this.time = 0;
      this.idle = 0;
      this.finishBeat = null;
      this.joining = false;
      this.blend = 0;
    } else if (this.stage === "seated") {
      this.idle += dt;
      this.time = 0;
      swing = seatSwing(this.idle);
      if (playing) {
        this.stage = "hopping-off";
        this.time = 1.2;
        this.correction = swing - seatSwing(1.2);
        this.velocity = 0;
        swing = this.correction;
      }
    } else if (this.stage === "hopping-off") {
      const target = playing ? 1 : -1;
      this.velocity += (target - this.velocity) * (1 - Math.exp(-dt * 14));
      this.time = clamp(this.time + dt * this.velocity, 1.2, 2.9);
      swing = this.correction * (1 - smooth((this.time - 1.2) / 0.55));
      if (this.time >= 2.9 && playing) {
        this.stage = "dancing";
        this.dance = 2.9;
        this.finishBeat = null;
      } else if (this.time <= 1.2 && !playing) {
        this.stage = "seated";
        this.idle =
          Math.asin(clamp((seatSwing(1.2) + this.correction) / 0.055, -1, 1)) /
          (Math.PI / 2);
        this.time = 0;
        swing = seatSwing(this.idle);
      }
    } else if (this.stage === "dancing") {
      if (playing) this.finishBeat = null;
      else if (this.finishBeat === null)
        this.finishBeat = Math.ceil((this.dance - 2.9) * 2 + 0.001);
      this.dance += (dt * clamp(bpm, 70, 180)) / 120;
      const beat = (this.dance - 2.9) * 2;
      if (!playing && this.finishBeat !== null && beat >= this.finishBeat) {
        this.stage = "returning";
        this.time = 15.4;
        this.blendFrom = Math.min(this.dance, 14.899);
        this.blend = 0.18;
        this.joining = false;
        blendTime = this.blendFrom;
        blend = 1;
      } else {
        if (this.dance >= 14.9) {
          this.dance = 2.9 + (this.dance - 14.9);
          if (this.finishBeat !== null) this.finishBeat -= 24;
        }
        this.time = this.dance;
      }
    } else {
      if (this.blend > 0) {
        this.blend = Math.max(0, this.blend - dt);
        blendTime = this.blendFrom;
        blend = smooth(this.blend / 0.18);
        if (this.blend === 0 && this.joining) {
          this.stage = "dancing";
          this.dance = 2.9;
          this.time = 2.9;
        }
      } else {
        this.time = clamp(this.time + dt * (playing ? -1 : 1), 15.4, 17.4);
        if (playing && this.time <= 15.4) {
          this.blendFrom = 15.4;
          this.time = 2.9;
          this.blend = 0.18;
          this.joining = true;
          blendTime = this.blendFrom;
          blend = 1;
        } else if (!playing && this.time >= 17.4) {
          this.stage = "seated";
          this.idle = 17.4;
          this.time = 0;
          swing = seatSwing(this.idle);
        }
      }
    }
    const beat = Math.max(0, (this.dance - 2.9) * 2);
    return {
      time: this.time,
      blendTime,
      blend,
      swing,
      stage: this.stage,
      beat,
      move: (["toe-tap", "heel-kick", "shuffle"] as const)[
        Math.floor(beat / 8) % 3
      ],
      departure:
        this.stage === "seated"
          ? 0
          : this.stage === "hopping-off"
            ? (this.time - 1.2) / 1.7
            : 1,
    };
  }
}
