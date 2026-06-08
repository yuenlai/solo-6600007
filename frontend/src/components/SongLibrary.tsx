import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Song } from '../types';
import { useAudioStore } from '../store/audio';
import { SongUploader } from './SongUploader';

const API_BASE = 'http://127.0.0.1:8080/api';

export const SongLibrary: React.FC = () => {
  const { 
    songs, 
    searchResults, 
    searchQuery, 
    isSearching, 
    fetchSongs, 
    searchSongs, 
    setSearchQuery,
    clearSearch,
    setCurrentSongId, 
    deleteSong, 
    isDeletingSong,
    songSortBy
  } = useAudioStore();
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const [localSearchInput, setLocalSearchInput] = useState('');
  const [localSortBy, setLocalSortBy] = useState<string>(songSortBy || 'created_at');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sortOptions = [
    { value: 'created_at', label: '录入时间' },
    { value: 'duration', label: '歌曲时长' },
    { value: 'popularity', label: '识别热度' },
  ];

  useEffect(() => {
    fetchSongs(localSortBy);
  }, [fetchSongs, localSortBy]);

  const handleSortChange = useCallback((sortBy: string) => {
    setLocalSortBy(sortBy);
    fetchSongs(sortBy);
  }, [fetchSongs]);

  const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchInput(value);
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        searchSongs(value);
      }, 300);
    } else {
      clearSearch();
    }
  }, [setSearchQuery, searchSongs, clearSearch]);

  const handleClearSearch = useCallback(() => {
    setLocalSearchInput('');
    clearSearch();
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  }, [clearSearch]);

  const displaySongs = searchQuery.trim() ? searchResults : songs;

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
      await fetchSongs(localSortBy);
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
        <div style={{ marginBottom: '16px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="🔍 搜索歌曲名或歌手名..."
              value={localSearchInput}
              onChange={handleSearchInputChange}
              style={{
                width: '100%',
                padding: '10px 40px 10px 14px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#1976d2';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#ddd';
              }}
            />
            {localSearchInput && (
              <button
                onClick={handleClearSearch}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#999',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            )}
          </div>
          {isSearching && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
              搜索中...
            </div>
          )}
          {searchQuery.trim() && !isSearching && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
              找到 {searchResults.length} 个结果
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '16px' }}>
            {searchQuery.trim() ? '搜索结果' : '已入库歌曲'} ({displaySongs.length})
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!searchQuery.trim() && (
              <div style={{ display: 'flex', border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden' }}>
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSortChange(opt.value)}
                    style={{
                      padding: '4px 10px',
                      border: 'none',
                      background: localSortBy === opt.value ? '#1976d2' : '#fff',
                      color: localSortBy === opt.value ? '#fff' : '#666',
                      cursor: 'pointer',
                      fontSize: '12px',
                      transition: 'all 0.2s',
                      borderRight: opt.value !== 'popularity' ? '1px solid #ddd' : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => fetchSongs(localSortBy)}
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
        </div>
        {displaySongs.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            background: '#fff',
            borderRadius: '8px',
            color: '#999',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>
              {searchQuery.trim() ? '🔍' : '🎵'}
            </div>
            <div>
              {searchQuery.trim() ? '未找到匹配的歌曲' : '暂无歌曲，上传第一首歌吧！'}
            </div>
            {searchQuery.trim() && (
              <button
                onClick={handleClearSearch}
                style={{
                  marginTop: '12px',
                  padding: '6px 16px',
                  border: '1px solid #1976d2',
                  background: '#fff',
                  color: '#1976d2',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                清除搜索
              </button>
            )}
          </div>
        ) : (
          displaySongs.map(s => (
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
