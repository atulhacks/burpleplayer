import assert from "node:assert/strict";
import process from "node:process";
import {
  armBoneMatrix,
  ropePoint,
  swingArmBones,
  SWING_GRIPS,
} from "../src/lib/swingGeometry.ts";

const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9);
let poses = 0;
for (let angle = -7; angle <= 7; angle += 0.25) {
  for (const tilt of [-1.5, 0, 1.5]) {
    const bones = swingArmBones(angle, tilt);
    for (const [index, side] of ["left", "right"].entries()) {
      const upper = bones[index * 2];
      const forearm = bones[index * 2 + 1];
      close(upper.end.x, forearm.start.x);
      close(upper.end.y, forearm.start.y);
      const wrist = ropePoint(side, SWING_GRIPS[side].gripY + 25, angle);
      close(forearm.end.x, wrist.x);
      close(forearm.end.y, wrist.y);
      for (const bone of [upper, forearm]) {
        const values = armBoneMatrix(bone).slice(7, -1).split(",").map(Number);
        assert.ok(values.every(Number.isFinite));
        close(values[4], bone.start.x);
        close(values[5], bone.start.y);
        close(values[2] * 100 + values[4], bone.end.x);
        close(values[3] * 100 + values[5], bone.end.y);
      }
    }
    poses += 1;
  }
}
process.stdout.write(
  `Swing grip geometry: ${poses} poses passed; wrists remain rope-pinned.\n`,
);
