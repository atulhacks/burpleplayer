import { create } from "zustand";
import { desktopAvailable, playerApi } from "../lib/playerApi";
import type { PlaybackState, PositionEvent, Track } from "../lib/playerApi";

export type PlayerStatus = "loading" | "ready" | "scanning" | "web-preview";

interface PlayerStore {
  playback: PlaybackState;
  tracks: Track[];
  folders: string[];
  status: PlayerStatus;
  error: string | null;
  applyPlayback: (playback: PlaybackState) => void;
  applyPosition: (position: PositionEvent) => void;
  setTracks: (tracks: Track[]) => void;
  setFolders: (folders: string[]) => void;
  setStatus: (status: PlayerStatus) => void;
  setError: (error: string | null) => void;
  toggle: () => Promise<void>;
  previous: () => Promise<void>;
  next: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  adjustVolume: (delta: number) => Promise<void>;
  jumpTo: (index: number) => Promise<void>;
  importFolder: () => Promise<void>;
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
        set({ tracks, folders, status: "ready" });
        if (tracks.length === 0) {
          set({ error: "No supported audio files found in that folder." });
        }
      } catch (error) {
        set({ error: errorMessage(error), status: "ready" });
      }
    },
  };
});
