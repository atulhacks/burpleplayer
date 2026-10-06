export type Point = { x: number; y: number };
export type ArmBone = { start: Point; end: Point };

export const SWING_GRIPS = {
  left: { x: 433, anchorY: 260, gripY: 671 },
  right: { x: 723, anchorY: 281, gripY: 676 },
} as const;

export function ropePoint(
  side: keyof typeof SWING_GRIPS,
  y: number,
  angle: number,
): Point {
  const { x, anchorY } = SWING_GRIPS[side];
  const radians = (angle * Math.PI) / 180;
  return {
    x: x - (y - anchorY) * Math.sin(radians),
    y: anchorY + (y - anchorY) * Math.cos(radians),
  };
}

export function swingArmBones(angle: number, bodyTilt: number): ArmBone[] {
  const radians = (angle * Math.PI) / 180;
  const tilt = (bodyTilt * Math.PI) / 180;
  const offset = {
    x: -610 * Math.sin(radians),
    y: 610 * (Math.cos(radians) - 1),
  };
  return (["left", "right"] as const).flatMap((side) => {
    const left = side === "left";
    const shoulder = { x: left ? 451 : 704, y: 737 };
    const dx = shoulder.x - 578;
    const dy = shoulder.y - 710;
    const start = {
      x: 578 + dx * Math.cos(tilt) - dy * Math.sin(tilt) + offset.x,
      y: 710 + dx * Math.sin(tilt) + dy * Math.cos(tilt) + offset.y,
    };
    const wrist = ropePoint(side, SWING_GRIPS[side].gripY + 25, angle);
    const elbow = {
      x: (start.x + wrist.x) / 2 + (left ? -30 : 30),
      y: (start.y + wrist.y) / 2 + 26,
    };
    return [
      { start, end: elbow },
      { start: elbow, end: wrist },
    ];
  });
}

export function armBoneMatrix({ start, end }: ArmBone): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  // The local bone runs down the Y axis from 0 to 100.
  return `matrix(${dy / length},${-dx / length},${dx / 100},${dy / 100},${start.x},${start.y})`;
}
