import React, { useState, useRef } from 'react';
import { useAudioStore } from '../store/audio';

export const SongUploader: React.FC = () => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isUploading, uploadError, uploadSuccess, uploadSong, fetchSongs, clearUploadStatus } = useAudioStore();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setTitle(nameWithoutExt);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !selectedFile) return;

    clearUploadStatus();
    const success = await uploadSong(title, artist, selectedFile);
    if (success) {
      await fetchSongs();
      setTitle('');
      setArtist('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    }}>
      <h4 style={{ margin: '0 0 16px', fontSize: '16px' }}>📤 上传新歌曲</h4>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '6px' }}>
            歌曲名称 *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入歌曲名称"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
            required
          />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '6px' }}>
            艺术家
          </label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="输入艺术家名称"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '6px' }}>
            音频文件 (WAV) *
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #ccc',
              borderRadius: '8px',
              padding: '30px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: selectedFile ? '#f0f7ff' : '#fafafa',
              transition: 'all 0.2s',
            }}
          >
            {selectedFile ? (
              <div>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎵</div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{selectedFile.name}</div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
                <div style={{ fontSize: '14px', color: '#666' }}>点击选择或拖拽WAV文件到此处</div>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>仅支持WAV格式</div>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,audio/wav,audio/x-wav"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {uploadError && (
          <div style={{
            padding: '10px 12px',
            background: '#ffebee',
            color: '#c62828',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '13px',
          }}>
            ❌ {uploadError}
          </div>
        )}

        {uploadSuccess && (
          <div style={{
            padding: '10px 12px',
            background: '#e8f5e9',
            color: '#2e7d32',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '13px',
          }}>
            ✅ {uploadSuccess.message}
          </div>
        )}

        <button
          type="submit"
          disabled={!title || !selectedFile || isUploading}
          style={{
            width: '100%',
            padding: '12px',
            background: (!title || !selectedFile || isUploading) ? '#ccc' : '#1976d2',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: (!title || !selectedFile || isUploading) ? 'not-allowed' : 'pointer',
          }}
        >
          {isUploading ? '⏳ 上传并处理中...' : '🚀 上传歌曲'}
        </button>
      </form>
    </div>
  );
};
