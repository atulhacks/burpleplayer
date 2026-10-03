import { useEffect } from "react";
import { NowPlayingDock } from "./components/controls/NowPlayingDock";
import { QueueDrawer } from "./components/panels/QueueDrawer";
import { ClayScene } from "./components/scene/ClayScene";
import { usePlayerBridge } from "./lib/usePlayerBridge";
import { useAppStore } from "./store/appStore";
import { usePlayerStore } from "./store/playerStore";
import "./styles/tokens.css";
import "./App.css";

export default function App() {
  usePlayerBridge();
  const view = useAppStore((state) => state.view);
  const setView = useAppStore((state) => state.setView);
  const status = usePlayerStore((state) => state.status);
  const error = usePlayerStore((state) => state.error);
  const setError = usePlayerStore((state) => state.setError);
  const importFolder = usePlayerStore((state) => state.importFolder);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && useAppStore.getState().view === "queue") {
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
    <main className="app-shell">
      <div className="scene-frame">
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
      {view === "queue" && <QueueDrawer />}
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
    </main>
  );
}
