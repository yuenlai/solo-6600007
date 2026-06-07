export interface Song {
  id: string;
  title: string;
  artist: string | null;
  fingerprint_hash: string;
  fingerprint_peaks?: string | null;
  fingerprint_robust?: string | null;
  duration_sec: number | null;
  created_at?: string;
}

export interface RecognizeResult {
  match_found: boolean;
  song: { id: string; title: string; artist: string | null; duration_sec: number | null } | null;
  confidence: number;
  processing_time_ms: number;
}

export interface SpectrogramData {
  frequencies: number[];
  magnitudes: number[][];
  sampleRate: number;
}

export interface UploadSongResponse {
  id: string;
  title: string;
  artist: string | null;
  fingerprint_hash: string;
  duration_sec: number | null;
  status: string;
  message: string;
}

export interface RecognitionHistoryItem {
  id: string;
  match_found: boolean;
  song_id: string | null;
  song_title: string | null;
  song_artist: string | null;
  confidence: number;
  processing_time_ms: number;
  created_at: string;
}
