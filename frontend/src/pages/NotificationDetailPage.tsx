import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { notificationsApi } from '../api/notifications';
import { CHANNEL_TYPE_LABELS } from '../constants/channelTypes';

const statusMap: Record<string, string> = {
  active: '活跃',
  disabled: '已停用',
  blocked_no_channel: '无渠道',
  completed: '已完成',
};

const triggerMap: Record<string, string> = {
  once: '单次',
  recurring: '循环',
  webhook: 'Webhook',
};

export default function NotificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newWebhookToken, setNewWebhookToken] = useState<string | null>(null);

  const { data: notification } = useQuery({
    queryKey: ['notification', id],
    queryFn: () => notificationsApi.getDetail(id!),
    enabled: !!id,
  });

  const resetTokenMutation = useMutation({
    mutationFn: () => notificationsApi.resetWebhookToken(id!),
    onSuccess: (data) => {
      setNewWebhookToken(data.webhookToken);
      queryClient.invalidateQueries({ queryKey: ['notification', id] });
    },
  });

  if (!notification) return <div className="page-stack"><div className="card">加载中...</div></div>;

  const triggerConfigDescription =
    notification.triggerType === 'once'
      ? (notification.triggerConfig.executeAt ?? notification.triggerConfig.scheduleAt)
        ? new Date(notification.triggerConfig.executeAt ?? notification.triggerConfig.scheduleAt ?? '').toLocaleString('zh-CN')
        : '-'
      : notification.triggerType === 'recurring'
        ? notification.triggerConfig.cron ?? '-'
        : '按请求触发';

  return (
    <div className="page-stack">
      <PageHeader
        title={notification.name}
        description="查看通知详情与配置。"
        actions={
          <>
            <Link className="primary-button" to={`/notifications/${id}/edit`}>编辑</Link>
            <button className="ghost-button" onClick={() => navigate('/notifications')}>返回</button>
          </>
        }
      />
      <div className="detail-grid">
        {/* 基础信息 */}
        <Card>
          <h3>基本信息</h3>
          <div className="stack-gap">
            <div className="detail-pair">
              <span className="muted-text">状态</span>
              <StatusBadge tone={notification.status === 'active' ? 'green' : notification.status === 'completed' ? 'blue' : notification.status === 'blocked_no_channel' ? 'orange' : 'slate'}>
                {statusMap[notification.status] || notification.status}
              </StatusBadge>
            </div>
            <div className="detail-pair">
              <span className="muted-text">触发类型</span>
              <StatusBadge tone={notification.triggerType === 'recurring' ? 'blue' : notification.triggerType === 'once' ? 'orange' : 'slate'}>
                {triggerMap[notification.triggerType]}
              </StatusBadge>
            </div>
            <div className="detail-pair">
              <span className="muted-text">触发规则</span>
              <span>{triggerConfigDescription}</span>
            </div>
            <div className="detail-pair">
              <span className="muted-text">下一次触发</span>
              <span>{notification.nextTriggerAt ? new Date(notification.nextTriggerAt).toLocaleString('zh-CN') : '-'}</span>
            </div>
            {notification.stopReason && (
              <div className="detail-pair">
                <span className="muted-text">停用原因</span>
                <span>{notification.stopReason}</span>
              </div>
            )}
            <div className="detail-pair">
              <span className="muted-text">创建时间</span>
              <span>{new Date(notification.createdAt).toLocaleString('zh-CN')}</span>
            </div>
          </div>
        </Card>

        {/* 内容信息 */}
        <Card>
          <h3>消息内容</h3>
          <div className="stack-gap">
            <div>
              <div className="field-label">标题</div>
              <div className="input-shell">{notification.title}</div>
            </div>
            <div>
              <div className="field-label">正文</div>
              <div className="textarea-shell">{notification.content}</div>
            </div>
          </div>
        </Card>

        {/* 关联渠道 */}
        <Card>
          <h3>关联渠道</h3>
          {notification.channels && notification.channels.length > 0 ? (
            <div className="tag-list">
              {notification.channels.map((ch) => (
                <Link key={ch.id} to={`/channels/${ch.id}`} className="tag">{ch.name}（{CHANNEL_TYPE_LABELS[ch.type as keyof typeof CHANNEL_TYPE_LABELS] || ch.type}）</Link>
              ))}
            </div>
          ) : (
            <div className="muted-text">暂无关联渠道</div>
          )}
        </Card>

        {/* Webhook 配置（仅 Webhook 类型展示） */}
        {notification.triggerType === 'webhook' && (
          <Card>
            <h3>Webhook 配置</h3>
            <div className="stack-gap">
              {newWebhookToken ? (
                <div className="preview-box success">
                  <strong>Token 已重置，请复制并妥善保管，关闭后不再展示</strong>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{newWebhookToken}</code>
                    <button className="ghost-button" type="button" onClick={() => navigator.clipboard.writeText(newWebhookToken)}>复制</button>
                    <button className="ghost-button" type="button" onClick={() => setNewWebhookToken(null)}>关闭</button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div className="field-label">调用 Token</div>
                    <div className="token-box">
                      <span className="muted-text">{notification.webhookEnabled ? '已设置（不可查看，可重置）' : '尚未生成'}</span>
                    </div>
                    <div className="helper-text" style={{ marginTop: 8 }}>重置后获得新 Token，旧 Token 立即失效。</div>
                  </div>
                  <div>
                    <div className="field-label">调用路径</div>
                    <div className="input-shell" style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      POST /open/webhook/notify/{'{webhookToken}'}
                    </div>
                    <div className="helper-text" style={{ marginTop: 8 }}>详情页不会返回明文 Token；生成或重置后请立即复制保存。</div>
                  </div>
                  <div className="form-actions">
                    <button className="ghost-button" onClick={() => resetTokenMutation.mutate()} disabled={resetTokenMutation.isPending}>
                      {resetTokenMutation.isPending ? '重置中...' : (notification.webhookEnabled ? '重置 Token' : '生成 Token')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </Card>
        )}

        {/* 最近推送记录 */}
        <Card>
          <h3>最近推送记录</h3>
          {notification.recentRecords && notification.recentRecords.length > 0 ? (
            <div className="recent-list compact">
              {notification.recentRecords.map((r) => (
                <Link key={r.id} className="recent-row" to={`/push-records/${r.id}`}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 140 }}>
                    {new Date(r.pushedAt).toLocaleString('zh-CN')}
                  </span>
                  <span className="row-title" style={{ flex: 1 }}>{r.channelName}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {r.title}
                  </span>
                  <StatusBadge tone={r.result === 'success' ? 'green' : r.result === 'failure' ? 'red' : 'orange'}>
                    {r.result === 'success' ? '成功' : r.result === 'failure' ? '失败' : '部分成功'}
                  </StatusBadge>
                </Link>
              ))}
            </div>
          ) : (
            <div className="muted-text">暂无推送记录</div>
          )}
        </Card>
      </div>
    </div>
  );
}
