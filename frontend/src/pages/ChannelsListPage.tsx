import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { FakeSwitch } from '../components/common/FakeSwitch';
import { Select } from '../components/common/Select';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { emitToast } from '../components/common/Toast';
import { channelsApi, type Channel, type ChannelStatus } from '../api/channels';

const typeMap: Record<string, string> = {
  Bark: 'Bark',
  ServerChan: 'Server酱',
  PushDeer: 'PushDeer',
  Telegram: 'Telegram',
  Discord: 'Discord',
  Slack: 'Slack',
  WeCom: '企业微信',
  DingTalk: '钉钉',
  Feishu: '飞书',
  Email: '邮件',
  LINE: 'LINE',
  Gitter: 'Gitter',
  Mattermost: 'Mattermost',
  RocketChat: 'RocketChat',
  MicrosoftTeams: 'Teams',
};

export default function ChannelsListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['channels', page, typeFilter, statusFilter, keyword],
    queryFn: () =>
      channelsApi.list({
        page,
        pageSize: 20,
        ...(typeFilter && { type: typeFilter as Channel['type'] }),
        ...(statusFilter && { status: statusFilter as ChannelStatus }),
        ...(keyword && { keyword }),
      }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ChannelStatus }) =>
      channelsApi.updateStatus(id, { status }),
    onSuccess: (_, variables) => {
      emitToast(variables.status === 'active' ? '渠道已启用' : '渠道已停用', 'success');
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => channelsApi.remove(id),
    onSuccess: () => {
      emitToast('渠道删除成功', 'success');
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  return (
    <div className="page-stack">
      <PageHeader
        title="渠道"
        description="管理你的通知渠道与配置。"
        actions={
          <Link className="primary-button" to="/channels/new">新建渠道</Link>
        }
      />
      <Card className="warning-banner">
        渠道是被通知引用的外部通道，一个渠道可被多个通知绑定；停用渠道会导致绑定该渠道的通知变为"无渠道"状态。
      </Card>
      <Card>
        <div className="filters-grid">
          <input
            className="input-shell"
            placeholder="搜索渠道名称"
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
            ]}
          />
          <Select
            className="input-shell"
            value={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1); }}
            options={[
              { value: '', label: '类型：全部' },
              { value: 'Bark', label: 'Bark' },
              { value: 'ServerChan', label: 'Server酱' },
              { value: 'PushDeer', label: 'PushDeer' },
              { value: 'Telegram', label: 'Telegram' },
              { value: 'Discord', label: 'Discord' },
              { value: 'Slack', label: 'Slack' },
              { value: 'WeCom', label: '企业微信' },
              { value: 'DingTalk', label: '钉钉' },
              { value: 'Feishu', label: '飞书' },
              { value: 'Email', label: '邮件' },
            ]}
          />
        </div>
      </Card>
      <div className="table-card">
        <div className="table-header channels-grid">
          <div>渠道名称</div>
          <div>类型</div>
          <div>状态</div>
          <div>重试次数</div>
          <div>最近使用</div>
          <div>关联通知</div>
          <div className="align-right">操作</div>
        </div>
        {isLoading ? (
          <div className="table-row">加载中...</div>
        ) : data?.items.length === 0 ? (
          <div className="table-empty">
            <span style={{ fontSize: 24 }}>—</span>
            <span>暂无渠道</span>
          </div>
        ) : (
          data?.items.map((ch) => (
            <div className="table-row link-row channels-grid" key={ch.id}>
              <div>
                <Link to={`/channels/${ch.id}`} className="row-title">{ch.name}</Link>
              </div>
              <div>
                <StatusBadge tone="blue">
                  {typeMap[ch.type] || ch.type}
                </StatusBadge>
              </div>
              <div>
                <FakeSwitch
                  checked={ch.status === 'active'}
                  onChange={(checked) =>
                    toggleMutation.mutate({ id: ch.id, status: checked ? 'active' : 'disabled' })
                  }
                />
              </div>
              <div>
                <span style={{ fontFamily: 'monospace' }}>{ch.retryCount ?? 3}</span>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                {ch.lastUsedAt ? new Date(ch.lastUsedAt).toLocaleString('zh-CN') : '从未使用'}
              </div>
              <div>
                <span style={{ fontWeight: 700 }}>{ch.relatedNotificationCount ?? 0}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}> 个通知</span>
              </div>
              <div className="table-actions align-right">
                <Link className="icon-button" to={`/channels/${ch.id}`}>◔</Link>
                <Link className="icon-button" to={`/channels/${ch.id}/edit`}>✎</Link>
                <button
                  className="icon-button danger"
                  type="button"
                  onClick={() => setPendingDelete({ id: ch.id, name: ch.name })}
                >
                  ⌫
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
      <ConfirmDialog
        open={!!pendingDelete}
        title="确认删除渠道"
        description={pendingDelete ? `删除后不可恢复，渠道“${pendingDelete.name}”将被移除。` : ''}
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
