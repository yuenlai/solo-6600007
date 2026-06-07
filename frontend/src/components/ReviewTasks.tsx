import React, { useEffect, useState, useRef } from 'react';
import { useAudioStore } from '../store/audio';
import { ReviewTask, ReviewStatus } from '../types';

export const ReviewTasks: React.FC = () => {
  const {
    reviewTasks,
    fetchReviewTasks,
    isFetchingReviewTasks,
    deleteReviewTask,
    isDeletingReviewTask,
    reRecognizeReviewTask,
    isReRecognizing,
    fetchLowConfidenceHistory,
    lowConfidenceHistory,
    isFetchingLowConfidence,
    createReviewTask,
    isCreatingReviewTask,
  } = useAudioStore();

  const [activeTab, setActiveTab] = useState<'tasks' | 'lowConfidence'>('tasks');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [reRecognizeResult, setReRecognizeResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'tasks') {
      fetchReviewTasks(statusFilter === 'all' ? undefined : statusFilter);
    } else {
      fetchLowConfidenceHistory(0.3);
    }
  }, [activeTab, statusFilter, fetchReviewTasks, fetchLowConfidenceHistory]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: ReviewStatus) => {
    switch (status) {
      case 'pending':
        return '#ff9800';
      case 'reviewing':
        return '#2196f3';
      case 'completed':
        return '#4caf50';
      case 'rejected':
        return '#f44336';
      default:
        return '#999';
    }
  };

  const getStatusLabel = (status: ReviewStatus) => {
    switch (status) {
      case 'pending':
        return '待复检';
      case 'reviewing':
        return '复检中';
      case 'completed':
        return '已完成';
      case 'rejected':
        return '已拒绝';
      default:
        return status;
    }
  };

  const handleFileSelect = async (taskId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedTaskId(taskId);
    const success = await reRecognizeReviewTask(taskId, file);
    if (success) {
      await fetchReviewTasks(statusFilter === 'all' ? undefined : statusFilter);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSelectedTaskId(null);
  };

  const handleCreateReviewTask = async (historyId: string) => {
    const success = await createReviewTask(historyId);
    if (success) {
      await fetchLowConfidenceHistory(0.3);
    }
  };

  const stats = {
    total: reviewTasks.length,
    pending: reviewTasks.filter(t => t.review_status === 'pending').length,
    completed: reviewTasks.filter(t => t.review_status === 'completed').length,
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '20px' }}>🔍 识别结果复检</h3>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('tasks')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            background: activeTab === 'tasks' ? '#1976d2' : '#fff',
            color: activeTab === 'tasks' ? '#fff' : '#333',
            border: activeTab === 'tasks' ? 'none' : '1px solid #ddd',
          }}
        >
          📋 复检任务
        </button>
        <button
          onClick={() => setActiveTab('lowConfidence')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            background: activeTab === 'lowConfidence' ? '#1976d2' : '#fff',
            color: activeTab === 'lowConfidence' ? '#fff' : '#333',
            border: activeTab === 'lowConfidence' ? 'none' : '1px solid #ddd',
          }}
        >
          ⚠️ 低置信度结果
        </button>
      </div>

      {activeTab === 'tasks' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#1976d2' }}>{stats.total}</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>总任务数</div>
            </div>
            <div style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#ff9800' }}>{stats.pending}</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>待复检</div>
            </div>
            <div style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#4caf50' }}>{stats.completed}</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>已完成</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#666' }}>状态筛选:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ReviewStatus | 'all')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                }}
              >
                <option value="all">全部</option>
                <option value="pending">待复检</option>
                <option value="reviewing">复检中</option>
                <option value="completed">已完成</option>
                <option value="rejected">已拒绝</option>
              </select>
            </div>
            <button
              onClick={() => fetchReviewTasks(statusFilter === 'all' ? undefined : statusFilter)}
              disabled={isFetchingReviewTasks}
              style={{
                padding: '6px 12px',
                border: '1px solid #ddd',
                background: '#fff',
                borderRadius: '4px',
                cursor: isFetchingReviewTasks ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                opacity: isFetchingReviewTasks ? 0.6 : 1,
              }}
            >
              {isFetchingReviewTasks ? '加载中...' : '🔄 刷新'}
            </button>
          </div>

          {reviewTasks.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              background: '#fff',
              borderRadius: '8px',
              color: '#999',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
              <div>暂无复检任务</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>从识别历史中选择低置信度结果加入复检</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {reviewTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                    background: '#fff',
                    borderLeft: `4px solid ${getStatusColor(task.review_status)}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                        {task.song_title || '未知歌曲'}
                      </div>
                      {task.song_artist && (
                        <div style={{ fontSize: '13px', color: '#888', marginBottom: '6px' }}>
                          {task.song_artist}
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: `${getStatusColor(task.review_status)}20`,
                        color: getStatusColor(task.review_status),
                      }}
                    >
                      {getStatusLabel(task.review_status)}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: '#888' }}>原始置信度: </span>
                      <span style={{ fontWeight: 500, color: '#ff9800' }}>
                        {(task.original_confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>复检次数: </span>
                      <span style={{ fontWeight: 500 }}>{task.review_count}</span>
                    </div>
                    {task.last_review_confidence !== null && (
                      <div>
                        <span style={{ color: '#888' }}>最后复检置信度: </span>
                        <span style={{ fontWeight: 500, color: task.last_review_confidence >= 0.5 ? '#4caf50' : '#ff9800' }}>
                          {(task.last_review_confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                    <div>
                      <span style={{ color: '#888' }}>创建时间: </span>
                      <span>{formatTime(task.created_at)}</span>
                    </div>
                  </div>

                  {task.note && (
                    <div style={{ padding: '8px', background: '#f5f5f5', borderRadius: '4px', fontSize: '13px', marginBottom: '12px' }}>
                      <span style={{ color: '#888' }}>备注: </span>
                      {task.note}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileSelect(task.id, e)}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isReRecognizing && selectedTaskId === task.id}
                      style={{
                        padding: '8px 16px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isReRecognizing && selectedTaskId === task.id ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        background: '#2196f3',
                        color: '#fff',
                        fontWeight: 500,
                        opacity: isReRecognizing && selectedTaskId === task.id ? 0.6 : 1,
                      }}
                    >
                      {isReRecognizing && selectedTaskId === task.id ? '识别中...' : '🎤 上传音频复检'}
                    </button>
                    <button
                      onClick={() => deleteReviewTask(task.id)}
                      disabled={isDeletingReviewTask}
                      style={{
                        padding: '8px 16px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: isDeletingReviewTask ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        background: '#fff',
                        color: '#f44336',
                        opacity: isDeletingReviewTask ? 0.6 : 1,
                      }}
                    >
                      🗑️ 删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'lowConfidence' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '16px' }}>置信度低于 30% 的识别结果</h4>
            <button
              onClick={() => fetchLowConfidenceHistory(0.3)}
              disabled={isFetchingLowConfidence}
              style={{
                padding: '6px 12px',
                border: '1px solid #ddd',
                background: '#fff',
                borderRadius: '4px',
                cursor: isFetchingLowConfidence ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                opacity: isFetchingLowConfidence ? 0.6 : 1,
              }}
            >
              {isFetchingLowConfidence ? '加载中...' : '🔄 刷新'}
            </button>
          </div>

          {lowConfidenceHistory.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              background: '#fff',
              borderRadius: '8px',
              color: '#999',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
              <div>没有低置信度的识别结果</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>所有识别结果的置信度都高于 30%</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lowConfidenceHistory.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                    background: '#fff',
                    borderLeft: '4px solid #ff9800',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '6px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                      background: '#fff3e0',
                    }}>
                      ⚠️
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: '14px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.song_title || '未找到匹配歌曲'}
                      </div>
                      {item.song_artist && (
                        <div style={{ fontSize: '12px', color: '#888' }}>
                          {item.song_artist}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginLeft: '42px' }}>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#999' }}>
                      <span>🎯 置信度 {(item.confidence * 100).toFixed(0)}%</span>
                      <span>🕐 {formatTime(item.created_at)}</span>
                    </div>
                    <button
                      onClick={() => handleCreateReviewTask(item.id)}
                      disabled={isCreatingReviewTask}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isCreatingReviewTask ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        background: '#ff9800',
                        color: '#fff',
                        fontWeight: 500,
                      }}
                    >
                      ➕ 加入复检
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
