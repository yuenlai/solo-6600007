import React, { useRef, useState } from 'react';
import { useAudioStore } from '../store/audio';

export const Recorder: React.FC = () => {
  const { 
    isRecording, 
    setRecording, 
    setAudioLevel, 
    setRecognizeResult,
    recognizeFile,
    isRecognizing,
    recognizeError,
    clearRecognizeStatus
  } = useAudioStore();
  
  const mediaRef = useRef<MediaRecorder | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    clearRecognizeStatus();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const blobChunks: Blob[] = [];
    recorder.ondataavailable = (e) => { blobChunks.push(e.data); setAudioLevel(Math.random() * 100); };
    recorder.onstop = async () => {
      setChunks(blobChunks);
      const audioBlob = new Blob(blobChunks, { type: 'audio/wav' });
      const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
      await recognizeFile(audioFile);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearRecognizeStatus();
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileRecognize = async () => {
    if (selectedFile) {
      await recognizeFile(selectedFile);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '20px', color: '#333' }}>选择识别方式</h3>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isRecognizing}
              style={{ 
                width: '120px', 
                height: '120px', 
                borderRadius: '50%', 
                border: 'none',
                background: isRecording ? '#e53935' : '#1a237e', 
                color: '#fff', 
                fontSize: '16px',
                cursor: isRecognizing ? 'not-allowed' : 'pointer', 
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                animation: isRecording ? 'pulse 1s infinite' : 'none',
                opacity: isRecognizing ? 0.5 : 1
              }}>
              {isRecording ? '■ 停止' : '🎤 录音'}
            </button>
            <div style={{ marginTop: '12px', color: '#666', fontSize: '14px' }}>
              麦克风录音识别
            </div>
            {isRecording && <div style={{ marginTop: '8px', color: '#e53935' }}>● 正在录音...</div>}
          </div>

          <div style={{ fontSize: '24px', color: '#ccc', alignSelf: 'center' }}>或</div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button 
              onClick={triggerFileInput}
              disabled={isRecognizing || isRecording}
              style={{ 
                width: '120px', 
                height: '120px', 
                borderRadius: '50%', 
                border: 'none',
                background: selectedFile ? '#2e7d32' : '#1565c0', 
                color: '#fff', 
                fontSize: '16px',
                cursor: isRecognizing || isRecording ? 'not-allowed' : 'pointer', 
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                opacity: isRecognizing || isRecording ? 0.5 : 1
              }}>
              📁 选择文件
            </button>
            <div style={{ marginTop: '12px', color: '#666', fontSize: '14px' }}>
              本地音频文件识别
            </div>
            {selectedFile && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#333', maxWidth: '150px', wordBreak: 'break-all' }}>
                已选: {selectedFile.name}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedFile && !isRecognizing && (
        <button
          onClick={handleFileRecognize}
          style={{
            padding: '12px 32px',
            fontSize: '16px',
            borderRadius: '8px',
            border: 'none',
            background: '#2e7d32',
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
          🔍 开始识别
        </button>
      )}

      {isRecognizing && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '18px', color: '#1565c0' }}>
            ⏳ 正在分析音频...
          </div>
        </div>
      )}

      {recognizeError && (
        <div style={{ 
          marginTop: '20px', 
          padding: '12px 20px', 
          background: '#ffebee', 
          color: '#c62828',
          borderRadius: '8px',
          maxWidth: '400px',
          margin: '20px auto'
        }}>
          ❌ 识别失败: {recognizeError}
        </div>
      )}
    </div>
  );
};
