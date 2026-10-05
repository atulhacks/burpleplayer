import { getCurrentWindow } from "@tauri-apps/api/window";
import { gsap } from "gsap";
import { useAppStore } from "../store/appStore";

type Sample = { time: number; intervalMs: number };

function summarize(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const count = sorted.length;
  return {
    frames: count,
    meanMs: count ? samples.reduce((sum, value) => sum + value, 0) / count : 0,
    p95Ms: count ? sorted[Math.min(count - 1, Math.floor(count * 0.95))] : 0,
    maxMs: count ? sorted[count - 1] : 0,
    over20Ms: samples.filter((value) => value > 20).length,
    over25Ms: samples.filter((value) => value > 25).length,
    over34Ms: samples.filter((value) => value > 34).length,
  };
}

function phaseSamples(samples: Sample[], from: number, to: number) {
  return summarize(
    samples
      .filter(({ time }) => time >= from && time < to)
      .map(({ intervalMs }) => intervalMs),
  );
}

export function startPerformanceProbe() {
  const appWindow = getCurrentWindow();
  const stage = document.querySelector<HTMLElement>(".scene-frame");
  const originalVisibility = stage?.style.visibility ?? "";
  const tickerSamples: Sample[] = [];
  const rafSamples: Sample[] = [];
  const visits = ["library", "queue", "settings", "now-playing"] as const;
  let nativeFocused = false;
  let remainedFocused = true;
  let active = true;
  let startWall: number | null = null;
  let lastTicker: number | null = null;
  let lastRaf: number | null = null;
  let step = 0;
  let stagePhase = 0;
  let rafId = 0;
  let unlistenFocus: (() => void) | undefined;

  void appWindow.isFocused().then((focused) => {
    if (active) nativeFocused = focused;
  });
  void appWindow
    .onFocusChanged(({ payload: focused }) => {
      nativeFocused = focused;
      if (startWall !== null && !focused) remainedFocused = false;
    })
    .then((unlisten) => {
      if (active) unlistenFocus = unlisten;
      else unlisten();
    });

  const frame = (now: number) => {
    if (!active) return;
    if (startWall !== null) {
      const elapsed = (now - startWall) / 1000;
      if (lastRaf !== null && elapsed >= 2 && elapsed < 12.5) {
        rafSamples.push({ time: elapsed, intervalMs: now - lastRaf });
      }
      lastRaf = now;
    }
    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);

  const dispose = () => {
    if (!active) return;
    active = false;
    if (stage) stage.style.visibility = originalVisibility;
    gsap.ticker.remove(tick);
    cancelAnimationFrame(rafId);
    unlistenFocus?.();
  };

  const tick = () => {
    if (!active) return;
    const now = performance.now();
    if (startWall === null) {
      if (document.hidden || !document.hasFocus() || !nativeFocused) return;
      startWall = now;
    }
    const elapsed = (now - startWall) / 1000;
    remainedFocused &&=
      !document.hidden && document.hasFocus() && nativeFocused;
    if (lastTicker !== null && elapsed >= 2 && elapsed < 12.5) {
      tickerSamples.push({ time: elapsed, intervalMs: now - lastTicker });
    }
    lastTicker = now;

    if (stagePhase === 0 && elapsed >= 5 && stage) {
      stage.style.visibility = "hidden";
      stagePhase = 1;
    }
    if (stagePhase === 1 && elapsed >= 7 && stage) {
      stage.style.visibility = originalVisibility;
      stagePhase = 2;
    }
    while (step < visits.length && elapsed >= 8 + step) {
      useAppStore.getState().setView(visits[step]);
      step += 1;
    }
    if (elapsed < 12.5) return;

    const result = {
      probeVersion: 2,
      measuredAt: new Date().toISOString(),
      remainedFocused,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        devicePixelRatio: window.devicePixelRatio,
      },
      ticker: {
        scene: phaseSamples(tickerSamples, 2, 5),
        stageHidden: phaseSamples(tickerSamples, 5.4, 7),
        transitions: phaseSamples(tickerSamples, 8, 12),
      },
      raf: {
        scene: phaseSamples(rafSamples, 2, 5),
        stageHidden: phaseSamples(rafSamples, 5.4, 7),
        transitions: phaseSamples(rafSamples, 8, 12),
      },
      transitionsByView: visits.map((view, index) => ({
        view,
        ticker: phaseSamples(tickerSamples, 8 + index, 9 + index),
        raf: phaseSamples(rafSamples, 8 + index, 9 + index),
      })),
      transitionCount: visits.length,
      device: navigator.userAgent,
    };
    window.localStorage.setItem("burple.perf-audit", JSON.stringify(result));
    console.info("BURPLE_PERF_AUDIT", JSON.stringify(result));
    dispose();
  };

  gsap.ticker.add(tick);
  return dispose;
}
