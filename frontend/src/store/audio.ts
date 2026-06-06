import { create } from 'zustand';
import { Song, RecognizeResult } from '../types';

interface AudioState {
  songs: Song[];
  recognizeResult: RecognizeResult | null;
  isRecording: boolean;
  audioLevel: number;
  setSongs: (songs: Song[]) => void;
  setRecognizeResult: (r: RecognizeResult | null) => void;
  setRecording: (v: boolean) => void;
  setAudioLevel: (v: number) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  songs: [], recognizeResult: null, isRecording: false, audioLevel: 0,
  setSongs: (songs) => set({ songs }),
  setRecognizeResult: (r) => set({ recognizeResult: r }),
  setRecording: (v) => set({ isRecording: v }),
  setAudioLevel: (v) => set({ audioLevel: v }),
}));
