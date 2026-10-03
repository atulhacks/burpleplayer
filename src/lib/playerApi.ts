import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface Track {
  id: number;
  path: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  hasArt: boolean;
}

export interface PlaybackState {
  track: Track | null;
  queue: Track[];
  queueIndex: number | null;
  positionMs: number;
  volume: number;
  playing: boolean;
}

export interface PositionEvent {
  positionMs: number;
  durationMs: number;
  playing: boolean;
}

export interface SpectrumEvent {
  bands: number[];
}

export interface AlbumArt {
  mimeType: string;
  bytes: number[];
}

export const desktopAvailable = isTauri();

export const playerApi = {
  playbackState: () => invoke<PlaybackState>("playback_state"),
  getTracks: () => invoke<Track[]>("get_tracks"),
  getFolders: () => invoke<string[]>("get_folders"),
  getAlbumArt: (trackId: number) =>
    invoke<AlbumArt | null>("get_album_art", { trackId }),
  play: () => invoke<PlaybackState>("play"),
  pause: () => invoke<PlaybackState>("pause"),
  togglePlayback: () => invoke<PlaybackState>("toggle_playback"),
  seek: (positionMs: number) => invoke<PlaybackState>("seek", { positionMs }),
  setVolume: (volume: number) =>
    invoke<PlaybackState>("set_volume", { volume }),
  next: () => invoke<PlaybackState>("next"),
  prev: () => invoke<PlaybackState>("prev"),
  loadQueue: (trackIds: number[], startIndex: number) =>
    invoke<PlaybackState>("load_queue", { trackIds, startIndex }),
  jumpToQueueIndex: (index: number) =>
    invoke<PlaybackState>("jump_to_queue_index", { index }),
  scanFolder: (path: string) => invoke<Track[]>("scan_folder", { path }),
  async pickFolder(): Promise<string | null> {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose a music folder",
    });
    return typeof selected === "string" ? selected : null;
  },
};
