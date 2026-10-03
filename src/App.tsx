import "./styles/tokens.css";
import "./App.css";

export default function App() {
  return (
    <main className="app-shell">
      <header className="titlebar" data-tauri-drag-region>
        <span data-tauri-drag-region>BurplePlayer</span>
      </header>
      <div
        className="stage-label"
        aria-label="BurplePlayer is ready for its scene"
      >
        <span className="stage-label__eyebrow">
          A little world for your music
        </span>
        <h1>BurplePlayer</h1>
        <p>The playground is being built.</p>
      </div>
    </main>
  );
}
