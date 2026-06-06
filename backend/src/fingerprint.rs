use rustfft::{FftPlanner, num_complex::Complex};

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

        // Find spectral peaks in magnitude spectrum
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
