import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { Select } from '../components/common/Select';
import { recordsApi, type PushRecordListItem } from '../api/records';
import { notificationsApi } from '../api/notifications';

function sourceLabel(source: PushRecordListItem['source']) {
  if (source === 'scheduler') return '定时';
  if (source === 'webhook') return 'Webhook';
  if (source === 'test_notification') return '测试通知';
  if (source === 'channel_api') return '渠道接口';
  return source;
}

export default function PushRecordsListPage() {
  const [page, setPage] = useState(1);
  const [resultFilter, setResultFilter] = useState('');
  const [notificationFilter, setNotificationFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data } = useQuery({
    queryKey: ['records', page, resultFilter, notificationFilter, startDate, endDate],
    queryFn: () =>
      recordsApi.list({
        page,
        pageSize: 20,
        ...(resultFilter && { result: resultFilter as PushRecordListItem['status'] }),
        ...(notificationFilter && { notificationId: notificationFilter }),
        ...(startDate && { startDate: new Date(startDate).toISOString() }),
        ...(endDate && { endDate: new Date(endDate + 'T23:59:59').toISOString() }),
      }),
  });

  const { data: notificationsList } = useQuery({
    queryKey: ['notifications', { pageSize: 100 }],
    queryFn: () => notificationsApi.list({ pageSize: 100 }),
  });

  const notificationOptions = [
    { value: '', label: '通知：全部' },
    ...(notificationsList?.items.map((n) => ({ value: n.id, label: n.name })) ?? []),
  ];

  const resetFilters = () => {
    setResultFilter('');
    setNotificationFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const hasFilter = resultFilter || notificationFilter || startDate || endDate;

  return (
    <div className="page-stack">
      <PageHeader
        title="推送记录"
        description="查看所有通知的推送历史与状态。"
      />
      <Card>
        <div className="filters-grid">
          <Select
            className="input-shell"
            value={resultFilter}
            onChange={(v) => { setResultFilter(v); setPage(1); }}
            options={[
              { value: '', label: '状态：全部' },
              { value: 'success', label: '成功' },
              { value: 'failure', label: '失败' },
              { value: 'partial', label: '部分成功' },
            ]}
          />
          <Select
            className="input-shell"
            value={notificationFilter}
            onChange={(v) => { setNotificationFilter(v); setPage(1); }}
            options={notificationOptions}
          />
          <input
            type="date"
            className="input-shell"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            style={{ padding: '8px 16px', cursor: 'pointer' }}
          />
          <input
            type="date"
            className="input-shell"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            style={{ padding: '8px 16px', cursor: 'pointer' }}
          />
          {hasFilter && (
            <button className="ghost-button" type="button" onClick={resetFilters}>重置</button>
          )}
        </div>
      </Card>
      <div className="table-card">
        <div className="table-header records-grid">
          <div>时间</div>
          <div>通知</div>
          <div>渠道</div>
          <div>标题</div>
          <div>来源</div>
          <div>状态</div>
        </div>
        {!data || data.items.length === 0 ? (
          <div className="table-empty">
            <span style={{ fontSize: 24 }}>—</span>
            <span>暂无推送记录</span>
          </div>
        ) : (
          data.items.map((r) => (
            <div className="table-row link-row records-grid" key={r.id}>
              <div style={{ fontSize: 'var(--text-sm)' }}>
                {new Date(r.pushedAt).toLocaleString('zh-CN')}
              </div>
              <div>
                <Link to={`/notifications/${r.notificationId}`} className="row-title">{r.notificationName}</Link>
              </div>
              <div>
                <Link to={`/channels/${r.channelId}`} className="text-link">{r.channelName}</Link>
              </div>
              <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                {sourceLabel(r.source)}
              </div>
              <div>
                <StatusBadge tone={r.status === 'success' ? 'green' : r.status === 'failure' ? 'red' : 'orange'}>
                  {r.status === 'success' ? '成功' : r.status === 'failure' ? '失败' : '部分成功'}
                </StatusBadge>
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
    </div>
  );
}
