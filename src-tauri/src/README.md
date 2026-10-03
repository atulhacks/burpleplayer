# Rust backend

Rust owns the library and all playback state. React calls Tauri commands and listens for events; it does not open local audio files.

## Modules

- `audio/decoder.rs`: Symphonia streaming decoder for MP3, FLAC, WAV, OGG/Vorbis, and AAC in MP4/M4A containers. Implements Rodio's `Source`, including seek.
- `audio/spectrum.rs`: nonblocking mono tap and 2048-point FFT, quantized to 16 `u8` bands.
- `audio/mod.rs`: dedicated transport worker, Rodio output, queue, volume, playback clock, and Souvlaki media controls.
- `library/mod.rs`: Lofty metadata/artwork reader, WalkDir scanner, SQLite tracks/folders/playlists.
- `ipc/mod.rs`: Tauri commands for transport, queue, library, artwork, and playlists.
- `models.rs`: serialized command responses and event payloads.

## Commands

Transport: `playback_state`, `play`, `pause`, `toggle_playback`, `seek({ positionMs })`, `set_volume({ volume })`, `next`, `prev`.

Queue: `load_queue({ trackIds, startIndex })`, `enqueue({ trackIds })`, `remove_from_queue({ index })`, `move_in_queue({ from, to })`, `jump_to_queue_index({ index })`.

Library: `get_tracks`, `get_folders`, `scan_folder({ path })`, `remove_folder({ path })`, `get_album_art({ trackId })`. `get_album_art` returns `{ mimeType, bytes }` or `null`.

Playlists: `get_playlists`, `create_playlist({ name })`, `delete_playlist({ id })`, `add_to_playlist({ playlistId, trackId })`, `remove_from_playlist({ playlistId, trackId })`.

## Events

- `player:track`: full `PlaybackState`, emitted on transport/queue/track changes.
- `player:position`: `{ positionMs, durationMs, playing }`, every 250 ms.
- `player:spectrum`: `{ bands: number[16] }`, about every 33 ms. The renderer should update visualizer DOM through refs.
- `library:updated`: full track list after a folder scan or removal.

The SQLite database lives under Tauri's app-data directory (`library.sqlite3`). Audio output opens lazily on first play, so the UI still starts when no audio device is available.

## Checks

`cargo test` covers WAV decode/seek, library persistence/pruning, and FFT response. `cargo test streams_decoded_audio_to_output -- --ignored` additionally checks the physical default output device.
