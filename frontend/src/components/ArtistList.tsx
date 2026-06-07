import React, { useEffect, useState } from 'react';
import { ArtistSummary } from '../types';

const API_BASE = 'http://127.0.0.1:8080/api';

interface ArtistListProps {
  onSelectArtist: (artistName: string) => void;
}

export const ArtistList: React.FC<ArtistListProps> = ({ onSelectArtist }) => {
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArtists = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/artists?limit=100`);
      if (!res.ok) throw new Error('Failed to fetch artists');
      const data = await res.json();
      setArtists(data.artists || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtists();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '暂无';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '20px' }}>🎤 歌手</h3>
        <button
          onClick={fetchArtists}
          disabled={loading}
          style={{
            padding: '6px 12px',
            border: '1px solid #ddd',
            background: '#fff',
            borderRadius: '4px',
            cursor: loading ? 'wait' : 'pointer',
            fontSize: '12px',
          }}
        >
          🔄 刷新
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
          加载中...
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px',
          background: '#ffebee',
          color: '#c62828',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {!loading && !error && artists.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          background: '#fff',
          borderRadius: '8px',
          color: '#999',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎵</div>
          <div>暂无歌手数据，上传歌曲时填写歌手信息即可收录</div>
        </div>
      )}

      {!loading && !error && artists.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {artists.map((artist) => (
            <div
              key={artist.artist}
              onClick={() => onSelectArtist(artist.artist)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 16px',
                background: '#fff',
                borderRadius: '10px',
                border: '1px solid #e8e8e8',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fafafa';
                e.currentTarget.style.borderColor = '#d0d0d0';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.borderColor = '#e8e8e8';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 600,
                flexShrink: 0,
              }}>
                {getInitials(artist.artist)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: '15px',
                  color: '#212121',
                  marginBottom: '4px',
                }}>
                  {artist.artist}
                </div>
                <div style={{ fontSize: '12px', color: '#757575' }}>
                  {artist.song_count} 首歌曲 · 被识别 {artist.total_recognitions} 次
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '11px', color: '#9e9e9e' }}>最近活跃</div>
                <div style={{ fontSize: '12px', color: '#616161', fontWeight: 500 }}>
                  {formatDate(artist.last_recognition_at)}
                </div>
              </div>
              <div style={{ color: '#bdbdbd', fontSize: '18px', flexShrink: 0 }}>
                ›
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
