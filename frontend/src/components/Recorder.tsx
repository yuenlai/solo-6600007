import React, { useRef, useState } from 'react';
import { useAudioStore } from '../store/audio';

const getQualityColor = (level: string) => {
  switch (level) {
    case 'excellent': return '#2e7d32';
    case 'good': return '#558b2f';
    case 'fair': return '#f57c00';
    case 'poor': return '#e53935';
    case 'no_signal': return '#c62828';
    default: return '#757575';
  }
};

const getQualityLabel = (level: string) => {
  switch (level) {
    case 'excellent': return '优秀';
    case 'good': return '良好';
    case 'fair': return '一般';
    case 'poor': return '较差';
    case 'no_signal': return '无信号';
    default: return '未知';
  }
};

export const Recorder: React.FC = () => {
  const { 
    isRecording, 
    setRecording, 
    setAudioLevel, 
    setRecognizeResult,
    recognizeFile,
    isRecognizing,
    recognizeError,
    clearRecognizeStatus,
    calibrationStatus,
    calibrationResult,
    calibrationRealTimeVolume,
    calibrationWaveform,
    startCalibration,
    clearCalibration,
  } = useAudioStore();
  
  const mediaRef = useRef<MediaRecorder | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canRecord = calibrationResult?.qualityLevel === 'excellent' 
    || calibrationResult?.qualityLevel === 'good'
    || calibrationResult?.qualityLevel === 'fair';

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

  const handleStartCalibration = () => {
    clearCalibration();
    startCalibration(2000);
  };

  const renderWaveform = () => {
    const maxHeight = 60;
    const barWidth = 3;
    const gap = 1;
    const data = calibrationWaveform.length > 0 ? calibrationWaveform : new Array(50).fill(0);
    
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: maxHeight + 'px', gap: gap + 'px' }}>
        {data.map((val, idx) => {
          const height = Math.max(2, (val / 128) * maxHeight);
          const color = calibrationStatus === 'calibrating' 
            ? `hsl(${120 - (val / 128) * 60}, 70%, 50%)`
            : '#ccc';
          return (
            <div
              key={idx}
              style={{
                width: barWidth + 'px',
                height: height + 'px',
                background: color,
                borderRadius: '1px',
                transition: 'height 0.05s ease',
              }}
            />
          );
        })}
      </div>
    );
  };

  const renderCalibrationSection = () => {
    return (
      <div style={{ 
        marginBottom: '30px', 
        padding: '20px', 
        background: '#f5f5f5', 
        borderRadius: '12px' 
      }}>
        <h4 style={{ marginTop: 0, marginBottom: '16px', color: '#333' }}>
          🎙️ 环境校准
        </h4>

        {calibrationStatus === 'idle' && !calibrationResult && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#666', marginBottom: '16px', fontSize: '14px' }}>
              在开始录音识别前，建议先检测麦克风输入质量
            </p>
            <button
              onClick={handleStartCalibration}
              disabled={isRecognizing || isRecording}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                borderRadius: '8px',
                border: 'none',
                background: '#1565c0',
                color: '#fff',
                cursor: isRecognizing || isRecording ? 'not-allowed' : 'pointer',
                opacity: isRecognizing || isRecording ? 0.5 : 1,
              }}
            >
              🔍 开始环境校准
            </button>
          </div>
        )}

        {calibrationStatus === 'calibrating' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#1565c0', marginBottom: '12px', fontSize: '14px', fontWeight: 500 }}>
              ⏳ 正在检测环境... 请保持安静
            </p>
            <div style={{ marginBottom: '12px' }}>
              {renderWaveform()}
            </div>
            <div style={{ 
              height: '8px', 
              background: '#e0e0e0', 
              borderRadius: '4px',
              overflow: 'hidden',
              maxWidth: '300px',
              margin: '0 auto'
            }}>
              <div style={{
                height: '100%',
                width: `${calibrationRealTimeVolume}%`,
                background: `linear-gradient(90deg, #4caf50, #ff9800, #f44336)`,
                transition: 'width 0.1s ease',
              }} />
            </div>
            <p style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
              音量: {Math.round(calibrationRealTimeVolume)}%
            </p>
          </div>
        )}

        {calibrationResult && calibrationStatus !== 'calibrating' && (
          <div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ 
                  padding: '4px 12px', 
                  borderRadius: '20px', 
                  background: getQualityColor(calibrationResult.qualityLevel) + '20',
                  color: getQualityColor(calibrationResult.qualityLevel),
                  fontWeight: 600,
                  fontSize: '13px'
                }}>
                  {getQualityLabel(calibrationResult.qualityLevel)}
                </span>
                {calibrationStatus === 'failed' && (
                  <span style={{ color: '#e53935', fontSize: '13px' }}>校准失败</span>
                )}
              </div>
              <button
                onClick={handleStartCalibration}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  background: '#fff',
                  color: '#555',
                  cursor: 'pointer',
                }}
              >
                重新校准
              </button>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: '12px', 
              marginBottom: '16px' 
            }}>
              <div style={{ textAlign: 'center', padding: '8px', background: '#fff', borderRadius: '8px' }}>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#333' }}>
                  {calibrationResult.averageVolume}%
                </div>
                <div style={{ fontSize: '11px', color: '#888' }}>平均音量</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px', background: '#fff', borderRadius: '8px' }}>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#333' }}>
                  {calibrationResult.peakVolume}%
                </div>
                <div style={{ fontSize: '11px', color: '#888' }}>峰值音量</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px', background: '#fff', borderRadius: '8px' }}>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#333' }}>
                  {calibrationResult.signalToNoiseRatio}
                </div>
                <div style={{ fontSize: '11px', color: '#888' }}>信噪比(dB)</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px', background: '#fff', borderRadius: '8px' }}>
                <div style={{ fontSize: '20px', fontWeight: 600, color: calibrationResult.clippedSamples > 0 ? '#e53935' : '#333' }}>
                  {calibrationResult.clippedSamples}
                </div>
                <div style={{ fontSize: '11px', color: '#888' }}>削波次数</div>
              </div>
            </div>

            <div style={{ 
              padding: '12px', 
              background: '#fff', 
              borderRadius: '8px',
              borderLeft: `4px solid ${getQualityColor(calibrationResult.qualityLevel)}`
            }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#333', marginBottom: '6px' }}>
                💡 建议:
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#666' }}>
                {calibrationResult.suggestions.map((s, idx) => (
                  <li key={idx} style={{ marginBottom: '2px' }}>{s}</li>
                ))}
              </ul>
            </div>

            {!canRecord && calibrationResult.qualityLevel !== 'no_signal' && (
              <p style={{ 
                marginTop: '12px', 
                padding: '10px', 
                background: '#fff3e0', 
                borderRadius: '6px',
                fontSize: '12px',
                color: '#e65100',
                textAlign: 'center'
              }}>
                ⚠️ 录音质量较差，建议优化环境后重新校准
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      {renderCalibrationSection()}

      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '20px', color: '#333' }}>选择识别方式</h3>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isRecognizing || (!canRecord && !isRecording)}
              style={{ 
                width: '120px', 
                height: '120px', 
                borderRadius: '50%', 
                border: 'none',
                background: isRecording ? '#e53935' : '#1a237e', 
                color: '#fff', 
                fontSize: '16px',
                cursor: isRecognizing || (!canRecord && !isRecording) ? 'not-allowed' : 'pointer', 
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                animation: isRecording ? 'pulse 1s infinite' : 'none',
                opacity: isRecognizing || (!canRecord && !isRecording) ? 0.5 : 1
              }}>
              {isRecording ? '■ 停止' : '🎤 录音'}
            </button>
            <div style={{ marginTop: '12px', color: '#666', fontSize: '14px' }}>
              麦克风录音识别
            </div>
            {isRecording && <div style={{ marginTop: '8px', color: '#e53935' }}>● 正在录音...</div>}
            {!canRecord && !isRecording && calibrationResult && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#e53935', maxWidth: '150px' }}>
                请先完成环境校准
              </div>
            )}
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
