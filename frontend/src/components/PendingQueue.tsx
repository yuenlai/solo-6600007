import React, { useEffect } from 'react';
import { Song, SongStatus } from '../types';
import { useAudioStore } from '../store/audio';

export const PendingQueue: React.FC = () => {
  const { pendingSongs, fetchPendingSongs, isFetchingPendingSongs, setCurrentSongId } = useAudioStore();

  useEffect(() => {
    fetchPendingSongs();
    const interval = setInterval(fetchPendingSongs, 5000);
    return () => clearInterval(interval);
  }, [fetchPendingSongs]);

  const getStatusIcon = (status: SongStatus) => {
    switch (status) {
      case 'pending': return '📥';
      case 'processing': return '⏳';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '⏳';
    }
  };

  const getStatusText = (status: SongStatus) => {
    switch (status) {
      case 'pending': return '等待处理';
      case 'processing': return '生成指纹中';
      case 'completed': return '已完成';
      case 'failed': return '处理失败';
      default: return '未知';
    }
  };

  const getStatusColor = (status: SongStatus) => {
    switch (status) {
      case 'pending': return '#f57c00';
      case 'processing': return '#1976d2';
      case 'completed': return '#2e7d32';
      case 'failed': return '#c62828';
      default: return '#888';
    }
  };

  const formatDuration = (sec: number | null) => {
    if (!sec) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '--';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const pendingCount = pendingSongs.filter(s => s.status === 'pending').length;
  const processingCount = pendingSongs.filter(s => s.status === 'processing').length;

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '20px' }}>⏳ 待处理队列</h3>
        <button
          onClick={fetchPendingSongs}
          disabled={isFetchingPendingSongs}
          style={{
            padding: '6px 12px',
            border: '1px solid #ddd',
            background: '#fff',
            borderRadius: '4px',
            cursor: isFetchingPendingSongs ? 'wait' : 'pointer',
            fontSize: '12px',
          }}
        >
          {isFetchingPendingSongs ? '刷新中...' : '🔄 刷新'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          flex: 1,
          padding: '16px',
          background: '#fff3e0',
          borderRadius: '8px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#f57c00' }}>{pendingCount}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>等待处理</div>
        </div>
        <div style={{
          flex: 1,
          padding: '16px',
          background: '#e3f2fd',
          borderRadius: '8px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#1976d2' }}>{processingCount}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>生成指纹中</div>
        </div>
      </div>

      {pendingSongs.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#fff',
          borderRadius: '8px',
          color: '#999',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
          <div style={{ fontSize: '16px', marginBottom: '4px' }}>暂无待处理任务</div>
          <div style={{ fontSize: '13px' }}>所有歌曲都已完成指纹生成</div>
        </div>
      ) : (
        <div>
          {pendingSongs.map(song => (
            <div
              key={song.id}
              onClick={() => setCurrentSongId(song.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px',
                marginBottom: '8px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                background: '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f5f5f5';
                e.currentTarget.style.borderColor = '#bdbdbd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.borderColor = '#e0e0e0';
              }}
            >
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: song.status === 'processing' ? '#e3f2fd' : '#fff3e0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0,
              }}>
                {getStatusIcon(song.status || 'pending')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: '14px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {song.title}
                </div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                  {song.artist || '未知艺术家'} · {formatDuration(song.duration_sec)}
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                  上传时间: {formatTime(song.created_at)}
                </div>
              </div>
              <div style={{
                padding: '4px 10px',
                borderRadius: '12px',
                background: `${getStatusColor(song.status || 'pending')}15`,
                color: getStatusColor(song.status || 'pending'),
                fontSize: '12px',
                fontWeight: 500,
                flexShrink: 0,
              }}>
                {getStatusText(song.status || 'pending')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
