import { useEffect, useRef, useState } from "react";
import { desktopAvailable } from "../../lib/playerApi";
import { usePlayerStore } from "../../store/playerStore";
import { useAppStore } from "../../store/appStore";
import { ClayScene } from "./ClayScene";
import "./DancerScene.css";

const controls = [
  ["up", "Volume up · ↑"],
  ["previous", "Previous track · ←"],
  ["next", "Next track · →"],
  ["down", "Volume down · ↓"],
  ["toggle", "Play or pause · Space"],
  ["queue", "Open queue"],
] as const;

export function DancerScene() {
  const host = useRef<HTMLDivElement>(null);
  const buttons = useRef<HTMLDivElement>(null);
  const feedback = useRef<HTMLSpanElement>(null);
  const preview = useRef(false);
  const [demo, setDemo] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "fallback">(
    "loading",
  );
  const playback = usePlayerStore((s) => s.playback);
  const upcoming = playback.queue.slice(
    (playback.queueIndex ?? -1) + 1,
    (playback.queueIndex ?? -1) + 7,
  );
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    let cleanup: (() => void) | undefined;
    void import("./dancerRenderer")
      .then(({ createDancerRenderer }) => {
        if (!live || !host.current || !buttons.current) return;
        return createDancerRenderer(
          host.current,
          buttons.current,
          feedback.current,
          () => preview.current,
          () => {
            preview.current = false;
            if (live) setDemo(false);
          },
          controller.signal,
        );
      })
      .then((dispose) => {
        if (!dispose) return;
        if (live) {
          cleanup = dispose;
          setState("ready");
        } else dispose();
      })
      .catch((error) => {
        if (!live || controller.signal.aborted) return;
        console.error("BurplePlayer 3D scene unavailable:", error);
        if (live) setState("fallback");
      });
    return () => {
      live = false;
      controller.abort();
      cleanup?.();
    };
  }, []);

  function press(control: (typeof controls)[number][0]) {
    const p = usePlayerStore.getState();
    switch (control) {
      case "up":
        void p.adjustVolume(0.05);
        break;
      case "down":
        void p.adjustVolume(-0.05);
        break;
      case "previous":
        void p.previous();
        break;
      case "next":
        void p.next();
        break;
      case "toggle":
        void p.toggle();
        break;
      case "queue":
        useAppStore.getState().setView("queue");
        break;
    }
  }
  if (state === "fallback")
    return (
      <>
        <ClayScene />
        <span className="dancer-notice">
          3D unavailable · lightweight scene active
        </span>
      </>
    );
  return (
    <div className="dancer-stage" data-renderer="blender">
      <div ref={host} className="dancer-canvas" aria-hidden="true" />
      <div ref={buttons} className="dancer-hotspots">
        {controls.map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-control={id}
            aria-label={label}
            title={label}
            className="dancer-hotspot"
            onClick={() => press(id)}
          />
        ))}
        {upcoming.map((track, i) => (
          <button
            key={`${track.id}-${i}`}
            className="dancer-hotspot dancer-hotspot--cube"
            type="button"
            data-cube={i}
            aria-label={`Play ${track.title} by ${track.artist}`}
            title={track.title}
            onClick={() =>
              void usePlayerStore
                .getState()
                .jumpTo((playback.queueIndex ?? -1) + 1 + i)
            }
          />
        ))}
      </div>
      <div className="dancer-caption">
        <span ref={feedback}>
          {state === "loading" ? "Opening the playground…" : "Ready to groove"}
        </span>
        {!desktopAvailable && state === "ready" && (
          <button
            type="button"
            aria-pressed={demo}
            onClick={() => {
              preview.current = !preview.current;
              setDemo(preview.current);
            }}
          >
            {demo ? "Back to swing" : "Preview dance"}
          </button>
        )}
      </div>
    </div>
  );
}
