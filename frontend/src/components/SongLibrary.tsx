import React, { useEffect } from 'react';
import { Song } from '../types';
import { useAudioStore } from '../store/audio';
import { SongUploader } from './SongUploader';

export const SongLibrary: React.FC = () => {
  const { songs, fetchSongs } = useAudioStore();

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const formatDuration = (sec: number | null) => {
    if (!sec) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '20px' }}>📚 指纹库</h3>
      <SongUploader />
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '16px' }}>已入库歌曲 ({songs.length})</h4>
          <button
            onClick={fetchSongs}
            style={{
              padding: '6px 12px',
              border: '1px solid #ddd',
              background: '#fff',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            🔄 刷新
          </button>
        </div>
        {songs.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            background: '#fff',
            borderRadius: '8px',
            color: '#999',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎵</div>
            <div>暂无歌曲，上传第一首歌吧！</div>
          </div>
        ) : (
          songs.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
              marginBottom: '8px', borderRadius: '8px', border: '1px solid #e0e0e0',
              background: '#fff',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '8px', background: '#e8eaf6',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
              }}>🎵</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: '14px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{s.title}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                  {s.artist || '未知艺术家'} · {formatDuration(s.duration_sec)}
                </div>
              </div>
              <code style={{
                fontSize: '10px', color: '#999', background: '#f5f5f5',
                padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
              }}>{s.fingerprint_hash}</code>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
