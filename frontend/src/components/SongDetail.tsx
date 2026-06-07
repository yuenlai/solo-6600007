import React, { useEffect } from 'react';
import { useAudioStore } from '../store/audio';

export const SongDetail: React.FC = () => {
  const {
    currentSongId,
    currentSong,
    currentSongHistory,
    isFetchingSongDetail,
    isFetchingSongHistory,
    fetchSongDetail,
    fetchSongHistory,
    setCurrentSongId,
  } = useAudioStore();

  useEffect(() => {
    if (currentSongId) {
      fetchSongDetail(currentSongId);
      fetchSongHistory(currentSongId);
    }
  }, [currentSongId, fetchSongDetail, fetchSongHistory]);

  const formatDuration = (sec: number | null) => {
    if (!sec) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getFingerprintSummary = () => {
    if (!currentSong) return null;
    const peaksCount = currentSong.fingerprint_peaks
      ? (JSON.parse(currentSong.fingerprint_peaks) as unknown[]).length
      : 0;
    const robustCount = currentSong.fingerprint_robust
      ? (JSON.parse(currentSong.fingerprint_robust) as unknown[]).length
      : 0;
    return { peaksCount, robustCount };
  };

  const fingerprintSummary = getFingerprintSummary();

  const stats = {
    total: currentSongHistory.length,
    avgConfidence: currentSongHistory.length > 0
      ? (currentSongHistory.reduce((sum, h) => sum + h.confidence, 0) / currentSongHistory.length * 100).toFixed(1)
      : '0',
    avgTime: currentSongHistory.length > 0
      ? Math.round(currentSongHistory.reduce((sum, h) => sum + h.processing_time_ms, 0) / currentSongHistory.length)
      : 0,
  };

  if (!currentSongId) {
    return null;
  }

  if (isFetchingSongDetail) {
    return (
      <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
          <div>加载中...</div>
        </div>
      </div>
    );
  }

  if (!currentSong) {
    return (
      <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
        <button
          onClick={() => setCurrentSongId(null)}
          style={{
            marginBottom: '16px',
            padding: '8px 16px',
            border: 'none',
            background: 'transparent',
            color: '#1976d2',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          ← 返回列表
        </button>
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '8px', color: '#999' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>❓</div>
          <div>未找到歌曲</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
      <button
        onClick={() => setCurrentSongId(null)}
        style={{
          marginBottom: '16px',
          padding: '8px 16px',
          border: 'none',
          background: 'transparent',
          color: '#1976d2',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        ← 返回列表
      </button>

      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e0e0e0',
        padding: '24px',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px',
            flexShrink: 0,
          }}>🎵</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 700 }}>{currentSong.title}</h2>
            <div style={{ fontSize: '16px', color: '#666', marginBottom: '12px' }}>
              {currentSong.artist || '未知艺术家'}
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#888' }}>
              <span>⏱️ 时长: {formatDuration(currentSong.duration_sec)}</span>
              {currentSong.created_at && (
                <span>📅 入库: {formatTime(currentSong.created_at)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e0e0e0',
        padding: '20px',
        marginBottom: '20px',
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🔐 指纹摘要
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
          <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>特征点数量</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1976d2' }}>{fingerprintSummary?.peaksCount || 0}</div>
          </div>
          <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>鲁棒特征数</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#2e7d32' }}>{fingerprintSummary?.robustCount || 0}</div>
          </div>
        </div>
        <div style={{ padding: '12px', background: '#fafafa', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>指纹哈希</div>
          <code style={{
            fontSize: '11px',
            color: '#333',
            wordBreak: 'break-all',
            fontFamily: 'monospace',
          }}>{currentSong.fingerprint_hash}</code>
        </div>
      </div>

      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e0e0e0',
        padding: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📋 最近识别记录
          </h3>
          <button
            onClick={() => currentSongId && fetchSongHistory(currentSongId)}
            disabled={isFetchingSongHistory}
            style={{
              padding: '6px 12px',
              border: '1px solid #ddd',
              background: '#fff',
              borderRadius: '4px',
              cursor: isFetchingSongHistory ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              opacity: isFetchingSongHistory ? 0.6 : 1,
            }}
          >
            {isFetchingSongHistory ? '加载中...' : '🔄 刷新'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={{ padding: '12px', background: '#e3f2fd', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1976d2' }}>{stats.total}</div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>总识别次数</div>
          </div>
          <div style={{ padding: '12px', background: '#e8f5e9', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#2e7d32' }}>{stats.avgConfidence}%</div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>平均置信度</div>
          </div>
          <div style={{ padding: '12px', background: '#fff3e0', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#ed6c02' }}>{stats.avgTime}ms</div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>平均耗时</div>
          </div>
        </div>

        {currentSongHistory.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            background: '#fafafa',
            borderRadius: '8px',
            color: '#999',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
            <div>暂无识别记录</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflow: 'auto' }}>
            {currentSongHistory.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  background: '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: '#e8f5e9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0,
                }}>✅</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#333' }}>
                    置信度: {(item.confidence * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '11px', color: '#999' }}>
                    耗时: {item.processing_time_ms}ms · {formatTime(item.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
