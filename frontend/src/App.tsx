import React, { useState, useEffect } from 'react';
import { Recorder } from './components/Recorder';
import { CompareRecorder } from './components/CompareRecorder';
import { SongLibrary } from './components/SongLibrary';
import { RecognitionHistory } from './components/RecognitionHistory';
import { SongDetail } from './components/SongDetail';
import { PendingQueue } from './components/PendingQueue';
import { FailedSamples } from './components/FailedSamples';
import { PlaylistManager } from './components/PlaylistManager';
import { AddToPlaylist } from './components/AddToPlaylist';
import { OnboardingGuide } from './components/OnboardingGuide';
import { OfflineDrafts } from './components/OfflineDrafts';
import { ReviewTasks } from './components/ReviewTasks';
import { ArtistList } from './components/ArtistList';
import { ArtistDetail } from './components/ArtistDetail';
import { useAudioStore } from './store/audio';
import { RecognizeResult } from './types';

const getMatchStatusInfo = (result: RecognizeResult) => {
  if (result.match_found) {
    const confidence = result.confidence;
    if (confidence >= 0.6) {
      return {
        label: '精确匹配',
        description: '音频指纹特征高度吻合，识别结果可靠',
        color: '#2e7d32',
        bgColor: '#e8f5e9'
      };
    } else if (confidence >= 0.3) {
      return {
        label: '可能匹配',
        description: '音频指纹特征有一定相似度，建议进一步确认',
        color: '#f57c00',
        bgColor: '#fff3e0'
      };
    } else {
      return {
        label: '低置信度匹配',
        description: '音频指纹特征相似度较低，结果可能不准确',
        color: '#e65100',
        bgColor: '#fff8e1'
      };
    }
  } else {
    return {
      label: '未找到匹配',
      description: '数据库中未找到匹配的音频指纹',
      color: '#c62828',
      bgColor: '#ffebee'
    };
  }
};

const getConfidenceInterpretation = (confidence: number, matchFound: boolean) => {
  if (!matchFound) {
    return {
      level: '无匹配',
      description: '未能在曲库中找到匹配的歌曲',
      details: [
        '可能原因：音频质量差、背景噪音大、歌曲未录入曲库',
        '建议：尝试使用更清晰的音频片段，或检查歌曲是否已添加到曲库'
      ]
    };
  }
  
  const percent = Math.round(confidence * 100);
  
  if (confidence >= 0.8) {
    return {
      level: '极高置信度',
      description: `识别置信度 ${percent}%，结果非常可靠`,
      details: [
        '音频指纹特征高度吻合',
        '可以直接使用识别结果，无需人工复核',
        '适合用于自动识别场景'
      ]
    };
  } else if (confidence >= 0.6) {
    return {
      level: '高置信度',
      description: `识别置信度 ${percent}%，结果较为可靠`,
      details: [
        '音频指纹特征匹配度较好',
        '建议简单人工确认后使用',
        '可用于大多数常规识别场景'
      ]
    };
  } else if (confidence >= 0.4) {
    return {
      level: '中等置信度',
      description: `识别置信度 ${percent}%，结果有一定参考价值`,
      details: [
        '音频指纹特征有一定相似度，但可能存在误差',
        '建议人工复核确认',
        '可结合相似歌曲推荐综合判断'
      ]
    };
  } else if (confidence >= 0.2) {
    return {
      level: '低置信度',
      description: `识别置信度 ${percent}%，结果仅供参考`,
      details: [
        '音频指纹特征相似度较低',
        '强烈建议人工复核，或重新录制音频',
        '可参考相似歌曲推荐'
      ]
    };
  } else {
    return {
      level: '极低置信度',
      description: `识别置信度 ${percent}%，结果可能不准确`,
      details: [
        '音频指纹特征相似度很低',
        '不建议直接使用该结果',
        '建议重新录制更清晰的音频片段再次识别',
        '检查歌曲是否已正确录入曲库'
      ]
    };
  }
};

const getNextSteps = (result: RecognizeResult) => {
  const steps: string[] = [];
  
  if (result.match_found) {
    steps.push('✅ 确认识别结果是否正确');
    
    if (result.confidence >= 0.6) {
      steps.push('⭐ 可将歌曲收藏到歌单以便后续使用');
      steps.push('📋 可在历史记录中查看该识别记录');
    } else {
      steps.push('🔍 查看相似歌曲推荐，可能有更匹配的结果');
      steps.push('🎤 建议重新录制更清晰的音频再次识别');
      steps.push('⚙️ 考虑创建复检任务进行人工审核');
    }
    
    if (result.song) {
      steps.push('📚 点击歌曲可查看详细信息和识别历史');
    }
  } else {
    steps.push('🎤 尝试录制更长、更清晰的音频片段');
    steps.push('🔇 确保录音环境安静，减少背景噪音');
    steps.push('📚 检查歌曲是否已添加到指纹库中');
    steps.push('⭐ 可将该失败样本提升为新歌曲录入曲库');
    steps.push('🔄 调整麦克风位置或音量后再次尝试');
  }
  
  return steps;
};

const App: React.FC = () => {
  const [tab, setTab] = useState<'recognize' | 'compare' | 'library' | 'artists' | 'queue' | 'history' | 'failed' | 'playlists' | 'drafts' | 'review'>('recognize');
  const { 
    recognizeResult, 
    setRecognizeResult,
    currentSongId, 
    setCurrentSongId, 
    pendingSongs, 
    failedSamples, 
    currentPlaylistId,
    isOnline,
    setOnlineStatus,
    loadOfflineDrafts,
    offlineDrafts,
    syncOfflineDrafts,
  } = useAudioStore();
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [addToPlaylistSong, setAddToPlaylistSong] = useState<{ id: string; title: string } | null>(null);
  const [currentArtistName, setCurrentArtistName] = useState<string | null>(null);

  const pendingCount = pendingSongs.length;
  const failedCount = failedSamples.length;
  const draftsCount = offlineDrafts.filter(d => d.status === 'pending' || d.status === 'failed').length;

  useEffect(() => {
    loadOfflineDrafts();
  }, [loadOfflineDrafts]);

  useEffect(() => {
    const handleOnline = async () => {
      setOnlineStatus(true);
      const pendingDrafts = offlineDrafts.filter(d => d.status === 'pending' || d.status === 'failed');
      if (pendingDrafts.length > 0) {
        await syncOfflineDrafts();
      }
    };
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnlineStatus, offlineDrafts, syncOfflineDrafts]);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <nav style={{ width: '200px', background: '#0d1b2a', color: '#fff', padding: '20px 0', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ margin: '0 0 20px', padding: '0 16px', fontSize: '15px' }}>🎵 AudioID</h2>
        
        {!isOnline && (
          <div style={{
            margin: '0 16px 16px',
            padding: '8px 12px',
            background: '#e65100',
            borderRadius: '6px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span>📡</span>
            <span>网络已断开</span>
          </div>
        )}
        
        {draftsCount > 0 && (
          <div style={{
            margin: '0 16px 16px',
            padding: '8px 12px',
            background: '#1565c0',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
          onClick={() => setTab('drafts')}
          >
            <span>📝</span>
            <span>{draftsCount} 条待补交</span>
          </div>
        )}

        {[
          { key: 'recognize', label: '🎤 识别', onboarding: 'recognize' },
          { key: 'compare', label: '🔄 对比识别' },
          { key: 'library', label: '📚 指纹库', onboarding: 'library' },
          { key: 'artists', label: '🎤 歌手' },
          { key: 'playlists', label: '🎵 歌单收藏' },
          { key: 'queue', label: `⏳ 待处理${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { key: 'failed', label: `🗑️ 失败样本${failedCount > 0 ? ` (${failedCount})` : ''}` },
          { key: 'drafts', label: `📝 离线草稿${draftsCount > 0 ? ` (${draftsCount})` : ''}` },
          { key: 'history', label: '📋 历史', onboarding: 'history' },
          { key: 'review', label: '🔍 结果复检' },
        ].map(t => (
          <button
            key={t.key}
            data-onboarding={t.onboarding}
            onClick={() => {
              setCurrentSongId(null);
              setCurrentArtistName(null);
              setTab(t.key as any);
            }}
            style={{
              display: 'block', width: '100%', padding: '12px 16px', border: 'none', textAlign: 'left',
              cursor: 'pointer',
              background: (tab === t.key && !currentSongId && !currentPlaylistId && !currentArtistName) ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: '#fff',
              fontSize: '14px',
            }}
          >{t.label}</button>
        ))}
      </nav>
      <main style={{ flex: 1, overflow: 'auto', background: '#fafafa' }}>
        {currentSongId ? (
          <SongDetail />
        ) : currentArtistName ? (
          <ArtistDetail
            artistName={currentArtistName}
            onBack={() => setCurrentArtistName(null)}
          />
        ) : currentPlaylistId || tab === 'playlists' ? (
          <PlaylistManager />
        ) : (
          <>
            {tab === 'recognize' && (
              <div>
                <Recorder />
                
                <div style={{ maxWidth: '560px', margin: '20px auto', padding: '16px', background: '#f5f5f5', borderRadius: '12px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#333' }}>🧪 测试识别结果（验证 UI 展示）</h4>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setRecognizeResult({
                        match_found: true,
                        song: { id: 'test-1', title: '测试歌曲 - 高置信度', artist: '测试艺术家', duration_sec: 180 },
                        confidence: 0.85,
                        processing_time_ms: 120,
                        similar_songs: [
                          { id: 'sim-1', title: '相似歌曲1', artist: '艺术家A', duration_sec: 200, similarity_score: 0.72, reason: '旋律相似' },
                          { id: 'sim-2', title: '相似歌曲2', artist: '艺术家B', duration_sec: 195, similarity_score: 0.65, reason: '节奏相似' }
                        ]
                      })}
                      style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '6px', border: 'none', background: '#2e7d32', color: '#fff', cursor: 'pointer' }}
                    >
                      高置信度 (85%)
                    </button>
                    <button
                      onClick={() => setRecognizeResult({
                        match_found: true,
                        song: { id: 'test-2', title: '测试歌曲 - 中等置信度', artist: '测试艺术家', duration_sec: 210 },
                        confidence: 0.45,
                        processing_time_ms: 150,
                        similar_songs: [
                          { id: 'sim-3', title: '相似歌曲3', artist: '艺术家C', duration_sec: 188, similarity_score: 0.55, reason: '同流派' }
                        ]
                      })}
                      style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '6px', border: 'none', background: '#f57c00', color: '#fff', cursor: 'pointer' }}
                    >
                      中等置信度 (45%)
                    </button>
                    <button
                      onClick={() => setRecognizeResult({
                        match_found: true,
                        song: { id: 'test-3', title: '测试歌曲 - 低置信度', artist: '未知艺术家', duration_sec: 160 },
                        confidence: 0.18,
                        processing_time_ms: 200,
                        similar_songs: []
                      })}
                      style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '6px', border: 'none', background: '#e65100', color: '#fff', cursor: 'pointer' }}
                    >
                      低置信度 (18%)
                    </button>
                    <button
                      onClick={() => setRecognizeResult({
                        match_found: false,
                        song: null,
                        confidence: 0,
                        processing_time_ms: 180,
                        similar_songs: []
                      })}
                      style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '6px', border: 'none', background: '#c62828', color: '#fff', cursor: 'pointer' }}
                    >
                      未找到匹配
                    </button>
                    <button
                      onClick={() => setRecognizeResult(null)}
                      style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '6px', border: '1px solid #ccc', background: '#fff', color: '#666', cursor: 'pointer' }}
                    >
                      清除结果
                    </button>
                  </div>
                </div>
                
                {recognizeResult && (
                  <div style={{ maxWidth: '560px', margin: '0 auto' }}>
                    {(() => {
                      const matchStatus = getMatchStatusInfo(recognizeResult);
                      const confidenceInfo = getConfidenceInterpretation(recognizeResult.confidence, recognizeResult.match_found);
                      const nextSteps = getNextSteps(recognizeResult);
                      
                      return (
                        <>
                          <div style={{ padding: '24px', borderRadius: '12px',
                            background: matchStatus.bgColor, textAlign: 'center' }}>
                            <div style={{ fontSize: '40px' }}>{recognizeResult.match_found ? '✅' : '❌'}</div>
                            {recognizeResult.match_found && recognizeResult.song ? (
                              <>
                                <div style={{ fontWeight: 600, fontSize: '20px', margin: '12px 0 4px' }}>{recognizeResult.song.title}</div>
                                <div style={{ color: '#666', fontSize: '14px' }}>{recognizeResult.song.artist || '未知艺术家'}</div>
                                <div style={{ marginTop: '12px', fontSize: '13px', color: '#555' }}>
                                  置信度: {(recognizeResult.confidence * 100).toFixed(0)}% · 耗时: {recognizeResult.processing_time_ms}ms
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (recognizeResult.song) {
                                      setAddToPlaylistSong({ id: recognizeResult.song.id, title: recognizeResult.song.title });
                                      setShowAddToPlaylist(true);
                                    }
                                  }}
                                  style={{
                                    marginTop: '16px',
                                    padding: '10px 24px',
                                    border: 'none',
                                    background: '#ff9800',
                                    color: '#fff',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                  }}
                                >
                                  ⭐ 收藏到歌单
                                </button>
                              </>
                            ) : (
                              <>
                                <div style={{ fontWeight: 600, fontSize: '20px', margin: '12px 0 4px' }}>未找到匹配歌曲</div>
                                <div style={{ color: '#666', fontSize: '14px' }}>请尝试上传更清晰的音频片段</div>
                                <div style={{ marginTop: '12px', fontSize: '13px', color: '#555' }}>
                                  耗时: {recognizeResult.processing_time_ms}ms
                                </div>
                              </>
                            )}
                          </div>

                          <div style={{ marginTop: '16px', padding: '16px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                            <h4 style={{ margin: '0 0 12px', fontSize: '15px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>📊</span> 匹配状态说明
                            </h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: matchStatus.bgColor, borderRadius: '8px' }}>
                              <span style={{ 
                                padding: '4px 12px', 
                                borderRadius: '20px', 
                                background: matchStatus.color,
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: '13px',
                                whiteSpace: 'nowrap'
                              }}>
                                {matchStatus.label}
                              </span>
                              <span style={{ fontSize: '13px', color: '#555' }}>{matchStatus.description}</span>
                            </div>
                          </div>

                          <div style={{ marginTop: '16px', padding: '16px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                            <h4 style={{ margin: '0 0 12px', fontSize: '15px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>📈</span> 置信度区间解读
                            </h4>
                            <div style={{ marginBottom: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <span style={{ 
                                  padding: '3px 10px', 
                                  borderRadius: '12px', 
                                  background: '#1565c020',
                                  color: '#1565c0',
                                  fontWeight: 600,
                                  fontSize: '12px'
                                }}>
                                  {confidenceInfo.level}
                                </span>
                                <span style={{ fontSize: '13px', color: '#444', fontWeight: 500 }}>{confidenceInfo.description}</span>
                              </div>
                              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#666' }}>
                                {confidenceInfo.details.map((detail, idx) => (
                                  <li key={idx} style={{ marginBottom: '4px' }}>{detail}</li>
                                ))}
                              </ul>
                            </div>
                            <div style={{ 
                              height: '8px', 
                              background: '#e0e0e0', 
                              borderRadius: '4px',
                              overflow: 'hidden',
                              marginTop: '10px'
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${recognizeResult.match_found ? recognizeResult.confidence * 100 : 0}%`,
                                background: recognizeResult.confidence >= 0.6 
                                  ? 'linear-gradient(90deg, #4caf50, #2e7d32)' 
                                  : recognizeResult.confidence >= 0.3 
                                    ? 'linear-gradient(90deg, #ff9800, #f57c00)'
                                    : 'linear-gradient(90deg, #ff5722, #e53935)',
                                transition: 'width 0.5s ease',
                              }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: '#999' }}>
                              <span>0%</span>
                              <span>25%</span>
                              <span>50%</span>
                              <span>75%</span>
                              <span>100%</span>
                            </div>
                          </div>

                          <div style={{ marginTop: '16px', padding: '16px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                            <h4 style={{ margin: '0 0 12px', fontSize: '15px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>💡</span> 下一步建议
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: '20px' }}>
                              {nextSteps.map((step, idx) => (
                                <li key={idx} style={{ 
                                  fontSize: '13px', 
                                  color: '#555', 
                                  marginBottom: '8px',
                                  lineHeight: '1.5'
                                }}>{step}</li>
                              ))}
                            </ul>
                          </div>

                          {recognizeResult.match_found && recognizeResult.similar_songs && recognizeResult.similar_songs.length > 0 && (
                            <div style={{ marginTop: '16px', padding: '16px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                              <h3 style={{ margin: '0 0 12px', fontSize: '16px', color: '#333' }}>🎵 相似歌曲推荐</h3>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {recognizeResult.similar_songs.map((song) => (
                                  <div
                                    key={song.id}
                                    onClick={() => {
                                      setCurrentSongId(song.id);
                                      setTab('library');
                                    }}
                                    style={{
                                      padding: '12px',
                                      background: '#f5f5f5',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      transition: 'background 0.2s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#e8e8e8'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div>
                                        <div style={{ fontWeight: 500, fontSize: '14px' }}>{song.title}</div>
                                        <div style={{ fontSize: '12px', color: '#666' }}>{song.artist || '未知艺术家'}</div>
                                      </div>
                                      <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '11px', color: '#2196f3', fontWeight: 500 }}>
                                          相似度 {(song.similarity_score * 100).toFixed(0)}%
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#999' }}>{song.reason}</div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
            {tab === 'compare' && <CompareRecorder />}
            {tab === 'library' && <SongLibrary />}
            {tab === 'artists' && (
              <ArtistList
                onSelectArtist={(artistName) => {
                  setCurrentArtistName(artistName);
                }}
              />
            )}
            {tab === 'queue' && <PendingQueue />}
            {tab === 'failed' && <FailedSamples />}
            {tab === 'drafts' && <OfflineDrafts />}
            {tab === 'history' && <RecognitionHistory />}
            {tab === 'review' && <ReviewTasks />}
          </>
        )}
      </main>
      {showAddToPlaylist && addToPlaylistSong && (
        <AddToPlaylist
          songId={addToPlaylistSong.id}
          songTitle={addToPlaylistSong.title}
          onClose={() => {
            setShowAddToPlaylist(false);
            setAddToPlaylistSong(null);
          }}
        />
      )}
      <OnboardingGuide />
    </div>
  );
};
export default App;
