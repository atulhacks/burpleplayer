# Frontend layout

- `scene/`: the clay sky, clouds, pillars, swing, player, and queue cubes, plus the shared motion ticker.
- `controls/`: accessible player input surfaces.
- `panels/`: Library, Queue, and Settings glass overlays; the Queue has drag and keyboard reordering.
- `../store/`: Zustand UI state. Rust remains authoritative for audio state.
- `../lib/`: typed Tauri IPC and event adapters.
