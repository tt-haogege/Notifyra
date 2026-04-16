import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Cable, Bell, FlaskConical, History, type LucideIcon } from 'lucide-react';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { notificationsApi } from '../api/notifications';
import { channelsApi } from '../api/channels';
import { recordsApi } from '../api/records';

export default function OverviewPage() {
  // 截断到天，避免毫秒级时间戳每次渲染不同导致 queryKey 变化引发无限请求
  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);

  const { data: notifications } = useQuery({
    queryKey: ['notifications', { pageSize: 100 }],
    queryFn: () => notificationsApi.list({ pageSize: 100 }),
  });

  const { data: channels } = useQuery({
    queryKey: ['channels', { pageSize: 100 }],
    queryFn: () => channelsApi.list({ pageSize: 100 }),
  });

  const { data: recentRecords } = useQuery({
    queryKey: ['recentRecords', { pageSize: 5 }],
    queryFn: () => recordsApi.list({ pageSize: 5 }),
  });

  const { data: weeklyRecords } = useQuery({
    queryKey: ['weeklyRecords', { pageSize: 100, startDate }],
    queryFn: () => recordsApi.list({ pageSize: 100, startDate }),
  });

  const activeNotifications = notifications?.items.filter((n) => n.status === 'active').length ?? 0;
  const totalNotifications = notifications?.total ?? 0;
  const activeChannels = channels?.items.filter((c) => c.status === 'active').length ?? 0;
  const sevenDaySuccess = weeklyRecords?.items.filter((r) => r.status === 'success').length ?? 0;
  const sevenDayFailure = weeklyRecords?.items.filter((r) => r.status === 'failure').length ?? 0;

  const shortcuts: { title: string; description: string; to: string; tone: string; icon: LucideIcon }[] = [
    { title: '添加渠道', description: '绑定第一个通知渠道', to: '/channels/new',    tone: 'indigo', icon: Cable },
    { title: '新建通知', description: '创建你的第一条通知', to: '/notifications/new', tone: 'blue',   icon: Bell },
    { title: '测试模块', description: '验证渠道连通性',     to: '/test',            tone: 'green',  icon: FlaskConical },
    { title: '推送记录', description: '查看近期推送结果',   to: '/push-records',    tone: 'orange', icon: History },
  ];

  return (
    <div className="page-stack">
      <PageHeader title="概览" description="通知状态概览、快速操作入口与最近推送记录。" />
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="hero-metric-card">
          <div className="mb-2 text-[13px] text-app-muted">通知总览</div>
          <div className="text-4xl font-extrabold text-app-text sm:text-5xl">{totalNotifications}</div>
          <div className="mt-1 text-sm text-app-muted">已创建通知</div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-app-input-border bg-app-input p-4">
              <div className="mb-2 text-[13px] font-bold text-app-muted">活跃通知</div>
              <div className="text-3xl font-extrabold text-app-text">{activeNotifications}</div>
            </div>
            <div className="rounded-2xl border border-app-input-border bg-app-input p-4">
              <div className="mb-2 text-[13px] font-bold text-app-muted">活跃渠道</div>
              <div className="text-3xl font-extrabold text-app-text">{activeChannels}</div>
            </div>
            <div className="rounded-2xl border border-app-input-border bg-app-input p-4">
              <div className="mb-2 text-[13px] font-bold text-app-muted">7 天成功</div>
              <div className="text-3xl font-extrabold text-app-success">{sevenDaySuccess}</div>
            </div>
            <div className="rounded-2xl border border-app-input-border bg-app-input p-4">
              <div className="mb-2 text-[13px] font-bold text-app-muted">7 天失败</div>
              <div className={`text-3xl font-extrabold ${sevenDayFailure > 0 ? 'text-[#fca5a5]' : 'text-app-text'}`}>
                {sevenDayFailure}
              </div>
            </div>
          </div>
        </Card>
        <Card className="stack-gap">
          <h3>快捷操作</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {shortcuts.map((s) => (
              <Link
                className={`shortcut-card ${s.tone} no-underline transition hover:-translate-y-0.5`}
                key={s.to}
                to={s.to}
              >
                <div className="shortcut-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={18} strokeWidth={2} color="white" />
                </div>
                <div className="grid gap-1">
                  <div className="font-bold text-app-text">{s.title}</div>
                  <div className="text-sm text-app-muted">{s.description}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
      <Card className="stack-gap">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3>最近推送记录</h3>
          <Link className="text-sm font-medium text-app-primary no-underline" to="/push-records">
            查看全部
          </Link>
        </div>
        <div className="grid gap-2">
          {recentRecords?.items.map((r) => (
            <Link
              className="hover-slide flex flex-col gap-3 rounded-2xl bg-[var(--muted-card)] px-4 py-4 text-app-text no-underline transition sm:flex-row sm:items-center sm:justify-between"
              key={r.id}
              to={`/push-records/${r.id}`}
            >
              <span className="text-sm text-app-muted">{new Date(r.pushedAt).toLocaleString('zh-CN')}</span>
              <strong className="font-semibold">{r.notificationName}</strong>
              <span className="text-sm text-app-muted">{r.channelName}</span>
              <span className={`status-badge ${r.status === 'success' ? 'green' : r.status === 'failure' ? 'red' : 'orange'}`}>
                {r.status === 'success' ? '成功' : r.status === 'failure' ? '失败' : '部分成功'}
              </span>
            </Link>
          ))}
          {(!recentRecords?.items || recentRecords.items.length === 0) && (
            <div className="rounded-2xl bg-[var(--muted-card)] px-4 py-4 text-sm text-app-muted">暂无推送记录</div>
          )}
        </div>
      </Card>
    </div>
  );
}
