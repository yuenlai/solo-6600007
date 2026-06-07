use rustfft::{FftPlanner, num_complex::Complex};
use hound::WavReader;
use std::io::Cursor;

#[derive(Debug)]
pub enum AudioError {
    HoundError(hound::Error),
    InvalidFormat(String),
}

impl From<hound::Error> for AudioError {
    fn from(err: hound::Error) -> Self {
        AudioError::HoundError(err)
    }
}

pub struct AudioData {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub duration_sec: f64,
}

pub fn read_wav_from_bytes(bytes: &[u8]) -> Result<AudioData, AudioError> {
    let cursor = Cursor::new(bytes);
    let mut reader = WavReader::new(cursor)?;
    let spec = reader.spec();

    if spec.channels != 1 && spec.channels != 2 {
        return Err(AudioError::InvalidFormat(
            format!("Unsupported channel count: {}", spec.channels)
        ));
    }

    let sample_rate = spec.sample_rate;
    let duration_sec = reader.duration() as f64 / sample_rate as f64;

    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => {
            reader.samples::<f32>()
                .step_by(spec.channels as usize)
                .map(|s| s.unwrap_or(0.0))
                .collect()
        }
        hound::SampleFormat::Int => {
            let bits = spec.bits_per_sample as i32;
            let max_val = (1i64 << (bits - 1)) - 1;
            reader.samples::<i32>()
                .step_by(spec.channels as usize)
                .map(|s| {
                    let sample = s.unwrap_or(0) as f64;
                    (sample / max_val as f64) as f32
                })
                .collect()
        }
    };

    Ok(AudioData { samples, sample_rate, duration_sec })
}

/// Extract spectral peaks from audio samples using FFT
pub fn extract_peaks(samples: &[f32], sample_rate: usize) -> Vec<(usize, f32)> {
    let fft_size = 2048;
    let hop_size = 512;
    let mut planner = FftPlanner::new();
    let fft = planner.plan_fft_forward(fft_size);
    let mut peaks = Vec::new();

    let mut offset = 0;
    while offset + fft_size <= samples.len() {
        let mut buffer: Vec<Complex<f32>> = samples[offset..offset + fft_size]
            .iter().map(|&s| Complex::new(s, 0.0)).collect();
        fft.process(&mut buffer);

        for i in 2..buffer.len() / 2 - 1 {
            let mag = buffer[i].norm();
            let prev = buffer[i - 1].norm();
            let next = buffer[i + 1].norm();
            if mag > prev && mag > next && mag > 100.0 {
                let freq = i * sample_rate / fft_size;
                let time = offset * 1000 / sample_rate;
                peaks.push((time * 1000 + freq, mag));
            }
        }
        offset += hop_size;
    }
    peaks
}

/// Generate a compact fingerprint hash from spectral peaks
pub fn generate_hash(peaks: &[(usize, f32)]) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    for (k, v) in peaks.iter().take(100) {
        k.hash(&mut hasher);
        (*v as u32).hash(&mut hasher);
    }
    format!("{:016x}", hasher.finish())
}

pub fn process_audio_and_generate_fingerprint(bytes: &[u8]) -> Result<(String, f64, Vec<(usize, f32)>), AudioError> {
    let audio_data = read_wav_from_bytes(bytes)?;
    let peaks = extract_peaks(&audio_data.samples, audio_data.sample_rate as usize);
    let hash = generate_hash(&peaks);
    Ok((hash, audio_data.duration_sec, peaks))
}

pub fn calculate_similarity(peaks1: &[(usize, f32)], peaks2: &[(usize, f32)]) -> f32 {
    if peaks1.is_empty() || peaks2.is_empty() {
        return 0.0;
    }

    let set1: std::collections::HashSet<_> = peaks1.iter().take(200).map(|(k, _)| k).collect();
    let set2: std::collections::HashSet<_> = peaks2.iter().take(200).map(|(k, _)| k).collect();

    let intersection = set1.intersection(&set2).count();
    let union = set1.union(&set2).count();

    if union == 0 {
        0.0
    } else {
        intersection as f32 / union as f32
    }
}
