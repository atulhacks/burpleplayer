use std::path::Path;

use tauri::{AppHandle, Emitter, State};

use crate::audio::{Action, EngineHandle};
use crate::library::Library;
use crate::models::{AlbumArt, PlaybackState, Playlist, Track};

async fn send(engine: State<'_, EngineHandle>, action: Action) -> Result<PlaybackState, String> {
    let handle = engine.inner().clone();
    // Audio requests can wait on native media/output work; never occupy the UI thread.
    tauri::async_runtime::spawn_blocking(move || handle.request(action))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn playback_state(engine: State<'_, EngineHandle>) -> Result<PlaybackState, String> {
    send(engine, Action::Snapshot).await
}

#[tauri::command]
pub async fn play(engine: State<'_, EngineHandle>) -> Result<PlaybackState, String> {
    send(engine, Action::Play).await
}

#[tauri::command]
pub async fn pause(engine: State<'_, EngineHandle>) -> Result<PlaybackState, String> {
    send(engine, Action::Pause).await
}

#[tauri::command]
pub async fn toggle_playback(engine: State<'_, EngineHandle>) -> Result<PlaybackState, String> {
    send(engine, Action::Toggle).await
}

#[tauri::command]
pub async fn seek(
    position_ms: u64,
    engine: State<'_, EngineHandle>,
) -> Result<PlaybackState, String> {
    send(engine, Action::Seek(position_ms)).await
}

#[tauri::command]
pub async fn set_volume(
    volume: f32,
    engine: State<'_, EngineHandle>,
) -> Result<PlaybackState, String> {
    send(engine, Action::Volume(volume)).await
}

#[tauri::command]
pub async fn next(engine: State<'_, EngineHandle>) -> Result<PlaybackState, String> {
    send(engine, Action::Next).await
}

#[tauri::command]
pub async fn prev(engine: State<'_, EngineHandle>) -> Result<PlaybackState, String> {
    send(engine, Action::Previous).await
}

#[tauri::command]
pub async fn load_queue(
    track_ids: Vec<i64>,
    start_index: usize,
    library: State<'_, Library>,
    engine: State<'_, EngineHandle>,
) -> Result<PlaybackState, String> {
    let tracks = track_ids
        .into_iter()
        .map(|id| library.track(id))
        .collect::<Result<Vec<_>, _>>()?;
    send(engine, Action::Load(tracks, start_index)).await
}

#[tauri::command]
pub async fn enqueue(
    track_ids: Vec<i64>,
    library: State<'_, Library>,
    engine: State<'_, EngineHandle>,
) -> Result<PlaybackState, String> {
    let tracks = track_ids
        .into_iter()
        .map(|id| library.track(id))
        .collect::<Result<Vec<_>, _>>()?;
    send(engine, Action::Enqueue(tracks)).await
}

#[tauri::command]
pub async fn remove_from_queue(
    index: usize,
    engine: State<'_, EngineHandle>,
) -> Result<PlaybackState, String> {
    send(engine, Action::Remove(index)).await
}

#[tauri::command]
pub async fn move_in_queue(
    from: usize,
    to: usize,
    engine: State<'_, EngineHandle>,
) -> Result<PlaybackState, String> {
    send(engine, Action::Move(from, to)).await
}

#[tauri::command]
pub async fn jump_to_queue_index(
    index: usize,
    engine: State<'_, EngineHandle>,
) -> Result<PlaybackState, String> {
    send(engine, Action::Jump(index)).await
}

#[tauri::command]
pub fn get_tracks(library: State<'_, Library>) -> Result<Vec<Track>, String> {
    library.tracks()
}

#[tauri::command]
pub fn get_folders(library: State<'_, Library>) -> Result<Vec<String>, String> {
    library.folders()
}

#[tauri::command]
pub fn scan_folder(
    path: String,
    library: State<'_, Library>,
    app: AppHandle,
) -> Result<Vec<Track>, String> {
    let tracks = library.scan_folder(Path::new(&path))?;
    let _ = app.emit("library:updated", &tracks);
    Ok(tracks)
}

#[tauri::command]
pub fn remove_folder(
    path: String,
    library: State<'_, Library>,
    app: AppHandle,
) -> Result<Vec<Track>, String> {
    let tracks = library.remove_folder(&path)?;
    let _ = app.emit("library:updated", &tracks);
    Ok(tracks)
}

#[tauri::command]
pub fn get_album_art(
    track_id: i64,
    library: State<'_, Library>,
) -> Result<Option<AlbumArt>, String> {
    library.album_art(track_id)
}

#[tauri::command]
pub fn get_playlists(library: State<'_, Library>) -> Result<Vec<Playlist>, String> {
    library.playlists()
}

#[tauri::command]
pub fn create_playlist(name: String, library: State<'_, Library>) -> Result<i64, String> {
    if name.trim().is_empty() {
        return Err("Playlist name cannot be empty".into());
    }
    library.create_playlist(name.trim())
}

#[tauri::command]
pub fn delete_playlist(id: i64, library: State<'_, Library>) -> Result<(), String> {
    library.delete_playlist(id)
}

#[tauri::command]
pub fn add_to_playlist(
    playlist_id: i64,
    track_id: i64,
    library: State<'_, Library>,
) -> Result<(), String> {
    library.add_to_playlist(playlist_id, track_id)
}

#[tauri::command]
pub fn remove_from_playlist(
    playlist_id: i64,
    track_id: i64,
    library: State<'_, Library>,
) -> Result<(), String> {
    library.remove_from_playlist(playlist_id, track_id)
}
