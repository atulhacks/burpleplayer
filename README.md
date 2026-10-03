# BurplePlayer

A portrait desktop music player built with Tauri 2, Rust, React, TypeScript, Vite, pnpm, and Zustand. The clay-toy swing image at [`design/reference.png`](design/reference.png) is the visual reference.

## Status

**Milestones 0–3 complete:** the clay playground is now wired to the Rust audio engine. The console D-pad, A/B buttons, LCD, queue cubes, native music-folder picker, and compact Now Playing dock are interactive. Rust decodes and plays local music, owns the queue and persistent library, and emits playback and spectrum updates. Motion choreography, full Library/Queue/Settings views, extras, and the final audit remain for later milestones.

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

## Controls

- Console D-pad: left/right skip tracks; up/down change volume.
- Console A: play/pause (or choose a folder when the library is empty).
- Console B: open the Queue drawer; click an upcoming cube to jump to that song.
- Keyboard: Space, arrow keys, Tab/Enter, and Escape for the Queue drawer.
- The compact dock can expand to reveal seek and volume sliders. The `+ Music` button adds another folder.

## Bundled fonts

The interface bundles [Fredoka](https://github.com/google/fonts/tree/main/ofl/fredoka) and [Press Start 2P](https://github.com/google/fonts/tree/main/ofl/pressstart2p) locally under `src/assets/fonts/`. Both are distributed under their included SIL Open Font License files; no font CDN is used.

## Skill application plan

The requested skill files were read before implementation. The `svg-animation` approach provides inline scalable vector art and live LCD spectrum bars. The `micro-interaction` approach informs console hit targets and press feedback. The `glassmorphism` approach informs the static, sparingly blurred Queue drawer and dock. GSAP choreography, cloud-wipe transitions, Lottie and ASCII extras, reduced-motion behavior, and performance audit remain scheduled for their respective milestones.
