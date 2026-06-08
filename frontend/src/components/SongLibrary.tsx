import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Song, SongStatus, AudioSource } from '../types';
import { useAudioStore } from '../store/audio';
import { SongUploader } from './SongUploader';

const API_BASE = 'http://127.0.0.1:8080/api';

interface SongLibraryProps {
  onNavigateToRecognize?: () => void;
}

export const SongLibrary: React.FC<SongLibraryProps> = ({ onNavigateToRecognize }) => {
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
  const uploaderRef = useRef<HTMLDivElement | null>(null);

  const sortOptions = [
    { value: 'created_at', label: '录入时间' },
    { value: 'duration', label: '歌曲时长' },
    { value: 'popularity', label: '识别热度' },
  ];

  useEffect(() => {
    fetchSongs(localSortBy);
  }, [fetchSongs, localSortBy]);

  const handleScrollToUploader = useCallback(() => {
    if (uploaderRef.current) {
      uploaderRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const getStatusStyle = (status?: SongStatus) => {
    switch (status) {
      case 'completed':
        return { bg: '#e8f5e9', color: '#2e7d32', label: '已完成' };
      case 'processing':
        return { bg: '#e3f2fd', color: '#1565c0', label: '处理中' };
      case 'pending':
        return { bg: '#fff3e0', color: '#e65100', label: '待处理' };
      case 'failed':
        return { bg: '#ffebee', color: '#c62828', label: '失败' };
      default:
        return { bg: '#f5f5f5', color: '#666', label: '未知' };
    }
  };

  const getSourceInfo = (source?: AudioSource | null) => {
    switch (source) {
      case 'microphone':
        return { icon: '🎤', label: '录音' };
      case 'file':
        return { icon: '📁', label: '文件' };
      case 'batch_import':
        return { icon: '📦', label: '批量' };
      case 'review':
        return { icon: '🔍', label: '审核' };
      case 'promoted':
        return { icon: '⬆️', label: '提升' };
      default:
        return { icon: '📎', label: '其他' };
    }
  };

  const getFingerprintInfo = (song: Song) => {
    const peaksCount = song.fingerprint_peaks
      ? (JSON.parse(song.fingerprint_peaks) as unknown[]).length
      : 0;
    const robustCount = song.fingerprint_robust
      ? (JSON.parse(song.fingerprint_robust) as unknown[]).length
      : 0;
    return { peaksCount, robustCount };
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
      <div ref={uploaderRef}>
        <SongUploader />
      </div>
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
          searchQuery.trim() ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              background: '#fff',
              borderRadius: '8px',
              color: '#999',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
              <div>未找到匹配的歌曲</div>
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
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '32px 20px',
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>
                指纹库还是空的
              </div>
              <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px', lineHeight: '1.6' }}>
                上传歌曲到指纹库后，即可通过音频识别找到匹配的歌曲
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={handleScrollToUploader}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    border: 'none',
                    background: '#1976d2',
                    color: '#fff',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#1565c0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#1976d2'; }}
                >
                  <span style={{ fontSize: '16px' }}>📤</span>
                  上传歌曲
                </button>
                {onNavigateToRecognize && (
                  <button
                    onClick={onNavigateToRecognize}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 20px',
                      border: '1px solid #ddd',
                      background: '#fff',
                      color: '#555',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#1976d2';
                      e.currentTarget.style.color = '#1976d2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#ddd';
                      e.currentTarget.style.color = '#555';
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>🎤</span>
                    前往识别
                  </button>
                )}
              </div>
              <div style={{
                marginTop: '20px',
                padding: '12px 16px',
                background: '#f5f5f5',
                borderRadius: '8px',
                textAlign: 'left',
              }}>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '6px', fontWeight: 500 }}>使用提示</div>
                <div style={{ fontSize: '12px', color: '#777', lineHeight: '1.8' }}>
                  <div>1. 点击「上传歌曲」上传 WAV 音频文件到指纹库</div>
                  <div>2. 上传完成后系统自动提取音频指纹特征</div>
                  <div>3. 点击「前往识别」录制音频进行歌曲识别</div>
                </div>
              </div>
            </div>
          )
        ) : (
          displaySongs.map(s => {
            const statusStyle = getStatusStyle(s.status);
            const sourceInfo = getSourceInfo(s.source);
            const fpInfo = getFingerprintInfo(s);
            const dateStr = formatDate(s.created_at);

            return (
              <div
                key={s.id}
                onClick={() => setCurrentSongId(s.id)}
                style={{
                  padding: '12px',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{
                        fontWeight: 600, fontSize: '14px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, minWidth: 0,
                      }}>{s.title}</span>
                      {s.status && (
                        <span style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          background: statusStyle.bg,
                          color: statusStyle.color,
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}>{statusStyle.label}</span>
                      )}
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        background: '#f3e5f5',
                        color: '#7b1fa2',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}>{sourceInfo.icon} {sourceInfo.label}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>
                      {s.artist || '未知艺术家'} · {formatDuration(s.duration_sec)}{dateStr ? ` · 📅 ${dateStr}` : ''}
                    </div>
                    <div style={{ fontSize: '11px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>🔐 特征点: {fpInfo.peaksCount}</span>
                      <span>🛡️ 鲁棒: {fpInfo.robustCount}</span>
                    </div>
                  </div>
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
