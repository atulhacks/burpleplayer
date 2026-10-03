mod audio;
mod ipc;
mod library;
mod models;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let library = library::Library::open(data_dir.join("library.sqlite3"))
                .map_err(std::io::Error::other)?;
            app.manage(library);
            app.manage(audio::EngineHandle::start(app.handle().clone()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ipc::playback_state,
            ipc::play,
            ipc::pause,
            ipc::toggle_playback,
            ipc::seek,
            ipc::set_volume,
            ipc::next,
            ipc::prev,
            ipc::load_queue,
            ipc::enqueue,
            ipc::remove_from_queue,
            ipc::move_in_queue,
            ipc::jump_to_queue_index,
            ipc::get_tracks,
            ipc::get_folders,
            ipc::scan_folder,
            ipc::remove_folder,
            ipc::get_album_art,
            ipc::get_playlists,
            ipc::create_playlist,
            ipc::delete_playlist,
            ipc::add_to_playlist,
            ipc::remove_from_playlist,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run BurplePlayer");
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::Duration;

    use rodio::Source;

    use crate::audio::decoder::SymphoniaSource;
    use crate::library::Library;

    static TEST_NUMBER: AtomicUsize = AtomicUsize::new(0);

    struct TestDir(PathBuf);

    impl TestDir {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "burpleplayer-test-{}-{}",
                std::process::id(),
                TEST_NUMBER.fetch_add(1, Ordering::Relaxed)
            ));
            std::fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn write_wav(path: &Path) {
        let sample_rate = 44_100_u32;
        let frames = sample_rate;
        let data_len = frames * 2;
        let mut bytes = Vec::with_capacity((44 + data_len) as usize);
        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&(36 + data_len).to_le_bytes());
        bytes.extend_from_slice(b"WAVEfmt ");
        bytes.extend_from_slice(&16_u32.to_le_bytes());
        bytes.extend_from_slice(&1_u16.to_le_bytes());
        bytes.extend_from_slice(&1_u16.to_le_bytes());
        bytes.extend_from_slice(&sample_rate.to_le_bytes());
        bytes.extend_from_slice(&(sample_rate * 2).to_le_bytes());
        bytes.extend_from_slice(&2_u16.to_le_bytes());
        bytes.extend_from_slice(&16_u16.to_le_bytes());
        bytes.extend_from_slice(b"data");
        bytes.extend_from_slice(&data_len.to_le_bytes());
        for index in 0..frames {
            let phase = std::f32::consts::TAU * 440.0 * index as f32 / sample_rate as f32;
            let sample = (phase.sin() * 16_000.0) as i16;
            bytes.extend_from_slice(&sample.to_le_bytes());
        }
        std::fs::write(path, bytes).unwrap();
    }

    #[test]
    fn decodes_and_seeks_wav() {
        let dir = TestDir::new();
        let path = dir.0.join("tone.wav");
        write_wav(&path);
        let mut source = SymphoniaSource::open(&path).unwrap();
        assert_eq!(source.channels().get(), 1);
        assert_eq!(source.sample_rate().get(), 44_100);
        assert_eq!(source.total_duration().unwrap().as_secs(), 1);
        assert!(source.by_ref().take(1_000).any(|sample| sample.abs() > 0.1));
        source.try_seek(Duration::from_millis(500)).unwrap();
        assert!(source.take(22_050).any(|sample| sample.abs() > 0.1));
    }

    #[test]
    fn scans_persists_and_prunes_library() {
        let dir = TestDir::new();
        let music = dir.0.join("music");
        std::fs::create_dir(&music).unwrap();
        let path = music.join("tone.wav");
        write_wav(&path);
        let db = dir.0.join("data/library.sqlite3");
        let library = Library::open(db.clone()).unwrap();
        let tracks = library.scan_folder(&music).unwrap();
        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].title, "tone");
        assert_eq!(tracks[0].duration_ms, 1_000);
        assert_eq!(library.folders().unwrap().len(), 1);
        let id = library.create_playlist("Favorites").unwrap();
        library.add_to_playlist(id, tracks[0].id).unwrap();
        drop(library);
        let reopened = Library::open(db).unwrap();
        assert_eq!(reopened.playlists().unwrap()[0].tracks[0].id, tracks[0].id);
        std::fs::remove_file(path).unwrap();
        assert!(reopened.scan_folder(&music).unwrap().is_empty());
        assert!(reopened.playlists().unwrap()[0].tracks.is_empty());
    }

    #[test]
    #[ignore = "requires a default audio output device"]
    fn streams_decoded_audio_to_output() {
        let dir = TestDir::new();
        let path = dir.0.join("tone.wav");
        write_wav(&path);
        let source = SymphoniaSource::open(&path).unwrap();
        let output = rodio::DeviceSinkBuilder::open_default_sink().unwrap();
        let player = rodio::Player::connect_new(output.mixer());
        player.append(source);
        player.play();
        std::thread::sleep(Duration::from_millis(250));
        assert!(player.get_pos() > Duration::from_millis(50));
    }
}
