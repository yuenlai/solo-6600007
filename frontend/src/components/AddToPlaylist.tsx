import React, { useEffect, useState } from 'react';
import { useAudioStore } from '../store/audio';

interface AddToPlaylistProps {
  songId: string;
  songTitle: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddToPlaylist: React.FC<AddToPlaylistProps> = ({ songId, songTitle, onClose, onSuccess }) => {
  const {
    playlists,
    fetchPlaylists,
    createPlaylist,
    addSongToPlaylist,
    isCreatingPlaylist,
    isAddingSongToPlaylist,
  } = useAudioStore();

  const [showNewPlaylistForm, setShowNewPlaylistForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const handleAddToPlaylist = async (playlistId: string, playlistName: string) => {
    setSelectedPlaylistId(playlistId);
    const success = await addSongToPlaylist(playlistId, songId);
    if (success) {
      setSuccessMessage(`已添加到「${playlistName}」`);
      setTimeout(() => {
        setSuccessMessage(null);
        onSuccess?.();
        onClose();
      }, 1000);
    }
    setSelectedPlaylistId(null);
  };

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) return;
    const success = await createPlaylist(newPlaylistName.trim(), newPlaylistDesc.trim() || null);
    if (success) {
      setTimeout(async () => {
        await fetchPlaylists();
        const latestPlaylist = playlists[0];
        if (latestPlaylist) {
          await handleAddToPlaylist(latestPlaylist.id, newPlaylistName.trim());
        }
      }, 100);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '400px',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>收藏到歌单</h3>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#999',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{
          padding: '12px 20px',
          background: '#f5f5f5',
          borderBottom: '1px solid #e0e0e0',
          fontSize: '14px',
        }}>
          <span style={{ color: '#666' }}>歌曲：</span>
          <span style={{ fontWeight: 500 }}>{songTitle}</span>
        </div>

        {successMessage && (
          <div style={{
            padding: '12px 20px',
            background: '#e8f5e9',
            color: '#2e7d32',
            fontSize: '14px',
            textAlign: 'center',
          }}>
            ✅ {successMessage}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {!showNewPlaylistForm && (
            <div style={{ padding: '8px 20px' }}>
              <button
                onClick={() => setShowNewPlaylistForm(true)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px dashed #bdbdbd',
                  background: '#fff',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '18px' }}>+</span>
                新建歌单
              </button>
            </div>
          )}

          {showNewPlaylistForm && (
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ marginBottom: '10px' }}>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="歌单名称"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <textarea
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  placeholder="描述（可选）"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    minHeight: '50px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleCreateAndAdd}
                  disabled={isCreatingPlaylist || !newPlaylistName.trim()}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: 'none',
                    background: isCreatingPlaylist || !newPlaylistName.trim() ? '#bdbdbd' : '#4caf50',
                    color: '#fff',
                    borderRadius: '4px',
                    cursor: isCreatingPlaylist || !newPlaylistName.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                  }}
                >
                  {isCreatingPlaylist ? '创建中...' : '创建并添加'}
                </button>
                <button
                  onClick={() => {
                    setShowNewPlaylistForm(false);
                    setNewPlaylistName('');
                    setNewPlaylistDesc('');
                  }}
                  style={{
                    padding: '8px 12px',
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

          {playlists.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '30px 20px',
              color: '#999',
              fontSize: '14px',
            }}>
              还没有歌单，点击上方创建
            </div>
          ) : (
            playlists.map((playlist) => (
              <div
                key={playlist.id}
                onClick={() => handleAddToPlaylist(playlist.id, playlist.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 20px',
                  cursor: selectedPlaylistId === playlist.id || isAddingSongToPlaylist ? 'default' : 'pointer',
                  background: selectedPlaylistId === playlist.id ? '#e8f5e9' : 'transparent',
                  opacity: isAddingSongToPlaylist && selectedPlaylistId !== playlist.id ? 0.5 : 1,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (selectedPlaylistId !== playlist.id && !isAddingSongToPlaylist) {
                    e.currentTarget.style.background = '#f5f5f5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedPlaylistId !== playlist.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '16px',
                  flexShrink: 0,
                }}>
                  📂
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {playlist.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {playlist.song_count} 首歌曲
                  </div>
                </div>
                {selectedPlaylistId === playlist.id && isAddingSongToPlaylist && (
                  <div style={{ fontSize: '14px', color: '#4caf50' }}>添加中...</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
