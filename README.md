# BurplePlayer

A portrait desktop music player built with Tauri 2, Rust, React, TypeScript, Vite, pnpm, and Zustand. The attached clay-toy swing image is stored at [`design/reference.png`](design/reference.png) and guides the scene planned for milestone 1.

## Status

**Milestone 0 complete:** official Tauri 2 scaffold, portrait window, strict TypeScript, UI/backend folder map, reference asset, design tokens, ESLint, Prettier, Rust formatting, and a launchable placeholder screen. Audio playback and the illustrated scene are not implemented yet.

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
- `src/components/controls/` — keyboard-accessible physical toy controls.
- `src/components/panels/` — Library, Queue, and Settings overlays.
- `src/store/` — Zustand state for UI views and motion preference only.
- `src/lib/` — frontend IPC adapters and event handling.
- `src-tauri/src/audio/` — Rust playback, transport, queue, and spectrum.
- `src-tauri/src/library/` — tags, artwork, SQLite, scans, and playlists.
- `src-tauri/src/media/` — OS media controls.
- `src-tauri/src/ipc/` — commands and event payloads.

Rust will be the source of truth for playback and library data. The current app is intentionally a milestone-0 scaffold, not a mock music player.

## Skill application plan

The requested skill files were read before implementation. Milestone 0 establishes the tokens and folder boundaries they will use. The scene, SVG elements, GSAP choreography, micro-interactions, page transitions, glass overlays, Lottie and ASCII extras, reduced-motion behavior, and performance audit are scheduled for their respective milestones.
