import { gsap } from "gsap";
import { useAppStore } from "../store/appStore";

type Sample = { time: number; deltaMs: number };

function summarize(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const count = sorted.length;
  return {
    frames: count,
    meanMs: count ? samples.reduce((sum, value) => sum + value, 0) / count : 0,
    p95Ms: count ? sorted[Math.min(count - 1, Math.floor(count * 0.95))] : 0,
    maxMs: count ? sorted[count - 1] : 0,
    over25Ms: samples.filter((value) => value > 25).length,
    over34Ms: samples.filter((value) => value > 34).length,
  };
}

export function startPerformanceProbe() {
  let start: number | null = null;
  let step = 0;
  let visible = true;
  const samples: Sample[] = [];
  const visits = ["library", "queue", "settings", "now-playing"] as const;

  const tick = (time: number, deltaMs: number) => {
    if (start === null && (document.hidden || !document.hasFocus())) return;
    if (start === null) start = time;
    const elapsed = time - start;
    visible &&= !document.hidden && document.hasFocus();
    if (elapsed >= 2 && elapsed <= 9.5) {
      samples.push({ time: elapsed, deltaMs });
    }
    while (step < visits.length && elapsed >= 5 + step) {
      useAppStore.getState().setView(visits[step]);
      step += 1;
    }
    if (elapsed < 9.5) return;
    gsap.ticker.remove(tick);
    const baseline = samples
      .filter(({ time: at }) => at < 5)
      .map(({ deltaMs: delta }) => delta);
    const transitions = samples
      .filter(({ time: at }) => at >= 5 && at < 9)
      .map(({ deltaMs: delta }) => delta);
    const result = {
      measuredAt: new Date().toISOString(),
      visible,
      baseline: summarize(baseline),
      transitions: summarize(transitions),
      transitionCount: visits.length,
      device: navigator.userAgent,
    };
    console.info("BURPLE_PERF_AUDIT", JSON.stringify(result));
    window.localStorage.setItem("burple.perf-audit", JSON.stringify(result));
  };

  gsap.ticker.add(tick);
  return () => gsap.ticker.remove(tick);
}
