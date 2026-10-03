import { ClayScene } from "./components/scene/ClayScene";
import "./styles/tokens.css";
import "./App.css";

export default function App() {
  return (
    <main className="app-shell">
      <div className="scene-frame">
        <ClayScene />
      </div>
      <header className="titlebar" data-tauri-drag-region>
        <span data-tauri-drag-region>BurplePlayer</span>
      </header>
    </main>
  );
}
