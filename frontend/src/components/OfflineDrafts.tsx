import React from 'react';
import { useAudioStore } from '../store/audio';
import { OfflineRecognitionDraft } from '../types';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return '#f57c00';
    case 'syncing': return '#1565c0';
    case 'synced': return '#2e7d32';
    case 'failed': return '#c62828';
    default: return '#757575';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending': return '待补交';
    case 'syncing': return '补交中';
    case 'synced': return '已补交';
    case 'failed': return '补交失败';
    default: return '未知';
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

interface DraftItemProps {
  draft: OfflineRecognitionDraft;
  onSync: (id: string) => void;
  onDelete: (id: string) => void;
  onViewResult: (draft: OfflineRecognitionDraft) => void;
}

const DraftItem: React.FC<DraftItemProps> = ({ draft, onSync, onDelete, onViewResult }) => {
  const canSync = draft.status === 'pending' || draft.status === 'failed';
  const canViewResult = draft.status === 'synced' && draft.result;

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        background: '#fff',
        borderLeft: `4px solid ${getStatusColor(draft.status)}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
          background: '#f5f5f5',
        }}>
          🎵
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 600, fontSize: '14px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginBottom: '4px',
          }}>
            {draft.file_name}
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#999' }}>
            <span>{formatFileSize(draft.file_size)}</span>
            <span>🕐 {formatTime(draft.created_at)}</span>
            {draft.retry_count > 0 && <span>重试 {draft.retry_count} 次</span>}
          </div>
        </div>
        <span style={{
          padding: '4px 10px',
          borderRadius: '20px',
          background: getStatusColor(draft.status) + '15',
          color: getStatusColor(draft.status),
          fontWeight: 500,
          fontSize: '12px',
          whiteSpace: 'nowrap',
        }}>
          {getStatusLabel(draft.status)}
        </span>
      </div>

      {draft.last_error && (
        <div style={{
          padding: '8px 12px',
          background: '#ffebee',
          color: '#c62828',
          borderRadius: '6px',
          fontSize: '12px',
          marginBottom: '12px',
        }}>
          ⚠️ {draft.last_error}
        </div>
      )}

      {canViewResult && draft.result && (
        <div style={{
          padding: '12px',
          background: draft.result.match_found ? '#e8f5e9' : '#fff3e0',
          borderRadius: '6px',
          marginBottom: '12px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
            {draft.result.match_found ? '✅ 识别成功' : '❌ 未找到匹配'}
          </div>
          {draft.result.match_found && draft.result.song && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              {draft.result.song.title} - {draft.result.song.artist || '未知艺术家'}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        {canViewResult && (
          <button
            onClick={() => onViewResult(draft)}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              background: '#fff',
              color: '#555',
              cursor: 'pointer',
            }}
          >
            查看详情
          </button>
        )}
        {canSync && (
          <button
            onClick={() => onSync(draft.id)}
            disabled={draft.status === 'syncing'}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              borderRadius: '6px',
              border: 'none',
              background: '#1565c0',
              color: '#fff',
              cursor: draft.status === 'syncing' ? 'not-allowed' : 'pointer',
              opacity: draft.status === 'syncing' ? 0.6 : 1,
            }}
          >
            {draft.status === 'syncing' ? '补交中...' : '立即补交'}
          </button>
        )}
        <button
          onClick={() => onDelete(draft.id)}
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            borderRadius: '6px',
            border: '1px solid #ffcdd2',
            background: '#fff',
            color: '#c62828',
            cursor: 'pointer',
          }}
        >
          删除
        </button>
      </div>
    </div>
  );
};

export const OfflineDrafts: React.FC = () => {
  const {
    offlineDrafts,
    isSyncingDrafts,
    isOnline,
    syncOfflineDrafts,
    syncSingleDraft,
    deleteOfflineDraft,
    clearSyncedDrafts,
    setRecognizeResult,
  } = useAudioStore();

  const pendingDrafts = offlineDrafts.filter(d => d.status === 'pending' || d.status === 'failed');
  const syncedDrafts = offlineDrafts.filter(d => d.status === 'synced');

  const handleViewResult = (draft: OfflineRecognitionDraft) => {
    if (draft.result) {
      setRecognizeResult(draft.result);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '20px' }}>📝 离线草稿</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
            网络断开时保存的识别记录，恢复后将自动补交
          </p>
        </div>
      </div>

      {!isOnline && (
        <div style={{
          padding: '12px 16px',
          background: '#fff3e0',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px',
          color: '#e65100',
        }}>
          <span style={{ fontSize: '20px' }}>📡</span>
          <span>当前网络已断开，识别记录将保存为离线草稿</span>
        </div>
      )}

      {pendingDrafts.length > 0 && (
        <div style={{
          padding: '16px',
          background: '#e3f2fd',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 500, color: '#1565c0', fontSize: '14px' }}>
              有 {pendingDrafts.length} 条待补交的识别记录
            </div>
            <div style={{ fontSize: '12px', color: '#5c6bc0', marginTop: '4px' }}>
              {isOnline ? '网络已连接，可以立即补交' : '网络恢复后将自动补交'}
            </div>
          </div>
          <button
            onClick={syncOfflineDrafts}
            disabled={!isOnline || isSyncingDrafts}
            style={{
              padding: '8px 20px',
              fontSize: '13px',
              borderRadius: '6px',
              border: 'none',
              background: isOnline ? '#1565c0' : '#90caf9',
              color: '#fff',
              cursor: (!isOnline || isSyncingDrafts) ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            {isSyncingDrafts ? '补交中...' : '全部补交'}
          </button>
        </div>
      )}

      {syncedDrafts.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', color: '#333' }}>
            已补交 ({syncedDrafts.length})
          </h4>
          <button
            onClick={clearSyncedDrafts}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              background: '#fff',
              color: '#666',
              cursor: 'pointer',
            }}
          >
            清空已补交
          </button>
        </div>
      )}

      {offlineDrafts.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#fff',
          borderRadius: '8px',
          color: '#999',
        }}>
          <div style={{ fontSize: '50px', marginBottom: '16px' }}>📭</div>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>暂无离线草稿</div>
          <div style={{ fontSize: '13px' }}>网络断开时进行的识别会自动保存在这里</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {offlineDrafts.map((draft) => (
            <DraftItem
              key={draft.id}
              draft={draft}
              onSync={syncSingleDraft}
              onDelete={deleteOfflineDraft}
              onViewResult={handleViewResult}
            />
          ))}
        </div>
      )}
    </div>
  );
};
