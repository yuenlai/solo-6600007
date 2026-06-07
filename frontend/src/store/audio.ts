import { create } from 'zustand';
import axios from 'axios';
import { Song, RecognizeResult, UploadSongResponse, RecognitionHistoryItem, BatchUploadProgress, BatchUploadResult, DeleteSongResponse } from '../types';

const API_BASE = 'http://127.0.0.1:8080/api';

interface AudioState {
  songs: Song[];
  recognizeResult: RecognizeResult | null;
  isRecording: boolean;
  audioLevel: number;
  isUploading: boolean;
  isRecognizing: boolean;
  recognizeError: string | null;
  uploadError: string | null;
  uploadSuccess: UploadSongResponse | null;
  history: RecognitionHistoryItem[];
  isFetchingHistory: boolean;
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
  fetchSongs: () => Promise<void>;
  uploadSong: (title: string, artist: string, file: File) => Promise<boolean>;
  batchUploadSongs: (files: File[], defaultArtist?: string) => Promise<boolean>;
  recognizeFile: (file: File) => Promise<boolean>;
  fetchHistory: () => Promise<void>;
  fetchSongDetail: (songId: string) => Promise<void>;
  fetchSongHistory: (songId: string) => Promise<void>;
  deleteSong: (songId: string) => Promise<boolean>;
  setCurrentSongId: (id: string | null) => void;
  setSongs: (songs: Song[]) => void;
  setRecognizeResult: (r: RecognizeResult | null) => void;
  setRecording: (v: boolean) => void;
  setAudioLevel: (v: number) => void;
  clearUploadStatus: () => void;
  clearRecognizeStatus: () => void;
  clearBatchUploadStatus: () => void;
  clearDeleteStatus: () => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  songs: [],
  recognizeResult: null,
  isRecording: false,
  audioLevel: 0,
  isUploading: false,
  isRecognizing: false,
  recognizeError: null,
  uploadError: null,
  uploadSuccess: null,
  history: [],
  isFetchingHistory: false,
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

  fetchSongs: async () => {
    try {
      const response = await axios.get<Song[]>(`${API_BASE}/songs`);
      set({ songs: response.data });
    } catch (error) {
      console.error('Failed to fetch songs:', error);
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
      const message = error.response?.data?.message || error.message || 'Recognition failed';
      set({ isRecognizing: false, recognizeError: message });
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
}));
