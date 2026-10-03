use std::path::Path;

use tauri::{AppHandle, Emitter, State};

use crate::audio::{Action, EngineHandle};
use crate::library::Library;
use crate::models::{AlbumArt, PlaybackState, Playlist, Track};

fn send(engine: State<'_, EngineHandle>, action: Action) -> Result<PlaybackState, String> {
    engine.request(action)
}

#[tauri::command]
pub fn playback_state(engine: State<'_, EngineHandle>) -> Result<PlaybackState, String> {
    send(engine, Action::Snapshot)
}

#[tauri::command]
pub fn play(engine: State<'_, EngineHandle>) -> Result<PlaybackState, String> {
    send(engine, Action::Play)
}

#[tauri::command]
pub fn pause(engine: State<'_, EngineHandle>) -> Result<PlaybackState, String> {
    send(engine, Action::Pause)
}

#[tauri::command]
pub fn toggle_playback(engine: State<'_, EngineHandle>) -> Result<PlaybackState, String> {
    send(engine, Action::Toggle)
}

#[tauri::command]
pub fn seek(position_ms: u64, engine: State<'_, EngineHandle>) -> Result<PlaybackState, String> {
    send(engine, Action::Seek(position_ms))
}

#[tauri::command]
pub fn set_volume(volume: f32, engine: State<'_, EngineHandle>) -> Result<PlaybackState, String> {
    send(engine, Action::Volume(volume))
}

#[tauri::command]
pub fn next(engine: State<'_, EngineHandle>) -> Result<PlaybackState, String> {
    send(engine, Action::Next)
}

#[tauri::command]
pub fn prev(engine: State<'_, EngineHandle>) -> Result<PlaybackState, String> {
    send(engine, Action::Previous)
}

#[tauri::command]
pub fn load_queue(
    track_ids: Vec<i64>,
    start_index: usize,
    library: State<'_, Library>,
    engine: State<'_, EngineHandle>,
) -> Result<PlaybackState, String> {
    let tracks = track_ids
        .into_iter()
        .map(|id| library.track(id))
        .collect::<Result<Vec<_>, _>>()?;
    send(engine, Action::Load(tracks, start_index))
}

#[tauri::command]
pub fn enqueue(
    track_ids: Vec<i64>,
    library: State<'_, Library>,
    engine: State<'_, EngineHandle>,
) -> Result<PlaybackState, String> {
    let tracks = track_ids
        .into_iter()
        .map(|id| library.track(id))
        .collect::<Result<Vec<_>, _>>()?;
    send(engine, Action::Enqueue(tracks))
}

#[tauri::command]
pub fn remove_from_queue(
    index: usize,
    engine: State<'_, EngineHandle>,
) -> Result<PlaybackState, String> {
    send(engine, Action::Remove(index))
}

#[tauri::command]
pub fn move_in_queue(
    from: usize,
    to: usize,
    engine: State<'_, EngineHandle>,
) -> Result<PlaybackState, String> {
    send(engine, Action::Move(from, to))
}

#[tauri::command]
pub fn jump_to_queue_index(
    index: usize,
    engine: State<'_, EngineHandle>,
) -> Result<PlaybackState, String> {
    send(engine, Action::Jump(index))
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
