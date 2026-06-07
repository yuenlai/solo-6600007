import React, { useState, useRef } from 'react';
import { useAudioStore } from '../store/audio';
import { BatchUploadProgress } from '../types';

export const SongUploader: React.FC = () => {
  const [uploadMode, setUploadMode] = useState<'single' | 'batch'>('single');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [batchDefaultArtist, setBatchDefaultArtist] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  const {
    isUploading,
    uploadError,
    uploadSuccess,
    uploadSong,
    fetchSongs,
    clearUploadStatus,
    isBatchUploading,
    batchUploadProgress,
    batchUploadResult,
    batchUploadError,
    batchUploadSongs,
    clearBatchUploadStatus,
  } = useAudioStore();

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

  const handleBatchFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(files);
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

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;

    clearBatchUploadStatus();
    const success = await batchUploadSongs(selectedFiles, batchDefaultArtist);
    if (success) {
      await fetchSongs();
    }
  };

  const resetBatchUpload = () => {
    setSelectedFiles([]);
    setBatchDefaultArtist('');
    clearBatchUploadStatus();
    if (batchFileInputRef.current) {
      batchFileInputRef.current.value = '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'processing':
      case 'uploading': return '⏳';
      case 'pending': return '📥';
      default: return '⏳';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#2e7d32';
      case 'failed': return '#c62828';
      case 'processing':
      case 'uploading': return '#1976d2';
      case 'pending': return '#888';
      default: return '#888';
    }
  };

  const renderProgressBar = (progress: BatchUploadProgress) => (
    <div style={{ width: '100%', height: '6px', background: '#e0e0e0', borderRadius: '3px', overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          width: `${progress.progress}%`,
          background: getStatusColor(progress.status),
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );

  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    }}>
      <h4 style={{ margin: '0 0 16px', fontSize: '16px' }}>📤 上传新歌曲</h4>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => { setUploadMode('single'); clearBatchUploadStatus(); }}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            background: uploadMode === 'single' ? '#1976d2' : '#f0f0f0',
            color: uploadMode === 'single' ? '#fff' : '#333',
            fontWeight: 500,
          }}
        >
          单首上传
        </button>
        <button
          onClick={() => { setUploadMode('batch'); clearUploadStatus(); }}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            background: uploadMode === 'batch' ? '#1976d2' : '#f0f0f0',
            color: uploadMode === 'batch' ? '#fff' : '#333',
            fontWeight: 500,
          }}
        >
          批量上传
        </button>
      </div>

      {uploadMode === 'single' && (
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
      )}

      {uploadMode === 'batch' && (
        <form onSubmit={handleBatchSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '6px' }}>
              默认艺术家 (可选)
            </label>
            <input
              type="text"
              value={batchDefaultArtist}
              onChange={(e) => setBatchDefaultArtist(e.target.value)}
              placeholder="为所有歌曲设置相同艺术家"
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

          {batchUploadProgress.length === 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '6px' }}>
                音频文件 (WAV) *
              </label>
              <div
                onClick={() => batchFileInputRef.current?.click()}
                style={{
                  border: '2px dashed #ccc',
                  borderRadius: '8px',
                  padding: '40px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: selectedFiles.length > 0 ? '#f0f7ff' : '#fafafa',
                  transition: 'all 0.2s',
                }}
              >
                {selectedFiles.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎵</div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>已选择 {selectedFiles.length} 个文件</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                      总大小: {(selectedFiles.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📁</div>
                    <div style={{ fontSize: '14px', color: '#666' }}>点击选择多个WAV文件</div>
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>按住 Ctrl/Cmd 多选，仅支持WAV格式</div>
                  </div>
                )}
              </div>
              <input
                ref={batchFileInputRef}
                type="file"
                multiple
                accept=".wav,audio/wav,audio/x-wav"
                onChange={handleBatchFileChange}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {batchUploadError && (
            <div style={{
              padding: '10px 12px',
              background: '#ffebee',
              color: '#c62828',
              borderRadius: '6px',
              marginBottom: '12px',
              fontSize: '13px',
            }}>
              ❌ {batchUploadError}
            </div>
          )}

          {batchUploadResult && (
            <div style={{
              padding: '12px',
              background: batchUploadResult.failed === 0 ? '#e8f5e9' : '#fff3e0',
              borderRadius: '6px',
              marginBottom: '12px',
              fontSize: '13px',
            }}>
              <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                {batchUploadResult.failed === 0 ? '✅ 全部上传成功' : '⚠️ 部分上传完成'}
              </div>
              <div style={{ color: '#666' }}>
                共 {batchUploadResult.total} 首，成功 {batchUploadResult.success} 首，失败 {batchUploadResult.failed} 首
              </div>
            </div>
          )}

          {batchUploadProgress.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
                上传进度
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px' }}>
                {batchUploadProgress.map((progress) => (
                  <div
                    key={progress.file_index}
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '16px' }}>{getStatusIcon(progress.status)}</span>
                      <span style={{ fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {progress.file_name}
                      </span>
                      <span style={{ fontSize: '12px', color: getStatusColor(progress.status), fontWeight: 500 }}>
                        {progress.status === 'completed' ? '完成' :
                         progress.status === 'failed' ? '失败' :
                         progress.status === 'processing' ? '处理中' :
                         progress.status === 'uploading' ? '上传中' : '等待中'}
                      </span>
                    </div>
                    {renderProgressBar(progress)}
                    {progress.error && (
                      <div style={{ fontSize: '11px', color: '#c62828', marginTop: '4px' }}>
                        {progress.error}
                      </div>
                    )}
                    {progress.song && (
                      <div style={{ fontSize: '11px', color: '#2e7d32', marginTop: '4px' }}>
                        {progress.song.title} - {progress.song.artist || '未知艺术家'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {batchUploadProgress.length === 0 && (
            <button
              type="submit"
              disabled={selectedFiles.length === 0 || isBatchUploading}
              style={{
                width: '100%',
                padding: '12px',
                background: (selectedFiles.length === 0 || isBatchUploading) ? '#ccc' : '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: (selectedFiles.length === 0 || isBatchUploading) ? 'not-allowed' : 'pointer',
              }}
            >
              {isBatchUploading ? '⏳ 批量上传中...' : `🚀 开始批量上传 (${selectedFiles.length} 首)`}
            </button>
          )}

          {(batchUploadResult || batchUploadError) && (
            <button
              type="button"
              onClick={resetBatchUpload}
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '8px',
                background: '#f0f0f0',
                color: '#333',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              🔄 重新上传
            </button>
          )}
        </form>
      )}
    </div>
  );
};
