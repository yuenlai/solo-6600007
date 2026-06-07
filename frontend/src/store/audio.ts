import { create } from 'zustand';
import axios from 'axios';
import { Song, RecognizeResult, UploadSongResponse, RecognitionHistoryItem, BatchUploadProgress, BatchUploadResult, DeleteSongResponse, FailedSample, FailedSamplesResponse, PromoteSampleRequest, PromoteSampleResponse, SimilarSong, SimilarSongsResponse, CalibrationResult, CalibrationStatus, QualityLevel, CompareItem, CompareSlot, CompareResult, Playlist, PlaylistsResponse, PlaylistSongsResponse, PlaylistSongDetail, CreatePlaylistRequest, UpdatePlaylistRequest, AddSongToPlaylistRequest, SongPlaylistsResponse, OfflineRecognitionDraft, OfflineDraftStatus, ReviewTask, ReviewTasksResponse, CreateReviewTaskRequest, LowConfidenceHistoryResponse } from '../types';

const API_BASE = 'http://127.0.0.1:8080/api';

const ONBOARDING_KEY = 'audioid_onboarding_completed';
const OFFLINE_DRAFTS_KEY = 'audioid_offline_drafts';

interface AudioState {
  songs: Song[];
  pendingSongs: Song[];
  recognizeResult: RecognizeResult | null;
  isOnboardingCompleted: boolean;
  isRecording: boolean;
  audioLevel: number;
  isUploading: boolean;
  isRecognizing: boolean;
  recognizeError: string | null;
  uploadError: string | null;
  uploadSuccess: UploadSongResponse | null;
  history: RecognitionHistoryItem[];
  isFetchingHistory: boolean;
  isFetchingPendingSongs: boolean;
  currentSongId: string | null;
  currentSong: Song | null;
  currentSongHistory: RecognitionHistoryItem[];
  isFetchingSongDetail: boolean;
  isFetchingSongHistory: boolean;
  isBatchUploading: boolean;
  batchUploadProgress: BatchUploadProgress[];
  batchUploadResult: BatchUploadResult | null;
  batchUploadError: string | null;
  isDeletingSong: boolean;
  deleteSongError: string | null;
  failedSamples: FailedSample[];
  isFetchingFailedSamples: boolean;
  isPromotingSample: boolean;
  isDeletingFailedSample: boolean;
  failedSamplesError: string | null;
  promoteSampleError: string | null;
  similarSongs: SimilarSong[];
  isFetchingSimilarSongs: boolean;
  calibrationStatus: CalibrationStatus;
  calibrationResult: CalibrationResult | null;
  calibrationRealTimeVolume: number;
  calibrationWaveform: number[];
  fetchSongs: () => Promise<void>;
  fetchPendingSongs: () => Promise<void>;
  uploadSong: (title: string, artist: string, file: File) => Promise<boolean>;
  batchUploadSongs: (files: File[], defaultArtist?: string) => Promise<boolean>;
  recognizeFile: (file: File) => Promise<boolean>;
  fetchHistory: () => Promise<void>;
  fetchSongDetail: (songId: string) => Promise<void>;
  fetchSongHistory: (songId: string) => Promise<void>;
  fetchSimilarSongs: (songId: string, limit?: number) => Promise<void>;
  deleteSong: (songId: string) => Promise<boolean>;
  setCurrentSongId: (id: string | null) => void;
  startCalibration: (durationMs?: number) => Promise<boolean>;
  stopCalibration: () => void;
  clearCalibration: () => void;
  setSongs: (songs: Song[]) => void;
  setRecognizeResult: (r: RecognizeResult | null) => void;
  setRecording: (v: boolean) => void;
  setAudioLevel: (v: number) => void;
  clearUploadStatus: () => void;
  clearRecognizeStatus: () => void;
  clearBatchUploadStatus: () => void;
  clearDeleteStatus: () => void;
  fetchFailedSamples: () => Promise<void>;
  deleteFailedSample: (sampleId: string) => Promise<boolean>;
  promoteFailedSample: (sampleId: string, title: string, artist?: string | null) => Promise<boolean>;
  compareItemA: CompareItem;
  compareItemB: CompareItem;
  compareResult: CompareResult | null;
  setCompareFile: (slot: CompareSlot, file: File | null) => void;
  setCompareRecording: (slot: CompareSlot, recording: boolean) => void;
  recognizeCompareSlot: (slot: CompareSlot) => Promise<boolean>;
  clearCompareSlot: (slot: CompareSlot) => void;
  clearCompareAll: () => void;
  calculateCompareResult: () => void;
  playlists: Playlist[];
  currentPlaylistId: string | null;
  currentPlaylist: Playlist | null;
  currentPlaylistSongs: PlaylistSongDetail[];
  isFetchingPlaylists: boolean;
  isFetchingPlaylistSongs: boolean;
  isCreatingPlaylist: boolean;
  isUpdatingPlaylist: boolean;
  isDeletingPlaylist: boolean;
  isAddingSongToPlaylist: boolean;
  isRemovingSongFromPlaylist: boolean;
  playlistError: string | null;
  fetchPlaylists: () => Promise<void>;
  createPlaylist: (name: string, description?: string | null) => Promise<boolean>;
  fetchPlaylistDetail: (playlistId: string) => Promise<void>;
  fetchPlaylistSongs: (playlistId: string) => Promise<void>;
  updatePlaylist: (playlistId: string, name: string, description?: string | null) => Promise<boolean>;
  deletePlaylist: (playlistId: string) => Promise<boolean>;
  addSongToPlaylist: (playlistId: string, songId: string) => Promise<boolean>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<boolean>;
  setCurrentPlaylistId: (id: string | null) => void;
  clearPlaylistError: () => void;
  checkOnboardingStatus: () => void;
  resetOnboarding: () => void;
  completeOnboarding: () => void;
  isOnline: boolean;
  offlineDrafts: OfflineRecognitionDraft[];
  isSyncingDrafts: boolean;
  syncError: string | null;
  setOnlineStatus: (online: boolean) => void;
  loadOfflineDrafts: () => void;
  saveOfflineDraft: (file: File) => Promise<string>;
  updateDraftStatus: (id: string, status: OfflineDraftStatus, error?: string | null, result?: RecognizeResult | null) => void;
  deleteOfflineDraft: (id: string) => void;
  clearSyncedDrafts: () => void;
  syncOfflineDrafts: () => Promise<{ success: number; failed: number }>;
  syncSingleDraft: (id: string) => Promise<boolean>;
  reviewTasks: ReviewTask[];
  isFetchingReviewTasks: boolean;
  isCreatingReviewTask: boolean;
  isReRecognizing: boolean;
  isDeletingReviewTask: boolean;
  reviewTasksError: string | null;
  lowConfidenceHistory: RecognitionHistoryItem[];
  isFetchingLowConfidence: boolean;
  fetchReviewTasks: (status?: string) => Promise<void>;
  createReviewTask: (historyId: string, note?: string | null) => Promise<boolean>;
  deleteReviewTask: (taskId: string) => Promise<boolean>;
  reRecognizeReviewTask: (taskId: string, file: File) => Promise<boolean>;
  updateReviewTaskStatus: (taskId: string, status: string) => Promise<boolean>;
  fetchLowConfidenceHistory: (threshold?: number) => Promise<void>;
}

export const useAudioStore = create<AudioState>((set) => ({
  songs: [],
  pendingSongs: [],
  recognizeResult: null,
  isOnboardingCompleted: false,
  isRecording: false,
  audioLevel: 0,
  isUploading: false,
  isRecognizing: false,
  recognizeError: null,
  uploadError: null,
  uploadSuccess: null,
  history: [],
  isFetchingHistory: false,
  isFetchingPendingSongs: false,
  currentSongId: null,
  currentSong: null,
  currentSongHistory: [],
  isFetchingSongDetail: false,
  isFetchingSongHistory: false,
  isBatchUploading: false,
  batchUploadProgress: [],
  batchUploadResult: null,
  batchUploadError: null,
  isDeletingSong: false,
  deleteSongError: null,
  failedSamples: [],
  isFetchingFailedSamples: false,
  isPromotingSample: false,
  isDeletingFailedSample: false,
  failedSamplesError: null,
  promoteSampleError: null,
  similarSongs: [],
  isFetchingSimilarSongs: false,
  calibrationStatus: 'idle',
  calibrationResult: null,
  calibrationRealTimeVolume: 0,
  calibrationWaveform: [],
  compareItemA: {
    slot: 'A',
    file: null,
    fileName: null,
    isRecording: false,
    isRecognizing: false,
    result: null,
    error: null,
  },
  compareItemB: {
    slot: 'B',
    file: null,
    fileName: null,
    isRecording: false,
    isRecognizing: false,
    result: null,
    error: null,
  },
  compareResult: null,
  playlists: [],
  currentPlaylistId: null,
  currentPlaylist: null,
  currentPlaylistSongs: [],
  isFetchingPlaylists: false,
  isFetchingPlaylistSongs: false,
  isCreatingPlaylist: false,
  isUpdatingPlaylist: false,
  isDeletingPlaylist: false,
  isAddingSongToPlaylist: false,
  isRemovingSongFromPlaylist: false,
  playlistError: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  offlineDrafts: [],
  isSyncingDrafts: false,
  syncError: null,

  setOnlineStatus: (online) => set({ isOnline: online }),

  loadOfflineDrafts: () => {
    try {
      const stored = localStorage.getItem(OFFLINE_DRAFTS_KEY);
      if (stored) {
        const drafts = JSON.parse(stored) as OfflineRecognitionDraft[];
        set({ offlineDrafts: drafts });
      }
    } catch (error) {
      console.error('Failed to load offline drafts:', error);
    }
  },

  saveOfflineDraft: async (file: File) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const audioData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const draft: OfflineRecognitionDraft = {
      id,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type || 'audio/wav',
      audio_data: audioData,
      created_at: new Date().toISOString(),
      status: 'pending',
      retry_count: 0,
      last_error: null,
      result: null,
      synced_at: null,
    };

    set((state) => {
      const newDrafts = [draft, ...state.offlineDrafts];
      localStorage.setItem(OFFLINE_DRAFTS_KEY, JSON.stringify(newDrafts));
      return { offlineDrafts: newDrafts };
    });

    return id;
  },

  updateDraftStatus: (id, status, error = null, result = null) => {
    set((state) => {
      const newDrafts = state.offlineDrafts.map((d) =>
        d.id === id
          ? {
              ...d,
              status,
              last_error: error,
              result: result || d.result,
              synced_at: status === 'synced' ? new Date().toISOString() : d.synced_at,
              retry_count: status === 'failed' ? d.retry_count + 1 : d.retry_count,
            }
          : d
      );
      localStorage.setItem(OFFLINE_DRAFTS_KEY, JSON.stringify(newDrafts));
      return { offlineDrafts: newDrafts };
    });
  },

  deleteOfflineDraft: (id) => {
    set((state) => {
      const newDrafts = state.offlineDrafts.filter((d) => d.id !== id);
      localStorage.setItem(OFFLINE_DRAFTS_KEY, JSON.stringify(newDrafts));
      return { offlineDrafts: newDrafts };
    });
  },

  clearSyncedDrafts: () => {
    set((state) => {
      const newDrafts = state.offlineDrafts.filter((d) => d.status !== 'synced');
      localStorage.setItem(OFFLINE_DRAFTS_KEY, JSON.stringify(newDrafts));
      return { offlineDrafts: newDrafts };
    });
  },

  syncSingleDraft: async (id) => {
    const state = useAudioStore.getState();
    const draft = state.offlineDrafts.find((d) => d.id === id);
    if (!draft) return false;

    state.updateDraftStatus(id, 'syncing');

    try {
      const response = await fetch(draft.audio_data);
      const blob = await response.blob();
      const file = new File([blob], draft.file_name, { type: draft.file_type });

      const formData = new FormData();
      formData.append('file', file);

      const result = await axios.post<RecognizeResult>(
        `${API_BASE}/recognize`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      state.updateDraftStatus(id, 'synced', null, result.data);
      state.fetchHistory();
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Sync failed';
      state.updateDraftStatus(id, 'failed', message);
      return false;
    }
  },

  syncOfflineDrafts: async () => {
    const state = useAudioStore.getState();
    const pendingDrafts = state.offlineDrafts.filter(
      (d) => d.status === 'pending' || d.status === 'failed'
    );

    if (pendingDrafts.length === 0) {
      return { success: 0, failed: 0 };
    }

    set({ isSyncingDrafts: true, syncError: null });

    let success = 0;
    let failed = 0;

    for (const draft of pendingDrafts) {
      const ok = await state.syncSingleDraft(draft.id);
      if (ok) success++;
      else failed++;
    }

    set({ isSyncingDrafts: false });
    return { success, failed };
  },

  fetchSongs: async () => {
    try {
      const response = await axios.get<Song[]>(`${API_BASE}/songs`);
      set({ songs: response.data });
    } catch (error) {
      console.error('Failed to fetch songs:', error);
    }
  },

  fetchPendingSongs: async () => {
    set({ isFetchingPendingSongs: true });
    try {
      const response = await axios.get<Song[]>(`${API_BASE}/songs/pending`);
      set({ pendingSongs: response.data, isFetchingPendingSongs: false });
    } catch (error) {
      console.error('Failed to fetch pending songs:', error);
      set({ isFetchingPendingSongs: false });
    }
  },

  uploadSong: async (title: string, artist: string, file: File) => {
    set({ isUploading: true, uploadError: null, uploadSuccess: null });
    try {
      const formData = new FormData();
      formData.append('title', title);
      if (artist) {
        formData.append('artist', artist);
      }
      formData.append('file', file);

      const response = await axios.post<UploadSongResponse>(
        `${API_BASE}/songs/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      set({ isUploading: false, uploadSuccess: response.data });
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Upload failed';
      set({ isUploading: false, uploadError: message });
      return false;
    }
  },

  batchUploadSongs: async (files: File[], defaultArtist?: string) => {
    const initialProgress: BatchUploadProgress[] = files.map((file, index) => ({
      file_index: index,
      file_name: file.name,
      status: 'pending',
      progress: 0,
      song: null,
      error: null,
    }));

    set({ isBatchUploading: true, batchUploadProgress: initialProgress, batchUploadResult: null, batchUploadError: null });

    try {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`file_${index}`, file);
        const title = file.name.replace(/\.[^/.]+$/, '');
        formData.append(`title_${index}`, title);
        if (defaultArtist) {
          formData.append(`artist_${index}`, defaultArtist);
        }
      });

      set((state) => ({
        batchUploadProgress: state.batchUploadProgress.map((p) => ({
          ...p,
          status: 'uploading',
          progress: 10,
        })),
      }));

      const response = await axios.post<BatchUploadResult>(
        `${API_BASE}/songs/batch-upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      set({
        isBatchUploading: false,
        batchUploadProgress: response.data.results.map((r) => ({
          ...r,
          status: r.status as any,
        })),
        batchUploadResult: response.data,
      });

      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Batch upload failed';
      set({ isBatchUploading: false, batchUploadError: message });
      return false;
    }
  },

  recognizeFile: async (file: File) => {
    set({ isRecognizing: true, recognizeError: null, recognizeResult: null });
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post<RecognizeResult>(
        `${API_BASE}/recognize`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      set({ isRecognizing: false, recognizeResult: response.data });
      return true;
    } catch (error: any) {
      const isNetworkError = !error.response || error.code === 'ERR_NETWORK' || error.message.includes('Network');
      const message = error.response?.data?.message || error.message || 'Recognition failed';

      if (isNetworkError) {
        const draftId = await useAudioStore.getState().saveOfflineDraft(file);
        set({ 
          isRecognizing: false, 
          recognizeError: `${message}（已保存为离线草稿，网络恢复后将自动补交）` 
        });
      } else {
        set({ isRecognizing: false, recognizeError: message });
      }
      return false;
    }
  },

  setSongs: (songs) => set({ songs }),
  setRecognizeResult: (r) => set({ recognizeResult: r }),
  setRecording: (v) => set({ isRecording: v }),
  setAudioLevel: (v) => set({ audioLevel: v }),
  clearUploadStatus: () => set({ uploadError: null, uploadSuccess: null }),
  clearRecognizeStatus: () => set({ recognizeError: null, recognizeResult: null }),
  clearBatchUploadStatus: () => set({ batchUploadProgress: [], batchUploadResult: null, batchUploadError: null }),

  fetchHistory: async () => {
    set({ isFetchingHistory: true });
    try {
      const response = await axios.get<RecognitionHistoryItem[]>(`${API_BASE}/history`);
      set({ history: response.data, isFetchingHistory: false });
    } catch (error) {
      console.error('Failed to fetch history:', error);
      set({ isFetchingHistory: false });
    }
  },

  fetchSongDetail: async (songId: string) => {
    set({ isFetchingSongDetail: true });
    try {
      const response = await axios.get<Song>(`${API_BASE}/songs/${songId}`);
      set({ currentSong: response.data, isFetchingSongDetail: false });
    } catch (error) {
      console.error('Failed to fetch song detail:', error);
      set({ currentSong: null, isFetchingSongDetail: false });
    }
  },

  fetchSongHistory: async (songId: string) => {
    set({ isFetchingSongHistory: true });
    try {
      const response = await axios.get<RecognitionHistoryItem[]>(`${API_BASE}/songs/${songId}/history`);
      set({ currentSongHistory: response.data, isFetchingSongHistory: false });
    } catch (error) {
      console.error('Failed to fetch song history:', error);
      set({ currentSongHistory: [], isFetchingSongHistory: false });
    }
  },

  setCurrentSongId: (id: string | null) => set({ currentSongId: id, currentSong: null, currentSongHistory: [] }),

  deleteSong: async (songId: string) => {
    set({ isDeletingSong: true, deleteSongError: null });
    try {
      await axios.delete<DeleteSongResponse>(`${API_BASE}/songs/${songId}`);
      set({ isDeletingSong: false });
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Delete failed';
      set({ isDeletingSong: false, deleteSongError: message });
      return false;
    }
  },

  clearDeleteStatus: () => set({ deleteSongError: null }),

  fetchFailedSamples: async () => {
    set({ isFetchingFailedSamples: true, failedSamplesError: null });
    try {
      const response = await axios.get<FailedSamplesResponse>(`${API_BASE}/failed-samples?limit=100`);
      set({ failedSamples: response.data.samples, isFetchingFailedSamples: false });
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch failed samples';
      set({ isFetchingFailedSamples: false, failedSamplesError: message });
    }
  },

  deleteFailedSample: async (sampleId: string) => {
    set({ isDeletingFailedSample: true });
    try {
      await axios.delete(`${API_BASE}/failed-samples/${sampleId}`);
      set((state) => ({
        failedSamples: state.failedSamples.filter((s) => s.id !== sampleId),
        isDeletingFailedSample: false,
      }));
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Delete failed';
      set({ isDeletingFailedSample: false, failedSamplesError: message });
      return false;
    }
  },

  promoteFailedSample: async (sampleId: string, title: string, artist?: string | null) => {
    set({ isPromotingSample: true, promoteSampleError: null });
    try {
      const body: PromoteSampleRequest = { title, artist: artist || null };
      await axios.post<PromoteSampleResponse>(`${API_BASE}/failed-samples/${sampleId}/promote`, body);
      set((state) => ({
        failedSamples: state.failedSamples.filter((s) => s.id !== sampleId),
        isPromotingSample: false,
      }));
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Promote failed';
      set({ isPromotingSample: false, promoteSampleError: message });
      return false;
    }
  },

  fetchSimilarSongs: async (songId: string, limit: number = 5) => {
    set({ isFetchingSimilarSongs: true });
    try {
      const response = await axios.get<SimilarSongsResponse>(
        `${API_BASE}/songs/${songId}/similar?limit=${limit}`
      );
      set({ similarSongs: response.data.songs, isFetchingSimilarSongs: false });
    } catch (error) {
      console.error('Failed to fetch similar songs:', error);
      set({ similarSongs: [], isFetchingSimilarSongs: false });
    }
  },

  startCalibration: async (durationMs: number = 2000) => {
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let stream: MediaStream | null = null;
    let animationId: number | null = null;
    const startTime = Date.now();

    try {
      set({ 
        calibrationStatus: 'calibrating', 
        calibrationResult: null,
        calibrationWaveform: []
      });

      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const volumes: number[] = [];
      const peaks: number[] = [];
      let clippedCount = 0;
      const waveformHistory: number[] = [];

      const collectData = () => {
        if (!analyser) return;
        analyser.getByteTimeDomainData(dataArray);
        
        let sum = 0;
        let peak = 0;
        let hasClip = false;
        
        for (let i = 0; i < bufferLength; i++) {
          const v = Math.abs(dataArray[i] - 128);
          sum += v;
          if (v > peak) peak = v;
          if (v >= 127) hasClip = true;
        }
        
        const avgVolume = sum / bufferLength;
        volumes.push(avgVolume);
        peaks.push(peak);
        if (hasClip) clippedCount++;
        
        waveformHistory.push(avgVolume);
        if (waveformHistory.length > 100) waveformHistory.shift();
        
        set({ 
          calibrationRealTimeVolume: avgVolume / 128 * 100,
          calibrationWaveform: [...waveformHistory]
        });

        const elapsed = Date.now() - startTime;
        if (elapsed < durationMs) {
          animationId = requestAnimationFrame(collectData);
        } else {
          finishCalibration();
        }
      };

      const finishCalibration = () => {
        stream?.getTracks().forEach(t => t.stop());
        audioContext?.close();
        
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const maxPeak = Math.max(...peaks);
        const avgVolumeNorm = avgVolume / 128;
        const peakNorm = maxPeak / 128;
        
        const sortedVolumes = [...volumes].sort((a, b) => a - b);
        const noiseFloor = sortedVolumes[Math.floor(sortedVolumes.length * 0.1)] / 128;
        const snr = noiseFloor > 0 ? 20 * Math.log10(avgVolumeNorm / noiseFloor) : 0;
        
        let qualityLevel: QualityLevel = 'no_signal';
        const suggestions: string[] = [];
        
        if (avgVolumeNorm < 0.02) {
          qualityLevel = 'no_signal';
          suggestions.push('未检测到麦克风输入，请检查麦克风是否连接并授权');
        } else if (avgVolumeNorm < 0.08) {
          qualityLevel = 'poor';
          suggestions.push('输入音量过低，请靠近麦克风或调大麦克风音量');
        } else if (peakNorm > 0.98 || clippedCount > 5) {
          qualityLevel = 'poor';
          suggestions.push('检测到音频削波，请调小麦克风音量或远离音源');
        } else if (snr < 10) {
          qualityLevel = 'fair';
          suggestions.push('环境噪音较大，建议在安静环境下录音');
        } else if (avgVolumeNorm >= 0.15 && avgVolumeNorm <= 0.5 && snr >= 20) {
          qualityLevel = 'excellent';
          suggestions.push('录音环境良好，可以开始识别');
        } else if (avgVolumeNorm >= 0.1 && avgVolumeNorm <= 0.6 && snr >= 15) {
          qualityLevel = 'good';
          suggestions.push('录音环境良好，可以开始识别');
        } else {
          qualityLevel = 'fair';
          if (avgVolumeNorm < 0.1) {
            suggestions.push('音量稍低，可适当靠近麦克风');
          } else if (avgVolumeNorm > 0.6) {
            suggestions.push('音量稍高，可适当远离麦克风');
          }
          suggestions.push('建议在安静环境下进行识别');
        }

        const result: CalibrationResult = {
          status: 'success',
          qualityLevel,
          averageVolume: Math.round(avgVolumeNorm * 100),
          peakVolume: Math.round(peakNorm * 100),
          noiseLevel: Math.round(noiseFloor * 100),
          signalToNoiseRatio: Math.round(snr * 10) / 10,
          clippedSamples: clippedCount,
          suggestions,
          durationMs: Date.now() - startTime,
        };

        set({ 
          calibrationStatus: 'success', 
          calibrationResult: result,
          calibrationRealTimeVolume: 0
        });
      };

      collectData();
      return true;
    } catch (error: any) {
      console.error('Calibration failed:', error);
      stream?.getTracks().forEach(t => t.stop());
      audioContext?.close();
      
      set({ 
        calibrationStatus: 'failed',
        calibrationRealTimeVolume: 0,
        calibrationResult: {
          status: 'failed',
          qualityLevel: 'no_signal',
          averageVolume: 0,
          peakVolume: 0,
          noiseLevel: 0,
          signalToNoiseRatio: 0,
          clippedSamples: 0,
          suggestions: ['校准失败: ' + (error.message || '无法访问麦克风')],
          durationMs: 0,
        }
      });
      return false;
    }
  },

  stopCalibration: () => {
    set({ 
      calibrationStatus: 'idle',
      calibrationRealTimeVolume: 0,
      calibrationWaveform: []
    });
  },

  clearCalibration: () => {
    set({ 
      calibrationStatus: 'idle',
      calibrationResult: null,
      calibrationRealTimeVolume: 0,
      calibrationWaveform: []
    });
  },

  setCompareFile: (slot: CompareSlot, file: File | null) => {
    const key = slot === 'A' ? 'compareItemA' : 'compareItemB';
    set((state) => ({
      [key]: {
        ...state[key],
        file,
        fileName: file?.name || null,
        result: null,
        error: null,
      },
      compareResult: null,
    }));
  },

  setCompareRecording: (slot: CompareSlot, recording: boolean) => {
    const key = slot === 'A' ? 'compareItemA' : 'compareItemB';
    set((state) => ({
      [key]: {
        ...state[key],
        isRecording: recording,
      },
    }));
  },

  recognizeCompareSlot: async (slot: CompareSlot) => {
    const key = slot === 'A' ? 'compareItemA' : 'compareItemB';
    
    set((state) => ({
      [key]: {
        ...state[key],
        isRecognizing: true,
        error: null,
        result: null,
      },
      compareResult: null,
    }));

    const getStateFunc = () => useAudioStore.getState();
    const file = getStateFunc()[key].file;

    if (!file) {
      set((state) => ({
        [key]: {
          ...state[key],
          isRecognizing: false,
          error: '请先选择音频文件',
        },
      }));
      return false;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post<RecognizeResult>(
        `${API_BASE}/recognize`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      set((state) => ({
        [key]: {
          ...state[key],
          isRecognizing: false,
          result: response.data,
        },
      }));

      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '识别失败';
      set((state) => ({
        [key]: {
          ...state[key],
          isRecognizing: false,
          error: message,
        },
      }));
      return false;
    }
  },

  clearCompareSlot: (slot: CompareSlot) => {
    const key = slot === 'A' ? 'compareItemA' : 'compareItemB';
    set((state) => ({
      [key]: {
        ...state[key],
        file: null,
        fileName: null,
        isRecording: false,
        isRecognizing: false,
        result: null,
        error: null,
      },
      compareResult: null,
    }));
  },

  clearCompareAll: () => {
    set({
      compareItemA: {
        slot: 'A',
        file: null,
        fileName: null,
        isRecording: false,
        isRecognizing: false,
        result: null,
        error: null,
      },
      compareItemB: {
        slot: 'B',
        file: null,
        fileName: null,
        isRecording: false,
        isRecognizing: false,
        result: null,
        error: null,
      },
      compareResult: null,
    });
  },

  calculateCompareResult: () => {
    const state = useAudioStore.getState();
    const resultA = state.compareItemA.result;
    const resultB = state.compareItemB.result;

    if (!resultA || !resultB) {
      set({ compareResult: null });
      return;
    }

    const sameTitle = resultA.song?.title === resultB.song?.title;
    const sameArtist = resultA.song?.artist === resultB.song?.artist;
    const isSameSong = resultA.match_found && resultB.match_found && sameTitle;
    const confidenceDiff = Math.abs(resultA.confidence - resultB.confidence);

    let summary = '';
    if (isSameSong) {
      summary = '✅ 两段音频识别为同一首歌曲';
    } else if (resultA.match_found && resultB.match_found) {
      summary = '❌ 两段音频识别为不同的歌曲';
    } else if (!resultA.match_found && !resultB.match_found) {
      summary = '⚠️ 两段音频均未找到匹配歌曲';
    } else {
      summary = '⚠️ 仅一段音频找到匹配歌曲';
    }

    set({
      compareResult: {
        isSameSong,
        confidenceDiff,
        sameTitle,
        sameArtist,
        summary,
      },
    });
  },

  fetchPlaylists: async () => {
    set({ isFetchingPlaylists: true, playlistError: null });
    try {
      const response = await axios.get<PlaylistsResponse>(`${API_BASE}/playlists`);
      set({ playlists: response.data.playlists, isFetchingPlaylists: false });
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch playlists';
      set({ isFetchingPlaylists: false, playlistError: message });
    }
  },

  createPlaylist: async (name: string, description?: string | null) => {
    set({ isCreatingPlaylist: true, playlistError: null });
    try {
      const body: CreatePlaylistRequest = { name, description: description || null };
      const response = await axios.post<Playlist>(`${API_BASE}/playlists`, body);
      set((state) => ({
        playlists: [response.data, ...state.playlists],
        isCreatingPlaylist: false,
      }));
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to create playlist';
      set({ isCreatingPlaylist: false, playlistError: message });
      return false;
    }
  },

  fetchPlaylistDetail: async (playlistId: string) => {
    try {
      const response = await axios.get<Playlist>(`${API_BASE}/playlists/${playlistId}`);
      set({ currentPlaylist: response.data });
    } catch (error) {
      console.error('Failed to fetch playlist detail:', error);
      set({ currentPlaylist: null });
    }
  },

  fetchPlaylistSongs: async (playlistId: string) => {
    set({ isFetchingPlaylistSongs: true });
    try {
      const response = await axios.get<PlaylistSongsResponse>(`${API_BASE}/playlists/${playlistId}/songs`);
      set({ currentPlaylistSongs: response.data.songs, isFetchingPlaylistSongs: false });
    } catch (error) {
      console.error('Failed to fetch playlist songs:', error);
      set({ currentPlaylistSongs: [], isFetchingPlaylistSongs: false });
    }
  },

  updatePlaylist: async (playlistId: string, name: string, description?: string | null) => {
    set({ isUpdatingPlaylist: true, playlistError: null });
    try {
      const body: UpdatePlaylistRequest = { name, description: description || null };
      const response = await axios.put<Playlist>(`${API_BASE}/playlists/${playlistId}`, body);
      set((state) => ({
        playlists: state.playlists.map((p) =>
          p.id === playlistId ? response.data : p
        ),
        currentPlaylist: response.data,
        isUpdatingPlaylist: false,
      }));
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to update playlist';
      set({ isUpdatingPlaylist: false, playlistError: message });
      return false;
    }
  },

  deletePlaylist: async (playlistId: string) => {
    set({ isDeletingPlaylist: true, playlistError: null });
    try {
      await axios.delete(`${API_BASE}/playlists/${playlistId}`);
      set((state) => ({
        playlists: state.playlists.filter((p) => p.id !== playlistId),
        currentPlaylistId: state.currentPlaylistId === playlistId ? null : state.currentPlaylistId,
        currentPlaylist: state.currentPlaylist?.id === playlistId ? null : state.currentPlaylist,
        currentPlaylistSongs: state.currentPlaylist?.id === playlistId ? [] : state.currentPlaylistSongs,
        isDeletingPlaylist: false,
      }));
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to delete playlist';
      set({ isDeletingPlaylist: false, playlistError: message });
      return false;
    }
  },

  addSongToPlaylist: async (playlistId: string, songId: string) => {
    set({ isAddingSongToPlaylist: true, playlistError: null });
    try {
      const body: AddSongToPlaylistRequest = { song_id: songId };
      await axios.post(`${API_BASE}/playlists/${playlistId}/songs`, body);
      set({ isAddingSongToPlaylist: false });
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to add song to playlist';
      set({ isAddingSongToPlaylist: false, playlistError: message });
      return false;
    }
  },

  removeSongFromPlaylist: async (playlistId: string, songId: string) => {
    set({ isRemovingSongFromPlaylist: true, playlistError: null });
    try {
      await axios.delete(`${API_BASE}/playlists/${playlistId}/songs/${songId}`);
      set((state) => ({
        currentPlaylistSongs: state.currentPlaylistSongs.filter((s) => s.song_id !== songId),
        isRemovingSongFromPlaylist: false,
      }));
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to remove song from playlist';
      set({ isRemovingSongFromPlaylist: false, playlistError: message });
      return false;
    }
  },

  setCurrentPlaylistId: (id: string | null) =>
    set({ currentPlaylistId: id, currentPlaylist: null, currentPlaylistSongs: [] }),

  clearPlaylistError: () => set({ playlistError: null }),

  checkOnboardingStatus: () => {
    const completed = localStorage.getItem(ONBOARDING_KEY) === 'true';
    set({ isOnboardingCompleted: completed });
  },

  resetOnboarding: () => {
    localStorage.removeItem(ONBOARDING_KEY);
    set({ isOnboardingCompleted: false });
  },

  completeOnboarding: () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    set({ isOnboardingCompleted: true });
  },

  reviewTasks: [],
  isFetchingReviewTasks: false,
  isCreatingReviewTask: false,
  isReRecognizing: false,
  isDeletingReviewTask: false,
  reviewTasksError: null,
  lowConfidenceHistory: [],
  isFetchingLowConfidence: false,

  fetchReviewTasks: async (status?: string) => {
    set({ isFetchingReviewTasks: true, reviewTasksError: null });
    try {
      const url = status
        ? `${API_BASE}/review-tasks?status=${status}&limit=100`
        : `${API_BASE}/review-tasks?limit=100`;
      const response = await axios.get<ReviewTasksResponse>(url);
      set({ reviewTasks: response.data.tasks, isFetchingReviewTasks: false });
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch review tasks';
      set({ isFetchingReviewTasks: false, reviewTasksError: message });
    }
  },

  createReviewTask: async (historyId: string, note?: string | null) => {
    set({ isCreatingReviewTask: true, reviewTasksError: null });
    try {
      const body: CreateReviewTaskRequest = { history_id: historyId, note: note || null };
      await axios.post(`${API_BASE}/review-tasks`, body);
      set({ isCreatingReviewTask: false });
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to create review task';
      set({ isCreatingReviewTask: false, reviewTasksError: message });
      return false;
    }
  },

  deleteReviewTask: async (taskId: string) => {
    set({ isDeletingReviewTask: true });
    try {
      await axios.delete(`${API_BASE}/review-tasks/${taskId}`);
      set((state) => ({
        reviewTasks: state.reviewTasks.filter((t) => t.id !== taskId),
        isDeletingReviewTask: false,
      }));
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to delete review task';
      set({ isDeletingReviewTask: false, reviewTasksError: message });
      return false;
    }
  },

  reRecognizeReviewTask: async (taskId: string, file: File) => {
    set({ isReRecognizing: true, reviewTasksError: null });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post<RecognizeResult>(
        `${API_BASE}/review-tasks/${taskId}/re-recognize`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      set({ isReRecognizing: false });
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Re-recognition failed';
      set({ isReRecognizing: false, reviewTasksError: message });
      return false;
    }
  },

  updateReviewTaskStatus: async (taskId: string, status: string) => {
    try {
      await axios.put(`${API_BASE}/review-tasks/${taskId}/status`, { status });
      return true;
    } catch (error: any) {
      console.error('Failed to update review task status:', error);
      return false;
    }
  },

  fetchLowConfidenceHistory: async (threshold: number = 0.3) => {
    set({ isFetchingLowConfidence: true });
    try {
      const response = await axios.get<LowConfidenceHistoryResponse>(
        `${API_BASE}/review-tasks/low-confidence?threshold=${threshold}&limit=100`
      );
      set({ lowConfidenceHistory: response.data.items, isFetchingLowConfidence: false });
    } catch (error) {
      console.error('Failed to fetch low confidence history:', error);
      set({ isFetchingLowConfidence: false });
    }
  },
}));
