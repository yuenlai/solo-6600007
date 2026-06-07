import React, { useRef, useEffect } from 'react';
import { useAudioStore } from '../store/audio';
import { CompareSlot, RecognizeResult } from '../types';

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

const CompareSlotCard: React.FC<{
  slot: CompareSlot;
  title: string;
  color: string;
}> = ({ slot, title, color }) => {
  const {
    compareItemA,
    compareItemB,
    setCompareFile,
    setCompareRecording,
    recognizeCompareSlot,
    clearCompareSlot,
    calibrationResult,
    startCalibration,
    clearCalibration,
    calibrationStatus,
    calibrationRealTimeVolume,
    calibrationWaveform,
  } = useAudioStore();

  const item = slot === 'A' ? compareItemA : compareItemB;
  const mediaRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canRecord = calibrationResult?.qualityLevel === 'excellent'
    || calibrationResult?.qualityLevel === 'good'
    || calibrationResult?.qualityLevel === 'fair';

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const blobChunks: Blob[] = [];
    recorder.ondataavailable = (e) => { blobChunks.push(e.data); };
    recorder.onstop = async () => {
      const audioBlob = new Blob(blobChunks, { type: 'audio/wav' });
      const audioFile = new File([audioBlob], `${slot}_recording.wav`, { type: 'audio/wav' });
      setCompareFile(slot, audioFile);
      setCompareRecording(slot, false);
    };
    recorder.start();
    mediaRef.current = recorder;
    setCompareRecording(slot, true);
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach(t => t.stop());
    setCompareRecording(slot, false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCompareFile(slot, file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleRecognize = async () => {
    const success = await recognizeCompareSlot(slot);
    if (success) {
      setTimeout(() => {
        useAudioStore.getState().calculateCompareResult();
      }, 100);
    }
  };

  const renderResult = (result: RecognizeResult) => {
    return (
      <div style={{
        padding: '12px',
        borderRadius: '8px',
        background: result.match_found ? '#e8f5e9' : '#fff3e0',
        marginTop: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '20px' }}>{result.match_found ? '✅' : '❌'}</span>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            {result.match_found ? '识别成功' : '未找到匹配'}
          </span>
        </div>
        {result.match_found && result.song ? (
          <>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>{result.song.title}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{result.song.artist || '未知艺术家'}</div>
          </>
        ) : (
          <div style={{ fontSize: '12px', color: '#666' }}>未匹配到歌曲库中的音频</div>
        )}
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#999' }}>
          置信度: {(result.confidence * 100).toFixed(0)}% · 耗时: {result.processing_time_ms}ms
        </div>
      </div>
    );
  };

  const renderWaveform = () => {
    const maxHeight = 40;
    const barWidth = 2;
    const gap = 1;
    const data = calibrationWaveform.length > 0 ? calibrationWaveform : new Array(40).fill(0);

    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: maxHeight + 'px', gap: gap + 'px' }}>
        {data.map((val, idx) => {
          const height = Math.max(2, (val / 128) * maxHeight);
          return (
            <div
              key={idx}
              style={{
                width: barWidth + 'px',
                height: height + 'px',
                background: color,
                borderRadius: '1px',
                opacity: 0.5,
              }}
            />
          );
        })}
      </div>
    );
  };

  const renderCalibrationSection = () => {
    return (
      <div style={{ marginBottom: '16px', padding: '12px', background: '#f5f5f5', borderRadius: '8px', fontSize: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontWeight: 500, color: '#333' }}>🎙️ 环境校准</span>
          {calibrationStatus !== 'calibrating' && (
            <button
              onClick={() => { clearCalibration(); startCalibration(2000); }}
              disabled={item.isRecording || item.isRecognizing}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                borderRadius: '4px',
                border: 'none',
                background: '#1565c0',
                color: '#fff',
                cursor: item.isRecording || item.isRecognizing ? 'not-allowed' : 'pointer',
                opacity: item.isRecording || item.isRecognizing ? 0.5 : 1,
              }}
            >
              {calibrationResult ? '重新校准' : '开始校准'}
            </button>
          )}
        </div>

        {calibrationStatus === 'calibrating' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#1565c0', fontSize: '11px', marginBottom: '6px' }}>正在检测...</div>
            {renderWaveform()}
            <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
              音量: {Math.round(calibrationRealTimeVolume)}%
            </div>
          </div>
        )}

        {calibrationResult && calibrationStatus !== 'calibrating' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              padding: '2px 8px',
              borderRadius: '10px',
              background: getQualityColor(calibrationResult.qualityLevel) + '20',
              color: getQualityColor(calibrationResult.qualityLevel),
              fontWeight: 600,
              fontSize: '11px',
            }}>
              {getQualityLabel(calibrationResult.qualityLevel)}
            </span>
            <span style={{ fontSize: '10px', color: '#888' }}>
              音量: {calibrationResult.averageVolume}% · 信噪比: {calibrationResult.signalToNoiseRatio}dB
            </span>
          </div>
        )}

        {!calibrationResult && calibrationStatus !== 'calibrating' && (
          <div style={{ fontSize: '11px', color: '#888' }}>建议先校准以获得更好的识别效果</div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      flex: 1,
      padding: '20px',
      border: `2px solid ${color}`,
      borderRadius: '12px',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color, fontSize: '18px' }}>{title}</h3>
        {item.file && (
          <button
            onClick={() => clearCompareSlot(slot)}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              background: '#fff',
              color: '#666',
              cursor: 'pointer',
            }}
          >
            清空
          </button>
        )}
      </div>

      {renderCalibrationSection()}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            onClick={item.isRecording ? stopRecording : startRecording}
            disabled={item.isRecognizing || (!canRecord && !item.isRecording)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: item.isRecording ? '#e53935' : color,
              color: '#fff',
              fontSize: '14px',
              cursor: item.isRecognizing || (!canRecord && !item.isRecording) ? 'not-allowed' : 'pointer',
              opacity: item.isRecognizing || (!canRecord && !item.isRecording) ? 0.5 : 1,
            }}
          >
            {item.isRecording ? '■ 停止录音' : '🎤 录音'}
          </button>
          {item.isRecording && <div style={{ fontSize: '11px', color: '#e53935', marginTop: '4px' }}>● 录音中...</div>}
          {!canRecord && !item.isRecording && calibrationResult && (
            <div style={{ fontSize: '10px', color: '#e53935', marginTop: '4px' }}>请先完成环境校准</div>
          )}
        </div>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <button
            onClick={triggerFileInput}
            disabled={item.isRecognizing || item.isRecording}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: item.file ? '#2e7d32' : '#1565c0',
              color: '#fff',
              fontSize: '14px',
              cursor: item.isRecognizing || item.isRecording ? 'not-allowed' : 'pointer',
              opacity: item.isRecognizing || item.isRecording ? 0.5 : 1,
            }}
          >
            📁 选择文件
          </button>
          {item.fileName && (
            <div style={{ fontSize: '11px', color: '#333', marginTop: '4px', wordBreak: 'break-all' }}>
              {item.fileName}
            </div>
          )}
        </div>
      </div>

      {item.file && !item.isRecognizing && !item.result && (
        <button
          onClick={handleRecognize}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            background: '#2e7d32',
            color: '#fff',
            fontSize: '14px',
            cursor: 'pointer',
            marginBottom: '12px',
          }}
        >
          🔍 开始识别
        </button>
      )}

      {item.isRecognizing && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#1565c0', fontSize: '14px' }}>
          ⏳ 正在分析音频...
        </div>
      )}

      {item.error && (
        <div style={{
          padding: '10px',
          background: '#ffebee',
          color: '#c62828',
          borderRadius: '8px',
          fontSize: '12px',
          marginTop: '12px',
        }}>
          ❌ {item.error}
        </div>
      )}

      {item.result && renderResult(item.result)}
    </div>
  );
};

export const CompareRecorder: React.FC = () => {
  const {
    compareItemA,
    compareItemB,
    compareResult,
    clearCompareAll,
  } = useAudioStore();

  useEffect(() => {
    if (compareItemA.result && compareItemB.result) {
      useAudioStore.getState().calculateCompareResult();
    }
  }, [compareItemA.result, compareItemB.result]);

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#333' }}>🔄 对比识别模式</h2>
        {(compareItemA.file || compareItemB.file) && (
          <button
            onClick={clearCompareAll}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              background: '#fff',
              color: '#666',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            全部清空
          </button>
        )}
      </div>

      <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
        分别对两段音频进行识别，直观对比识别结果差异
      </p>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <CompareSlotCard slot="A" title="音频 A" color="#1a237e" />
        <CompareSlotCard slot="B" title="音频 B" color="#e65100" />
      </div>

      {compareResult && (
        <div style={{
          padding: '24px',
          borderRadius: '12px',
          background: compareResult.isSameSong ? '#e8f5e9' : '#fff3e0',
          border: `2px solid ${compareResult.isSameSong ? '#4caf50' : '#ff9800'}`,
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '18px', color: '#333' }}>📊 对比结果</h3>

          <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: '#333' }}>
            {compareResult.summary}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>歌曲标题</div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: compareResult.sameTitle ? '#2e7d32' : '#e65100' }}>
                {compareResult.sameTitle ? '✅ 相同' : '❌ 不同'}
              </div>
            </div>

            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>艺术家</div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: compareResult.sameArtist ? '#2e7d32' : '#e65100' }}>
                {compareResult.sameArtist ? '✅ 相同' : '❌ 不同'}
              </div>
            </div>

            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>置信度差异</div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#333' }}>
                {(compareResult.confidenceDiff * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {compareItemA.result && compareItemB.result && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#333', marginBottom: '12px' }}>详细对比</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#1a237e', fontWeight: 600, marginBottom: '8px' }}>音频 A</div>
                  <div style={{ fontSize: '14px' }}>
                    {compareItemA.result.match_found && compareItemA.result.song
                      ? compareItemA.result.song.title
                      : '未匹配'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    置信度: {(compareItemA.result.confidence * 100).toFixed(0)}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#e65100', fontWeight: 600, marginBottom: '8px' }}>音频 B</div>
                  <div style={{ fontSize: '14px' }}>
                    {compareItemB.result.match_found && compareItemB.result.song
                      ? compareItemB.result.song.title
                      : '未匹配'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    置信度: {(compareItemB.result.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
