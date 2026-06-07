import React, { useEffect, useRef, useState } from 'react';
import { Song } from '../types';
import { useAudioStore } from '../store/audio';
import { SongUploader } from './SongUploader';

const API_BASE = 'http://127.0.0.1:8080/api';

export const SongLibrary: React.FC = () => {
  const { songs, fetchSongs, setCurrentSongId, deleteSong, isDeletingSong } = useAudioStore();
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const formatDuration = (sec: number | null) => {
    if (!sec) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handlePlayPreview = async (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (playingSongId === song.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingSongId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const audioUrl = `${API_BASE}/songs/${song.id}/preview`;
    const audio = new Audio(audioUrl);
    
    audio.addEventListener('ended', () => {
      setPlayingSongId(null);
    });

    audio.addEventListener('error', () => {
      console.error('Failed to load audio preview');
      setPlayingSongId(null);
    });

    audioRef.current = audio;
    setPlayingSongId(song.id);
    
    try {
      await audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      setPlayingSongId(null);
    }
  };

  const handleDeleteSong = async (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(`确定要删除歌曲「${song.title}」吗？删除后无法恢复。`)) {
      return;
    }

    setDeletingSongId(song.id);
    const success = await deleteSong(song.id);
    if (success) {
      await fetchSongs();
      if (playingSongId === song.id && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setPlayingSongId(null);
      }
    }
    setDeletingSongId(null);
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
            <div
              key={s.id}
              onClick={() => setCurrentSongId(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                marginBottom: '8px', borderRadius: '8px', border: '1px solid #e0e0e0',
                background: '#fff', cursor: 'pointer', transition: 'all 0.2s',
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
              <button
                onClick={(e) => handlePlayPreview(s, e)}
                disabled={deletingSongId === s.id}
                style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: playingSongId === s.id ? '#1976d2' : '#e8eaf6',
                  color: playingSongId === s.id ? '#fff' : '#1976d2',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', flexShrink: 0,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (playingSongId !== s.id) {
                    e.currentTarget.style.background = '#c5cae9';
                  }
                }}
                onMouseLeave={(e) => {
                  if (playingSongId !== s.id) {
                    e.currentTarget.style.background = '#e8eaf6';
                  }
                }}
              >
                {playingSongId === s.id ? '⏸' : '▶'}
              </button>
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
                marginRight: '8px',
              }}>{s.fingerprint_hash}</code>
              <button
                onClick={(e) => handleDeleteSong(s, e)}
                disabled={deletingSongId === s.id || isDeletingSong}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #ffcdd2',
                  background: deletingSongId === s.id ? '#ffebee' : '#fff',
                  color: '#c62828',
                  borderRadius: '4px',
                  cursor: deletingSongId === s.id ? 'wait' : 'pointer',
                  fontSize: '12px',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (deletingSongId !== s.id) {
                    e.currentTarget.style.background = '#ffebee';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                }}
              >
                {deletingSongId === s.id ? '删除中...' : '🗑️ 删除'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
