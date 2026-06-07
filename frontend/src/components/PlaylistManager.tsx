import React, { useEffect, useState } from 'react';
import { useAudioStore } from '../store/audio';

export const PlaylistManager: React.FC = () => {
  const {
    playlists,
    currentPlaylistId,
    currentPlaylist,
    currentPlaylistSongs,
    fetchPlaylists,
    createPlaylist,
    fetchPlaylistDetail,
    fetchPlaylistSongs,
    updatePlaylist,
    deletePlaylist,
    removeSongFromPlaylist,
    setCurrentPlaylistId,
    setCurrentSongId,
    isFetchingPlaylists,
    isFetchingPlaylistSongs,
    isCreatingPlaylist,
    isUpdatingPlaylist,
    isDeletingPlaylist,
    isRemovingSongFromPlaylist,
    playlistError,
  } = useAudioStore();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  useEffect(() => {
    if (currentPlaylistId) {
      fetchPlaylistDetail(currentPlaylistId);
      fetchPlaylistSongs(currentPlaylistId);
    }
  }, [currentPlaylistId, fetchPlaylistDetail, fetchPlaylistSongs]);

  const formatDuration = (sec: number | null) => {
    if (!sec) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleCreatePlaylist = async () => {
    if (!newName.trim()) return;
    const success = await createPlaylist(newName.trim(), newDescription.trim() || null);
    if (success) {
      setNewName('');
      setNewDescription('');
      setShowCreateForm(false);
    }
  };

  const handleStartEdit = () => {
    if (currentPlaylist) {
      setEditName(currentPlaylist.name);
      setEditDescription(currentPlaylist.description || '');
      setEditingPlaylist(currentPlaylist.id);
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !currentPlaylistId) return;
    const success = await updatePlaylist(currentPlaylistId, editName.trim(), editDescription.trim() || null);
    if (success) {
      setEditingPlaylist(null);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!currentPlaylist || !currentPlaylistId) return;
    if (!confirm(`确定要删除歌单「${currentPlaylist.name}」吗？删除后无法恢复。`)) {
      return;
    }
    const success = await deletePlaylist(currentPlaylistId);
    if (success) {
      setCurrentPlaylistId(null);
    }
  };

  const handleRemoveSong = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentPlaylistId) return;
    if (!confirm('确定要从歌单中移除这首歌曲吗？')) {
      return;
    }
    await removeSongFromPlaylist(currentPlaylistId, songId);
  };

  if (currentPlaylistId && currentPlaylist) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button
            onClick={() => setCurrentPlaylistId(null)}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              background: '#fff',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            ← 返回
          </button>
          <h3 style={{ margin: 0, fontSize: '20px', flex: 1 }}>🎵 {currentPlaylist.name}</h3>
        </div>

        {editingPlaylist === currentPlaylistId ? (
          <div style={{
            padding: '16px',
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            marginBottom: '20px',
          }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
                歌单名称
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
                placeholder="输入歌单名称"
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
                描述
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  minHeight: '60px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
                placeholder="添加歌单描述（可选）"
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSaveEdit}
                disabled={isUpdatingPlaylist || !editName.trim()}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: isUpdatingPlaylist || !editName.trim() ? '#bdbdbd' : '#1976d2',
                  color: '#fff',
                  borderRadius: '4px',
                  cursor: isUpdatingPlaylist || !editName.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                {isUpdatingPlaylist ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => setEditingPlaylist(null)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  background: '#fff',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            padding: '16px',
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            marginBottom: '20px',
          }}>
            {currentPlaylist.description && (
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                {currentPlaylist.description}
              </div>
            )}
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px' }}>
              共 {currentPlaylist.song_count} 首歌曲 · 创建于 {new Date(currentPlaylist.created_at).toLocaleDateString()}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleStartEdit}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #ddd',
                  background: '#fff',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ✏️ 编辑
              </button>
              <button
                onClick={handleDeletePlaylist}
                disabled={isDeletingPlaylist}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #ffcdd2',
                  background: '#fff',
                  color: '#c62828',
                  borderRadius: '4px',
                  cursor: isDeletingPlaylist ? 'wait' : 'pointer',
                  fontSize: '12px',
                }}
              >
                {isDeletingPlaylist ? '删除中...' : '🗑️ 删除歌单'}
              </button>
            </div>
          </div>
        )}

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '16px' }}>歌单歌曲 ({currentPlaylistSongs.length})</h4>
            <button
              onClick={() => fetchPlaylistSongs(currentPlaylistId)}
              disabled={isFetchingPlaylistSongs}
              style={{
                padding: '6px 12px',
                border: '1px solid #ddd',
                background: '#fff',
                borderRadius: '4px',
                cursor: isFetchingPlaylistSongs ? 'wait' : 'pointer',
                fontSize: '12px',
              }}
            >
              🔄 刷新
            </button>
          </div>

          {isFetchingPlaylistSongs ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>加载中...</div>
          ) : currentPlaylistSongs.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              background: '#fff',
              borderRadius: '8px',
              color: '#999',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📂</div>
              <div>歌单还没有歌曲，去识别页面添加喜欢的歌曲吧！</div>
            </div>
          ) : (
            currentPlaylistSongs.map((song) => (
              <div
                key={song.song_id}
                onClick={() => setCurrentSongId(song.song_id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                  marginBottom: '8px', borderRadius: '8px', border: '1px solid #e0e0e0',
                  background: '#fff', cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '8px',
                  background: '#e8eaf6', color: '#1976d2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', flexShrink: 0,
                }}>
                  🎵
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: '14px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{song.title}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    {song.artist || '未知艺术家'} · {formatDuration(song.duration_sec)}
                  </div>
                </div>
                <button
                  onClick={(e) => handleRemoveSong(song.song_id, e)}
                  disabled={isRemovingSongFromPlaylist}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #ffcdd2',
                    background: '#fff',
                    color: '#c62828',
                    borderRadius: '4px',
                    cursor: isRemovingSongFromPlaylist ? 'wait' : 'pointer',
                    fontSize: '12px',
                    flexShrink: 0,
                  }}
                >
                  移除
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '20px' }}>🎵 我的歌单</h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: '#1976d2',
            color: '#fff',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          + 新建歌单
        </button>
      </div>

      {playlistError && (
        <div style={{
          padding: '12px',
          background: '#ffebee',
          color: '#c62828',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '14px',
        }}>
          {playlistError}
        </div>
      )}

      {showCreateForm && (
        <div style={{
          padding: '16px',
          background: '#fff',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          marginBottom: '20px',
        }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '16px' }}>创建新歌单</h4>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
              歌单名称 *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
              placeholder="输入歌单名称"
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
              描述
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                minHeight: '60px',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
              placeholder="添加歌单描述（可选）"
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCreatePlaylist}
              disabled={isCreatingPlaylist || !newName.trim()}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: isCreatingPlaylist || !newName.trim() ? '#bdbdbd' : '#4caf50',
                color: '#fff',
                borderRadius: '4px',
                cursor: isCreatingPlaylist || !newName.trim() ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              {isCreatingPlaylist ? '创建中...' : '创建'}
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewName('');
                setNewDescription('');
              }}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                background: '#fff',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {isFetchingPlaylists ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>加载中...</div>
      ) : playlists.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          background: '#fff',
          borderRadius: '8px',
          color: '#999',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📁</div>
          <div>还没有歌单，创建第一个歌单吧！</div>
        </div>
      ) : (
        playlists.map((playlist) => (
          <div
            key={playlist.id}
            onClick={() => setCurrentPlaylistId(playlist.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
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
            <div style={{
              width: '50px', height: '50px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', flexShrink: 0,
            }}>
              📂
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 600, fontSize: '15px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{playlist.name}</div>
              {playlist.description && (
                <div style={{
                  fontSize: '12px', color: '#888',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{playlist.description}</div>
              )}
              <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                {playlist.song_count} 首歌曲
              </div>
            </div>
            <div style={{ fontSize: '20px', color: '#999' }}>›</div>
          </div>
        ))
      )}
    </div>
  );
};
