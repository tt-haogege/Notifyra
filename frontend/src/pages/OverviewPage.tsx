import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { notificationsApi } from '../api/notifications';
import { channelsApi } from '../api/channels';
import { recordsApi } from '../api/records';

export default function OverviewPage() {
  // 最近 7 天统计
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startDate = sevenDaysAgo.toISOString();

  const { data: notifications } = useQuery({
    queryKey: ['notifications', { pageSize: 100 }],
    queryFn: () => notificationsApi.list({ pageSize: 100 }),
  });

  const { data: channels } = useQuery({
    queryKey: ['channels', { pageSize: 100 }],
    queryFn: () => channelsApi.list({ pageSize: 100 }),
  });

  const { data: records } = useQuery({
    queryKey: ['records', { pageSize: 100, startDate }],
    queryFn: () => recordsApi.list({ pageSize: 100, startDate }),
  });

  const activeNotifications = notifications?.items.filter((n) => n.status === 'active').length ?? 0;
  const totalNotifications = notifications?.total ?? 0;
  const activeChannels = channels?.items.filter((c) => c.status === 'active').length ?? 0;
  const sevenDaySuccess = records?.items.filter((r) => r.status === 'success').length ?? 0;
  const sevenDayFailed = records?.items.filter((r) => r.status === 'failed').length ?? 0;

  const shortcuts = [
    { title: '添加渠道', description: '绑定第一个通知渠道', to: '/channels/new', tone: 'indigo' },
    { title: '新建通知', description: '创建你的第一条通知', to: '/notifications/new', tone: 'blue' },
    { title: '测试模块', description: '验证渠道连通性', to: '/test', tone: 'green' },
    { title: '推送记录', description: '查看近期推送结果', to: '/push-records', tone: 'orange' },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="概览"
        description="通知状态概览、快速操作入口与最近推送记录。"
      />
      <div className="overview-grid">
        <Card className="hero-metric-card">
          <div className="eyebrow">通知总览</div>
          <div className="hero-metric-value">{totalNotifications}</div>
          <div className="hero-metric-subtitle">已创建通知</div>
          <div className="metric-grid">
            <div className="metric-box">
              <div className="metric-label">活跃通知</div>
              <div className="metric-value">{activeNotifications}</div>
            </div>
            <div className="metric-box">
              <div className="metric-label">活跃渠道</div>
              <div className="metric-value">{activeChannels}</div>
            </div>
            <div className="metric-box">
              <div className="metric-label">7 天成功</div>
              <div className="metric-value success">{sevenDaySuccess}</div>
            </div>
            <div className="metric-box">
              <div className="metric-label">7 天失败</div>
              <div className={`metric-value ${sevenDayFailed > 0 ? 'danger' : ''}`}>{sevenDayFailed}</div>
            </div>
          </div>
        </Card>
        <Card>
          <h3>快捷操作</h3>
          <div className="shortcut-grid">
            {shortcuts.map((s) => (
              <Link className={`shortcut-card ${s.tone}`} key={s.to} to={s.to}>
                <div className="shortcut-icon" />
                <div>
                  <div className="row-title">{s.title}</div>
                  <div className="row-subtitle">{s.description}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
      <Card>
        <div className="section-header">
          <h3>最近推送记录</h3>
          <Link className="text-link" to="/push-records">
            查看全部
          </Link>
        </div>
        <div className="recent-list">
          {records?.items.slice(0, 5).map((r) => (
            <Link className="recent-row" key={r.id} to={`/push-records/${r.id}`}>
              <span>{new Date(r.pushedAt).toLocaleString('zh-CN')}</span>
              <strong>{r.notificationName}</strong>
              <span>{r.channelName}</span>
              <span className={`status-badge ${r.status === 'success' ? 'green' : r.status === 'failed' ? 'red' : 'blue'}`}>
                {r.status === 'success' ? '成功' : r.status === 'failed' ? '失败' : '处理中'}
              </span>
            </Link>
          ))}
          {(!records?.items || records.items.length === 0) && (
            <div className="muted-text" style={{ padding: 16 }}>暂无推送记录</div>
          )}
        </div>
      </Card>
    </div>
  );
}
