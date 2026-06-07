import React, { useEffect } from 'react';
import { RecognitionHistoryItem } from '../types';
import { useAudioStore } from '../store/audio';

export const RecognitionHistory: React.FC = () => {
  const { history, fetchHistory, isFetchingHistory } = useAudioStore();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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

  const stats = {
    total: history.length,
    matched: history.filter(h => h.match_found).length,
    avgTime: history.length > 0
      ? Math.round(history.reduce((sum, h) => sum + h.processing_time_ms, 0) / history.length)
      : 0,
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '20px' }}>📋 识别历史</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#1976d2' }}>{stats.total}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>总识别次数</div>
        </div>
        <div style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#2e7d32' }}>{stats.matched}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>匹配成功</div>
        </div>
        <div style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#ed6c02' }}>{stats.avgTime}ms</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>平均耗时</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '16px' }}>历史记录</h4>
        <button
          onClick={fetchHistory}
          disabled={isFetchingHistory}
          style={{
            padding: '6px 12px',
            border: '1px solid #ddd',
            background: '#fff',
            borderRadius: '4px',
            cursor: isFetchingHistory ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            opacity: isFetchingHistory ? 0.6 : 1,
          }}
        >
          {isFetchingHistory ? '加载中...' : '🔄 刷新'}
        </button>
      </div>

      {history.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          background: '#fff',
          borderRadius: '8px',
          color: '#999',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
          <div>暂无识别记录</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>去识别页面试试吧！</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {history.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                background: '#fff',
                borderLeft: `4px solid ${item.match_found ? '#4caf50' : '#ff9800'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                  background: item.match_found ? '#e8f5e9' : '#fff3e0',
                }}>
                  {item.match_found ? '✅' : '❌'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: '14px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.match_found && item.song_title
                      ? item.song_title
                      : '未找到匹配歌曲'}
                  </div>
                  {item.match_found && item.song_artist && (
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      {item.song_artist}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#999', marginLeft: '42px' }}>
                <span>⏱️ {item.processing_time_ms}ms</span>
                {item.match_found && <span>🎯 置信度 {(item.confidence * 100).toFixed(0)}%</span>}
                <span>🕐 {formatTime(item.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
