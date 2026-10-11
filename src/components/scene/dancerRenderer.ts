import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { gsap } from "gsap";
import { listen } from "@tauri-apps/api/event";
import { RhythmTracker } from "../../lib/dancerMotion";
import { PerformanceController } from "../../lib/blenderPerformance";
import { bindBlenderMotion, loadBlenderMotion } from "../../lib/blenderRuntime";
import { desktopAvailable } from "../../lib/playerApi";
import type { SpectrumEvent } from "../../lib/playerApi";
import { cubeColorForTrack } from "../../lib/artPalette";
import { spectrumAsciiRows, PAUSED_LCD_ASCII } from "../../lib/ascii";
import { useAppStore } from "../../store/appStore";
import { usePlayerStore } from "../../store/playerStore";

const modelUrl = `${import.meta.env.BASE_URL}models/burple-reviewed.glb`;
type Binding = { node: THREE.Object3D; rest: THREE.Vector3 };

export async function createDancerRenderer(
  host: HTMLElement,
  hotspots: HTMLElement,
  caption: HTMLElement | null,
  preview: () => boolean,
  endPreview: () => void,
  signal: AbortSignal,
) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);
  const materials = new Set<THREE.Material>(),
    geometries = new Set<THREE.BufferGeometry>(),
    textures = new Set<THREE.Texture>();
  const disposers: (() => void)[] = [];
  let active = true,
    attached = false,
    lost = false;
  const dispose = () => {
    if (!active) return;
    active = false;
    if (attached) gsap.ticker.remove(renderFrame);
    disposers.forEach((fn) => fn());
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
    geometries.forEach((geometry) => geometry.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  };
  let scene: THREE.Scene, camera: THREE.PerspectiveCamera;
  let runtime: ReturnType<typeof bindBlenderMotion>;
  let width = 480,
    height = 622,
    elapsed = 0,
    demoStart = -1,
    panel = 0;
  let bands = new Array<number>(16).fill(0),
    energy = 0;
  const rhythm = new RhythmTracker(),
    controller = new PerformanceController();
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const parameters =
    import.meta.env.DEV &&
    new URLSearchParams(location.search).get("sceneQA") === "1"
      ? new URLSearchParams(location.search)
      : null;
  const reduced = () =>
    parameters?.get("reduce") === "1" ||
    useAppStore.getState().motionPreference === "reduced" ||
    (useAppStore.getState().motionPreference === "system" && media.matches);
  const bindings = new Map<string, Binding>(),
    controls = new Map<string, THREE.Object3D>();
  const queueCubes: THREE.Mesh[] = [],
    clouds: Binding[] = [];
  let cubeRest: THREE.Vector3[] = [];
  const position = new THREE.Vector3();
  let lcdTexture: THREE.CanvasTexture, lcdContext: CanvasRenderingContext2D;
  let key: THREE.DirectionalLight;
  let lastLcd = -Infinity,
    lastQueue = "",
    lastTrack = usePlayerStore.getState().playback.track?.id;
  let unlisten: (() => void) | undefined;
  let lastRendered = 0;
  const intervals: number[] = [];

  function drawLcd(playing: boolean) {
    if (elapsed - lastLcd < 0.12 && attached) return;
    lastLcd = elapsed;
    const p = usePlayerStore.getState().playback,
      ctx = lcdContext;
    ctx.fillStyle = "#45c2e8";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#152953";
    const blink = !reduced() && playing && Math.sin(elapsed * 1.3) > 0.994;
    for (const x of [70, 160]) ctx.fillRect(x, 42, 26, blink ? 8 : 32);
    ctx.fillRect(83, 92, 84, 10);
    ctx.fillRect(72, 82, 11, 10);
    ctx.fillRect(167, 82, 11, 10);
    ctx.textAlign = "center";
    ctx.font = '13px "Press Start 2P", monospace';
    ctx.fillText(
      (p.track?.title ?? (playing ? "LET’S GROOVE" : "BURPLEPLAYER")).slice(
        0,
        15,
      ),
      128,
      134,
    );
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillText((p.track?.artist ?? "PRESS PLAY").slice(0, 18), 128, 158);
    if (useAppStore.getState().visualizerMode === "ascii") {
      ctx.font = "11px monospace";
      (playing
        ? spectrumAsciiRows(bands, Math.floor(elapsed * 8))
        : PAUSED_LCD_ASCII
      ).forEach((row, i) => ctx.fillText(row, 128, 183 + i * 12));
    } else
      for (let i = 0; i < 16; i++) {
        const h = Math.max(2, ((bands[i] ?? 0) / 255) * 34);
        ctx.fillRect(25 + i * 13, 216 - h, 8, h);
      }
    const seconds = Math.floor(p.positionMs / 1000);
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillText(
      `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
      128,
      242,
    );
    lcdTexture.needsUpdate = true;
  }
  function projectControls() {
    scene.updateMatrixWorld(true);
    for (const button of hotspots.querySelectorAll<HTMLButtonElement>(
      "button",
    )) {
      const cube = button.dataset.cube;
      const node =
        cube !== undefined
          ? queueCubes[Number(cube)]
          : controls.get(button.dataset.control ?? "");
      if (!node) {
        button.style.visibility = "hidden";
        continue;
      }
      node.getWorldPosition(position).project(camera);
      const size =
        cube !== undefined
          ? 32
          : ["up", "down", "previous", "next"].includes(
                button.dataset.control ?? "",
              )
            ? 12
            : 20;
      button.style.width = button.style.height = `${size}px`;
      button.style.transform = `translate3d(${((position.x + 1) * width) / 2 - size / 2}px,${((1 - position.y) * height) / 2 - size / 2}px,0)`;
      button.style.visibility =
        position.z < 1 && position.z > -1 ? "visible" : "hidden";
    }
  }
  function renderFrame(_time = 0, deltaMs = 16.67) {
    void _time;
    if (!active || lost || document.hidden || !runtime) return;
    const dt = Math.min(deltaMs / 1000, 0.05),
      app = useAppStore.getState(),
      playback = usePlayerStore.getState().playback;
    const home = app.view === "now-playing",
      isReduced = reduced();
    // A panel transition may keep the ticker alive, but never advances the dancer.
    const characterDt = home ? dt : 0;
    elapsed += characterDt;
    if (preview()) {
      if (demoStart < 0) demoStart = elapsed;
      if (elapsed - demoStart > 16) endPreview();
    } else demoStart = -1;
    const playing = playback.playing || preview();
    rhythm.advance(characterDt, performance.now() / 1000);
    energy +=
      ((preview() ? 0.55 : rhythm.energy * playback.volume) - energy) *
      (1 - Math.exp(-dt * 8));
    let pose = controller.update(characterDt, playing, isReduced, rhythm.bpm);
    if (parameters?.has("frame")) {
      pose = {
        ...pose,
        time: Number(parameters.get("frame")) / 30,
        swing: 0,
        blend: 0,
        stage: "dancing",
        departure: 1,
      };
    }
    runtime.apply(pose);
    panel = isReduced
      ? home
        ? 0
        : 1
      : panel + ((home ? 0 : 1) - panel) * (1 - Math.exp(-dt * 9));
    runtime.pillars.left.position.x = -panel * 0.9;
    runtime.pillars.right.position.x = panel * 0.9;
    const twilight = app.theme === "twilight";
    key.color.set(twilight ? "#efcdff" : "#fff7e8");
    key.intensity = twilight ? 2.1 : 3.2;
    queueCubes.forEach((cube, i) => {
      cube.position.copy(cubeRest[i]);
      if (!isReduced && playing)
        cube.position.y +=
          Math.max(0, Math.sin(pose.beat * Math.PI + i * 0.7)) ** 3 *
          energy *
          0.16;
      cube.updateMatrix();
    });
    clouds.forEach(({ node, rest }, i) => {
      node.position.copy(rest);
      if (!isReduced) node.position.x += Math.sin(elapsed * 0.14 + i) * 0.04;
      node.updateMatrix();
    });
    drawLcd(playing);
    projectControls();
    renderer.render(scene, camera);
    host.dataset.danceStage = pose.stage;
    host.dataset.danceMove = pose.move;
    host.dataset.departure = pose.departure.toFixed(3);
    host.dataset.poseTime = pose.time.toFixed(3);
    const label = isReduced
      ? "Still mode"
      : pose.stage === "dancing"
        ? `${pose.move === "heel-kick" ? "Heel kicks" : pose.move === "shuffle" ? "Shuffle time" : "Toe taps"}${preview() ? " · preview" : ""}`
        : pose.stage === "returning"
          ? "Back to the swing"
          : pose.stage === "hopping-off"
            ? "Here comes the groove"
            : "Ready to groove";
    if (caption && caption.textContent !== label) caption.textContent = label;
    if (import.meta.env.DEV && attached) {
      const now = performance.now();
      if (lastRendered && deltaMs > 0) intervals.push(now - lastRendered);
      lastRendered = now;
      if (intervals.length >= 180) {
        host.dataset.fps = (
          1000 /
          (intervals.reduce((a, b) => a + b, 0) / intervals.length)
        ).toFixed(1);
        host.dataset.triangles = String(renderer.info.render.triangles);
        intervals.length = 0;
      }
    }
    if (attached && !home && Math.abs(panel - 1) < 0.001) {
      gsap.ticker.remove(renderFrame);
      attached = false;
    }
  }
  function syncLoop() {
    if (!active || !runtime) return;
    const home = useAppStore.getState().view === "now-playing";
    const run =
      !lost &&
      !document.hidden &&
      !reduced() &&
      !parameters?.has("frame") &&
      (home || Math.abs(panel - 1) > 0.001);
    if (run && !attached) {
      lastRendered = 0;
      gsap.ticker.add(renderFrame);
      attached = true;
    } else if (!run && attached) {
      gsap.ticker.remove(renderFrame);
      attached = false;
    }
    renderFrame(0, 0);
  }
  function resize() {
    width = host.clientWidth;
    height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderFrame(0, 0);
  }
  try {
    const base = `${import.meta.env.BASE_URL}models/`;
    const [modelResponse, motion] = await Promise.all([
      fetch(modelUrl, { signal }),
      loadBlenderMotion(base, signal),
    ]);
    if (!modelResponse.ok)
      throw new Error("Reviewed Blender scene unavailable");
    const gltf = await new GLTFLoader().parseAsync(
      await modelResponse.arrayBuffer(),
      base,
    );
    scene = new THREE.Scene();
    scene.add(gltf.scene);
    scene.traverse((node) => {
      if (node.userData.rigRole)
        bindings.set(node.userData.rigRole, {
          node,
          rest: node.position.clone(),
        });
      if (node.userData.control) controls.set(node.userData.control, node);
      const name = String(
        node.userData.runtimeName ?? node.userData.name ?? node.name,
      );
      if (node instanceof THREE.Mesh) {
        node.castShadow = !name.startsWith("Runtime_Sand");
        node.receiveShadow = true;
        geometries.add(node.geometry);
        for (const material of Array.isArray(node.material)
          ? node.material
          : [node.material]) {
          materials.add(material);
          for (const value of Object.values(material))
            if (value instanceof THREE.Texture) textures.add(value);
        }
        if (name.startsWith("LCD") && /pixel|smile/.test(name))
          node.visible = false;
        if (name.startsWith("Ground cube") && !name.includes("red")) {
          node.material = (node.material as THREE.Material).clone();
          materials.add(node.material);
          queueCubes.push(node);
        }
        if (name.includes("smooth clay cloud"))
          clouds.push({ node, rest: node.position.clone() });
      }
    });
    if (signal.aborted) throw new DOMException("Scene cancelled", "AbortError");
    camera = gltf.cameras[0] as THREE.PerspectiveCamera;
    if (!camera?.isPerspectiveCamera)
      throw new Error("Blender portrait camera missing");
    runtime = bindBlenderMotion(gltf.scene, motion.manifest, motion.poses);
    runtime.arms.forEach((arm) => geometries.add(arm.tube.geometry));
    const display = bindings.get("Rig_Display")?.node;
    if (!display) throw new Error("Reviewed LCD binding missing");
    queueCubes.sort((a, b) =>
      String(a.userData.runtimeName).localeCompare(
        String(b.userData.runtimeName),
        undefined,
        { numeric: true },
      ),
    );
    queueCubes.splice(6);
    cubeRest = queueCubes.map((cube) => cube.position.clone());
    const environment = new RoomEnvironment(),
      pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(environment, 0.06);
    scene.environment = envMap.texture;
    scene.environmentIntensity = 0.55;
    environment.dispose();
    pmrem.dispose();
    disposers.push(() => envMap.dispose());
    scene.add(new THREE.HemisphereLight("#eaf8ff", "#df9d66", 1.4));
    key = new THREE.DirectionalLight("#fff7e8", 3.2);
    key.position.set(-5, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    key.shadow.camera.left = key.shadow.camera.bottom = -8;
    key.shadow.camera.right = key.shadow.camera.top = 8;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 35;
    key.shadow.normalBias = 0.025;
    key.shadow.bias = -0.0002;
    scene.add(key);
    disposers.push(() => key.shadow.dispose());
    const fill = new THREE.DirectionalLight("#d6f3ff", 0.7);
    fill.position.set(5, 7, -4);
    scene.add(fill);
    const lcd = document.createElement("canvas");
    lcd.width = lcd.height = 256;
    lcdContext = lcd.getContext("2d")!;
    lcdTexture = new THREE.CanvasTexture(lcd);
    lcdTexture.colorSpace = THREE.SRGBColorSpace;
    lcdTexture.magFilter = THREE.NearestFilter;
    textures.add(lcdTexture);
    const lcdMaterial = new THREE.MeshBasicMaterial({ map: lcdTexture }),
      lcdGeometry = new THREE.PlaneGeometry(0.9, 0.91);
    const screen = new THREE.Mesh(lcdGeometry, lcdMaterial);
    display.add(screen);
    materials.add(lcdMaterial);
    geometries.add(lcdGeometry);
    runtime.apply(controller.update(0, false, reduced(), 120));
    await renderer.compileAsync(scene, camera);
    if (signal.aborted) throw new DOMException("Scene cancelled", "AbortError");
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    disposers.push(() => observer.disconnect());
    const mutations = new MutationObserver(() => renderFrame(0, 0));
    mutations.observe(hotspots, { childList: true });
    disposers.push(() => mutations.disconnect());
    disposers.push(useAppStore.subscribe(syncLoop));
    disposers.push(
      usePlayerStore.subscribe((state) => {
        if (state.playback.track?.id !== lastTrack) {
          lastTrack = state.playback.track?.id;
          rhythm.reset();
        }
        const upcoming = state.playback.queue.slice(
          (state.playback.queueIndex ?? -1) + 1,
          (state.playback.queueIndex ?? -1) + 7,
        );
        const nextQueue = upcoming.map((track) => track.id).join(",");
        if (nextQueue !== lastQueue) {
          lastQueue = nextQueue;
          void Promise.all(upcoming.map(cubeColorForTrack)).then((colors) => {
            if (!active || lastQueue !== nextQueue) return;
            colors.forEach((color, i) =>
              (
                queueCubes[i]?.material as
                  THREE.MeshStandardMaterial | undefined
              )?.color.set(color),
            );
            renderFrame(0, 0);
          });
        }
        renderFrame(0, 0);
      }),
    );
    media.addEventListener("change", syncLoop);
    document.addEventListener("visibilitychange", syncLoop);
    disposers.push(() => {
      media.removeEventListener("change", syncLoop);
      document.removeEventListener("visibilitychange", syncLoop);
    });
    const onLost = (event: Event) => {
        event.preventDefault();
        lost = true;
        syncLoop();
      },
      onRestore = () => {
        lost = false;
        syncLoop();
      };
    renderer.domElement.addEventListener("webglcontextlost", onLost);
    renderer.domElement.addEventListener("webglcontextrestored", onRestore);
    disposers.push(() => {
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      renderer.domElement.removeEventListener(
        "webglcontextrestored",
        onRestore,
      );
    });
    signal.addEventListener("abort", dispose, { once: true });
    disposers.push(() => signal.removeEventListener("abort", dispose));
    if (desktopAvailable)
      void listen<SpectrumEvent>("player:spectrum", (event) => {
        if (!active || document.hidden) return;
        bands = event.payload.bands;
        rhythm.push(bands, performance.now() / 1000);
        if (!attached) renderFrame(0, 0);
      })
        .then((fn) => {
          if (active) unlisten = fn;
          else fn();
        })
        .catch((error) => console.warn("Spectrum stream unavailable", error));
    disposers.push(() => unlisten?.());
    void document.fonts.ready.then(() => {
      if (active) renderFrame(0, 0);
    });
    resize();
    syncLoop();
    host.dataset.motionSource = "blender-reviewed";
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}
