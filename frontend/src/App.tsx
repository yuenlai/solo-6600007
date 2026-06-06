import React, { useState } from 'react';
import { Recorder } from './components/Recorder';
import { SongLibrary } from './components/SongLibrary';
import { useAudioStore } from './store/audio';

const App: React.FC = () => {
  const [tab, setTab] = useState<'recognize' | 'library'>('recognize');
  const { recognizeResult } = useAudioStore();

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <nav style={{ width: '200px', background: '#0d1b2a', color: '#fff', padding: '20px 0' }}>
        <h2 style={{ margin: '0 0 20px', padding: '0 16px', fontSize: '15px' }}>🎵 AudioID</h2>
        {[{ key: 'recognize', label: '🎤 识别' }, { key: 'library', label: '📚 指纹库' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{
            display: 'block', width: '100%', padding: '12px 16px', border: 'none', textAlign: 'left',
            cursor: 'pointer', background: tab === t.key ? 'rgba(255,255,255,0.1)' : 'transparent', color: '#fff'
          }}>{t.label}</button>
        ))}
      </nav>
      <main style={{ flex: 1, overflow: 'auto', background: '#fafafa' }}>
        {tab === 'recognize' && (
          <div>
            <Recorder />
            {recognizeResult && (
              <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px', borderRadius: '12px',
                background: recognizeResult.match ? '#e8f5e9' : '#fff3e0', textAlign: 'center' }}>
                <div style={{ fontSize: '40px' }}>{recognizeResult.match ? '✅' : '❌'}</div>
                <div style={{ fontWeight: 600, fontSize: '18px', margin: '8px 0' }}>{recognizeResult.song.title}</div>
                <div style={{ color: '#666' }}>{recognizeResult.song.artist}</div>
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                  置信度: {(recognizeResult.song.confidence * 100).toFixed(0)}% · 耗时: {recognizeResult.processing_time_ms}ms
                </div>
              </div>
            )}
          </div>
        )}
        {tab === 'library' && <SongLibrary />}
      </main>
    </div>
  );
};
export default App;
