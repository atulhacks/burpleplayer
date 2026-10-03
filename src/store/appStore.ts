import { create } from "zustand";

export type AppView = "now-playing" | "library" | "queue" | "settings";
export type MotionPreference = "system" | "reduced" | "full";

interface AppState {
  view: AppView;
  motionPreference: MotionPreference;
  setView: (view: AppView) => void;
  setMotionPreference: (preference: MotionPreference) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "now-playing",
  motionPreference: "system",
  setView: (view) => set({ view }),
  setMotionPreference: (motionPreference) => set({ motionPreference }),
}));
