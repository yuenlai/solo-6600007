import { create } from 'zustand';
import axios from 'axios';
import { Song, RecognizeResult, UploadSongResponse } from '../types';

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
  fetchSongs: () => Promise<void>;
  uploadSong: (title: string, artist: string, file: File) => Promise<boolean>;
  recognizeFile: (file: File) => Promise<boolean>;
  setSongs: (songs: Song[]) => void;
  setRecognizeResult: (r: RecognizeResult | null) => void;
  setRecording: (v: boolean) => void;
  setAudioLevel: (v: number) => void;
  clearUploadStatus: () => void;
  clearRecognizeStatus: () => void;
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
}));
