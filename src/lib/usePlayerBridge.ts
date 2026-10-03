import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { desktopAvailable, playerApi } from "./playerApi";
import type { PlaybackState, PositionEvent, Track } from "./playerApi";
import { usePlayerStore } from "../store/playerStore";

export function usePlayerBridge() {
  useEffect(() => {
    if (!desktopAvailable) return;
    let active = true;
    let unlisteners: UnlistenFn[] = [];
    const store = usePlayerStore.getState();

    async function connect() {
      try {
        const listeners = await Promise.all([
          listen<PlaybackState>("player:track", (event) => {
            if (active) usePlayerStore.getState().applyPlayback(event.payload);
          }),
          listen<PositionEvent>("player:position", (event) => {
            if (active) usePlayerStore.getState().applyPosition(event.payload);
          }),
          listen<Track[]>("library:updated", (event) => {
            if (active) usePlayerStore.getState().setTracks(event.payload);
          }),
        ]);
        if (!active) {
          listeners.forEach((unlisten) => unlisten());
          return;
        }
        unlisteners = listeners;
        const [playback, tracks, folders] = await Promise.all([
          playerApi.playbackState(),
          playerApi.getTracks(),
          playerApi.getFolders(),
        ]);
        if (!active) return;
        const current = usePlayerStore.getState();
        current.applyPlayback(playback);
        current.setTracks(tracks);
        current.setFolders(folders);
        current.setStatus("ready");
      } catch (error) {
        if (active) {
          usePlayerStore.getState().setStatus("ready");
          usePlayerStore.getState().setError(String(error));
        }
      }
    }

    void connect();
    return () => {
      active = false;
      unlisteners.forEach((unlisten) => unlisten());
      store.setStatus("loading");
    };
  }, []);
}
