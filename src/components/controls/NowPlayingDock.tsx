import { useEffect, useState } from "react";
import { usePlayerStore } from "../../store/playerStore";

function clock(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Icon({ name }: { name: "play" | "pause" | "previous" | "next" }) {
  const paths = {
    play: <path d="m8 5 12 7-12 7Z" />,
    pause: (
      <>
        <path d="M7 5h4v14H7z" />
        <path d="M15 5h4v14h-4z" />
      </>
    ),
    previous: (
      <>
        <path d="M5 5h2v14H5z" />
        <path d="m18 5-10 7 10 7Z" />
      </>
    ),
    next: (
      <>
        <path d="M17 5h2v14h-2z" />
        <path d="M6 5 16 12 6 19Z" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      {paths[name]}
    </svg>
  );
}

export function NowPlayingDock() {
  const playback = usePlayerStore((state) => state.playback);
  const tracks = usePlayerStore((state) => state.tracks);
  const status = usePlayerStore((state) => state.status);
  const toggle = usePlayerStore((state) => state.toggle);
  const previous = usePlayerStore((state) => state.previous);
  const next = usePlayerStore((state) => state.next);
  const seek = usePlayerStore((state) => state.seek);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const importFolder = usePlayerStore((state) => state.importFolder);
  const [seekDraft, setSeekDraft] = useState<number | null>(null);
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setSeekDraft(null);
  }, [playback.track?.id]);
  useEffect(() => {
    setVolumeDraft(null);
  }, [playback.volume]);

  const duration = playback.track?.durationMs ?? 0;
  const position = seekDraft ?? Math.min(playback.positionMs, duration);
  const volume = volumeDraft ?? playback.volume;
  const title =
    playback.track?.title ??
    (tracks.length ? "Ready when you are" : "A little music for the clouds");
  const artist =
    playback.track?.artist ??
    (tracks.length
      ? `${tracks.length} songs in your library`
      : "Choose a folder to begin");

  function commitSeek() {
    if (seekDraft !== null) void seek(seekDraft);
    setSeekDraft(null);
  }

  function commitVolume() {
    if (volumeDraft !== null) void setVolume(volumeDraft);
    setVolumeDraft(null);
  }

  return (
    <section
      className="now-dock"
      aria-label="Now playing"
      data-expanded={expanded}
    >
      <div className="now-dock__top">
        <div className="now-dock__disc" aria-hidden="true">
          <span />
        </div>
        <div
          className="now-dock__identity"
          aria-live="polite"
          aria-atomic="true"
        >
          <strong title={title}>{title}</strong>
          <span title={artist}>{artist}</span>
        </div>
        {tracks.length === 0 ? (
          <button
            type="button"
            className="now-dock__import"
            onClick={() => void importFolder()}
            disabled={status === "scanning"}
          >
            {status === "scanning" ? "Scanning…" : "Add music"}
          </button>
        ) : (
          <div className="now-dock__transport" aria-label="Playback controls">
            <button
              type="button"
              aria-label="Previous track"
              onClick={() => void previous()}
              disabled={!playback.track}
            >
              <Icon name="previous" />
            </button>
            <button
              type="button"
              className="now-dock__play"
              aria-label={playback.playing ? "Pause" : "Play"}
              onClick={() => void toggle()}
            >
              <Icon name={playback.playing ? "pause" : "play"} />
            </button>
            <button
              type="button"
              aria-label="Next track"
              onClick={() => void next()}
              disabled={!playback.track}
            >
              <Icon name="next" />
            </button>
          </div>
        )}
        <button
          type="button"
          className="now-dock__expand"
          aria-label={
            expanded
              ? "Hide seek and volume controls"
              : "Show seek and volume controls"
          }
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "⌄" : "⌃"}
        </button>
      </div>
      <div className="now-dock__seek">
        <span aria-hidden="true">{clock(position)}</span>
        <input
          aria-label="Seek position"
          type="range"
          min={0}
          max={Math.max(1, duration)}
          step={1000}
          value={position}
          disabled={!playback.track || duration === 0}
          onChange={(event) => setSeekDraft(Number(event.currentTarget.value))}
          onPointerUp={commitSeek}
          onKeyUp={commitSeek}
          onBlur={commitSeek}
          style={
            {
              "--range-fill": `${duration ? (position / duration) * 100 : 0}%`,
            } as React.CSSProperties
          }
        />
        <span aria-hidden="true">{clock(duration)}</span>
      </div>
      <div className="now-dock__volume">
        <span aria-hidden="true">VOL</span>
        <input
          aria-label="Volume"
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(event) =>
            setVolumeDraft(Number(event.currentTarget.value) / 100)
          }
          onPointerUp={commitVolume}
          onKeyUp={commitVolume}
          onBlur={commitVolume}
          style={{ "--range-fill": `${volume * 100}%` } as React.CSSProperties}
        />
        <span>{Math.round(volume * 100)}%</span>
      </div>
    </section>
  );
}
