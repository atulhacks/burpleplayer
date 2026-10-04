import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Track } from "../../lib/playerApi";
import { AsciiScanLoader, EmptyLibraryAscii } from "../extras/AsciiExtras";
import { LottieArt } from "../extras/LottieArt";
import { useAppStore } from "../../store/appStore";
import { usePlayerStore } from "../../store/playerStore";
import { GlassPanel } from "./GlassPanel";

type LibraryTab = "songs" | "albums" | "artists" | "playlists" | "folders";
const tabs: LibraryTab[] = [
  "songs",
  "albums",
  "artists",
  "playlists",
  "folders",
];

function matches(track: Track, query: string) {
  return [track.title, track.artist, track.album, track.path]
    .join(" ")
    .toLocaleLowerCase()
    .includes(query);
}

function inFolder(track: Track, folder: string) {
  const path = folder.replace(/[\\/]$/, "");
  return (
    track.path.startsWith(`${path}/`) || track.path.startsWith(`${path}\\`)
  );
}

function groups(tracks: Track[], key: (track: Track) => string) {
  const result = new Map<string, Track[]>();
  for (const track of tracks) {
    const name = key(track) || "Unknown";
    const bucket = result.get(name);
    if (bucket) bucket.push(track);
    else result.set(name, [track]);
  }
  return [...result.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function TrackRow({
  track,
  context,
  index,
  playlistId,
}: {
  track: Track;
  context: Track[];
  index: number;
  playlistId?: number;
}) {
  const playTracks = usePlayerStore((state) => state.playTracks);
  const enqueueTracks = usePlayerStore((state) => state.enqueueTracks);
  const addToPlaylist = usePlayerStore((state) => state.addToPlaylist);
  const removeFromPlaylist = usePlayerStore(
    (state) => state.removeFromPlaylist,
  );
  const playlists = usePlayerStore((state) => state.playlists);
  const setView = useAppStore((state) => state.setView);
  return (
    <li className="library-track">
      <button
        type="button"
        className="library-track__play"
        aria-label={`Play ${track.title} by ${track.artist}`}
        onClick={() => {
          void playTracks(
            context.map((entry) => entry.id),
            index,
          );
          setView("now-playing");
        }}
      >
        <span className="library-track__glyph" aria-hidden="true">
          ▶
        </span>
        <span className="library-track__copy">
          <strong>{track.title}</strong>
          <small>
            {track.artist} · {track.album}
          </small>
        </span>
      </button>
      <button
        className="library-track__action"
        type="button"
        title="Add to queue"
        aria-label={`Add ${track.title} to queue`}
        onClick={() => void enqueueTracks([track.id])}
      >
        +
      </button>
      {playlistId === undefined && playlists.length > 0 && (
        <select
          className="library-track__select"
          aria-label={`Add ${track.title} to a playlist`}
          defaultValue=""
          onChange={(event) => {
            const id = Number(event.currentTarget.value);
            if (id) void addToPlaylist(id, track.id);
            event.currentTarget.value = "";
          }}
        >
          <option value="">List</option>
          {playlists.map((playlist) => (
            <option key={playlist.id} value={playlist.id}>
              {playlist.name}
            </option>
          ))}
        </select>
      )}
      {playlistId !== undefined && (
        <button
          className="library-track__action"
          type="button"
          title="Remove from playlist"
          aria-label={`Remove ${track.title} from playlist`}
          onClick={() => void removeFromPlaylist(playlistId, track.id)}
        >
          ×
        </button>
      )}
    </li>
  );
}

function TrackList({
  tracks,
  playlistId,
}: {
  tracks: Track[];
  playlistId?: number;
}) {
  return (
    <ol className="library-track-list">
      {tracks.map((track, index) => (
        <TrackRow
          key={`${track.id}-${index}`}
          track={track}
          context={tracks}
          index={index}
          playlistId={playlistId}
        />
      ))}
    </ol>
  );
}

export function LibraryPanel() {
  const tracks = usePlayerStore((state) => state.tracks);
  const status = usePlayerStore((state) => state.status);
  const folders = usePlayerStore((state) => state.folders);
  const playlists = usePlayerStore((state) => state.playlists);
  const importFolder = usePlayerStore((state) => state.importFolder);
  const createPlaylist = usePlayerStore((state) => state.createPlaylist);
  const deletePlaylist = usePlayerStore((state) => state.deletePlaylist);
  const playTracks = usePlayerStore((state) => state.playTracks);
  const setView = useAppStore((state) => state.setView);
  const [tab, setTab] = useState<LibraryTab>("songs");
  const [search, setSearch] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () => tracks.filter((track) => matches(track, query)),
    [tracks, query],
  );
  const grouped = useMemo(
    () =>
      groups(filtered, (track) =>
        tab === "albums" ? track.album : track.artist,
      ),
    [filtered, tab],
  );
  const visibleFolders = useMemo(
    () =>
      folders.filter(
        (folder) =>
          folder.toLocaleLowerCase().includes(query) ||
          tracks.some(
            (track) => inFolder(track, folder) && matches(track, query),
          ),
      ),
    [folders, tracks, query],
  );
  const visiblePlaylists = useMemo(
    () =>
      playlists.filter(
        (playlist) =>
          playlist.name.toLocaleLowerCase().includes(query) ||
          playlist.tracks.some((track) => matches(track, query)),
      ),
    [playlists, query],
  );

  function submitPlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!playlistName.trim()) return;
    void createPlaylist(playlistName);
    setPlaylistName("");
  }

  return (
    <GlassPanel
      view="library"
      eyebrow={`${tracks.length} songs in your little world`}
    >
      {status === "scanning" && <AsciiScanLoader />}
      <label className="panel-search">
        <span className="sr-only">Search your library</span>
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder="Find a song, artist, album…"
        />
      </label>
      <div className="panel-tabs" aria-label="Browse library">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div aria-label={`${tab} in your library`}>
        {tab === "songs" &&
          (filtered.length > 0 ? (
            <TrackList tracks={filtered} />
          ) : (
            <div className="panel-empty">
              {!tracks.length && status !== "scanning" ? (
                <div className="panel-empty__art">
                  <LottieArt kind="empty" />
                  <EmptyLibraryAscii />
                </div>
              ) : (
                <span aria-hidden="true">♫</span>
              )}
              <p>
                {status === "scanning"
                  ? "Searching the shelves for songs…"
                  : tracks.length
                    ? "Nothing matches that search."
                    : "Your library is waiting for music."}
              </p>
              {!tracks.length && status !== "scanning" && (
                <button type="button" onClick={() => void importFolder()}>
                  Add music folder
                </button>
              )}
            </div>
          ))}
        {(tab === "albums" || tab === "artists") &&
          (grouped.length ? (
            grouped.map(([name, items]) => (
              <section className="library-group" key={name}>
                <div className="library-group__header">
                  <div>
                    <strong>{name}</strong>
                    <small>{items.length} songs</small>
                  </div>
                  <button
                    type="button"
                    aria-label={`Play all from ${name}`}
                    onClick={() => {
                      void playTracks(
                        items.map((track) => track.id),
                        0,
                      );
                      setView("now-playing");
                    }}
                  >
                    Play all
                  </button>
                </div>
                <TrackList tracks={items} />
              </section>
            ))
          ) : (
            <p className="panel-empty">No {tab} match that search.</p>
          ))}
        {tab === "folders" &&
          (visibleFolders.length ? (
            visibleFolders.map((folder) => {
              const items = folder.toLocaleLowerCase().includes(query)
                ? tracks.filter((track) => inFolder(track, folder))
                : filtered.filter((track) => inFolder(track, folder));
              return (
                <section className="library-group" key={folder}>
                  <div className="library-group__header">
                    <div>
                      <strong title={folder}>
                        {folder.split(/[\\/]/).pop()}
                      </strong>
                      <small title={folder}>{folder}</small>
                    </div>
                    <span className="library-group__count">{items.length}</span>
                  </div>
                  <TrackList tracks={items} />
                </section>
              );
            })
          ) : (
            <p className="panel-empty">
              {folders.length
                ? "No folders match that search."
                : "No music folders yet."}
            </p>
          ))}
        {tab === "playlists" && (
          <>
            <form className="playlist-create" onSubmit={submitPlaylist}>
              <label className="sr-only" htmlFor="playlist-name">
                New playlist name
              </label>
              <input
                id="playlist-name"
                value={playlistName}
                onChange={(event) => setPlaylistName(event.currentTarget.value)}
                placeholder="A new playlist…"
                maxLength={72}
              />
              <button type="submit" disabled={!playlistName.trim()}>
                Create
              </button>
            </form>
            {visiblePlaylists.length ? (
              visiblePlaylists.map((playlist) => (
                <section className="library-group" key={playlist.id}>
                  <div className="library-group__header">
                    <div>
                      <strong>{playlist.name}</strong>
                      <small>{playlist.tracks.length} songs</small>
                    </div>
                    <div className="library-group__actions">
                      <button
                        type="button"
                        disabled={!playlist.tracks.length}
                        onClick={() => {
                          void playTracks(
                            playlist.tracks.map((track) => track.id),
                            0,
                          );
                          setView("now-playing");
                        }}
                      >
                        Play
                      </button>
                      <button
                        type="button"
                        className="subtle-danger"
                        aria-label={`Delete playlist ${playlist.name}`}
                        onClick={() => void deletePlaylist(playlist.id)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {playlist.tracks.length ? (
                    <TrackList
                      tracks={
                        playlist.name.toLocaleLowerCase().includes(query)
                          ? playlist.tracks
                          : playlist.tracks.filter((track) =>
                              matches(track, query),
                            )
                      }
                      playlistId={playlist.id}
                    />
                  ) : (
                    <p className="library-group__empty">
                      Add songs from the Songs, Albums, or Artists tabs.
                    </p>
                  )}
                </section>
              ))
            ) : (
              <p className="panel-empty">
                {playlists.length
                  ? "No playlists match that search."
                  : "Make a playlist for your next listening day."}
              </p>
            )}
          </>
        )}
      </div>
    </GlassPanel>
  );
}
