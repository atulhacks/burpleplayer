pub(crate) mod decoder;
mod spectrum;

use std::sync::mpsc::{self, Receiver, Sender, SyncSender};
use std::thread;
use std::time::{Duration, Instant};

use rodio::{DeviceSinkBuilder, MixerDeviceSink, Player, Source};
use souvlaki::{
    MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, MediaPosition, PlatformConfig,
    SeekDirection,
};
use tauri::{AppHandle, Emitter};

use crate::models::{PlaybackState, PositionEvent, SpectrumEvent, Track};
use decoder::SymphoniaSource;
use spectrum::{SpectrumAnalyzer, SpectrumTap};

pub enum Action {
    Load(Vec<Track>, usize),
    Enqueue(Vec<Track>),
    Remove(usize),
    Move(usize, usize),
    Jump(usize),
    Play,
    Pause,
    Toggle,
    Seek(u64),
    SeekRelative(i64),
    Volume(f32),
    Next,
    Previous,
    Snapshot,
}

struct Message {
    action: Action,
    reply: Option<Sender<Result<PlaybackState, String>>>,
}

#[derive(Clone)]
pub struct EngineHandle {
    sender: Sender<Message>,
}

impl EngineHandle {
    pub fn start(app: AppHandle) -> Self {
        let (sender, receiver) = mpsc::channel();
        let handle = Self {
            sender: sender.clone(),
        };
        thread::Builder::new()
            .name("burple-audio".into())
            .spawn(move || Engine::new(app, sender).run(receiver))
            .expect("audio worker thread failed to start");
        handle
    }

    pub fn request(&self, action: Action) -> Result<PlaybackState, String> {
        let (reply_tx, reply_rx) = mpsc::channel();
        self.sender
            .send(Message {
                action,
                reply: Some(reply_tx),
            })
            .map_err(|error| error.to_string())?;
        reply_rx
            .recv_timeout(Duration::from_secs(8))
            .map_err(|error| error.to_string())?
    }
}

struct Engine {
    app: AppHandle,
    output: Option<MixerDeviceSink>,
    player: Option<Player>,
    media: Option<MediaControls>,
    queue: Vec<Track>,
    index: Option<usize>,
    playing: bool,
    volume: f32,
    sample_rate: u32,
    spectrum_tx: SyncSender<Vec<f32>>,
    spectrum_rx: Receiver<Vec<f32>>,
    analyzer: SpectrumAnalyzer,
}

impl Engine {
    fn new(app: AppHandle, sender: Sender<Message>) -> Self {
        let (spectrum_tx, spectrum_rx) = mpsc::sync_channel(3);
        let media = Self::init_media(sender.clone());
        Self {
            app,
            output: None,
            player: None,
            media,
            queue: Vec::new(),
            index: None,
            playing: false,
            volume: 0.8,
            sample_rate: 44_100,
            spectrum_tx,
            spectrum_rx,
            analyzer: SpectrumAnalyzer::new(),
        }
    }

    fn init_media(sender: Sender<Message>) -> Option<MediaControls> {
        let config = PlatformConfig {
            dbus_name: "com.burpleplayer.app",
            display_name: "BurplePlayer",
            hwnd: None,
        };
        let mut controls = MediaControls::new(config).ok()?;
        controls
            .attach(move |event| {
                let action = match event {
                    MediaControlEvent::Play => Action::Play,
                    MediaControlEvent::Pause => Action::Pause,
                    MediaControlEvent::Toggle => Action::Toggle,
                    MediaControlEvent::Next => Action::Next,
                    MediaControlEvent::Previous => Action::Previous,
                    MediaControlEvent::SetPosition(MediaPosition(position)) => {
                        Action::Seek(position.as_millis() as u64)
                    }
                    MediaControlEvent::SetVolume(volume) => Action::Volume(volume as f32),
                    MediaControlEvent::Stop => Action::Pause,
                    MediaControlEvent::SeekBy(direction, duration) => {
                        let delta = duration.as_millis() as u64;
                        match direction {
                            SeekDirection::Forward => Action::SeekRelative(delta as i64),
                            SeekDirection::Backward => Action::SeekRelative(-(delta as i64)),
                        }
                    }
                    MediaControlEvent::Seek(direction) => Action::SeekRelative(match direction {
                        SeekDirection::Forward => 10_000,
                        SeekDirection::Backward => -10_000,
                    }),
                    _ => return,
                };
                let _ = sender.send(Message {
                    action,
                    reply: None,
                });
            })
            .ok()?;
        Some(controls)
    }

    fn run(mut self, receiver: Receiver<Message>) {
        let mut last_position = Instant::now();
        let mut last_spectrum = Instant::now();
        loop {
            match receiver.recv_timeout(Duration::from_millis(8)) {
                Ok(message) => {
                    let result = self.apply(message.action).map(|()| self.snapshot());
                    if let Some(reply) = message.reply {
                        let _ = reply.send(result);
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
                Err(mpsc::RecvTimeoutError::Timeout) => {}
            }
            if self.playing && self.player.as_ref().is_some_and(Player::empty) {
                let _ = self.advance();
            }
            if last_position.elapsed() >= Duration::from_millis(250) {
                self.emit_position();
                last_position = Instant::now();
            }
            if last_spectrum.elapsed() >= Duration::from_millis(33) {
                self.emit_spectrum();
                last_spectrum = Instant::now();
            }
        }
    }

    fn apply(&mut self, action: Action) -> Result<(), String> {
        match action {
            Action::Load(queue, index) => {
                if queue.is_empty() {
                    return Err("Queue is empty".into());
                }
                if index >= queue.len() {
                    return Err("Queue index is out of range".into());
                }
                let previous = std::mem::replace(&mut self.queue, queue);
                if let Err(error) = self.start(index) {
                    self.queue = previous;
                    return Err(error);
                }
            }
            Action::Enqueue(tracks) => {
                self.queue.extend(tracks);
                if self.index.is_none() && !self.queue.is_empty() {
                    self.index = Some(0);
                }
                self.emit_track();
            }
            Action::Remove(index) => {
                if index >= self.queue.len() {
                    return Err("Queue index is out of range".into());
                }
                self.queue.remove(index);
                match self.index {
                    Some(current) if current == index => {
                        self.player = None;
                        self.playing = false;
                        self.index = if self.queue.is_empty() {
                            None
                        } else {
                            Some(index.min(self.queue.len() - 1))
                        };
                    }
                    Some(current) if current > index => self.index = Some(current - 1),
                    _ => {}
                }
                self.update_media();
                self.emit_track();
            }
            Action::Move(from, to) => {
                if from >= self.queue.len() || to >= self.queue.len() {
                    return Err("Queue index is out of range".into());
                }
                let track = self.queue.remove(from);
                self.queue.insert(to, track);
                if let Some(current) = self.index {
                    self.index = Some(if current == from {
                        to
                    } else if from < current && to >= current {
                        current - 1
                    } else if from > current && to <= current {
                        current + 1
                    } else {
                        current
                    });
                }
                self.emit_track();
            }
            Action::Jump(index) => self.start(index)?,
            Action::Play => {
                if self.player.is_none() {
                    self.start(self.index.unwrap_or(0))?;
                } else if let Some(player) = &self.player {
                    player.play();
                    self.playing = true;
                }
                self.update_media();
                self.emit_track();
            }
            Action::Pause => {
                if let Some(player) = &self.player {
                    player.pause();
                }
                self.playing = false;
                self.update_media();
                self.emit_track();
            }
            Action::Toggle => {
                return self.apply(if self.playing {
                    Action::Pause
                } else {
                    Action::Play
                })
            }
            Action::Seek(position_ms) => {
                let track = self.current().ok_or("No track selected")?;
                let duration = track.duration_ms;
                let player = self.player.as_ref().ok_or("No active playback")?;
                let position = if duration == 0 {
                    position_ms
                } else {
                    position_ms.min(duration)
                };
                player
                    .try_seek(Duration::from_millis(position))
                    .map_err(|error| error.to_string())?;
                self.emit_position();
            }
            Action::SeekRelative(delta_ms) => {
                let position = self
                    .player
                    .as_ref()
                    .map_or(0, |player| player.get_pos().as_millis() as i64);
                return self.apply(Action::Seek(position.saturating_add(delta_ms).max(0) as u64));
            }
            Action::Volume(volume) => {
                if !volume.is_finite() {
                    return Err("Volume must be a finite number".into());
                }
                self.volume = volume.clamp(0.0, 1.0);
                if let Some(player) = &self.player {
                    player.set_volume(self.volume);
                }
                self.emit_track();
            }
            Action::Next => self.advance()?,
            Action::Previous => {
                if self
                    .player
                    .as_ref()
                    .is_some_and(|player| player.get_pos() > Duration::from_secs(3))
                {
                    if let Some(player) = &self.player {
                        player
                            .try_seek(Duration::ZERO)
                            .map_err(|error| error.to_string())?;
                    }
                } else if let Some(index) = self.index {
                    self.start(index.saturating_sub(1))?;
                }
            }
            Action::Snapshot => {}
        }
        Ok(())
    }

    fn current(&self) -> Option<&Track> {
        self.index.and_then(|index| self.queue.get(index))
    }

    fn start(&mut self, index: usize) -> Result<(), String> {
        let track = self.queue.get(index).ok_or("Queue index is out of range")?;
        let source = SymphoniaSource::open(std::path::Path::new(&track.path))?;
        self.sample_rate = source.sample_rate().get();
        if self.output.is_none() {
            self.output =
                Some(DeviceSinkBuilder::open_default_sink().map_err(|error| error.to_string())?);
        }
        self.player = None;
        let player =
            Player::connect_new(self.output.as_ref().expect("audio output opened").mixer());
        player.set_volume(self.volume);
        player.append(SpectrumTap::new(source, self.spectrum_tx.clone()));
        player.play();
        self.player = Some(player);
        self.index = Some(index);
        self.playing = true;
        self.update_media();
        self.emit_track();
        Ok(())
    }

    fn advance(&mut self) -> Result<(), String> {
        match self.index {
            Some(index) if index + 1 < self.queue.len() => self.start(index + 1),
            _ => {
                self.player = None;
                self.playing = false;
                self.update_media();
                self.emit_track();
                Ok(())
            }
        }
    }

    fn snapshot(&self) -> PlaybackState {
        PlaybackState {
            track: self.current().cloned(),
            queue: self.queue.clone(),
            queue_index: self.index,
            position_ms: self
                .player
                .as_ref()
                .map_or(0, |player| player.get_pos().as_millis() as u64),
            volume: self.volume,
            playing: self.playing,
        }
    }

    fn emit_track(&self) {
        let _ = self.app.emit("player:track", self.snapshot());
    }

    fn emit_position(&self) {
        let event = PositionEvent {
            position_ms: self
                .player
                .as_ref()
                .map_or(0, |player| player.get_pos().as_millis() as u64),
            duration_ms: self.current().map_or(0, |track| track.duration_ms),
            playing: self.playing,
        };
        let _ = self.app.emit("player:position", event);
    }

    fn emit_spectrum(&mut self) {
        let mut latest = None;
        while let Ok(chunk) = self.spectrum_rx.try_recv() {
            latest = Some(chunk);
        }
        let bands = if self.playing {
            if let Some(chunk) = latest {
                self.analyzer.process(&chunk, self.sample_rate)
            } else {
                self.analyzer.fade()
            }
        } else {
            self.analyzer.fade()
        };
        let _ = self.app.emit("player:spectrum", SpectrumEvent { bands });
    }

    fn update_media(&mut self) {
        let track = self.current().cloned();
        if let Some(media) = &mut self.media {
            if let Some(track) = track {
                let _ = media.set_metadata(MediaMetadata {
                    title: Some(&track.title),
                    artist: Some(&track.artist),
                    album: Some(&track.album),
                    cover_url: None,
                    duration: Some(Duration::from_millis(track.duration_ms)),
                });
            }
            let progress = self
                .player
                .as_ref()
                .map(|player| MediaPosition(player.get_pos()));
            let status = if self.playing {
                MediaPlayback::Playing { progress }
            } else if self.player.is_some() {
                MediaPlayback::Paused { progress }
            } else {
                MediaPlayback::Stopped
            };
            let _ = media.set_playback(status);
        }
    }
}
