import React from 'react';
import { Song } from '../types';

const mockSongs: Song[] = [
  { id: '1', title: 'Midnight Rain', artist: 'Luna Wave', fingerprint_hash: 'a3f2c8d1', duration_sec: 234 },
  { id: '2', title: 'Electric Dreams', artist: 'Neon Pulse', fingerprint_hash: 'b7e1f4a9', duration_sec: 198 },
  { id: '3', title: 'Mountain Echo', artist: 'Terra Sound', fingerprint_hash: 'c9d3b6e2', duration_sec: 312 },
];

export const SongLibrary: React.FC = () => (
  <div style={{ padding: '20px' }}>
    <h3 style={{ margin: '0 0 16px' }}>🎵 指纹库</h3>
    {mockSongs.map(s => (
      <div key={s.id} style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
        marginBottom: '8px', borderRadius: '8px', border: '1px solid #e0e0e0'
      }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#e8eaf6',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🎵</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>{s.title}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>{s.artist} · {Math.floor(s.duration_sec / 60)}:{String(s.duration_sec % 60).padStart(2, '0')}</div>
        </div>
        <code style={{ fontSize: '10px', color: '#999', background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px' }}>{s.fingerprint_hash}</code>
      </div>
    ))}
  </div>
);
