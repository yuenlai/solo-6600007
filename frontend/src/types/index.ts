export type SongStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type AudioSource = 'microphone' | 'file' | 'batch_import' | 'review' | 'promoted';

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
  source?: AudioSource | null;
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
  source?: AudioSource | null;
}

export interface SourceStats {
  source: AudioSource | null;
  count: number;
}

export interface SourceStatsResponse {
  total: number;
  stats: SourceStats[];
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

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  song_count: number;
}

export interface PlaylistSongDetail {
  song_id: string;
  title: string;
  artist: string | null;
  duration_sec: number | null;
  added_at: string;
}

export interface PlaylistsResponse {
  total: number;
  playlists: Playlist[];
}

export interface PlaylistSongsResponse {
  total: number;
  songs: PlaylistSongDetail[];
}

export interface CreatePlaylistRequest {
  name: string;
  description?: string | null;
}

export interface UpdatePlaylistRequest {
  name: string;
  description?: string | null;
}

export interface AddSongToPlaylistRequest {
  song_id: string;
}

export interface SongPlaylistsResponse {
  total: number;
  playlist_ids: string[];
}

export type OfflineDraftStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OfflineRecognitionDraft {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  audio_data: string;
  created_at: string;
  status: OfflineDraftStatus;
  retry_count: number;
  last_error?: string | null;
  result?: RecognizeResult | null;
  synced_at?: string | null;
}

export interface OfflineDraftsResponse {
  total: number;
  drafts: OfflineRecognitionDraft[];
}

export type ReviewStatus = 'pending' | 'reviewing' | 'completed' | 'rejected';

export interface ReviewTask {
  id: string;
  history_id: string;
  song_id: string | null;
  song_title: string | null;
  song_artist: string | null;
  original_confidence: number;
  review_status: ReviewStatus;
  review_count: number;
  last_review_result: string | null;
  last_review_confidence: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewTasksResponse {
  total: number;
  tasks: ReviewTask[];
}

export interface CreateReviewTaskRequest {
  history_id: string;
  note?: string | null;
}

export interface LowConfidenceHistoryResponse {
  total: number;
  items: RecognitionHistoryItem[];
}

export interface ArtistSummary {
  artist: string;
  song_count: number;
  total_recognitions: number;
  last_recognition_at: string | null;
}

export interface ArtistDetail {
  artist: string;
  song_count: number;
  total_recognitions: number;
  first_seen_at: string | null;
  last_recognition_at: string | null;
}

export interface ArtistSong {
  song_id: string;
  title: string;
  recognition_count: number;
  created_at: string;
  duration_sec: number | null;
}

export interface ArtistRecentActivity {
  id: string;
  song_id: string;
  song_title: string;
  confidence: number;
  created_at: string;
}

export interface ArtistsResponse {
  total: number;
  artists: ArtistSummary[];
}

export interface ArtistSongsResponse {
  total: number;
  songs: ArtistSong[];
}

export interface ArtistActivityResponse {
  total: number;
  activities: ArtistRecentActivity[];
}

export interface SearchSongsResponse {
  total: number;
  songs: Song[];
}
