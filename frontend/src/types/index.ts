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

export interface BatchUploadProgress {
  file_index: number;
  file_name: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  song: UploadSongResponse | null;
  error: string | null;
}

export interface BatchUploadResult {
  total: number;
  success: number;
  failed: number;
  results: BatchUploadProgress[];
}
