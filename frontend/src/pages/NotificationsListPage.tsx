import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { FakeSwitch } from '../components/common/FakeSwitch';
import { Select } from '../components/common/Select';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { emitToast } from '../components/common/toast-events';
import { notificationsApi } from '../api/notifications';
import type { Notification as NotificationType } from '../api/notifications';
import { CHANNEL_TYPE_LABELS } from '../constants/channelTypes';
import { EyeIcon, PencilIcon, SparklesIcon, TrashIcon } from '../components/common/icons';
import { AiQuickCreateModal } from '../components/ai/AiQuickCreateModal';

const triggerMap: Record<string, string> = {
  once: '单次',
  recurring: '循环',
  webhook: 'Webhook',
};

export default function NotificationsListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [triggerFilter, setTriggerFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page, statusFilter, triggerFilter, keyword],
    queryFn: () =>
      notificationsApi.list({
        page,
        pageSize: 20,
        ...(statusFilter && { status: statusFilter as NotificationType['status'] }),
        ...(triggerFilter && { triggerType: triggerFilter as NotificationType['triggerType'] }),
        ...(keyword && { keyword }),
      }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: NotificationType['status'] }) =>
      notificationsApi.updateStatus(id, { status }),
    onSuccess: (_, variables) => {
      emitToast(variables.status === 'active' ? '通知已启用' : '通知已停用', 'success');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.remove(id),
    onSuccess: () => {
      emitToast('通知删除成功', 'success');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <div className="page-stack">
      <PageHeader
        title="通知"
        description="管理你的通知规则、状态、渠道与触发方式。"
        actions={
          <>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setAiModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <SparklesIcon size={16} />
              <span>AI 一句话新建</span>
            </button>
            <Link className="primary-button" to="/notifications/new">新建通知</Link>
          </>
        }
      />
      <Card>
        <div className="filters-grid">
          <input
            className="input-shell"
            placeholder="搜索通知名称"
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
          />
          <Select
            className="input-shell"
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[
              { value: '', label: '状态：全部' },
              { value: 'active', label: '活跃' },
              { value: 'disabled', label: '已停用' },
              { value: 'blocked_no_channel', label: '无渠道' },
              { value: 'completed', label: '已完成' },
            ]}
          />
          <Select
            className="input-shell"
            value={triggerFilter}
            onChange={(v) => { setTriggerFilter(v); setPage(1); }}
            options={[
              { value: '', label: '触发类型：全部' },
              { value: 'once', label: '单次' },
              { value: 'recurring', label: '循环' },
              { value: 'webhook', label: 'Webhook' },
            ]}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <button
              className="icon-button"
              type="button"
              title="刷新"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['notifications'] })}
            >
              ↻
            </button>
          </div>
        </div>
      </Card>
      <div className="table-card">
        <div className="table-header notifications-grid">
          <div>通知名称</div>
          <div>触发类型</div>
          <div>渠道</div>
          <div>状态</div>
          <div>下一次触发</div>
          <div>最近结果</div>
          <div className="align-right">操作</div>
        </div>
        {isLoading ? (
          <div className="table-row">加载中...</div>
        ) : data?.items.length === 0 ? (
          <div className="table-empty">
            <span style={{ fontSize: 24 }}>—</span>
            <span>暂无通知</span>
          </div>
        ) : (
          data?.items.map((n) => (
            <div className="table-row notifications-grid link-row" key={n.id}>
              <div>
                <Link to={`/notifications/${n.id}`} className="row-title">{n.name}</Link>
              </div>
              <div>
                <StatusBadge tone={n.triggerType === 'recurring' ? 'blue' : n.triggerType === 'once' ? 'orange' : 'slate'}>
                  {triggerMap[n.triggerType] || n.triggerType}
                </StatusBadge>
              </div>
              <div className="channel-tags">
                {n.channels && n.channels.length > 0 ? (
                  <>
                    {n.channels.slice(0, 2).map((ch) => (
                      <span key={ch.id} className="channel-tag">{ch.name}（{CHANNEL_TYPE_LABELS[ch.type as keyof typeof CHANNEL_TYPE_LABELS] || ch.type}）</span>
                    ))}
                    {n.channels.length > 2 && <span className="channel-tag-more">+{n.channels.length - 2}</span>}
                  </>
                ) : (
                  <span className="muted-text">未绑定</span>
                )}
              </div>
              <div>
                {n.status === 'completed' ? (
                  <StatusBadge tone="slate">已完成</StatusBadge>
                ) : n.status === 'blocked_no_channel' ? (
                  <StatusBadge tone="red">无渠道</StatusBadge>
                ) : (
                  <FakeSwitch
                    checked={n.status === 'active'}
                    onChange={(checked) =>
                      toggleMutation.mutate({ id: n.id, status: checked ? 'active' : 'disabled' })
                    }
                  />
                )}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                {n.nextTriggerAt ? new Date(n.nextTriggerAt).toLocaleString('zh-CN') : '-'}
              </div>
              <div>
                {n.lastPushResult ? (
                  <StatusBadge tone={n.lastPushResult.status === 'success' ? 'green' : n.lastPushResult.status === 'failure' ? 'red' : 'orange'}>
                    {n.lastPushResult.status === 'success' ? '成功' : n.lastPushResult.status === 'failure' ? '失败' : '部分成功'}
                  </StatusBadge>
                ) : (
                  <span className="muted-text">暂无</span>
                )}
              </div>
              <div className="table-actions align-right">
                <Link className="icon-button" to={`/notifications/${n.id}`} aria-label="查看通知" title="查看">
                  <EyeIcon />
                </Link>
                <Link className="icon-button" to={`/notifications/${n.id}/edit`} aria-label="编辑通知" title="编辑">
                  <PencilIcon />
                </Link>
                <button
                  className="icon-button danger"
                  type="button"
                  aria-label="删除通知"
                  title="删除"
                  onClick={() => setPendingDelete({ id: n.id, name: n.name })}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {data && data.total > 20 && (
        <div className="segment-tabs" style={{ justifySelf: 'center' }}>
          <button className="segment-tab" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>上一页</button>
          <span className="segment-tab" style={{ cursor: 'default' }}>第 {page} / {Math.ceil(data.total / 20)} 页</span>
          <button className="segment-tab" disabled={page >= Math.ceil(data.total / 20)} onClick={() => setPage((p) => p + 1)}>下一页</button>
        </div>
      )}
      <AiQuickCreateModal open={aiModalOpen} onClose={() => setAiModalOpen(false)} />
      <ConfirmDialog
        open={!!pendingDelete}
        title="确认删除通知"
        description={pendingDelete ? `删除后不可恢复，通知“${pendingDelete.name}”将被移除。` : ''}
        confirmText={deleteMutation.isPending ? '删除中...' : '确认删除'}
        confirmTone="danger"
        confirmDisabled={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteMutation.mutate(pendingDelete.id, {
            onSuccess: () => setPendingDelete(null),
          });
        }}
      />
    </div>
  );
}
