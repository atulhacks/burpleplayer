import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { EMPTY_LIBRARY_ART, scanAsciiFrame } from "../../lib/ascii";
import { useAppStore } from "../../store/appStore";
import { LottieArt } from "./LottieArt";
import "./AsciiExtras.css";

export function EmptyLibraryAscii() {
  return (
    <pre className="ascii-empty" aria-hidden="true">
      {EMPTY_LIBRARY_ART}
    </pre>
  );
}

export function AsciiScanLoader() {
  const preRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let preference = useAppStore.getState().motionPreference;
    let attached = false;
    let lastFrame = -1;
    const tick = (time: number) => {
      const frame = Math.floor(time * 2) % 4;
      if (frame === lastFrame) return;
      lastFrame = frame;
      pre.textContent = scanAsciiFrame(frame);
    };
    const sync = () => {
      const reduced =
        preference === "reduced" || (preference === "system" && media.matches);
      const shouldRun = !reduced && !document.hidden;
      if (shouldRun && !attached) {
        gsap.ticker.add(tick);
        attached = true;
      } else if (!shouldRun && attached) {
        gsap.ticker.remove(tick);
        attached = false;
      }
      if (reduced) pre.textContent = scanAsciiFrame(0);
    };
    const unsubscribe = useAppStore.subscribe((state) => {
      preference = state.motionPreference;
      sync();
    });
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      if (attached) gsap.ticker.remove(tick);
      unsubscribe();
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <div className="ascii-scan" role="status" aria-live="polite">
      <LottieArt kind="scanning" loop />
      <pre ref={preRef} aria-hidden="true">
        {scanAsciiFrame(0)}
      </pre>
      <span>Scanning music folders…</span>
    </div>
  );
}
