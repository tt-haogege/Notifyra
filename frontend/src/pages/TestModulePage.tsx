import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { Select } from '../components/common/Select';
import { channelsApi } from '../api/channels';
import { notificationsApi } from '../api/notifications';
import { testApi } from '../api/test';
import { emitToast } from '../components/common/Toast';
import { CHANNEL_TYPE_LABELS } from '../constants/channelTypes';

type TestTab = 'notification' | 'channel';
type CodeLang = 'curl' | 'javascript' | 'python';

export default function TestModulePage() {
  const [tab, setTab] = useState<TestTab>('channel');
  const [codeLang, setCodeLang] = useState<CodeLang>('curl');

  const [channelId, setChannelId] = useState('');
  const [channelTitle, setChannelTitle] = useState('测试通知');
  const [channelContent, setChannelContent] = useState('这是一条测试消息，用于验证渠道配置是否正确。');
  const [channelResult, setChannelResult] = useState<string | null>(null);

  const [notificationId, setNotificationId] = useState('');
  const [overrideTitle, setOverrideTitle] = useState('');
  const [overrideContent, setOverrideContent] = useState('');
  const [notificationResult, setNotificationResult] = useState<string | null>(null);

  const { data: channels } = useQuery({
    queryKey: ['channels', { pageSize: 100 }],
    queryFn: () => channelsApi.list({ pageSize: 100 }),
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', { pageSize: 100 }],
    queryFn: () => notificationsApi.list({ pageSize: 100 }),
  });

  const activeChannels = (channels?.items ?? []).filter((c) => c.status === 'active');
  const activeNotifications = (notifications?.items ?? []).filter((n) => n.status === 'active');

  const { data: codeData } = useQuery({
    queryKey: ['test-code', tab, codeLang],
    queryFn: () =>
      testApi.getCode({
        type: tab,
        lang: codeLang,
        webhookToken: '{webhookToken}',
        channelToken: '{channelToken}',
      }),
  });

  const sendChannelMutation = useMutation({
    mutationFn: () => testApi.sendChannel(channelId, { title: channelTitle, content: channelContent }),
    onSuccess: (data) => {
      setChannelResult(data.success ? 'ok' : 'fail');
      if (data.success) emitToast('测试渠道发送成功', 'success');
    },
    onError: () => setChannelResult('fail'),
  });

  const sendNotificationMutation = useMutation({
    mutationFn: () => testApi.sendNotification(notificationId, {
      ...(overrideTitle && { overrideTitle }),
      ...(overrideContent && { overrideContent }),
    }),
    onSuccess: (data) => {
      setNotificationResult(data.success ? 'ok' : 'fail');
      if (data.success) emitToast('测试通知发送成功', 'success');
    },
    onError: () => setNotificationResult('fail'),
  });

  const handleCodeLangChange = (lang: CodeLang) => {
    setCodeLang(lang);
  };

  const handleSend = () => {
    if (tab === 'channel') {
      if (!channelId) { setChannelResult('fail'); return; }
      sendChannelMutation.mutate();
    } else {
      if (!notificationId) { setNotificationResult('fail'); return; }
      sendNotificationMutation.mutate();
    }
  };

  const isSending = tab === 'channel' ? sendChannelMutation.isPending : sendNotificationMutation.isPending;
  const resultOk = tab === 'channel' ? channelResult === 'ok' : notificationResult === 'ok';
  const resultFail = tab === 'channel' ? channelResult === 'fail' : notificationResult === 'fail';
  const code = codeData?.code ?? '示例代码加载中...';

  return (
    <div className="page-stack">
      <PageHeader
        title="测试模块"
        description="验证通知或渠道是否工作正常，并查看接入示例代码。"
      />
      <div className="segment-tabs">
        <button
          className={`segment-tab ${tab === 'notification' ? 'active' : ''}`}
          onClick={() => { setTab('notification'); setChannelResult(null); setNotificationResult(null); }}
        >
          测试通知
        </button>
        <button
          className={`segment-tab ${tab === 'channel' ? 'active' : ''}`}
          onClick={() => { setTab('channel'); setChannelResult(null); setNotificationResult(null); }}
        >
          测试渠道
        </button>
      </div>
      <div className="two-panel-layout test-module-layout">
        <div className="stack-gap" style={{ minWidth: 0 }}>
          {tab === 'channel' ? (
            <Card className="stack-gap">
              <div>
                <h3>测试渠道</h3>
                <p className="muted-text">选择一个活跃渠道，填写标题和内容，然后发送测试消息。</p>
              </div>
              <div>
                <div className="field-label">选择渠道</div>
                <Select
                  className="input-shell full-width"
                  value={channelId}
                  onChange={setChannelId}
                  options={[
                    { value: '', label: '请选择渠道...' },
                    ...activeChannels.map((ch) => ({ value: ch.id, label: `${ch.name}（${CHANNEL_TYPE_LABELS[ch.type] || ch.type}）` })),
                  ]}
                />
              </div>
              <div>
                <div className="field-label">标题</div>
                <input className="input-shell full-width" value={channelTitle} onChange={(e) => setChannelTitle(e.target.value)} placeholder="请输入测试标题" />
              </div>
              <div>
                <div className="field-label">内容</div>
                <textarea className="textarea-shell full-width" value={channelContent} onChange={(e) => setChannelContent(e.target.value)} placeholder="请输入测试内容" rows={4} />
              </div>
              <div className="form-actions">
                <button className="ghost-button" type="button" onClick={() => window.location.href = '/channels/new'}>去创建渠道</button>
                <button className="primary-button" type="button" onClick={handleSend} disabled={isSending || !channelId}>
                  {isSending ? '发送中...' : '发送测试'}
                </button>
              </div>
              {resultOk && (
                <div className="preview-box success">
                  <strong>发送成功</strong>
                </div>
              )}
              {resultFail && (
                <div className="preview-box danger">
                  <strong>发送失败，请检查渠道配置</strong>
                </div>
              )}
            </Card>
          ) : (
            <Card className="stack-gap">
              <div>
                <h3>测试通知</h3>
                <p className="muted-text">选择一条活跃通知，按其当前配置执行一次测试发送。</p>
              </div>
              <div>
                <div className="field-label">选择通知</div>
                <Select
                  className="input-shell full-width"
                  value={notificationId}
                  onChange={setNotificationId}
                  options={[
                    { value: '', label: '请选择通知...' },
                    ...activeNotifications.map((n) => ({ value: n.id, label: n.name })),
                  ]}
                />
              </div>
              <div>
                <div className="field-label">覆盖标题（可选）</div>
                <input className="input-shell full-width" value={overrideTitle} onChange={(e) => setOverrideTitle(e.target.value)} placeholder="留空则使用通知配置的标题" />
              </div>
              <div>
                <div className="field-label">覆盖内容（可选）</div>
                <textarea className="textarea-shell full-width" value={overrideContent} onChange={(e) => setOverrideContent(e.target.value)} placeholder="留空则使用通知配置的内容" rows={4} />
              </div>
              <div className="form-actions">
                <button className="ghost-button" type="button" onClick={() => window.location.href = '/notifications/new'}>去创建通知</button>
                <button className="primary-button" type="button" onClick={handleSend} disabled={isSending || !notificationId}>
                  {isSending ? '发送中...' : '发送测试'}
                </button>
              </div>
              {resultOk && (
                <div className="preview-box success">
                  <strong>发送成功</strong>
                </div>
              )}
              {resultFail && (
                <div className="preview-box danger">
                  <strong>发送失败，请检查通知配置</strong>
                </div>
              )}
            </Card>
          )}

          {tab === 'channel' ? (
            <Card>
              <h3>渠道状态</h3>
              <div className="recent-list">
                {activeChannels.length > 0 ? (
                  activeChannels.map((ch) => (
                    <div className="recent-row" key={ch.id}>
                      <span className="row-title">{ch.name}</span>
                      <StatusBadge tone="blue">{CHANNEL_TYPE_LABELS[ch.type] || ch.type}</StatusBadge>
                      <StatusBadge tone="green">活跃</StatusBadge>
                    </div>
                  ))
                ) : (
                  <div className="muted-text">暂无活跃渠道</div>
                )}
              </div>
            </Card>
          ) : (
            <Card>
              <h3>通知状态</h3>
              <div className="recent-list">
                {activeNotifications.length > 0 ? (
                  activeNotifications.map((n) => (
                    <Link className="recent-row" key={n.id} to={`/notifications/${n.id}`}>
                      <span className="row-title">{n.name}</span>
                      <StatusBadge tone="blue">{n.triggerType === 'once' ? '单次' : n.triggerType === 'recurring' ? '循环' : 'Webhook'}</StatusBadge>
                      <StatusBadge tone="green">活跃</StatusBadge>
                    </Link>
                  ))
                ) : (
                  <div className="muted-text">暂无活跃通知</div>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="stack-gap" style={{ minWidth: 0 }}>
          <Card>
            <div className="code-tabs-header">
              <h3>示例代码</h3>
              <div className="code-tabs-nav">
                {(['curl', 'javascript', 'python'] as CodeLang[]).map((lang) => (
                  <button
                    key={lang}
                    className={`code-tab ${codeLang === lang ? 'active' : ''}`}
                    onClick={() => handleCodeLangChange(lang)}
                  >
                    {lang === 'curl' ? 'curl' : lang === 'javascript' ? 'JavaScript' : 'Python'}
                  </button>
                ))}
              </div>
            </div>
            <pre className="code-block">{code}</pre>
            <div className="helper-text" style={{ marginTop: 8 }}>
              {tab === 'channel'
                ? '渠道示例代码来自开放接口 /open/channels/{channelToken}/send。请先到渠道详情页生成或重置 token，再将 {channelToken} 替换为真实值。'
                : '通知示例代码来自开放接口 /open/webhook/notify/{webhookToken}。请先到通知详情页生成或重置 token，再将 {webhookToken} 替换为真实值。'}
            </div>
          </Card>
          <Card>
            <h3>提示说明</h3>
            <div className="stack-gap">
              <p className="muted-text">
                {tab === 'channel'
                  ? '左侧“发送测试”直接调用已登录的测试接口；右侧示例代码由 /test/code 生成，展示对外开放渠道接口的调用方式。'
                  : '左侧“发送测试”按当前通知配置执行一次内部测试；右侧示例代码由 /test/code 生成，展示外部系统触发 webhook 通知的方式。'}
              </p>
              <Link className="text-link" to={tab === 'channel' ? '/channels' : '/notifications'}>
                {tab === 'channel' ? '前往渠道列表管理 Token' : '前往通知列表管理 Webhook Token'}
              </Link>
              <Link className="text-link" to="/push-records">查看推送记录</Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
