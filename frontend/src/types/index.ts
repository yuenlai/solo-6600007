export type SongStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Song {
  id: string;
  title: string;
  artist: string | null;
  fingerprint_hash: string;
  fingerprint_peaks?: string | null;
  fingerprint_robust?: string | null;
  duration_sec: number | null;
  created_at?: string;
  status?: SongStatus;
}

export interface SimilarSong {
  id: string;
  title: string;
  artist: string | null;
  duration_sec: number | null;
  similarity_score: number;
  reason: string;
}

export interface RecognizeResult {
  match_found: boolean;
  song: { id: string; title: string; artist: string | null; duration_sec: number | null } | null;
  confidence: number;
  processing_time_ms: number;
  similar_songs: SimilarSong[];
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

export interface DeleteSongResponse {
  status: string;
  message: string;
}

export interface FailedSample {
  id: string;
  fingerprint_hash: string;
  fingerprint_peaks?: string | null;
  fingerprint_robust?: string | null;
  duration_sec: number | null;
  best_confidence: number;
  note?: string | null;
  created_at: string;
}

export interface FailedSamplesResponse {
  total: number;
  samples: FailedSample[];
}

export interface PromoteSampleRequest {
  title: string;
  artist?: string | null;
}

export interface PromoteSampleResponse {
  status: string;
  song_id: string;
  message: string;
}

export interface SimilarSongsResponse {
  total: number;
  songs: SimilarSong[];
}

export type CompareSlot = 'A' | 'B';

export interface CompareItem {
  slot: CompareSlot;
  file: File | null;
  fileName: string | null;
  isRecording: boolean;
  isRecognizing: boolean;
  result: RecognizeResult | null;
  error: string | null;
}

export interface CompareResult {
  isSameSong: boolean;
  confidenceDiff: number;
  sameTitle: boolean;
  sameArtist: boolean;
  summary: string;
}

export type CalibrationStatus = 'idle' | 'calibrating' | 'success' | 'failed';

export type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'no_signal';

export interface CalibrationResult {
  status: CalibrationStatus;
  qualityLevel: QualityLevel;
  averageVolume: number;
  peakVolume: number;
  noiseLevel: number;
  signalToNoiseRatio: number;
  clippedSamples: number;
  suggestions: string[];
  durationMs: number;
}
