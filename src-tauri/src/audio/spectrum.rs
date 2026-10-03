use std::sync::mpsc::SyncSender;
use std::sync::Arc;
use std::time::Duration;

use rodio::Source;
use rustfft::num_complex::Complex32;
use rustfft::{Fft, FftPlanner};

const FFT_SIZE: usize = 2048;

pub struct SpectrumTap<S> {
    source: S,
    sender: SyncSender<Vec<f32>>,
    mono: Vec<f32>,
    channel: usize,
    frame_sum: f32,
}

impl<S: Source> SpectrumTap<S> {
    pub fn new(source: S, sender: SyncSender<Vec<f32>>) -> Self {
        Self {
            source,
            sender,
            mono: Vec::with_capacity(FFT_SIZE),
            channel: 0,
            frame_sum: 0.0,
        }
    }
}

impl<S: Source> Iterator for SpectrumTap<S> {
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        let sample = self.source.next()?;
        self.frame_sum += sample;
        self.channel += 1;
        let channels = usize::from(self.source.channels().get());
        if self.channel >= channels {
            self.mono.push(self.frame_sum / channels as f32);
            self.frame_sum = 0.0;
            self.channel = 0;
            if self.mono.len() == FFT_SIZE {
                let chunk = std::mem::replace(&mut self.mono, Vec::with_capacity(FFT_SIZE));
                let _ = self.sender.try_send(chunk);
            }
        }
        Some(sample)
    }
}

impl<S: Source> Source for SpectrumTap<S> {
    fn current_span_len(&self) -> Option<usize> {
        self.source.current_span_len()
    }
    fn channels(&self) -> rodio::ChannelCount {
        self.source.channels()
    }
    fn sample_rate(&self) -> rodio::SampleRate {
        self.source.sample_rate()
    }
    fn total_duration(&self) -> Option<Duration> {
        self.source.total_duration()
    }
    fn try_seek(&mut self, position: Duration) -> Result<(), rodio::source::SeekError> {
        self.mono.clear();
        self.channel = 0;
        self.frame_sum = 0.0;
        self.source.try_seek(position)
    }
}

pub struct SpectrumAnalyzer {
    fft: Arc<dyn Fft<f32>>,
    buffer: Vec<Complex32>,
    bands: [f32; 16],
}

impl SpectrumAnalyzer {
    pub fn new() -> Self {
        let mut planner = FftPlanner::new();
        Self {
            fft: planner.plan_fft_forward(FFT_SIZE),
            buffer: vec![Complex32::new(0.0, 0.0); FFT_SIZE],
            bands: [0.0; 16],
        }
    }

    pub fn process(&mut self, samples: &[f32], sample_rate: u32) -> [u8; 16] {
        if samples.len() != FFT_SIZE || sample_rate == 0 {
            return self.quantized();
        }
        for (index, (slot, sample)) in self.buffer.iter_mut().zip(samples).enumerate() {
            let window = 0.5 - 0.5 * (std::f32::consts::TAU * index as f32 / FFT_SIZE as f32).cos();
            *slot = Complex32::new(sample * window, 0.0);
        }
        self.fft.process(&mut self.buffer);
        for band in 0..16 {
            let low = 45.0_f32 * (15_000.0_f32 / 45.0).powf(band as f32 / 16.0);
            let high = 45.0_f32 * (15_000.0_f32 / 45.0).powf((band + 1) as f32 / 16.0);
            let start =
                ((low * FFT_SIZE as f32 / sample_rate as f32) as usize).clamp(1, FFT_SIZE / 2 - 1);
            let end = ((high * FFT_SIZE as f32 / sample_rate as f32) as usize)
                .clamp(start + 1, FFT_SIZE / 2);
            let energy = self.buffer[start..end]
                .iter()
                .map(|sample| sample.norm_sqr())
                .sum::<f32>()
                / (end - start) as f32;
            let target = ((energy.sqrt() / FFT_SIZE as f32) * 14.0).clamp(0.0, 1.0);
            self.bands[band] = self.bands[band] * 0.42 + target * 0.58;
        }
        self.quantized()
    }

    pub fn fade(&mut self) -> [u8; 16] {
        for band in &mut self.bands {
            *band *= 0.78;
        }
        self.quantized()
    }

    fn quantized(&self) -> [u8; 16] {
        self.bands.map(|value| (value * 255.0).round() as u8)
    }
}

#[cfg(test)]
mod tests {
    use super::{SpectrumAnalyzer, FFT_SIZE};

    #[test]
    fn sine_energy_lands_in_expected_band_and_fades() {
        let mut analyzer = SpectrumAnalyzer::new();
        let samples = (0..FFT_SIZE)
            .map(|index| (std::f32::consts::TAU * 440.0 * index as f32 / 44_100.0).sin() * 0.5)
            .collect::<Vec<_>>();
        let bands = analyzer.process(&samples, 44_100);
        let peak = bands
            .iter()
            .enumerate()
            .max_by_key(|(_, value)| *value)
            .unwrap()
            .0;
        assert!((5..=8).contains(&peak), "unexpected FFT band: {peak}");
        let first = bands[peak];
        for _ in 0..15 {
            analyzer.fade();
        }
        assert!(analyzer.fade()[peak] < first / 4);
    }
}
