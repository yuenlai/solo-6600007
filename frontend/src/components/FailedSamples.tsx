import React, { useEffect, useRef, useState } from 'react';
import { FailedSample } from '../types';
import { useAudioStore } from '../store/audio';

const API_BASE = 'http://127.0.0.1:8080/api';

interface PromoteDialogProps {
  sample: FailedSample;
  onClose: () => void;
  onConfirm: (title: string, artist: string | null) => void;
  isLoading: boolean;
}

const PromoteDialog: React.FC<PromoteDialogProps> = ({ sample, onClose, onConfirm, isLoading }) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onConfirm(title.trim(), artist.trim() || null);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>📥 补充入库</h3>
        <p style={{ fontSize: '13px', color: '#666', margin: '0 0 16px' }}>
          将该失败样本添加到歌曲指纹库中
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>
              歌曲名称 <span style={{ color: '#f44336' }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入歌曲名称"
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #ddd',
                borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box',
              }}
              autoFocus
              disabled={isLoading}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>
              艺术家
            </label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="请输入艺术家（可选）"
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #ddd',
                borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box',
              }}
              disabled={isLoading}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: '8px 16px', border: '1px solid #ddd', background: '#fff',
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading || !title.trim()}
              style={{
                padding: '8px 16px', border: 'none',
                background: isLoading || !title.trim() ? '#bdbdbd' : '#1976d2',
                color: '#fff', borderRadius: '6px', cursor: isLoading || !title.trim() ? 'not-allowed' : 'pointer',
                fontSize: '13px',
              }}
            >
              {isLoading ? '入库中...' : '确认入库'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const FailedSamples: React.FC = () => {
  const {
    failedSamples,
    fetchFailedSamples,
    deleteFailedSample,
    promoteFailedSample,
    fetchSongs,
    isFetchingFailedSamples,
    isPromotingSample,
  } = useAudioStore();
  const [playingSampleId, setPlayingSampleId] = useState<string | null>(null);
  const [deletingSampleId, setDeletingSampleId] = useState<string | null>(null);
  const [promotingSampleId, setPromotingSampleId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchFailedSamples();
  }, [fetchFailedSamples]);

  const formatDate = (dateStr: string) => {
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

  const handlePlayPreview = async (sample: FailedSample, e: React.MouseEvent) => {
    e.stopPropagation();

    if (playingSampleId === sample.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingSampleId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const audioUrl = `${API_BASE}/failed-samples/${sample.id}/preview`;
    const audio = new Audio(audioUrl);

    audio.addEventListener('ended', () => {
      setPlayingSampleId(null);
    });

    audio.addEventListener('error', () => {
      console.error('Failed to load sample audio');
      setPlayingSampleId(null);
    });

    audioRef.current = audio;
    setPlayingSampleId(sample.id);

    try {
      await audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      setPlayingSampleId(null);
    }
  };

  const handleDeleteSample = async (sample: FailedSample, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('确定要删除该失败样本吗？删除后无法恢复。')) {
      return;
    }

    setDeletingSampleId(sample.id);
    const success = await deleteFailedSample(sample.id);
    if (success && playingSampleId === sample.id && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingSampleId(null);
    }
    setDeletingSampleId(null);
  };

  const handlePromoteSample = async (title: string, artist: string | null) => {
    if (!promotingSampleId) return;

    const success = await promoteFailedSample(promotingSampleId, title, artist);
    if (success) {
      if (playingSampleId === promotingSampleId && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setPlayingSampleId(null);
      }
      await fetchSongs();
      setPromotingSampleId(null);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '20px' }}>🗑️ 识别失败样本</h3>
        <button
          onClick={fetchFailedSamples}
          disabled={isFetchingFailedSamples}
          style={{
            padding: '6px 12px',
            border: '1px solid #ddd',
            background: '#fff',
            borderRadius: '4px',
            cursor: isFetchingFailedSamples ? 'wait' : 'pointer',
            fontSize: '12px',
          }}
        >
          {isFetchingFailedSamples ? '加载中...' : '🔄 刷新'}
        </button>
      </div>

      {failedSamples.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          background: '#fff',
          borderRadius: '8px',
          color: '#999',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>✨</div>
          <div>暂无识别失败的样本</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>
            当音频识别失败时，样本会自动保存到这里
          </div>
        </div>
      ) : (
        <div>
          <div style={{
            fontSize: '13px',
            color: '#666',
            marginBottom: '12px',
            padding: '8px 12px',
            background: '#fff3e0',
            borderRadius: '6px',
          }}>
            💡 共 {failedSamples.length} 个失败样本，可以试听后补充入库到歌曲库
          </div>
          {failedSamples.map((sample) => (
            <div
              key={sample.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                marginBottom: '8px', borderRadius: '8px', border: '1px solid #e0e0e0',
                background: '#fff', transition: 'all 0.2s',
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
                onClick={(e) => handlePlayPreview(sample, e)}
                disabled={deletingSampleId === sample.id || isPromotingSample}
                style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: playingSampleId === sample.id ? '#ff9800' : '#fff3e0',
                  color: playingSampleId === sample.id ? '#fff' : '#e65100',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', flexShrink: 0,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (playingSampleId !== sample.id && deletingSampleId !== sample.id) {
                    e.currentTarget.style.background = '#ffe0b2';
                  }
                }}
                onMouseLeave={(e) => {
                  if (playingSampleId !== sample.id) {
                    e.currentTarget.style.background = '#fff3e0';
                  }
                }}
              >
                {playingSampleId === sample.id ? '⏸' : '▶'}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 500, fontSize: '13px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: '#333',
                }}>
                  样本 #{sample.id.slice(0, 8)}
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                  {formatDate(sample.created_at)} · 最高置信度: {(sample.best_confidence * 100).toFixed(0)}%
                </div>
              </div>
              <code style={{
                fontSize: '10px', color: '#999', background: '#f5f5f5',
                padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                marginRight: '4px',
              }}>{sample.fingerprint_hash.slice(0, 12)}...</code>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPromotingSampleId(sample.id);
                }}
                disabled={deletingSampleId === sample.id || isPromotingSample}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #c8e6c9',
                  background: '#fff',
                  color: '#2e7d32',
                  borderRadius: '4px',
                  cursor: deletingSampleId === sample.id ? 'wait' : 'pointer',
                  fontSize: '12px',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (deletingSampleId !== sample.id) {
                    e.currentTarget.style.background = '#e8f5e9';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                }}
              >
                📥 入库
              </button>
              <button
                onClick={(e) => handleDeleteSample(sample, e)}
                disabled={deletingSampleId === sample.id || isPromotingSample}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #ffcdd2',
                  background: deletingSampleId === sample.id ? '#ffebee' : '#fff',
                  color: '#c62828',
                  borderRadius: '4px',
                  cursor: deletingSampleId === sample.id ? 'wait' : 'pointer',
                  fontSize: '12px',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (deletingSampleId !== sample.id) {
                    e.currentTarget.style.background = '#ffebee';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                }}
              >
                {deletingSampleId === sample.id ? '删除中...' : '🗑️'}
              </button>
            </div>
          ))}
        </div>
      )}

      {promotingSampleId && (
        <PromoteDialog
          sample={failedSamples.find(s => s.id === promotingSampleId)!}
          onClose={() => setPromotingSampleId(null)}
          onConfirm={handlePromoteSample}
          isLoading={isPromotingSample}
        />
      )}
    </div>
  );
};
