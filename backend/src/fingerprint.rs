use rustfft::{FftPlanner, num_complex::Complex};
use hound::{WavReader, WavWriter, SampleFormat, WavSpec};
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
            if mag > prev && mag > next && mag > 50.0 {
                let freq = i * sample_rate / fft_size;
                let time = offset * 1000 / sample_rate;
                peaks.push((time * 1000 + freq, mag));
            }
        }
        offset += hop_size;
    }
    peaks
}

pub fn extract_robust_fingerprints(samples: &[f32], sample_rate: usize) -> Vec<u64> {
    let fft_size = 2048;
    let hop_size = 512;
    let mut planner = FftPlanner::new();
    let fft = planner.plan_fft_forward(fft_size);
    let mut fingerprints = Vec::new();

    let freq_bands = [0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 440, 480, 512];
    
    let mut offset = 0;
    let mut frame_count = 0;
    while offset + fft_size <= samples.len() {
        let mut buffer: Vec<Complex<f32>> = samples[offset..offset + fft_size]
            .iter().map(|&s| Complex::new(s, 0.0)).collect();
        fft.process(&mut buffer);

        if frame_count % 4 == 0 {
            let mut band_energies = [0.0f32; 13];
            for band_idx in 0..13 {
                let start = freq_bands[band_idx];
                let end = freq_bands[band_idx + 1];
                let mut sum = 0.0;
                for i in start..end {
                    sum += buffer[i].norm();
                }
                band_energies[band_idx] = sum;
            }

            let mut bits = 0u64;
            for i in 0..12 {
                if band_energies[i] > band_energies[i + 1] {
                    bits |= 1 << i;
                }
            }
            fingerprints.push(bits);
        }

        offset += hop_size;
        frame_count += 1;
    }
    fingerprints
}

pub fn generate_hash(peaks: &[(usize, f32)]) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    for (k, v) in peaks.iter().take(200) {
        k.hash(&mut hasher);
        (*v as u32).hash(&mut hasher);
    }
    format!("{:016x}", hasher.finish())
}

pub fn hash_string_to_u64(hash: &str) -> u64 {
    u64::from_str_radix(hash, 16).unwrap_or(0)
}

pub fn hamming_distance(a: u64, b: u64) -> u32 {
    (a ^ b).count_ones()
}

pub fn calculate_hash_similarity(hash1: &str, hash2: &str) -> f32 {
    let a = hash_string_to_u64(hash1);
    let b = hash_string_to_u64(hash2);
    let dist = hamming_distance(a, b);
    1.0 - (dist as f32 / 64.0)
}

pub fn calculate_robust_similarity(fp1: &[u64], fp2: &[u64]) -> f32 {
    if fp1.is_empty() || fp2.is_empty() {
        return 0.0;
    }

    let mut matches = 0;
    let window_size = 5;

    for i in 0..fp1.len().saturating_sub(window_size) {
        let slice1: std::collections::HashSet<_> = fp1[i..i + window_size].iter().collect();
        for j in 0..fp2.len().saturating_sub(window_size) {
            let slice2: std::collections::HashSet<_> = fp2[j..j + window_size].iter().collect();
            let common = slice1.intersection(&slice2).count();
            if common >= 3 {
                matches += 1;
                break;
            }
        }
    }

    let total_windows = fp1.len().saturating_sub(window_size).max(1);
    matches as f32 / total_windows as f32
}

pub fn calculate_similarity(peaks1: &[(usize, f32)], peaks2: &[(usize, f32)]) -> f32 {
    if peaks1.is_empty() || peaks2.is_empty() {
        return 0.0;
    }

    let freqs1: std::collections::HashSet<_> = peaks1.iter().map(|(k, _)| k % 1000).collect();
    let freqs2: std::collections::HashSet<_> = peaks2.iter().map(|(k, _)| k % 1000).collect();

    let intersection = freqs1.intersection(&freqs2).count();
    let union = freqs1.union(&freqs2).count();

    if union == 0 {
        0.0
    } else {
        intersection as f32 / union as f32
    }
}

pub fn process_audio_and_generate_fingerprint(bytes: &[u8]) -> Result<(String, f64, Vec<(usize, f32)>, Vec<u64>), AudioError> {
    let audio_data = read_wav_from_bytes(bytes)?;
    let peaks = extract_peaks(&audio_data.samples, audio_data.sample_rate as usize);
    let robust_fps = extract_robust_fingerprints(&audio_data.samples, audio_data.sample_rate as usize);
    let hash = generate_hash(&peaks);
    Ok((hash, audio_data.duration_sec, peaks, robust_fps))
}

pub fn extract_preview_sample(bytes: &[u8], max_duration_sec: f64) -> Result<Vec<u8>, AudioError> {
    let audio_data = read_wav_from_bytes(bytes)?;
    let sample_rate = audio_data.sample_rate;
    let samples = &audio_data.samples;
    
    let preview_duration = max_duration_sec.min(audio_data.duration_sec);
    let preview_samples_len = (preview_duration * sample_rate as f64) as usize;
    
    let start_idx = if samples.len() > preview_samples_len {
        let mid = samples.len() / 2;
        mid.saturating_sub(preview_samples_len / 2)
    } else {
        0
    };
    
    let end_idx = (start_idx + preview_samples_len).min(samples.len());
    let preview_samples = &samples[start_idx..end_idx];
    
    let spec = WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: SampleFormat::Int,
    };
    
    let mut cursor = Cursor::new(Vec::new());
    {
        let mut writer = WavWriter::new(&mut cursor, spec)?;
        for &sample in preview_samples {
            let sample_i16 = (sample * i16::MAX as f32).clamp(-1.0, 1.0) as i16;
            writer.write_sample(sample_i16)?;
        }
        writer.finalize()?;
    }
    
    Ok(cursor.into_inner())
}
