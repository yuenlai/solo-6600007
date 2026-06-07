import React, { useState } from 'react';
import { Recorder } from './components/Recorder';
import { SongLibrary } from './components/SongLibrary';
import { RecognitionHistory } from './components/RecognitionHistory';
import { SongDetail } from './components/SongDetail';
import { PendingQueue } from './components/PendingQueue';
import { useAudioStore } from './store/audio';

const App: React.FC = () => {
  const [tab, setTab] = useState<'recognize' | 'library' | 'queue' | 'history'>('recognize');
  const { recognizeResult, currentSongId, setCurrentSongId, pendingSongs } = useAudioStore();

  const pendingCount = pendingSongs.length;

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <nav style={{ width: '200px', background: '#0d1b2a', color: '#fff', padding: '20px 0' }}>
        <h2 style={{ margin: '0 0 20px', padding: '0 16px', fontSize: '15px' }}>🎵 AudioID</h2>
        {[
          { key: 'recognize', label: '🎤 识别' },
          { key: 'library', label: '📚 指纹库' },
          { key: 'queue', label: `⏳ 待处理${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { key: 'history', label: '📋 历史' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => {
              setCurrentSongId(null);
              setTab(t.key as any);
            }}
            style={{
              display: 'block', width: '100%', padding: '12px 16px', border: 'none', textAlign: 'left',
              cursor: 'pointer', background: tab === t.key && !currentSongId ? 'rgba(255,255,255,0.1)' : 'transparent', color: '#fff',
              fontSize: '14px',
            }}
          >{t.label}</button>
        ))}
      </nav>
      <main style={{ flex: 1, overflow: 'auto', background: '#fafafa' }}>
        {currentSongId ? (
          <SongDetail />
        ) : (
          <>
            {tab === 'recognize' && (
              <div>
                <Recorder />
                {recognizeResult && (
                  <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px', borderRadius: '12px',
                    background: recognizeResult.match_found ? '#e8f5e9' : '#fff3e0', textAlign: 'center' }}>
                    <div style={{ fontSize: '40px' }}>{recognizeResult.match_found ? '✅' : '❌'}</div>
                    {recognizeResult.match_found && recognizeResult.song ? (
                      <>
                        <div style={{ fontWeight: 600, fontSize: '18px', margin: '8px 0' }}>{recognizeResult.song.title}</div>
                        <div style={{ color: '#666' }}>{recognizeResult.song.artist || '未知艺术家'}</div>
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                          置信度: {(recognizeResult.confidence * 100).toFixed(0)}% · 耗时: {recognizeResult.processing_time_ms}ms
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600, fontSize: '18px', margin: '8px 0' }}>未找到匹配歌曲</div>
                        <div style={{ color: '#666' }}>请尝试上传更清晰的音频片段</div>
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                          耗时: {recognizeResult.processing_time_ms}ms
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            {tab === 'library' && <SongLibrary />}
            {tab === 'queue' && <PendingQueue />}
            {tab === 'history' && <RecognitionHistory />}
          </>
        )}
      </main>
    </div>
  );
};
export default App;
