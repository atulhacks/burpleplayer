import { useAppStore } from "../../store/appStore";
import { AsciiScanLoader } from "../extras/AsciiExtras";
import type {
  MotionPreference,
  ThemePreference,
  VisualizerMode,
} from "../../store/appStore";
import { usePlayerStore } from "../../store/playerStore";
import { GlassPanel } from "./GlassPanel";

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="settings-choice">
      <legend>{label}</legend>
      <div className="settings-choice__options">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsPanel() {
  const folders = usePlayerStore((state) => state.folders);
  const status = usePlayerStore((state) => state.status);
  const importFolder = usePlayerStore((state) => state.importFolder);
  const rescanFolder = usePlayerStore((state) => state.rescanFolder);
  const removeFolder = usePlayerStore((state) => state.removeFolder);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const motionPreference = useAppStore((state) => state.motionPreference);
  const setMotionPreference = useAppStore((state) => state.setMotionPreference);
  const visualizerMode = useAppStore((state) => state.visualizerMode);
  const setVisualizerMode = useAppStore((state) => state.setVisualizerMode);

  return (
    <GlassPanel view="settings" eyebrow="Make the playground yours">
      <section className="settings-section">
        {status === "scanning" && <AsciiScanLoader />}
        <div className="settings-section__heading">
          <div>
            <h3>Music folders</h3>
            <p>These folders are scanned into your library.</p>
          </div>
          <button
            type="button"
            disabled={status === "scanning"}
            onClick={() => void importFolder()}
          >
            + Add
          </button>
        </div>
        {folders.length ? (
          <ul className="settings-folders">
            {folders.map((folder) => (
              <li key={folder}>
                <span title={folder}>{folder}</span>
                <div>
                  <button
                    type="button"
                    disabled={status === "scanning"}
                    aria-label={`Rescan ${folder}`}
                    onClick={() => void rescanFolder(folder)}
                  >
                    ↻
                  </button>
                  <button
                    type="button"
                    className="subtle-danger"
                    aria-label={`Remove ${folder} from library`}
                    onClick={() => void removeFolder(folder)}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="settings-note">
            No folders yet. Add one to bring music in.
          </p>
        )}
      </section>
      <section className="settings-section">
        <h3>Appearance</h3>
        <Choice<ThemePreference>
          label="Sky theme"
          value={theme}
          onChange={setTheme}
          options={[
            { value: "day", label: "Sunny day" },
            { value: "twilight", label: "Twilight" },
          ]}
        />
      </section>
      <section className="settings-section">
        <h3>Motion</h3>
        <Choice<MotionPreference>
          label="Animation preference"
          value={motionPreference}
          onChange={setMotionPreference}
          options={[
            { value: "system", label: "System" },
            { value: "reduced", label: "Reduced" },
            { value: "full", label: "Full" },
          ]}
        />
        <p className="settings-note">
          Reduced motion keeps the LCD live while the swing, clouds, and cubes
          rest.
        </p>
      </section>
      <section className="settings-section">
        <h3>LCD</h3>
        <Choice<VisualizerMode>
          label="Visualizer mode"
          value={visualizerMode}
          onChange={setVisualizerMode}
          options={[
            { value: "bars", label: "Pixel bars" },
            { value: "ascii", label: "ASCII" },
          ]}
        />
      </section>
    </GlassPanel>
  );
}
