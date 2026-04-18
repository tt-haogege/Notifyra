import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { notificationsApi } from '../api/notifications';
import { emitToast } from '../components/common/toast-events';
import { CopyIconButton } from '../components/common/CopyIconButton';
import { RelativeTime } from '../components/common/RelativeTime';
import { CHANNEL_TYPE_LABELS } from '../constants/channelTypes';
import { maskToken } from '../utils/token';
import { formatAbsoluteTime } from '../utils/time';

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

const statusToneMap: Record<string, 'green' | 'blue' | 'orange' | 'slate'> = {
  active: 'green',
  completed: 'blue',
  blocked_no_channel: 'orange',
  disabled: 'slate',
};

export default function NotificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: notification } = useQuery({
    queryKey: ['notification', id],
    queryFn: () => notificationsApi.getDetail(id!),
    enabled: !!id,
  });

  const resetTokenMutation = useMutation({
    mutationFn: () => notificationsApi.resetWebhookToken(id!),
    onSuccess: () => {
      emitToast('Token 已重置，旧 Token 已失效', 'success');
      queryClient.invalidateQueries({ queryKey: ['notification', id] });
    },
    onError: () => emitToast('Token 重置失败', 'error'),
  });

  if (!notification) {
    return (
      <div className="page-stack">
        <div className="card">加载中...</div>
      </div>
    );
  }

  const webhookToken = notification.webhookToken ?? null;
  const webhookPath = `POST /open/webhook/notify/${webhookToken ?? '{webhookToken}'}`;
  const channelCount = notification.channels?.length ?? 0;

  const triggerConfigDescription =
    notification.triggerType === 'once'
      ? (notification.triggerConfig.executeAt ?? notification.triggerConfig.scheduleAt)
        ? formatAbsoluteTime(
            (notification.triggerConfig.executeAt ?? notification.triggerConfig.scheduleAt) as string,
          )
        : '-'
      : notification.triggerType === 'recurring'
        ? (notification.triggerConfig.cron as string | undefined) ?? '-'
        : '按请求触发';

  const headerMeta = [
    triggerMap[notification.triggerType] ?? notification.triggerType,
    `${channelCount} 个渠道`,
    statusMap[notification.status] ?? notification.status,
  ].join(' · ');

  return (
    <div className="page-stack">
      <PageHeader
        title={notification.name}
        description={headerMeta}
        actions={
          <Link className="primary-button" to={`/notifications/${id}/edit`}>
            编辑
          </Link>
        }
      />
      <div className="detail-grid">
        {/* 概览（含关联渠道） */}
        <Card>
          <h3>概览</h3>
          <div className="stack-gap">
            <div className="detail-pair">
              <span className="muted-text">状态</span>
              <StatusBadge tone={statusToneMap[notification.status] ?? 'slate'}>
                {statusMap[notification.status] ?? notification.status}
              </StatusBadge>
            </div>
            <div className="detail-pair">
              <span className="muted-text">触发类型</span>
              <StatusBadge
                tone={
                  notification.triggerType === 'recurring'
                    ? 'blue'
                    : notification.triggerType === 'once'
                      ? 'orange'
                      : 'slate'
                }
              >
                {triggerMap[notification.triggerType]}
              </StatusBadge>
            </div>
            <div className="detail-pair">
              <span className="muted-text">触发规则</span>
              <span>{triggerConfigDescription}</span>
            </div>
            {notification.triggerType !== 'webhook' && (
              <div className="detail-pair">
                <span className="muted-text">下一次触发</span>
                <RelativeTime value={notification.nextTriggerAt} />
              </div>
            )}
            {notification.stopReason && (
              <div className="detail-pair">
                <span className="muted-text">停用原因</span>
                <span>{notification.stopReason}</span>
              </div>
            )}

            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

            <div>
              <div className="field-label" style={{ marginBottom: 8 }}>关联渠道</div>
              {channelCount > 0 ? (
                <div className="tag-list">
                  {notification.channels!.map((ch) => (
                    <Link key={ch.id} to={`/channels/${ch.id}`} className="tag">
                      {ch.name}（{CHANNEL_TYPE_LABELS[ch.type as keyof typeof CHANNEL_TYPE_LABELS] || ch.type}）
                    </Link>
                  ))}
                </div>
              ) : (
                <span className="muted-text">暂无关联渠道</span>
              )}
            </div>

            <div className="helper-text" style={{ marginTop: 4 }}>
              创建于 <RelativeTime value={notification.createdAt} />
            </div>
          </div>
        </Card>

        {/* 消息内容 */}
        <Card>
          <h3>消息内容</h3>
          <div className="stack-gap">
            <div className="detail-pair" style={{ alignItems: 'flex-start' }}>
              <span className="muted-text" style={{ flexShrink: 0 }}>标题</span>
              <span style={{ textAlign: 'right', fontWeight: 600 }}>{notification.title}</span>
            </div>
            <div>
              <div className="field-label" style={{ marginBottom: 8 }}>正文</div>
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: 'var(--muted-card)',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.6,
                }}
              >
                {notification.content}
              </div>
            </div>
          </div>
        </Card>

        {/* Webhook 调用配置（仅 Webhook 类型） */}
        {notification.triggerType === 'webhook' && (
          <Card>
            <h3 style={{ marginBottom: 4 }}>Webhook 调用</h3>
            <div className="stack-gap">
              {webhookToken ? (
                <div className="preview-box success">
                  <strong>Token 已生成，请复制并妥善保管</strong>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: '1 1 280px', minWidth: 0 }}>
                      <code style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                        {maskToken(webhookToken)}
                      </code>
                      <CopyIconButton value={webhookToken} label="复制 Token" successMessage="Token 已复制" />
                    </div>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => resetTokenMutation.mutate()}
                      disabled={resetTokenMutation.isPending}
                    >
                      {resetTokenMutation.isPending ? '重置中...' : '重置 Token'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="preview-box success">
                  <strong>
                    {notification.webhookEnabled ? '当前通知需要重置后才可查看 Token' : '尚未生成 Token'}
                  </strong>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="muted-text">
                      {notification.webhookEnabled
                        ? '这是历史通知数据，旧 Token 无法恢复。'
                        : '点击生成后即可复制调用。'}
                    </span>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => resetTokenMutation.mutate()}
                      disabled={resetTokenMutation.isPending}
                    >
                      {resetTokenMutation.isPending
                        ? '处理中...'
                        : notification.webhookEnabled
                          ? '重置 Token'
                          : '生成 Token'}
                    </button>
                  </div>
                </div>
              )}
              <div>
                <div className="field-label">调用路径</div>
                <div
                  className="input-shell"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'monospace', fontSize: 13 }}
                >
                  <span style={{ flex: 1, wordBreak: 'break-all' }}>{webhookPath}</span>
                  <CopyIconButton value={webhookPath} label="复制调用路径" successMessage="调用路径已复制" />
                </div>
              </div>
              <div>
                <div className="field-label">请求体规则</div>
                <ul className="bullet-list" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  <li>
                    请求体中的 <code>title</code> / <code>content</code> 若非空字符串，将
                    <strong style={{ color: 'var(--text-primary)' }}>直接覆盖</strong>
                    通知中预设的标题和正文；未传则使用预设值。
                  </li>
                  <li>
                    预设或覆盖后的文本均支持 <code>{'{{body.xxx}}'}</code> 占位符，按请求体字段自动替换，例如
                    <code>{'{{body.device.name}}'}</code>。
                  </li>
                  <li>
                    所有非 <code>title</code> / <code>content</code> 字段都会进入 <code>body</code>，供占位符引用。
                  </li>
                </ul>
              </div>
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
                  <span className="row-title" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title}
                  </span>
                  <span className="muted-text" style={{ fontSize: 12 }}>
                    {r.channelName}
                  </span>
                  <span className="muted-text" style={{ fontSize: 12, minWidth: 90, textAlign: 'right' }}>
                    <RelativeTime value={r.pushedAt} />
                  </span>
                  <StatusBadge
                    tone={
                      r.result === 'success' ? 'green' : r.result === 'failure' ? 'red' : 'orange'
                    }
                  >
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
