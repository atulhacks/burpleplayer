import { create } from "zustand";

export type AppView = "now-playing" | "library" | "queue" | "settings";
export type MotionPreference = "system" | "reduced" | "full";
export type ThemePreference = "day" | "twilight";
export type VisualizerMode = "bars" | "ascii";

function savedChoice<T extends string>(
  key: string,
  choices: readonly T[],
  fallback: T,
): T {
  try {
    const value = localStorage.getItem(key);
    return choices.find((choice) => choice === value) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveChoice(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Playback and navigation remain usable when storage is unavailable.
  }
}

interface AppState {
  view: AppView;
  motionPreference: MotionPreference;
  theme: ThemePreference;
  visualizerMode: VisualizerMode;
  setView: (view: AppView) => void;
  setMotionPreference: (preference: MotionPreference) => void;
  setTheme: (theme: ThemePreference) => void;
  setVisualizerMode: (mode: VisualizerMode) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "now-playing",
  motionPreference: savedChoice(
    "burple.motion",
    ["system", "reduced", "full"],
    "system",
  ),
  theme: savedChoice("burple.theme", ["day", "twilight"], "day"),
  visualizerMode: savedChoice("burple.visualizer", ["bars", "ascii"], "bars"),
  setView: (view) => set({ view }),
  setMotionPreference: (motionPreference) => {
    saveChoice("burple.motion", motionPreference);
    set({ motionPreference });
  },
  setTheme: (theme) => {
    saveChoice("burple.theme", theme);
    set({ theme });
  },
  setVisualizerMode: (visualizerMode) => {
    saveChoice("burple.visualizer", visualizerMode);
    set({ visualizerMode });
  },
}));
