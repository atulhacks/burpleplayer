use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: i64,
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: u64,
    pub has_art: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackState {
    pub track: Option<Track>,
    pub queue: Vec<Track>,
    pub queue_index: Option<usize>,
    pub position_ms: u64,
    pub volume: f32,
    pub playing: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionEvent {
    pub position_ms: u64,
    pub duration_ms: u64,
    pub playing: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct SpectrumEvent {
    pub bands: [u8; 16],
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumArt {
    pub mime_type: String,
    pub bytes: Vec<u8>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Playlist {
    pub id: i64,
    pub name: String,
    pub tracks: Vec<Track>,
}
