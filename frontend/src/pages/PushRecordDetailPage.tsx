import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { recordsApi, type PushRecordDetail } from '../api/records';

function sourceLabel(source: PushRecordDetail['source']) {
  if (source === 'scheduler') return '定时';
  if (source === 'webhook') return 'Webhook';
  if (source === 'test_notification') return '测试通知';
  if (source === 'channel_api') return '渠道接口';
  return source;
}

export default function PushRecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showBody, setShowBody] = useState(false);

  const { data: record, isLoading } = useQuery({
    queryKey: ['record', id],
    queryFn: () => recordsApi.getDetail(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="page-stack"><div className="card">加载中...</div></div>;
  if (!record) return <div className="page-stack"><div className="card">记录不存在</div></div>;

  let requestBody: Record<string, unknown> = {};
  if (record.webhookLog?.requestBodyJson) {
    try { requestBody = JSON.parse(record.webhookLog.requestBodyJson); } catch { /* ignore */ }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="推送详情"
        description="查看推送记录的详细信息。"
        actions={
          <>
            <button className="ghost-button" onClick={() => navigate('/push-records')}>返回</button>
          </>
        }
      />
      <div className="detail-grid">
        <Card>
          <h3>基本信息</h3>
          <div className="stack-gap">
            <div className="detail-pair">
              <span className="muted-text">状态</span>
              <StatusBadge tone={record.status === 'success' ? 'green' : record.status === 'failure' ? 'red' : 'orange'}>
                {record.status === 'success' ? '成功' : record.status === 'failure' ? '失败' : '部分成功'}
              </StatusBadge>
            </div>
            <div className="detail-pair">
              <span className="muted-text">来源</span>
              <StatusBadge tone="blue">
                {sourceLabel(record.source)}
              </StatusBadge>
            </div>
            <div className="detail-pair">
              <span className="muted-text">推送时间</span>
              <span>{new Date(record.pushedAt).toLocaleString('zh-CN')}</span>
            </div>
            <div className="detail-pair">
              <span className="muted-text">创建时间</span>
              <span>{new Date(record.createdAt).toLocaleString('zh-CN')}</span>
            </div>
          </div>
        </Card>
        <Card>
          <h3>关联信息</h3>
          <div className="stack-gap">
            <div className="detail-pair">
              <span className="muted-text">通知</span>
              <Link to={`/notifications/${record.notificationId}`} className="text-link">{record.notificationName}</Link>
            </div>
            <div className="detail-pair">
              <span className="muted-text">渠道</span>
              <Link to={`/channels/${record.channelId}`} className="text-link">{record.channelName}</Link>
            </div>
            <div className="detail-pair">
              <span className="muted-text">渠道类型</span>
              <span>{record.channelType}</span>
            </div>
          </div>
        </Card>
        <Card>
          <h3>消息内容</h3>
          <div className="stack-gap">
            <div>
              <div className="field-label">标题</div>
              <div className="input-shell">{record.title}</div>
            </div>
            <div>
              <div className="field-label">正文</div>
              <div className="textarea-shell">{record.content}</div>
            </div>
          </div>
        </Card>
        {record.webhookLog && (
          <Card>
            <h3>Webhook 原始请求</h3>
            <div className="stack-gap">
              <div className="detail-pair">
                <span className="muted-text">请求时间</span>
                <span>{new Date(record.webhookLog.requestedAt).toLocaleString('zh-CN')}</span>
              </div>
              {record.webhookLog.sourceIp && (
                <div className="detail-pair">
                  <span className="muted-text">来源 IP</span>
                  <span style={{ fontFamily: 'monospace' }}>{record.webhookLog.sourceIp}</span>
                </div>
              )}
              <div>
                <div className="field-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  请求体 Body
                  <button className="ghost-button" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setShowBody(!showBody)}>
                    {showBody ? '隐藏 JSON' : '显示 JSON'}
                  </button>
                </div>
                {showBody ? (
                  <pre className="code-block" style={{ margin: 0 }}>{JSON.stringify(requestBody, null, 2)}</pre>
                ) : (
                  <div className="textarea-shell" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {JSON.stringify(requestBody)}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
        {record.errorMessage && (
          <Card>
            <h3>错误信息</h3>
            <div className="textarea-shell danger" style={{ color: 'var(--danger)' }}>
              {record.errorMessage}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
