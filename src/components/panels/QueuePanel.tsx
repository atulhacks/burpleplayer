import { useRef, useState } from "react";
import { EmptyLibraryAscii } from "../extras/AsciiExtras";
import { useAppStore } from "../../store/appStore";
import { usePlayerStore } from "../../store/playerStore";
import { GlassPanel } from "./GlassPanel";

export function QueuePanel() {
  const { queue, queueIndex } = usePlayerStore((state) => state.playback);
  const jumpTo = usePlayerStore((state) => state.jumpTo);
  const moveQueue = usePlayerStore((state) => state.moveQueue);
  const removeQueue = usePlayerStore((state) => state.removeQueue);
  const setView = useAppStore((state) => state.setView);
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  return (
    <GlassPanel view="queue" eyebrow={`${queue.length} songs in line`}>
      {queue.length === 0 ? (
        <div className="panel-empty">
          <EmptyLibraryAscii />
          <p>Your queue is waiting for its first song.</p>
          <button type="button" onClick={() => setView("library")}>
            Browse library
          </button>
        </div>
      ) : (
        <>
          <p className="panel-help">
            Drag to reorder, or use the arrow buttons.
          </p>
          <ol className="queue-list">
            {queue.map((track, index) => (
              <li
                key={`${track.id}-${index}`}
                className={
                  dragOver === index
                    ? "queue-item is-drop-target"
                    : "queue-item"
                }
                draggable
                onDragStart={(event) => {
                  dragFrom.current = index;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(index));
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const from = dragFrom.current;
                  if (from !== null && from !== index)
                    void moveQueue(from, index);
                  dragFrom.current = null;
                  setDragOver(null);
                }}
                onDragEnd={() => {
                  dragFrom.current = null;
                  setDragOver(null);
                }}
              >
                <span className="queue-item__handle" aria-hidden="true">
                  ⋮⋮
                </span>
                <button
                  className="queue-item__track"
                  type="button"
                  aria-current={queueIndex === index ? "true" : undefined}
                  onClick={() => {
                    void jumpTo(index);
                    setView("now-playing");
                  }}
                >
                  <span className="queue-item__number">
                    {queueIndex === index
                      ? "▶"
                      : String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="queue-item__copy">
                    <strong>{track.title}</strong>
                    <small>{track.artist}</small>
                  </span>
                </button>
                <div className="queue-item__actions">
                  <button
                    type="button"
                    aria-label={`Move ${track.title} up`}
                    disabled={index === 0}
                    onClick={() => void moveQueue(index, index - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${track.title} down`}
                    disabled={index === queue.length - 1}
                    onClick={() => void moveQueue(index, index + 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${track.title} from queue`}
                    onClick={() => void removeQueue(index)}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </GlassPanel>
  );
}
