import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { NowPlayingDock } from "./components/controls/NowPlayingDock";
import { LottieArt } from "./components/extras/LottieArt";
import { LibraryPanel } from "./components/panels/LibraryPanel";
import { QueuePanel } from "./components/panels/QueuePanel";
import { SettingsPanel } from "./components/panels/SettingsPanel";
import { ClayScene } from "./components/scene/ClayScene";
import { usePlayerBridge } from "./lib/usePlayerBridge";
import { useAppStore } from "./store/appStore";
import type { AppView } from "./store/appStore";
import { usePlayerStore } from "./store/playerStore";
import "./styles/tokens.css";
import "./App.css";

export default function App() {
  usePlayerBridge();
  const view = useAppStore((state) => state.view);
  const motionPreference = useAppStore((state) => state.motionPreference);
  const theme = useAppStore((state) => state.theme);
  const setView = useAppStore((state) => state.setView);
  const [renderedView, setRenderedView] = useState<AppView>(view);
  const [systemReduced, setSystemReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wipeRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef<AppView>(view);
  const progressRef = useRef({ value: 0 });
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const status = usePlayerStore((state) => state.status);
  const error = usePlayerStore((state) => state.error);
  const setError = usePlayerStore((state) => state.setError);
  const importFolder = usePlayerStore((state) => state.importFolder);
  const importCelebrationId = usePlayerStore(
    (state) => state.importCelebrationId,
  );
  const [dismissedCelebration, setDismissedCelebration] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const wipe = wipeRef.current;
    const panel = panelRef.current;
    const left = scene?.querySelector<SVGGElement>('[data-pillar="left"]');
    const right = scene?.querySelector<SVGGElement>('[data-pillar="right"]');
    const crossbar = scene?.querySelector<SVGGElement>(
      '[data-scene-layer="crossbar"]',
    );
    const swing = scene?.querySelector<SVGGElement>(
      '[data-scene-layer="swing"]',
    );
    if (!wipe || !panel || !left || !right || !crossbar || !swing) return;
    if (view === renderedRef.current && !timelineRef.current) return;

    timelineRef.current?.kill();
    const reduced =
      motionPreference === "reduced" ||
      (motionPreference === "system" && systemReduced);
    const focusPanel =
      document.activeElement?.classList.contains("scene-hotspot");
    const focusHome =
      view === "now-playing" &&
      !!document.activeElement &&
      panel.contains(document.activeElement);
    const finish = () => {
      timelineRef.current = null;
      wipe.style.visibility = "hidden";
      if (focusPanel && view !== "now-playing") {
        panel
          .querySelector<HTMLElement>(".view-panel h2")
          ?.focus({ preventScroll: true });
      } else if (focusHome) {
        document
          .querySelector<HTMLElement>('[data-view-target="now-playing"]')
          ?.focus({ preventScroll: true });
      }
    };
    const onVisibility = () => {
      if (document.hidden) timelineRef.current?.pause();
      else timelineRef.current?.resume();
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced) {
      wipe.style.visibility = "hidden";
      gsap.set([left, right], { x: 0 });
      gsap.set(left, { x: view === "now-playing" ? 0 : -92 });
      gsap.set(right, { x: view === "now-playing" ? 0 : 92 });
      gsap.set([crossbar, swing], {
        opacity: view === "now-playing" ? 1 : 0.55,
      });
      const timeline = gsap.timeline({ onComplete: finish });
      timeline
        .to(panel, { opacity: 0, duration: 0.1, ease: "none" })
        .call(() => {
          renderedRef.current = view;
          setRenderedView(view);
        })
        .to(panel, { opacity: 1, duration: 0.14, ease: "none" });
      timelineRef.current = timeline;
    } else {
      gsap.set(panel, { opacity: 1 });
      const progress = progressRef.current;
      const direction = progress.value <= 1 ? 1 : -1;
      const exit = direction === 1 ? 2 : 0;
      const setWipe = gsap.quickSetter(wipe, "xPercent") as (
        value: number,
      ) => void;
      const render = () => setWipe((progress.value - 1) * 115);
      wipe.style.visibility = "visible";
      render();
      const timeline = gsap.timeline({ onComplete: finish });
      timeline
        .to(progress, {
          value: 1,
          duration: Math.max(0.05, Math.abs(1 - progress.value) * 0.29),
          ease: "power2.in",
          onUpdate: render,
        })
        .call(() => {
          renderedRef.current = view;
          setRenderedView(view);
        })
        .to(progress, {
          value: exit,
          duration: 0.32,
          ease: "power2.out",
          onUpdate: render,
        });
      timeline.to(
        left,
        {
          x: view === "now-playing" ? 0 : -92,
          duration: 0.56,
          ease: "power2.inOut",
        },
        0,
      );
      timeline.to(
        right,
        {
          x: view === "now-playing" ? 0 : 92,
          duration: 0.56,
          ease: "power2.inOut",
        },
        0,
      );
      timeline.to(
        [crossbar, swing],
        {
          opacity: view === "now-playing" ? 1 : 0.55,
          duration: 0.38,
          ease: "power2.inOut",
        },
        0,
      );
      timelineRef.current = timeline;
    }
    if (document.hidden) timelineRef.current?.pause();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      timelineRef.current?.kill();
    };
  }, [view, motionPreference, systemReduced]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        useAppStore.getState().view !== "now-playing"
      ) {
        setView("now-playing");
        return;
      }
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest("button, input, textarea, [contenteditable]")
      )
        return;
      const player = usePlayerStore.getState();
      switch (event.key) {
        case " ":
          event.preventDefault();
          void player.toggle();
          break;
        case "ArrowLeft":
          event.preventDefault();
          void player.previous();
          break;
        case "ArrowRight":
          event.preventDefault();
          void player.next();
          break;
        case "ArrowUp":
          event.preventDefault();
          void player.adjustVolume(0.05);
          break;
        case "ArrowDown":
          event.preventDefault();
          void player.adjustVolume(-0.05);
          break;
        default:
          break;
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [setView]);

  return (
    <main
      className="app-shell"
      data-motion-preference={motionPreference}
      data-theme={theme}
    >
      <div className="scene-frame" ref={sceneRef}>
        <ClayScene />
      </div>
      <header className="titlebar" data-tauri-drag-region>
        <span data-tauri-drag-region>BurplePlayer</span>
        <button
          className="titlebar__add"
          type="button"
          onClick={() => void importFolder()}
          disabled={status === "scanning"}
        >
          {status === "scanning" ? "Scanning…" : "+ Music"}
        </button>
      </header>
      <nav className="view-nav" aria-label="Main views">
        {(
          [
            ["now-playing", "Play"],
            ["library", "Library"],
            ["queue", "Queue"],
            ["settings", "Settings"],
          ] as const
        ).map(([target, label]) => (
          <button
            key={target}
            type="button"
            data-view-target={target}
            aria-current={view === target ? "page" : undefined}
            onClick={() => setView(target)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="view-space" ref={panelRef}>
        {renderedView === "library" && <LibraryPanel />}
        {renderedView === "queue" && <QueuePanel />}
        {renderedView === "settings" && <SettingsPanel />}
      </div>
      <NowPlayingDock />
      {error && (
        <div className="app-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}
      {importCelebrationId > dismissedCelebration && (
        <div className="import-celebration" role="status">
          <LottieArt
            key={importCelebrationId}
            kind="confetti"
            onComplete={() => setDismissedCelebration(importCelebrationId)}
          />
          <span>Music is in your library!</span>
          <button
            type="button"
            aria-label="Dismiss import celebration"
            onClick={() => setDismissedCelebration(importCelebrationId)}
          >
            ×
          </button>
        </div>
      )}
      <div className="cloud-wipe" ref={wipeRef} aria-hidden="true">
        <span className="cloud-wipe__puff cloud-wipe__puff--one" />
        <span className="cloud-wipe__puff cloud-wipe__puff--two" />
        <span className="cloud-wipe__puff cloud-wipe__puff--three" />
      </div>
    </main>
  );
}
