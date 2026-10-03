import { useEffect, useRef } from "react";
import { useAppStore } from "../../store/appStore";
import { usePlayerStore } from "../../store/playerStore";

export function QueueDrawer() {
  const close = useAppStore((state) => state.setView);
  const { queue, queueIndex } = usePlayerStore((state) => state.playback);
  const jumpTo = usePlayerStore((state) => state.jumpTo);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  return (
    <aside className="queue-drawer" aria-label="Play queue">
      <div className="queue-drawer__header">
        <div>
          <small>PLAYLIST</small>
          <h2>Up next</h2>
        </div>
        <button
          ref={closeButton}
          type="button"
          aria-label="Close queue"
          onClick={() => close("now-playing")}
        >
          ×
        </button>
      </div>
      {queue.length === 0 ? (
        <p className="queue-drawer__empty">
          Your queue is waiting for its first song.
        </p>
      ) : (
        <ol>
          {queue.map((track, index) => (
            <li key={`${track.id}-${index}`}>
              <button
                type="button"
                className={
                  index === queueIndex
                    ? "queue-drawer__track is-current"
                    : "queue-drawer__track"
                }
                aria-current={index === queueIndex ? "true" : undefined}
                onClick={() => {
                  void jumpTo(index);
                  close("now-playing");
                }}
              >
                <span className="queue-drawer__number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="queue-drawer__details">
                  <strong>{track.title}</strong>
                  <small>{track.artist}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
