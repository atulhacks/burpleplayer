import { create } from "zustand";
import { desktopAvailable, playerApi } from "../lib/playerApi";
import type {
  PlaybackState,
  Playlist,
  PositionEvent,
  Track,
} from "../lib/playerApi";

export type PlayerStatus = "loading" | "ready" | "scanning" | "web-preview";

interface PlayerStore {
  playback: PlaybackState;
  tracks: Track[];
  folders: string[];
  playlists: Playlist[];
  importCelebrationId: number;
  status: PlayerStatus;
  error: string | null;
  applyPlayback: (playback: PlaybackState) => void;
  applyPosition: (position: PositionEvent) => void;
  setTracks: (tracks: Track[]) => void;
  setFolders: (folders: string[]) => void;
  setPlaylists: (playlists: Playlist[]) => void;
  setStatus: (status: PlayerStatus) => void;
  setError: (error: string | null) => void;
  toggle: () => Promise<void>;
  previous: () => Promise<void>;
  next: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  adjustVolume: (delta: number) => Promise<void>;
  jumpTo: (index: number) => Promise<void>;
  playTracks: (trackIds: number[], startIndex: number) => Promise<void>;
  enqueueTracks: (trackIds: number[]) => Promise<void>;
  moveQueue: (from: number, to: number) => Promise<void>;
  removeQueue: (index: number) => Promise<void>;
  importFolder: () => Promise<void>;
  rescanFolder: (path: string) => Promise<void>;
  removeFolder: (path: string) => Promise<void>;
  createPlaylist: (name: string) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;
  addToPlaylist: (playlistId: number, trackId: number) => Promise<void>;
  removeFromPlaylist: (playlistId: number, trackId: number) => Promise<void>;
  toggleFavorite: (trackId: number) => Promise<boolean>;
}

const initialPlayback: PlaybackState = {
  track: null,
  queue: [],
  queueIndex: null,
  positionMs: 0,
  volume: 0.8,
  playing: false,
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const usePlayerStore = create<PlayerStore>((set, get) => {
  async function transport(action: () => Promise<PlaybackState>) {
    if (!desktopAvailable) {
      set({ error: "Open the Tauri desktop app to play local music." });
      return;
    }
    try {
      const playback = await action();
      set({ playback, error: null });
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  }

  return {
    playback: initialPlayback,
    tracks: [],
    folders: [],
    playlists: [],
    importCelebrationId: 0,
    status: desktopAvailable ? "loading" : "web-preview",
    error: null,
    applyPlayback: (playback) => set({ playback, error: null }),
    applyPosition: (position) =>
      set((state) => ({
        playback: {
          ...state.playback,
          positionMs: position.positionMs,
          playing: position.playing,
        },
      })),
    setTracks: (tracks) => set({ tracks }),
    setFolders: (folders) => set({ folders }),
    setPlaylists: (playlists) => set({ playlists }),
    setStatus: (status) => set({ status }),
    setError: (error) => set({ error }),
    toggle: async () => {
      const { playback, tracks } = get();
      if (playback.track) {
        await transport(playerApi.togglePlayback);
      } else if (tracks.length > 0) {
        await transport(() =>
          playerApi.loadQueue(
            tracks.map((track) => track.id),
            0,
          ),
        );
      } else {
        await get().importFolder();
      }
    },
    previous: () => transport(playerApi.prev),
    next: () => transport(playerApi.next),
    seek: (positionMs) =>
      transport(() => playerApi.seek(Math.max(0, Math.round(positionMs)))),
    setVolume: (volume) =>
      transport(() => playerApi.setVolume(Math.min(1, Math.max(0, volume)))),
    adjustVolume: async (delta) => {
      const volume = get().playback.volume;
      await get().setVolume(Math.round((volume + delta) * 100) / 100);
    },
    jumpTo: (index) => transport(() => playerApi.jumpToQueueIndex(index)),
    playTracks: (trackIds, startIndex) =>
      transport(() => playerApi.loadQueue(trackIds, startIndex)),
    enqueueTracks: (trackIds) => transport(() => playerApi.enqueue(trackIds)),
    moveQueue: (from, to) => transport(() => playerApi.moveInQueue(from, to)),
    removeQueue: (index) => transport(() => playerApi.removeFromQueue(index)),
    importFolder: async () => {
      if (!desktopAvailable) {
        set({ error: "Open the Tauri desktop app to choose a music folder." });
        return;
      }
      try {
        const path = await playerApi.pickFolder();
        if (!path) return;
        set({ status: "scanning", error: null });
        const tracks = await playerApi.scanFolder(path);
        const folders = await playerApi.getFolders();
        set((state) => ({
          tracks,
          folders,
          status: "ready",
          importCelebrationId:
            state.importCelebrationId + (tracks.length > 0 ? 1 : 0),
        }));
        if (tracks.length === 0) {
          set({ error: "No supported audio files found in that folder." });
        }
      } catch (error) {
        set({ error: errorMessage(error), status: "ready" });
      }
    },
    rescanFolder: async (path) => {
      if (!desktopAvailable) return;
      try {
        set({ status: "scanning", error: null });
        const tracks = await playerApi.scanFolder(path);
        set({ tracks, status: "ready" });
      } catch (error) {
        set({ status: "ready", error: errorMessage(error) });
      }
    },
    removeFolder: async (path) => {
      if (!desktopAvailable) return;
      try {
        const tracks = await playerApi.removeFolder(path);
        const [folders, playlists] = await Promise.all([
          playerApi.getFolders(),
          playerApi.getPlaylists(),
        ]);
        set({ tracks, folders, playlists, error: null });
      } catch (error) {
        set({ error: errorMessage(error) });
      }
    },
    createPlaylist: async (name) => {
      if (!desktopAvailable) return;
      try {
        await playerApi.createPlaylist(name.trim());
        set({ playlists: await playerApi.getPlaylists(), error: null });
      } catch (error) {
        set({ error: errorMessage(error) });
      }
    },
    deletePlaylist: async (id) => {
      if (!desktopAvailable) return;
      try {
        await playerApi.deletePlaylist(id);
        set({ playlists: await playerApi.getPlaylists(), error: null });
      } catch (error) {
        set({ error: errorMessage(error) });
      }
    },
    addToPlaylist: async (playlistId, trackId) => {
      if (!desktopAvailable) return;
      try {
        await playerApi.addToPlaylist(playlistId, trackId);
        set({ playlists: await playerApi.getPlaylists(), error: null });
      } catch (error) {
        set({ error: errorMessage(error) });
      }
    },
    removeFromPlaylist: async (playlistId, trackId) => {
      if (!desktopAvailable) return;
      try {
        await playerApi.removeFromPlaylist(playlistId, trackId);
        set({ playlists: await playerApi.getPlaylists(), error: null });
      } catch (error) {
        set({ error: errorMessage(error) });
      }
    },
    toggleFavorite: async (trackId) => {
      if (!desktopAvailable) {
        set({ error: "Open the Tauri desktop app to save favorites." });
        return false;
      }
      try {
        let favorite = get().playlists.find(
          (playlist) => playlist.name.toLocaleLowerCase() === "favorites",
        );
        if (!favorite) {
          await playerApi.createPlaylist("Favorites");
          const playlists = await playerApi.getPlaylists();
          favorite = playlists.find(
            (playlist) => playlist.name.toLocaleLowerCase() === "favorites",
          );
        }
        if (!favorite) throw new Error("Favorites playlist was not created.");
        const saved = favorite.tracks.some((track) => track.id === trackId);
        if (saved) await playerApi.removeFromPlaylist(favorite.id, trackId);
        else await playerApi.addToPlaylist(favorite.id, trackId);
        set({ playlists: await playerApi.getPlaylists(), error: null });
        return !saved;
      } catch (error) {
        set({ error: errorMessage(error) });
        return false;
      }
    },
  };
});
