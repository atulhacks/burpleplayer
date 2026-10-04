# BurplePlayer

A portrait desktop music player built with Tauri 2, Rust, React, TypeScript, Vite, pnpm, and Zustand. The clay-toy swing image at [`design/reference.png`](design/reference.png) is the visual reference.

## Status

**Milestones 0–5 complete:** the clay playground is wired to the Rust audio engine, has its motion pass, and now opens full Library, Queue, and Settings glass panels with a cloud-wipe transition. The console D-pad, A/B buttons, LCD, queue cubes, native music-folder picker, and compact Now Playing dock are interactive. Rust decodes and plays local music, owns the queue and persistent library, and emits playback and spectrum updates. Lottie and expanded ASCII extras, the accessibility/performance audit, and final polish remain for later milestones.

## Development

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm tauri dev
```

For a Rust-only check:

```sh
cargo check --manifest-path src-tauri/Cargo.toml
```

On the current macOS workstation, the Command Line Tools default to an SDK whose `.tbd` files this linker cannot parse. Until the toolchain is updated, prefix Rust/Tauri commands with `SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk`; this SDK was used for the milestone-0 Rust check, Clippy, and desktop smoke test. Other platforms should use their normal SDK selection.

## Architecture

- `src/components/scene/` — sky, clouds, pillars, swing, player, and queue cubes.
- `src/components/controls/` — accessible Now Playing transport and seek/volume dock.
- `src/components/panels/` — compact Queue drawer (full views arrive in milestone 5).
- `src/store/` — Zustand UI state plus a mirror of Rust's authoritative playback/library state.
- `src/lib/` — typed Tauri IPC, event handling, and album-art palette extraction.
- `src-tauri/src/audio/` — Rust playback, transport, queue, and spectrum.
- `src-tauri/src/library/` — tags, artwork, SQLite, scans, and playlists.
- `src-tauri/src/ipc/` — commands and event payloads.

Rust is the source of truth for playback and library data. The frontend only sends commands and renders backend snapshots/events. The native Tauri dialog selects a folder; Rust scans it. `src-tauri/src/README.md` lists the command and event contract.

The scene in `src/components/scene/ClayScene.tsx` is layered SVG/CSS, not the reference image used as a background. The LCD draws live track text, time, face, and a 16-band spectrum. Up to six upcoming tracks appear as cubes; album art supplies their color when available. The hot spectrum path updates SVG bars through refs without rerendering React at 30 Hz.

`src/components/scene/useSceneMotion.ts` owns one GSAP ticker callback for the scene: a damped swing spring driven by volume and spectrum energy, staggered bass/kick cube hops, three cloud parallax layers, and a softly bobbing/blinking LCD face. The same spectrum listener feeds motion and LCD bars or a simple ASCII readout. Animation suspends when the document is hidden; OS reduced-motion and the app's `system`/`reduced`/`full` preference disable scene motion without stopping LCD updates. Button, D-pad, and slider feedback uses transform-only CSS transitions with a reduced-motion override.

The persistent view switcher keeps the scene behind the tinted glass panels. Normal navigation runs an interruptible, 0.6-second GSAP cloud wipe while the pillars part; reduced motion uses a short fade. Library has song search, album/artist/folder browsing, playlists, and play/enqueue actions. Queue supports drag reorder and keyboard-operable move/remove buttons. Settings manages scanned folders, sunny/twilight themes, motion preference, and bar/ASCII LCD modes. UI preferences persist locally; Rust remains authoritative for tracks, playlists, and playback.

## Controls

- Console D-pad: left/right skip tracks; up/down change volume.
- Console A: play/pause (or choose a folder when the library is empty).
- Console B: open the Queue drawer; click an upcoming cube to jump to that song.
- Keyboard: Space, arrow keys, Tab/Enter, and Escape for the Queue drawer.
- The compact dock can expand to reveal seek and volume sliders. The `+ Music` button adds another folder.
- The four navigation buttons open Play, Library, Queue, and Settings. In Library, search and browse songs, albums, artists, folders, or playlists. Add a song to the queue with `+`, or select a playlist from its row.
- In Queue, drag a row or use its ↑/↓ buttons to reorder it. In Settings, rescan/remove library folders and choose theme, motion, or LCD mode.

## Bundled fonts

The interface bundles [Fredoka](https://github.com/google/fonts/tree/main/ofl/fredoka) and [Press Start 2P](https://github.com/google/fonts/tree/main/ofl/pressstart2p) locally under `src/assets/fonts/`. Both are distributed under their included SIL Open Font License files; no font CDN is used.

## Skill application plan

The requested skill files were read before implementation. The `svg-animation` approach provides inline scalable vector art and live LCD spectrum bars. The `micro-interaction` approach informs console hit targets, press feedback, and slider spring release. The `gsap-web` approach supplies the single-ticker scene choreography and transition timeline. The `accessible-animation` approach supplies OS/in-app reduced-motion behavior. The `glassmorphism` approach supplies static, sparingly blurred Library/Queue/Settings panels. The `page-transition-animation` approach supplies an interruptible view swap behind a moving cloud layer. Lottie and expanded ASCII extras and the measured performance audit remain scheduled for their respective milestones.
