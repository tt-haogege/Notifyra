import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { TriggerTypeSelector } from '../components/common/TriggerTypeSelector';
import { notificationsApi } from '../api/notifications';
import { channelsApi } from '../api/channels';
import { emitToast } from '../components/common/Toast';
import type { Notification } from '../api/notifications';

export default function NotificationFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<Notification['triggerType']>('once');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [scheduleAt, setScheduleAt] = useState('');
  const [cronExpression, setCronExpression] = useState('');

  const { data: channels } = useQuery({
    queryKey: ['channels', { pageSize: 100 }],
    queryFn: () => channelsApi.list({ pageSize: 100 }),
  });

  const { data: existing } = useQuery({
    queryKey: ['notification', id],
    queryFn: () => notificationsApi.getDetail(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setTriggerType(existing.triggerType);
      setTitle(existing.title);
      setContent(existing.content);
      setSelectedChannels(existing.channels?.map((c) => c.id) ?? (existing.channelIds ?? []));
      if (existing.triggerConfig.executeAt || existing.triggerConfig.scheduleAt) {
        setScheduleAt(existing.triggerConfig.executeAt ?? existing.triggerConfig.scheduleAt ?? '');
      }
      if (existing.triggerConfig.cron) setCronExpression(existing.triggerConfig.cron);
    }
  }, [existing]);

  const activeChannels = channels?.items.filter((c) => c.status === 'active') ?? [];

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof notificationsApi.create>[0]) => notificationsApi.create(data),
    onSuccess: () => {
      emitToast('通知创建成功', 'success');
      navigate('/notifications');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof notificationsApi.update>[1]) => notificationsApi.update(id!, data),
    onSuccess: () => {
      emitToast('通知修改成功', 'success');
      navigate(`/notifications/${id}`);
    },
  });

  const toggleChannel = (chId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(chId) ? prev.filter((c) => c !== chId) : [...prev, chId]
    );
  };

  const handleSubmit = () => {
    const triggerConfig: Notification['triggerConfig'] = {};
    if (triggerType === 'once') triggerConfig.executeAt = scheduleAt;
    if (triggerType === 'recurring') triggerConfig.cron = cronExpression;

    const payload = { name, triggerType, title, content, channelIds: selectedChannels, triggerConfig };
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  return (
    <div className="page-stack">
      <PageHeader
        title={isEdit ? '编辑通知' : '新建通知'}
        description={isEdit ? '调整通知内容、渠道和触发方式。' : '通过 AI 对话或手动填写，创建一条新的通知。'}
        actions={
          <button className="ghost-button" type="button" onClick={() => navigate('/notifications')}>取消</button>
        }
      />
      <Card className="stack-gap">
        <div>
          <h3>{isEdit ? '编辑配置' : '手动创建'}</h3>
          <p className="muted-text">按字段配置通知规则，适合精确创建。</p>
        </div>
        <div>
          <div className="field-label">触发类型</div>
          <TriggerTypeSelector value={triggerType} onChange={setTriggerType} />
          <p className="helper-text">不同触发类型会显示不同的触发时间配置方式。</p>
        </div>
        <div className="form-grid two-columns">
          <div>
            <div className="field-label">通知名称</div>
            <input className="input-shell full-width" value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入通知名称" />
          </div>
          <div>
            <div className="field-label">发送渠道</div>
            <div className="input-shell">
              {activeChannels.length > 0 ? (
                <div className="tag-list">
                  {activeChannels.map((ch) => (
                    <button
                      key={ch.id}
                      className={`tag ${selectedChannels.includes(ch.id) ? 'active' : ''}`}
                      style={{ cursor: 'pointer', background: selectedChannels.includes(ch.id) ? 'var(--primary)' : undefined, color: selectedChannels.includes(ch.id) ? 'white' : undefined }}
                      onClick={() => toggleChannel(ch.id)}
                      type="button"
                    >
                      {ch.name}
                    </button>
                  ))}
                </div>
              ) : '暂无可用渠道'}
            </div>
          </div>
          <div>
            <div className="field-label">标题</div>
            <input className="input-shell full-width" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="请输入通知标题" />
          </div>
          {triggerType !== 'webhook' && (
          <div>
            <div className="field-label">触发时间</div>
            <div className="input-shell highlight">
              {triggerType === 'once' ? (
                <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', color: 'inherit' }} />
              ) : (
                <input className="full-width" value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} placeholder="0 * * * *" style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit' }} />
              )}
            </div>
          </div>
          )}
        </div>
        <div>
          <div className="field-label">正文</div>
          <textarea className="textarea-shell full-width" value={content} onChange={(e) => setContent(e.target.value)} placeholder="请输入通知正文..." />
        </div>
        <div className="preview-box">
          <strong>触发类型说明</strong>
          <ul className="bullet-list">
            <li>单次通知：在指定时间触发一次</li>
            <li>周期性通知：按 Cron 表达式循环触发</li>
            <li>Webhook 通知：提供 Webhook URL 供外部调用触发</li>
          </ul>
        </div>
        <div className="form-actions">
          <button className="primary-button" type="button" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
            {isEdit ? '保存修改' : '创建通知'}
          </button>
        </div>
      </Card>
    </div>
  );
}
