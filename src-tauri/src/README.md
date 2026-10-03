# Backend layout

- `audio/`: decoder, output, transport, queue, and spectrum.
- `library/`: metadata, artwork, SQLite, folder scans, playlists.
- `media/`: OS media session and media-key integration.
- `ipc/`: Tauri commands, event payloads, and validation.

The Rust backend will own audio playback and library state from milestone 2 onward.
