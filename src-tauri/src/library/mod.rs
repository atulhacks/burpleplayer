use std::path::{Path, PathBuf};

use lofty::file::{AudioFile, TaggedFileExt};
use lofty::tag::Accessor;
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use walkdir::WalkDir;

use crate::models::{AlbumArt, Playlist, Track};

pub fn migrate_legacy_library(data_dir: &Path) -> Result<(), String> {
    let destination = data_dir.join("library.sqlite3");
    if destination.exists() {
        return Ok(());
    }
    let Some(parent) = data_dir.parent() else {
        return Ok(());
    };
    let previous = parent.join("com.burpleplayer.app/library.sqlite3");
    if !previous.is_file() {
        return Ok(());
    }

    std::fs::create_dir_all(data_dir).map_err(|error| error.to_string())?;
    let temporary = data_dir.join(format!("library.sqlite3.migrating-{}", std::process::id()));
    if temporary.exists() {
        return Err(format!(
            "Previous library migration file already exists: {}",
            temporary.display()
        ));
    }
    let temporary_string = temporary
        .to_str()
        .ok_or_else(|| "Library data path is not valid UTF-8".to_owned())?;
    let source = Connection::open_with_flags(&previous, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| error.to_string())?;
    source
        .execute("VACUUM INTO ?1", [temporary_string])
        .map_err(|error| error.to_string())?;
    std::fs::rename(&temporary, &destination).map_err(|error| error.to_string())?;
    Ok(())
}

#[derive(Clone)]
pub struct Library {
    path: PathBuf,
}

impl Library {
    pub fn open(path: PathBuf) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let library = Self { path };
        let connection = library.connection()?;
        connection
            .execute_batch(
                "PRAGMA journal_mode=WAL;
                 PRAGMA foreign_keys=ON;
                 CREATE TABLE IF NOT EXISTS folders (
                   id INTEGER PRIMARY KEY,
                   path TEXT NOT NULL UNIQUE,
                   generation INTEGER NOT NULL DEFAULT 0
                 );
                 CREATE TABLE IF NOT EXISTS tracks (
                   id INTEGER PRIMARY KEY,
                   folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
                   path TEXT NOT NULL UNIQUE,
                   title TEXT NOT NULL,
                   artist TEXT NOT NULL,
                   album TEXT NOT NULL,
                   duration_ms INTEGER NOT NULL,
                   art_mime TEXT,
                   art BLOB,
                   generation INTEGER NOT NULL
                 );
                 CREATE INDEX IF NOT EXISTS tracks_artist_album ON tracks(artist, album);
                 CREATE TABLE IF NOT EXISTS playlists (
                   id INTEGER PRIMARY KEY,
                   name TEXT NOT NULL UNIQUE
                 );
                 CREATE TABLE IF NOT EXISTS playlist_tracks (
                   playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
                   track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                   position INTEGER NOT NULL,
                   PRIMARY KEY (playlist_id, track_id)
                 );",
            )
            .map_err(|error| error.to_string())?;
        Ok(library)
    }

    fn connection(&self) -> Result<Connection, String> {
        let connection = Connection::open(&self.path).map_err(|error| error.to_string())?;
        connection
            .execute_batch("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;")
            .map_err(|error| error.to_string())?;
        Ok(connection)
    }

    pub fn tracks(&self) -> Result<Vec<Track>, String> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare("SELECT id, path, title, artist, album, duration_ms, art IS NOT NULL FROM tracks ORDER BY artist COLLATE NOCASE, album COLLATE NOCASE, title COLLATE NOCASE")
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], row_to_track)
            .map_err(|error| error.to_string())?;
        rows.map(|row| row.map_err(|error| error.to_string()))
            .collect()
    }

    pub fn track(&self, id: i64) -> Result<Track, String> {
        self.connection()?
            .query_row("SELECT id, path, title, artist, album, duration_ms, art IS NOT NULL FROM tracks WHERE id=?1", [id], row_to_track)
            .map_err(|error| error.to_string())
    }

    pub fn folders(&self) -> Result<Vec<String>, String> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare("SELECT path FROM folders ORDER BY path COLLATE NOCASE")
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| row.get(0))
            .map_err(|error| error.to_string())?;
        rows.map(|row| row.map_err(|error| error.to_string()))
            .collect()
    }

    pub fn scan_folder(&self, folder: &Path) -> Result<Vec<Track>, String> {
        let folder = folder.canonicalize().map_err(|error| error.to_string())?;
        if !folder.is_dir() {
            return Err("Selected path is not a directory".into());
        }
        let folder_string = folder.to_string_lossy().into_owned();
        let mut connection = self.connection()?;
        let transaction = connection
            .transaction()
            .map_err(|error| error.to_string())?;
        transaction
            .execute(
                "INSERT OR IGNORE INTO folders(path) VALUES (?1)",
                [&folder_string],
            )
            .map_err(|error| error.to_string())?;
        let (folder_id, generation): (i64, i64) = transaction
            .query_row(
                "SELECT id, generation + 1 FROM folders WHERE path=?1",
                [&folder_string],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|error| error.to_string())?;
        transaction
            .execute(
                "UPDATE folders SET generation=?1 WHERE id=?2",
                params![generation, folder_id],
            )
            .map_err(|error| error.to_string())?;

        for entry in WalkDir::new(&folder)
            .follow_links(false)
            .into_iter()
            .filter_map(Result::ok)
        {
            let path = entry.path();
            if !entry.file_type().is_file() || !is_audio(path) {
                continue;
            }
            let Ok(file) = lofty::read_from_path(path) else {
                continue;
            };
            let tag = file.primary_tag().or_else(|| file.first_tag());
            let title = tag
                .and_then(|tag| tag.title())
                .map(|value| value.into_owned())
                .unwrap_or_else(|| {
                    path.file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .into_owned()
                });
            let artist = tag
                .and_then(|tag| tag.artist())
                .map(|value| value.into_owned())
                .unwrap_or_else(|| "Unknown Artist".into());
            let album = tag
                .and_then(|tag| tag.album())
                .map(|value| value.into_owned())
                .unwrap_or_else(|| "Unknown Album".into());
            let duration_ms = file
                .properties()
                .duration()
                .as_millis()
                .min(i64::MAX as u128) as i64;
            let picture = tag.and_then(|tag| tag.pictures().first());
            let art_mime = picture
                .and_then(|picture| picture.mime_type())
                .map(ToString::to_string);
            let art = picture.map(|picture| picture.data());
            transaction.execute(
                "INSERT INTO tracks(folder_id,path,title,artist,album,duration_ms,art_mime,art,generation)
                 VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)
                 ON CONFLICT(path) DO UPDATE SET folder_id=excluded.folder_id,title=excluded.title,
                 artist=excluded.artist,album=excluded.album,duration_ms=excluded.duration_ms,
                 art_mime=excluded.art_mime,art=excluded.art,generation=excluded.generation",
                params![folder_id, path.to_string_lossy().as_ref(), title, artist, album, duration_ms, art_mime, art, generation],
            ).map_err(|error| error.to_string())?;
        }
        transaction
            .execute(
                "DELETE FROM tracks WHERE folder_id=?1 AND generation<>?2",
                params![folder_id, generation],
            )
            .map_err(|error| error.to_string())?;
        transaction.commit().map_err(|error| error.to_string())?;
        self.tracks()
    }

    pub fn remove_folder(&self, folder: &str) -> Result<Vec<Track>, String> {
        self.connection()?
            .execute("DELETE FROM folders WHERE path=?1", [folder])
            .map_err(|error| error.to_string())?;
        self.tracks()
    }

    pub fn album_art(&self, track_id: i64) -> Result<Option<AlbumArt>, String> {
        self.connection()?
            .query_row(
                "SELECT art_mime, art FROM tracks WHERE id=?1 AND art IS NOT NULL",
                [track_id],
                |row| {
                    Ok(AlbumArt {
                        mime_type: row
                            .get::<_, Option<String>>(0)?
                            .unwrap_or_else(|| "image/jpeg".into()),
                        bytes: row.get(1)?,
                    })
                },
            )
            .optional()
            .map_err(|error| error.to_string())
    }

    pub fn create_playlist(&self, name: &str) -> Result<i64, String> {
        let connection = self.connection()?;
        connection
            .execute("INSERT INTO playlists(name) VALUES (?1)", [name])
            .map_err(|error| error.to_string())?;
        Ok(connection.last_insert_rowid())
    }

    pub fn delete_playlist(&self, id: i64) -> Result<(), String> {
        self.connection()?
            .execute("DELETE FROM playlists WHERE id=?1", [id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn add_to_playlist(&self, playlist_id: i64, track_id: i64) -> Result<(), String> {
        self.connection()?.execute(
            "INSERT OR REPLACE INTO playlist_tracks(playlist_id,track_id,position) VALUES(?1,?2,
             COALESCE((SELECT MAX(position)+1 FROM playlist_tracks WHERE playlist_id=?1),0))",
            params![playlist_id, track_id],
        ).map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn remove_from_playlist(&self, playlist_id: i64, track_id: i64) -> Result<(), String> {
        self.connection()?
            .execute(
                "DELETE FROM playlist_tracks WHERE playlist_id=?1 AND track_id=?2",
                params![playlist_id, track_id],
            )
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn playlists(&self) -> Result<Vec<Playlist>, String> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare("SELECT id,name FROM playlists ORDER BY name COLLATE NOCASE")
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|error| error.to_string())?;
        let mut playlists = Vec::new();
        for row in rows {
            let (id, name) = row.map_err(|error| error.to_string())?;
            let mut tracks_statement = connection
                .prepare(
                    "SELECT t.id,t.path,t.title,t.artist,t.album,t.duration_ms,t.art IS NOT NULL
                 FROM playlist_tracks pt JOIN tracks t ON t.id=pt.track_id
                 WHERE pt.playlist_id=?1 ORDER BY pt.position",
                )
                .map_err(|error| error.to_string())?;
            let tracks = tracks_statement
                .query_map([id], row_to_track)
                .map_err(|error| error.to_string())?
                .map(|track| track.map_err(|error| error.to_string()))
                .collect::<Result<Vec<_>, _>>()?;
            playlists.push(Playlist { id, name, tracks });
        }
        Ok(playlists)
    }
}

fn row_to_track(row: &rusqlite::Row<'_>) -> rusqlite::Result<Track> {
    Ok(Track {
        id: row.get(0)?,
        path: row.get(1)?,
        title: row.get(2)?,
        artist: row.get(3)?,
        album: row.get(4)?,
        duration_ms: row.get::<_, i64>(5)?.max(0) as u64,
        has_art: row.get(6)?,
    })
}

fn is_audio(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "mp3" | "flac" | "wav" | "ogg" | "oga" | "aac" | "m4a" | "mp4"
            )
        })
}
