use std::fs::File;
use std::num::{NonZeroU16, NonZeroU32};
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use rodio::source::SeekError;
use rodio::Source;
use symphonia::core::codecs::audio::{AudioDecoder, AudioDecoderOptions};
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::{FormatOptions, FormatReader, SeekMode, SeekTo, TrackType};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::units::{Time, TimeBase};

pub struct SymphoniaSource {
    format: Box<dyn FormatReader>,
    decoder: Box<dyn AudioDecoder>,
    track_id: u32,
    time_base: Option<TimeBase>,
    channels: NonZeroU16,
    sample_rate: NonZeroU32,
    duration: Option<Duration>,
    samples: Vec<f32>,
    offset: usize,
    exhausted: bool,
    seek_target: Option<Duration>,
}

impl SymphoniaSource {
    pub fn open(path: &Path) -> Result<Self, String> {
        let file = File::open(path).map_err(|error| error.to_string())?;
        let stream = MediaSourceStream::new(Box::new(file), Default::default());
        let mut hint = Hint::new();
        if let Some(extension) = path.extension().and_then(|extension| extension.to_str()) {
            hint.with_extension(extension);
        }
        let format = symphonia::default::get_probe()
            .probe(
                &hint,
                stream,
                FormatOptions::default(),
                MetadataOptions::default(),
            )
            .map_err(|error| error.to_string())?;
        let (decoder, track_id, time_base, duration, channels, sample_rate) = {
            let track = format
                .default_track(TrackType::Audio)
                .ok_or("No audio track found")?;
            let codec = track
                .codec_params
                .as_ref()
                .and_then(|params| params.audio())
                .ok_or("No audio codec parameters")?;
            let decoder = symphonia::default::get_codecs()
                .make_audio_decoder(codec, &AudioDecoderOptions::default())
                .map_err(|error| error.to_string())?;
            let duration = track
                .duration
                .and_then(|ticks| track.time_base?.calc_duration(ticks))
                .and_then(time_to_duration);
            (
                decoder,
                track.id,
                track.time_base,
                duration,
                codec
                    .channels
                    .as_ref()
                    .map_or(0, |channels| channels.count()),
                codec.sample_rate.unwrap_or(0),
            )
        };
        let mut source = Self {
            format,
            decoder,
            track_id,
            time_base,
            channels: NonZeroU16::new(channels as u16).unwrap_or(NonZeroU16::MIN),
            sample_rate: NonZeroU32::new(sample_rate).unwrap_or(NonZeroU32::MIN),
            duration,
            samples: Vec::new(),
            offset: 0,
            exhausted: false,
            seek_target: None,
        };
        source.fill_packet()?;
        if source.samples.is_empty() {
            return Err("Audio file contains no decodable samples".into());
        }
        Ok(source)
    }

    fn fill_packet(&mut self) -> Result<(), String> {
        self.samples.clear();
        self.offset = 0;
        let mut failures = 0;
        loop {
            let packet = match self.format.next_packet() {
                Ok(Some(packet)) => packet,
                Ok(None) => {
                    self.exhausted = true;
                    return Ok(());
                }
                Err(error) => return Err(error.to_string()),
            };
            if packet.track_id != self.track_id {
                continue;
            }
            let packet_time = self
                .time_base
                .and_then(|base| base.calc_time(packet.pts))
                .and_then(time_to_duration);
            let decoded = match self.decoder.decode(&packet) {
                Ok(decoded) => decoded,
                Err(SymphoniaError::DecodeError(_) | SymphoniaError::IoError(_))
                    if failures < 8 =>
                {
                    failures += 1;
                    continue;
                }
                Err(error) => return Err(error.to_string()),
            };
            self.channels = NonZeroU16::new(decoded.spec().channels().count() as u16)
                .ok_or("Zero-channel audio")?;
            self.sample_rate =
                NonZeroU32::new(decoded.spec().rate()).ok_or("Invalid audio sample rate")?;
            self.samples.resize(decoded.samples_interleaved(), 0.0);
            decoded.copy_to_slice_interleaved::<f32, _>(&mut self.samples);
            if let (Some(target), Some(start)) = (self.seek_target, packet_time) {
                let skip_frames = (target.saturating_sub(start).as_secs_f64()
                    * f64::from(self.sample_rate.get()))
                .floor() as usize;
                self.offset = skip_frames
                    .saturating_mul(usize::from(self.channels.get()))
                    .min(self.samples.len());
                if self.offset >= self.samples.len() {
                    continue;
                }
                self.seek_target = None;
            }
            if !self.samples.is_empty() {
                return Ok(());
            }
        }
    }
}

impl Iterator for SymphoniaSource {
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.offset >= self.samples.len() && (self.exhausted || self.fill_packet().is_err()) {
            self.exhausted = true;
            return None;
        }
        let sample = self.samples.get(self.offset).copied()?;
        self.offset += 1;
        Some(sample)
    }
}

impl Source for SymphoniaSource {
    fn current_span_len(&self) -> Option<usize> {
        if self.exhausted && self.offset >= self.samples.len() {
            Some(0)
        } else {
            None
        }
    }

    fn channels(&self) -> NonZeroU16 {
        self.channels
    }
    fn sample_rate(&self) -> NonZeroU32 {
        self.sample_rate
    }
    fn total_duration(&self) -> Option<Duration> {
        self.duration
    }

    fn try_seek(&mut self, position: Duration) -> Result<(), SeekError> {
        let time = Time::try_from_secs_f64(position.as_secs_f64())
            .ok_or_else(|| seek_error("Invalid seek position"))?;
        self.format
            .seek(
                SeekMode::Accurate,
                SeekTo::Time {
                    time,
                    track_id: Some(self.track_id),
                },
            )
            .map_err(|error| seek_error(error.to_string()))?;
        self.decoder.reset();
        self.samples.clear();
        self.offset = 0;
        self.exhausted = false;
        self.seek_target = Some(position);
        Ok(())
    }
}

fn seek_error(message: impl Into<String>) -> SeekError {
    SeekError::Other(Arc::new(std::io::Error::other(message.into())))
}

fn time_to_duration(time: Time) -> Option<Duration> {
    let (seconds, nanos) = time.parts();
    u64::try_from(seconds)
        .ok()
        .map(|seconds| Duration::new(seconds, nanos))
}
