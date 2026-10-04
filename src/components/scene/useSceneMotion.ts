import { useEffect, type RefObject } from "react";
import { listen } from "@tauri-apps/api/event";
import { gsap } from "gsap";
import { desktopAvailable } from "../../lib/playerApi";
import type { SpectrumEvent } from "../../lib/playerApi";
import { useAppStore } from "../../store/appStore";
import { usePlayerStore } from "../../store/playerStore";

type Setter = (value: number) => void;

export function useSceneMotion(
  stageRef: RefObject<HTMLDivElement | null>,
  bars: RefObject<(SVGRectElement | null)[]>,
) {
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const swing = stage.querySelector<SVGGElement>(
      '[data-scene-layer="swing"]',
    );
    const back = stage.querySelector<SVGGElement>(
      '[data-scene-layer="clouds-back"]',
    );
    const middle = stage.querySelector<SVGGElement>(
      '[data-scene-layer="clouds-mid"]',
    );
    const front = stage.querySelector<SVGGElement>(
      '[data-scene-layer="clouds-front"]',
    );
    const face = stage.querySelector<SVGGElement>("[data-motion-face]");
    const eyes = stage.querySelector<SVGGElement>("[data-motion-eyes]");
    const cubes = Array.from(
      stage.querySelectorAll<SVGGElement>("[data-motion-cube]"),
    );
    if (!swing || !back || !middle || !front || !face || !eyes) return;

    gsap.set(swing, { svgOrigin: "578 270" });
    gsap.set(eyes, { svgOrigin: "591 624" });
    const setSwing = gsap.quickSetter(swing, "rotation") as Setter;
    const setBack = gsap.quickSetter(back, "x") as Setter;
    const setMiddle = gsap.quickSetter(middle, "x") as Setter;
    const setFront = gsap.quickSetter(front, "x") as Setter;
    const setFace = gsap.quickSetter(face, "y") as Setter;
    const setEyes = gsap.quickSetter(eyes, "scaleY") as Setter;
    const setCubes = cubes.map((cube) => gsap.quickSetter(cube, "y") as Setter);

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let playback = usePlayerStore.getState().playback;
    let preference = useAppStore.getState().motionPreference;
    let reduced =
      preference === "reduced" || (preference === "system" && media.matches);
    let bands = Array<number>(16).fill(0);
    let energy = 0;
    let bass = 0;
    let theta = 0;
    let velocity = 0;
    let kick = 0;
    let phase = 0;
    let blinkAt = 3.4;
    let blinkLeft = 0;
    let attached = false;
    let active = true;
    let unlisten: (() => void) | undefined;

    function resetTransforms() {
      theta = 0;
      velocity = 0;
      kick = 0;
      setSwing(0);
      setBack(0);
      setMiddle(0);
      setFront(0);
      setFace(0);
      setEyes(1);
      setCubes.forEach((setCube) => setCube(0));
    }

    function tick(time: number, deltaTime: number) {
      const dt = Math.min(deltaTime / 1000, 0.05);
      phase += dt;
      const targetEnergy = playback.playing
        ? bands.reduce((sum, band) => sum + band, 0) / (16 * 255)
        : 0;
      const targetBass = playback.playing
        ? (bands[0] + bands[1] + bands[2]) / (3 * 255)
        : 0;
      const smoothing = 1 - Math.exp(-dt * 8);
      energy += (targetEnergy - energy) * smoothing;
      bass += (targetBass - bass) * smoothing;
      kick *= Math.exp(-dt * 6);

      // The spring loses energy naturally on pause; music only supplies a small drive.
      const drive = playback.playing
        ? Math.sin(phase * (1.15 + energy * 0.7)) *
          (1.6 + energy * 4.2) *
          playback.volume
        : 0;
      velocity += (-theta * 7.2 - velocity * 2.9 + drive) * dt;
      theta = Math.max(-4.5, Math.min(4.5, theta + velocity * dt));
      setSwing(theta);

      setBack(Math.sin(phase * 0.22) * 8);
      setMiddle(Math.sin(phase * 0.33 + 1.2) * 13);
      setFront(Math.sin(phase * 0.17 + 2.4) * 19);

      const playing = playback.playing;
      setFace(playing ? Math.sin(phase * 2.1) * (0.4 + energy * 1.5) : 0);
      if (playing && time >= blinkAt) {
        blinkLeft = 0.13;
        blinkAt = time + 3.2 + (Math.sin(time * 1.3) + 1) * 1.1;
      }
      blinkLeft = Math.max(0, blinkLeft - dt);
      setEyes(playing && blinkLeft > 0 ? 0.12 : 1);

      setCubes.forEach((setCube, index) => {
        const stagger = phase * 5.2 + index * 0.72;
        const hop = Math.max(0, Math.sin(stagger)) ** 3;
        setCube(playing ? -hop * (bass * playback.volume * 13 + kick * 8) : 0);
      });
    }

    function syncTicker() {
      const shouldRun = !reduced && !document.hidden;
      if (shouldRun && !attached) {
        gsap.ticker.add(tick);
        attached = true;
      } else if (!shouldRun && attached) {
        gsap.ticker.remove(tick);
        attached = false;
      }
      if (!shouldRun && reduced) resetTransforms();
    }

    const unsubscribePlayback = usePlayerStore.subscribe((state, previous) => {
      playback = state.playback;
      if (playback.track?.id !== previous.playback.track?.id && !reduced) {
        velocity += playback.playing ? 10 : 5;
        kick = 1;
        phase = 0;
      }
    });
    const unsubscribePreference = useAppStore.subscribe((state) => {
      preference = state.motionPreference;
      reduced =
        preference === "reduced" || (preference === "system" && media.matches);
      syncTicker();
    });
    const onMediaChange = () => {
      reduced =
        preference === "reduced" || (preference === "system" && media.matches);
      syncTicker();
    };
    media.addEventListener("change", onMediaChange);
    document.addEventListener("visibilitychange", syncTicker);
    syncTicker();

    if (desktopAvailable) {
      void listen<SpectrumEvent>("player:spectrum", (event) => {
        if (!active || document.hidden) return;
        bands = event.payload.bands;
        for (let index = 0; index < 16; index += 1) {
          const bar = bars.current[index];
          if (!bar) continue;
          const height = Math.max(
            1,
            Math.round(((bands[index] ?? 0) / 255) * 13),
          );
          bar.setAttribute("y", String(696 - height));
          bar.setAttribute("height", String(height));
        }
      }).then((cleanup) => {
        if (active) unlisten = cleanup;
        else cleanup();
      });
    }

    return () => {
      active = false;
      if (attached) gsap.ticker.remove(tick);
      unsubscribePlayback();
      unsubscribePreference();
      media.removeEventListener("change", onMediaChange);
      document.removeEventListener("visibilitychange", syncTicker);
      unlisten?.();
      gsap.set([swing, back, middle, front, face, eyes, ...cubes], {
        clearProps: "transform",
      });
    };
  }, [stageRef, bars]);
}
