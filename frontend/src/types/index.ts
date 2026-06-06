export interface Song {
  id: string; title: string; artist: string;
  fingerprint_hash: string; duration_sec: number;
}

export interface RecognizeResult {
  match: boolean;
  song: { title: string; artist: string; confidence: number };
  processing_time_ms: number;
}

export interface SpectrogramData {
  frequencies: number[];
  magnitudes: number[][];
  sampleRate: number;
}
