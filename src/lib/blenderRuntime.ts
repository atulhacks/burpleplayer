import * as THREE from "three";
import type { PerformancePose } from "./blenderPerformance";

export type MotionManifest = {
  version: number;
  fps: number;
  frames: number;
  stride: number;
  rawBytes: number;
  encoding: string;
  scale: number;
  encodedBytes: number;
  transforms: string[];
  arms: { name: string; offset: number; radii: number[] }[];
  legs: { name: string; offset: number; vertices: number }[];
};

/** Preallocated circular tube: the native Blender Bezier controls are the source. */
export class ClayArm {
  readonly geometry = new THREE.BufferGeometry();
  private readonly positions = new Float32Array(65 * 17 * 3);
  private readonly normals = new Float32Array(65 * 17 * 3);
  private readonly center = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly binormal = new THREE.Vector3();
  private readonly p = Array.from({ length: 9 }, () => new THREE.Vector3());
  constructor(private readonly radii: number[]) {
    const indices: number[] = [];
    for (let ring = 0; ring < 64; ring++)
      for (let j = 0; j < 16; j++) {
        const a = ring * 17 + j,
          b = a + 1,
          c = a + 17,
          d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    this.geometry.setIndex(indices);
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(this.normals, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
  }
  update(controls: Float32Array, offset: number) {
    for (let i = 0; i < 9; i++) this.p[i].fromArray(controls, offset + i * 3);
    for (let ring = 0; ring <= 64; ring++) {
      const segment = ring < 32 ? 0 : 1,
        t = (ring - segment * 32) / 32,
        u = 1 - t;
      const a = this.p[segment * 3],
        b = this.p[segment * 3 + 2],
        c = this.p[(segment + 1) * 3 + 1],
        d = this.p[(segment + 1) * 3];
      this.center
        .copy(a)
        .multiplyScalar(u * u * u)
        .addScaledVector(b, 3 * u * u * t)
        .addScaledVector(c, 3 * u * t * t)
        .addScaledVector(d, t * t * t);
      this.tangent
        .copy(b)
        .sub(a)
        .multiplyScalar(3 * u * u)
        .addScaledVector(c, 6 * u * t)
        .addScaledVector(b, -6 * u * t)
        .addScaledVector(d, 3 * t * t)
        .addScaledVector(c, -3 * t * t)
        .normalize();
      if (ring === 0) this.normal.set(0, 0, 1);
      this.normal.addScaledVector(this.tangent, -this.normal.dot(this.tangent));
      if (this.normal.lengthSq() < 0.0001)
        this.normal.set(1, 0, 0).addScaledVector(this.tangent, -this.tangent.x);
      this.normal.normalize();
      this.binormal.crossVectors(this.tangent, this.normal).normalize();
      const radius = THREE.MathUtils.lerp(
        this.radii[segment],
        this.radii[segment + 1],
        t,
      );
      for (let j = 0; j <= 16; j++) {
        const angle = (j * Math.PI) / 8,
          cos = Math.cos(angle),
          sin = Math.sin(angle),
          index = (ring * 17 + j) * 3;
        for (let axis = 0; axis < 3; axis++) {
          const n =
            this.normal.getComponent(axis) * cos +
            this.binormal.getComponent(axis) * sin;
          this.positions[index + axis] =
            this.center.getComponent(axis) + radius * n;
          this.normals[index + axis] = n;
        }
      }
    }
    this.geometry.getAttribute("position").needsUpdate = true;
    this.geometry.getAttribute("normal").needsUpdate = true;
  }
}

export async function loadBlenderMotion(base: string, signal: AbortSignal) {
  const [metaResponse, dataResponse] = await Promise.all([
    fetch(`${base}burple-motion.json`, { signal }),
    fetch(`${base}burple-motion.bin`, { signal }),
  ]);
  if (!metaResponse.ok || !dataResponse.ok || !dataResponse.body)
    throw new Error("Blender motion assets unavailable");
  const manifest = (await metaResponse.json()) as MotionManifest;
  const bytes = await new Response(
    dataResponse.body.pipeThrough(new DecompressionStream("gzip")),
  ).arrayBuffer();
  if (
    manifest.version !== 1 ||
    manifest.encoding !== "delta-i16" ||
    bytes.byteLength !== manifest.encodedBytes ||
    bytes.byteLength !== manifest.frames * manifest.stride * 2
  )
    throw new Error("Blender pose cache size/version mismatch");
  const encoded = new Int16Array(bytes),
    poses = new Float32Array(encoded.length);
  for (let i = 0; i < encoded.length; i++)
    poses[i] =
      encoded[i] / manifest.scale +
      (i >= manifest.stride ? poses[i - manifest.stride] : 0);
  return { manifest, poses };
}

export function bindBlenderMotion(
  root: THREE.Object3D,
  manifest: MotionManifest,
  poses: Float32Array,
) {
  const nodes = new Map<string, THREE.Object3D>();
  root.traverse((node) => {
    if (node.userData.runtimeName) nodes.set(node.userData.runtimeName, node);
  });
  const character = new THREE.Group(),
    swing = new THREE.Group();
  const pillars = { left: new THREE.Group(), right: new THREE.Group() };
  root.add(pillars.left, pillars.right);
  character.name = "Runtime character pivot";
  swing.name = "Runtime swing pivot";
  character.position.y = swing.position.y = 6.485;
  root.add(character, swing);
  root.updateMatrixWorld(true);
  for (const node of nodes.values()) {
    if (node.parent?.userData.runtimeName?.startsWith("Runtime bone •"))
      continue;
    const group =
      node.userData.layer === "character"
        ? character
        : node.userData.layer === "swing"
          ? swing
          : node.userData.pillar === "left"
            ? pillars.left
            : node.userData.pillar === "right"
              ? pillars.right
              : null;
    if (group) group.attach(node);
    node.matrixAutoUpdate = false;
    node.updateMatrix();
  }
  const transforms = manifest.transforms.map((name) => {
    const node = nodes.get(name);
    if (!node) throw new Error(`Missing reviewed node: ${name}`);
    return node;
  });
  const arms = manifest.arms.map((info) => {
    const node = nodes.get(info.name) as THREE.Mesh;
    if (!node?.isMesh) throw new Error(`Missing arm: ${info.name}`);
    const tube = new ClayArm(info.radii);
    node.geometry = tube.geometry;
    node.frustumCulled = false;
    return { info, tube, node };
  });
  const legs = manifest.legs.map((info) => {
    const node = nodes.get(info.name) as THREE.Mesh;
    if (!node?.isMesh) throw new Error(`Missing leg: ${info.name}`);
    const index = node.geometry.getAttribute("_motion_index");
    if (!index)
      throw new Error(`Missing leg vertex correspondence: ${info.name}`);
    const position = node.geometry.getAttribute("position"),
      normal = node.geometry.getAttribute("normal");
    if (
      !(position instanceof THREE.BufferAttribute) ||
      !(normal instanceof THREE.BufferAttribute)
    )
      throw new Error("Interleaved leg attributes are unsupported");
    position.setUsage(THREE.DynamicDrawUsage);
    normal.setUsage(THREE.DynamicDrawUsage);
    node.frustumCulled = false;
    return { info, index, position, normal };
  });
  const sample = new Float32Array(manifest.stride);
  function apply(pose: PerformancePose) {
    const frame = THREE.MathUtils.clamp(
      pose.time * manifest.fps,
      0,
      manifest.frames - 1,
    );
    const a = Math.floor(frame),
      b = Math.min(a + 1, manifest.frames - 1),
      weight = frame - a;
    const other = THREE.MathUtils.clamp(
      pose.blendTime * manifest.fps,
      0,
      manifest.frames - 1,
    );
    const c = Math.floor(other),
      d = Math.min(c + 1, manifest.frames - 1),
      w = other - c;
    for (let i = 0; i < sample.length; i++) {
      const value = THREE.MathUtils.lerp(
        poses[a * manifest.stride + i],
        poses[b * manifest.stride + i],
        weight,
      );
      sample[i] = pose.blend
        ? THREE.MathUtils.lerp(
            value,
            THREE.MathUtils.lerp(
              poses[c * manifest.stride + i],
              poses[d * manifest.stride + i],
              w,
            ),
            pose.blend,
          )
        : value;
    }
    transforms.forEach((node, i) => {
      node.matrix.fromArray(sample, i * 16);
      if (node.parent === character || node.parent === swing)
        node.matrix.elements[13] -= 6.485;
      node.matrixWorldNeedsUpdate = true;
    });
    arms.forEach(({ info, tube }) => tube.update(sample, info.offset));
    legs.forEach(({ info, index, position, normal }) => {
      for (let i = 0; i < position.count; i++) {
        const offset = info.offset + Math.round(index.getX(i)) * 6;
        position.setXYZ(
          i,
          sample[offset],
          sample[offset + 1],
          sample[offset + 2],
        );
        normal.setXYZ(
          i,
          sample[offset + 3],
          sample[offset + 4],
          sample[offset + 5],
        );
      }
      position.needsUpdate = normal.needsUpdate = true;
    });
    character.rotation.x = swing.rotation.x = pose.swing;
    root.updateMatrixWorld(true);
  }
  return { apply, nodes, character, swing, arms, pillars };
}
