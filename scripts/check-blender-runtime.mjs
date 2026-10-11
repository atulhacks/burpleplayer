import assert from "node:assert/strict";
import console from "node:console";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import ts from "typescript";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Vector3 } from "three";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const temporary = await fs.mkdtemp(
  path.join(root, "node_modules/.burple-motion-"),
);
try {
  for (const name of ["blenderRuntime", "blenderPerformance"]) {
    const source = await fs.readFile(
      path.join(root, `src/lib/${name}.ts`),
      "utf8",
    );
    const output = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    }).outputText;
    await fs.writeFile(path.join(temporary, `${name}.mjs`), output);
  }
  const { bindBlenderMotion } = await import(
    pathToFileURL(path.join(temporary, "blenderRuntime.mjs"))
  );
  const { PerformanceController } = await import(
    pathToFileURL(path.join(temporary, "blenderPerformance.mjs"))
  );
  const base = path.join(root, "public/models");
  const manifest = JSON.parse(
    await fs.readFile(path.join(base, "burple-motion.json"), "utf8"),
  );
  const compressed = await fs.readFile(path.join(base, "burple-motion.bin"));
  const bytes = gunzipSync(compressed);
  assert.equal(bytes.length, manifest.encodedBytes);
  const encoded = new Int16Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / 2,
  );
  const poses = new Float32Array(encoded.length);
  for (let i = 0; i < encoded.length; i++)
    poses[i] =
      encoded[i] / manifest.scale +
      (i >= manifest.stride ? poses[i - manifest.stride] : 0);
  assert.equal(poses.byteLength, manifest.rawBytes);
  const model = await fs.readFile(path.join(base, "burple-reviewed.glb"));
  const gltf = await new GLTFLoader().parseAsync(
    model.buffer.slice(model.byteOffset, model.byteOffset + model.byteLength),
    "",
  );
  const runtime = bindBlenderMotion(gltf.scene, manifest, poses);
  const controls = new PerformanceController();
  const testPose = controls.update(0, false, false, 120);
  let minimumGround = Infinity,
    maximumGroundGap = 0,
    endpointError = 0;
  const vector = new Vector3();
  for (let frame = 0; frame < 601; frame++) {
    runtime.apply({ ...testPose, time: frame / 30, swing: 0 });
    for (let side = 0; side < 2; side++) {
      const arm = manifest.arms[side],
        data = poses.subarray(
          frame * manifest.stride,
          (frame + 1) * manifest.stride,
        );
      const bone =
        manifest.transforms.indexOf(
          `Runtime bone • Hand_${side === 0 ? "L" : "R"}`,
        ) * 16;
      const end = new Vector3().fromArray(data, arm.offset + 18);
      const wrist = new Vector3(
        data[bone + 12],
        data[bone + 13],
        data[bone + 14],
      );
      endpointError = Math.max(
        endpointError,
        Math.abs(end.distanceTo(wrist) - 0.015),
      );
    }
    if (frame / 30 >= 2.55 && frame / 30 <= 15.8) {
      const bottoms = [];
      for (const side of ["L", "R"]) {
        const boot = runtime.nodes.get(`Boot • grounded sole ${side}`);
        const position = boot.geometry.getAttribute("position");
        let minimum = Infinity;
        for (let i = 0; i < position.count; i++)
          minimum = Math.min(
            minimum,
            vector
              .fromBufferAttribute(position, i)
              .applyMatrix4(boot.matrixWorld).y,
          );
        bottoms.push(minimum);
        minimumGround = Math.min(minimumGround, minimum);
      }
      maximumGroundGap = Math.max(maximumGroundGap, Math.min(...bottoms));
    }
  }
  assert.ok(endpointError < 0.0005, `Cuff endpoint error ${endpointError}`);
  assert.ok(
    minimumGround > -0.001 && maximumGroundGap < 0.001,
    `Boot contact ${minimumGround}, ${maximumGroundGap}`,
  );
  assert.equal(runtime.arms.length, 2);
  const c = new PerformanceController();
  for (let i = 0; i < 200; i++) c.update(1 / 60, true, false, 120);
  assert.equal(c.stage, "dancing");
  for (let i = 0; i < 240; i++) c.update(1 / 60, false, false, 120);
  assert.equal(c.stage, "seated");
  const interrupted = new PerformanceController();
  for (let i = 0; i < 40; i++) interrupted.update(1 / 60, true, false, 120);
  for (let i = 0; i < 80; i++) interrupted.update(1 / 60, false, false, 120);
  assert.equal(interrupted.stage, "seated");
  for (let i = 0; i < 250; i++) interrupted.update(1 / 60, true, false, 120);
  for (let i = 0; i < 80; i++) interrupted.update(1 / 60, false, false, 120);
  for (let i = 0; i < 250; i++) interrupted.update(1 / 60, true, false, 120);
  assert.equal(interrupted.stage, "dancing");
  const still = interrupted.update(1 / 60, true, true, 120);
  assert.equal(still.time, 0);
  assert.equal(still.swing, 0);
  const report = {
    poses: 601,
    armEndpointErrorMeters: endpointError,
    minimumBootY: minimumGround,
    plantedBootGapMeters: maximumGroundGap,
    controllers:
      "departure, pause, interrupted departure, resumed return, reduced motion passed",
    compressedBytes: compressed.length,
  };
  console.log(JSON.stringify(report, null, 2));
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
