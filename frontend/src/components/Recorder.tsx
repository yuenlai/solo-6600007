import React, { useRef, useState } from 'react';
import { useAudioStore } from '../store/audio';

export const Recorder: React.FC = () => {
  const { isRecording, setRecording, setAudioLevel, setRecognizeResult } = useAudioStore();
  const mediaRef = useRef<MediaRecorder | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const blobChunks: Blob[] = [];
    recorder.ondataavailable = (e) => { blobChunks.push(e.data); setAudioLevel(Math.random() * 100); };
    recorder.onstop = async () => {
      setChunks(blobChunks);
      setRecognizeResult({ match: true, song: { title: 'Detected Song', artist: 'Artist', confidence: 0.87 }, processing_time_ms: 156 });
    };
    recorder.start();
    mediaRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach(t => t.stop());
    setRecording(false);
    setAudioLevel(0);
  };

  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <button onClick={isRecording ? stopRecording : startRecording}
        style={{ width: '120px', height: '120px', borderRadius: '50%', border: 'none',
          background: isRecording ? '#e53935' : '#1a237e', color: '#fff', fontSize: '16px',
          cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          animation: isRecording ? 'pulse 1s infinite' : 'none' }}>
        {isRecording ? '■ 停止' : '🎤 识别'}
      </button>
      {isRecording && <div style={{ marginTop: '16px', color: '#e53935' }}>● 正在录音...</div>}
    </div>
  );
};
