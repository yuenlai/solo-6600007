import React, { useEffect, useState } from 'react';
import { ArtistDetail as ArtistDetailType, ArtistSong, ArtistRecentActivity } from '../types';
import { useAudioStore } from '../store/audio';

const API_BASE = 'http://127.0.0.1:8080/api';

interface ArtistDetailProps {
  artistName: string;
  onBack: () => void;
}

export const ArtistDetail: React.FC<ArtistDetailProps> = ({ artistName, onBack }) => {
  const { setCurrentSongId } = useAudioStore();
  const [artist, setArtist] = useState<ArtistDetailType | null>(null);
  const [songs, setSongs] = useState<ArtistSong[]>([]);
  const [activities, setActivities] = useState<ArtistRecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'songs' | 'activity'>('songs');

  const fetchArtistData = async () => {
    setLoading(true);
    setError(null);
    try {
      const encodedName = encodeURIComponent(artistName);
      const [artistRes, songsRes, activityRes] = await Promise.all([
        fetch(`${API_BASE}/artists/${encodedName}`),
        fetch(`${API_BASE}/artists/${encodedName}/songs`),
        fetch(`${API_BASE}/artists/${encodedName}/activity?limit=30`),
      ]);

      if (!artistRes.ok) throw new Error('Failed to fetch artist info');
      const artistData = await artistRes.json();
      setArtist(artistData);

      if (songsRes.ok) {
        const songsData = await songsRes.json();
        setSongs(songsData.songs || []);
      }

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivities(activityData.activities || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtistData();
  }, [artistName]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '暂无';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (sec: number | null) => {
    if (!sec) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
        加载中...
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div style={{ padding: '20px' }}>
        <button
          onClick={onBack}
          style={{
            marginBottom: '16px',
            padding: '8px 16px',
            border: '1px solid #ddd',
            background: '#fff',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          ← 返回歌手列表
        </button>
        <div style={{
          padding: '40px 20px',
          background: '#fff',
          borderRadius: '8px',
          textAlign: 'center',
          color: '#999',
        }}>
          {error || '未找到该歌手信息'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
      <button
        onClick={onBack}
        style={{
          marginBottom: '16px',
          padding: '6px 12px',
          border: '1px solid #ddd',
          background: '#fff',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        ← 返回歌手列表
      </button>

      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px',
        padding: '24px',
        color: '#fff',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: 700,
          }}>
            {getInitials(artist.artist)}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>{artist.artist}</h2>
            <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '4px' }}>
              首次收录: {formatDate(artist.first_seen_at)}
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginTop: '20px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>{artist.song_count}</div>
            <div style={{ fontSize: '12px', opacity: 0.85 }}>收录歌曲</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>{artist.total_recognitions}</div>
            <div style={{ fontSize: '12px', opacity: 0.85 }}>被识别次数</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>
              {artist.last_recognition_at ? '活跃' : '暂无'}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.85 }}>
              {artist.last_recognition_at ? formatDate(artist.last_recognition_at) : '识别记录'}
            </div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        borderBottom: '2px solid #e0e0e0',
        marginBottom: '16px',
      }}>
        <button
          onClick={() => setActiveTab('songs')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'songs' ? 600 : 400,
            color: activeTab === 'songs' ? '#667eea' : '#666',
            borderBottom: activeTab === 'songs' ? '2px solid #667eea' : '2px solid transparent',
            marginBottom: '-2px',
            transition: 'all 0.2s',
          }}
        >
          🎵 收录歌曲 ({songs.length})
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'activity' ? 600 : 400,
            color: activeTab === 'activity' ? '#667eea' : '#666',
            borderBottom: activeTab === 'activity' ? '2px solid #667eea' : '2px solid transparent',
            marginBottom: '-2px',
            transition: 'all 0.2s',
          }}
        >
          📊 近期活跃 ({activities.length})
        </button>
      </div>

      {activeTab === 'songs' && (
        <div>
          {songs.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              background: '#fff',
              borderRadius: '8px',
              color: '#999',
            }}>
              暂无收录歌曲
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {songs.map((song, index) => (
                <div
                  key={song.song_id}
                  onClick={() => {
                    setCurrentSongId(song.song_id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    background: '#fff',
                    borderRadius: '8px',
                    border: '1px solid #e8e8e8',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fafafa';
                    e.currentTarget.style.borderColor = '#d0d0d0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#e8e8e8';
                  }}
                >
                  <div style={{
                    width: '28px',
                    textAlign: 'center',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: index < 3 ? '#f57c00' : '#9e9e9e',
                    flexShrink: 0,
                  }}>
                    #{index + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 500,
                      fontSize: '14px',
                      color: '#212121',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {song.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9e9e9e' }}>
                      时长 {formatDuration(song.duration_sec)} · 收录于 {formatDate(song.created_at)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#667eea',
                    }}>
                      {song.recognition_count}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9e9e9e' }}>次识别</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div>
          {activities.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              background: '#fff',
              borderRadius: '8px',
              color: '#999',
            }}>
              暂无识别记录
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    background: '#fff',
                    borderRadius: '8px',
                    border: '1px solid #e8e8e8',
                  }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#e8f5e9',
                    color: '#2e7d32',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    flexShrink: 0,
                  }}>
                    ✅
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 500,
                      fontSize: '14px',
                      color: '#212121',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      识别到: {activity.song_title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9e9e9e' }}>
                      {formatDateTime(activity.created_at)}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#2e7d32',
                    background: '#e8f5e9',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}>
                    {(activity.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
