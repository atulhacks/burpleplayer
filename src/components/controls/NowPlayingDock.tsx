import { useEffect, useState } from "react";
import { LottieArt } from "../extras/LottieArt";
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
  const playlists = usePlayerStore((state) => state.playlists);
  const status = usePlayerStore((state) => state.status);
  const toggle = usePlayerStore((state) => state.toggle);
  const previous = usePlayerStore((state) => state.previous);
  const next = usePlayerStore((state) => state.next);
  const seek = usePlayerStore((state) => state.seek);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const importFolder = usePlayerStore((state) => state.importFolder);
  const toggleFavorite = usePlayerStore((state) => state.toggleFavorite);
  const [seekDraft, setSeekDraft] = useState<number | null>(null);
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [heartBurst, setHeartBurst] = useState(0);

  useEffect(() => {
    setSeekDraft(null);
  }, [playback.track?.id]);
  useEffect(() => {
    setVolumeDraft(null);
  }, [playback.volume]);

  const duration = playback.track?.durationMs ?? 0;
  const position = seekDraft ?? Math.min(playback.positionMs, duration);
  const volume = volumeDraft ?? playback.volume;
  const isFavorite = playlists.some(
    (playlist) =>
      playlist.name.toLocaleLowerCase() === "favorites" &&
      playlist.tracks.some((track) => track.id === playback.track?.id),
  );
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

  async function changeFavorite() {
    if (!playback.track || favoriteBusy) return;
    setFavoriteBusy(true);
    const added = await toggleFavorite(playback.track.id);
    if (added) setHeartBurst((value) => value + 1);
    setFavoriteBusy(false);
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
        {playback.track && (
          <button
            type="button"
            className="now-dock__favorite"
            aria-label={
              isFavorite ? "Remove from favorites" : "Add to favorites"
            }
            aria-pressed={isFavorite}
            disabled={favoriteBusy}
            onClick={() => void changeFavorite()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 21 3.6 12.8C-0.2 9.1 2.4 3 7.4 3c2 0 3.5 1 4.6 2.5C13.1 4 14.6 3 16.6 3c5 0 7.6 6.1 3.8 9.8Z" />
            </svg>
            {heartBurst > 0 && (
              <span
                key={heartBurst}
                className="now-dock__heart-burst"
                aria-hidden="true"
              >
                <LottieArt kind="heart" onComplete={() => setHeartBurst(0)} />
              </span>
            )}
          </button>
        )}
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
