import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { channelsApi } from '../api/channels';
import { CHANNEL_CONFIG_FIELD_LABELS, CHANNEL_TYPE_LABELS } from '../constants/channelTypes';
import { emitToast } from '../components/common/toast-events';
import { CopyIconButton } from '../components/common/CopyIconButton';
import { maskToken } from '../utils/token';

export default function ChannelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showToken] = useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(null);

  const { data: channel, isLoading } = useQuery({
    queryKey: ['channel', id],
    queryFn: () => channelsApi.getDetail(id!),
    enabled: !!id,
  });

  const resetTokenMutation = useMutation({
    mutationFn: () => channelsApi.resetToken(id!),
    onSuccess: (data) => {
      setCurrentToken(data.token);
      emitToast('Token 重置成功', 'success');
      queryClient.invalidateQueries({ queryKey: ['channel', id] });
    },
  });

  if (isLoading) return <div className="page-stack"><div className="card">加载中...</div></div>;
  if (!channel) return <div className="page-stack"><div className="card">渠道不存在</div></div>;

  const displayToken = currentToken ?? channel.token ?? null;

  return (
    <div className="page-stack">
      <PageHeader
        title={channel.name}
        description="查看渠道详情与配置。"
        actions={
          <>
            <Link className="primary-button" to={`/channels/${id}/edit`}>编辑</Link>
            <button className="ghost-button" onClick={() => navigate('/channels')}>返回</button>
          </>
        }
      />
      <div className="detail-grid">
        <Card>
          <h3>基本信息</h3>
          <div className="stack-gap">
            <div className="detail-pair">
              <span className="muted-text">类型</span>
              <StatusBadge tone="blue">
                {CHANNEL_TYPE_LABELS[channel.type] || channel.type}
              </StatusBadge>
            </div>
            <div className="detail-pair">
              <span className="muted-text">状态</span>
              <StatusBadge tone={channel.status === 'active' ? 'green' : 'slate'}>
                {channel.status === 'active' ? '活跃' : '已停用'}
              </StatusBadge>
            </div>
            <div className="detail-pair">
              <span className="muted-text">创建时间</span>
              <span>{new Date(channel.createdAt).toLocaleString('zh-CN')}</span>
            </div>
          </div>
        </Card>
        <Card>
          <h3>配置信息</h3>
          <div className="stack-gap">
            {channel.config && Object.entries(channel.config).map(([key, value]) => (
              <div key={key} className="detail-pair">
                <span className="muted-text">{CHANNEL_CONFIG_FIELD_LABELS[key] || key}</span>
                <span className="input-shell" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {typeof value === 'string' && (key.includes('token') || key.includes('Token') || key.includes('password') || key.includes('secret'))
                    ? showToken ? value : '••••••••'
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 style={{ marginBottom: 4 }}>渠道调用 Token</h3>
          <div className="stack-gap">
            {displayToken ? (
              <div className="preview-box success">
                <strong>Token 已生成，请复制并妥善保管</strong>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: '1 1 280px', minWidth: 0 }}>
                    <code style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{maskToken(displayToken)}</code>
                    <CopyIconButton value={displayToken} label="复制 Token" successMessage="Token 已复制" />
                  </div>
                  <button className="ghost-button" type="button" onClick={() => resetTokenMutation.mutate()} disabled={resetTokenMutation.isPending}>
                    {resetTokenMutation.isPending ? '重置中...' : '重置 Token'}
                  </button>
                  <Link className="primary-button" to="/test">发送测试</Link>
                </div>
              </div>
            ) : (
              <div className="preview-box success">
                <strong>当前渠道需要重置后才可查看 Token</strong>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="muted-text">这是历史渠道数据，旧 Token 无法恢复。</span>
                  <button className="ghost-button" type="button" onClick={() => resetTokenMutation.mutate()} disabled={resetTokenMutation.isPending}>
                    {resetTokenMutation.isPending ? '重置中...' : '重置 Token'}
                  </button>
                  <Link className="primary-button" to="/test">发送测试</Link>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
