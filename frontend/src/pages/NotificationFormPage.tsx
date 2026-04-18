import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import { Select } from '../components/common/Select';
import { PageHeader } from '../components/layout/PageHeader';
import { TriggerTypeSelector } from '../components/common/TriggerTypeSelector';
import { DateTimePopover } from '../components/common/DateTimePopover';
import { AiQuickCreateModal } from '../components/ai/AiQuickCreateModal';
import { CheckCircleIcon, SparklesIcon } from '../components/common/icons';
import { notificationsApi } from '../api/notifications';
import { channelsApi } from '../api/channels';
import { aiApi } from '../api/ai';
import { emitToast } from '../components/common/toast-events';
import type { Notification } from '../api/notifications';

const CRON_PART_PATTERN = /^([\d*/,-]+)$/;

const padNumber = (value: number) => value.toString().padStart(2, '0');

const formatDateValue = (date: Date) =>
  `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;

const parseScheduleParts = (value: string) => {
  if (!value) return { date: '', hour: '', minute: '', second: '' };

  const normalized = value.replace(' ', 'T');
  const matched = normalized.match(/^(\d{4}-\d{2}-\d{2})T?(\d{2})?:(\d{2})?(?::(\d{2}))?/);
  if (matched) {
    return {
      date: matched[1] ?? '',
      hour: matched[2] ?? '',
      minute: matched[3] ?? '',
      second: matched[4] ?? '',
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: '', hour: '', minute: '', second: '' };

  return {
    date: formatDateValue(parsed),
    hour: padNumber(parsed.getHours()),
    minute: padNumber(parsed.getMinutes()),
    second: padNumber(parsed.getSeconds()),
  };
};

const buildScheduleAt = (date: string, hour: string, minute: string, second: string) => {
  if (!date || !hour || !minute || !second) return '';
  return `${date}T${hour}:${minute}:${second}`;
};

const normalizeCronExpression = (cron: string) => cron.trim();

const isValidCronExpression = (cron: string) => {
  const normalizedCron = normalizeCronExpression(cron);
  const parts = normalizedCron.split(/\s+/);

  if ((parts.length !== 5 && parts.length !== 6) || parts.some((part) => !CRON_PART_PATTERN.test(part))) {
    return false;
  }

  return true;
};

const getDefaultNotificationDraft = (todayValue: string, sourceKey: string) => ({
  sourceKey,
  name: '',
  triggerType: 'once' as Notification['triggerType'],
  title: '',
  content: '',
  selectedChannels: [] as string[],
  selectedDate: todayValue,
  selectedHour: '09',
  selectedMinute: '00',
  selectedSecond: '00',
  cronExpression: '',
});

const getNotificationDraftFromExisting = (existing: Notification, todayValue: string) => {
  const scheduleValue = existing.triggerConfig.executeAt ?? existing.triggerConfig.scheduleAt ?? '';
  const parsedSchedule = parseScheduleParts(scheduleValue);

  return {
    sourceKey: existing.id,
    name: existing.name,
    triggerType: existing.triggerType,
    title: existing.title,
    content: existing.content,
    selectedChannels: existing.channels?.map((channel) => channel.id) ?? (existing.channelIds ?? []),
    selectedDate: parsedSchedule.date || todayValue,
    selectedHour: parsedSchedule.hour || '09',
    selectedMinute: parsedSchedule.minute || '00',
    selectedSecond: parsedSchedule.second || '00',
    cronExpression: existing.triggerConfig.cron ?? '',
  };
};

interface AiSessionLike {
  id: string;
  collectedParams: Record<string, unknown>;
}

const getNotificationDraftFromAiSession = (session: AiSessionLike, todayValue: string) => {
  const p = session.collectedParams as {
    name?: string;
    title?: string;
    content?: string;
    triggerType?: Notification['triggerType'];
    triggerConfig?: { executeAt?: string; cron?: string };
    channelIds?: string[];
  };
  const schedule = parseScheduleParts(p.triggerConfig?.executeAt ?? '');

  return {
    sourceKey: `ai-${session.id}`,
    name: p.name ?? '',
    triggerType: p.triggerType ?? 'once',
    title: p.title ?? '',
    content: p.content ?? '',
    selectedChannels: Array.isArray(p.channelIds) ? p.channelIds : [],
    selectedDate: schedule.date || todayValue,
    selectedHour: schedule.hour || '09',
    selectedMinute: schedule.minute || '00',
    selectedSecond: schedule.second || '00',
    cronExpression: p.triggerConfig?.cron ?? '',
  };
};

export default function NotificationFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = !!id;
  const todayValue = formatDateValue(new Date());

  const aiSessionId = useMemo(
    () => new URLSearchParams(location.search).get('ai_session'),
    [location.search],
  );

  const [draft, setDraft] = useState(() => getDefaultNotificationDraft(todayValue, 'new'));
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const { data: channels } = useQuery({
    queryKey: ['channels', { pageSize: 100 }],
    queryFn: () => channelsApi.list({ pageSize: 100 }),
  });

  const { data: existing } = useQuery({
    queryKey: ['notification', id],
    queryFn: () => notificationsApi.getDetail(id!),
    enabled: isEdit,
  });

  const { data: aiSession } = useQuery({
    queryKey: ['ai-session', aiSessionId],
    queryFn: () => aiApi.getSessionDetail(aiSessionId!),
    enabled: !!aiSessionId && !isEdit,
  });

  // 根据数据源派生期望的 draft。sourceKey 驱动：数据源变化时自动切换，
  // 用户本地编辑不会被重置（因为编辑后 draft.sourceKey === hydrated.sourceKey）。
  const hydratedDraft = useMemo(() => {
    if (isEdit && existing) return getNotificationDraftFromExisting(existing, todayValue);
    if (!isEdit && aiSession) return getNotificationDraftFromAiSession(aiSession, todayValue);
    return null;
  }, [isEdit, existing, aiSession, todayValue]);

  const currentDraft =
    hydratedDraft && draft.sourceKey !== hydratedDraft.sourceKey ? hydratedDraft : draft;

  type Draft = typeof draft;
  const patch = (changes: Partial<Draft>) => setDraft({ ...currentDraft, ...changes });
  const {
    name,
    triggerType,
    title,
    content,
    selectedChannels,
    selectedDate,
    selectedHour,
    selectedMinute,
    selectedSecond,
    cronExpression,
  } = currentDraft;

  const activeChannels = channels?.items.filter((c) => c.status === 'active') ?? [];
  const channelOptions = activeChannels.map((channel) => ({ value: channel.id, label: channel.name }));

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof notificationsApi.create>[0]) => notificationsApi.create(data),
    onSuccess: (data) => {
      if (aiSessionId) {
        aiApi.linkNotification(aiSessionId, data.id).catch(() => undefined);
      }
      emitToast('通知创建成功', 'success');
      navigate(`/notifications/${data.id}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof notificationsApi.update>[1]) => notificationsApi.update(id!, data),
    onSuccess: () => {
      emitToast('通知修改成功', 'success');
      navigate(`/notifications/${id}`);
    },
  });

  const handleSubmit = () => {
    if (selectedChannels.length === 0) {
      emitToast('请选择至少一个发送渠道', 'error');
      return;
    }

    const triggerConfig: Notification['triggerConfig'] = {};
    if (triggerType === 'once') {
      const executeAt = buildScheduleAt(selectedDate, selectedHour, selectedMinute, selectedSecond);
      if (!executeAt) {
        emitToast('请选择完整的触发时间', 'error');
        return;
      }
      triggerConfig.executeAt = executeAt;
    }
    if (triggerType === 'recurring') {
      const normalizedCron = normalizeCronExpression(cronExpression);
      if (!isValidCronExpression(normalizedCron)) {
        emitToast('Cron 表达式不合法', 'error');
        return;
      }
      triggerConfig.cron = normalizedCron;
    }

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
      {!isEdit && !aiSession && (
        <div
          className="preview-box"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            minHeight: 0,
          }}
        >
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <SparklesIcon size={16} />
            <strong>想更快？</strong>
            <span className="muted-text">
              一句话描述需求，AI 帮你自动填好所有字段。
            </span>
          </span>
          <button
            className="ghost-button"
            type="button"
            onClick={() => setAiModalOpen(true)}
          >
            打开 AI 对话
          </button>
        </div>
      )}
      {!isEdit && aiSession && (
        <div className="preview-box success" style={{ minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleIcon size={16} />
            <strong>已根据 AI 对话自动预填</strong>
          </div>
          <p className="muted-text" style={{ margin: '4px 0 0 0' }}>
            下方字段可自由修改，确认无误后点击"创建通知"。
          </p>
        </div>
      )}
      <AiQuickCreateModal open={aiModalOpen} onClose={() => setAiModalOpen(false)} />
      <Card className="stack-gap">
        <div>
          <h3>{isEdit ? '编辑配置' : '手动创建'}</h3>
          <p className="muted-text">按字段配置通知规则，适合精确创建。</p>
        </div>
        <div>
          <div className="field-label">触发类型</div>
          <TriggerTypeSelector
            value={triggerType}
            onChange={(value) => patch({ triggerType: value })}
          />
          <p className="helper-text">不同触发类型会显示不同的触发时间配置方式；单次通知支持精确到秒。</p>
        </div>
        <div className="form-grid two-columns">
          <div>
            <div className="field-label">通知名称</div>
            <input className="input-shell full-width" value={name} onChange={(e) => patch({ name: e.target.value })} placeholder="请输入通知名称" />
          </div>
          <div>
            <div className="field-label">发送渠道</div>
            {activeChannels.length > 0 ? (
              <Select
                className="input-shell full-width"
                multiple
                values={selectedChannels}
                onValuesChange={(values) => patch({ selectedChannels: values })}
                options={channelOptions}
                placeholder="请选择发送渠道"
              />
            ) : (
              <div className="input-shell full-width">暂无可用渠道</div>
            )}
            <p className="helper-text">请主动选择至少一个启用中的发送渠道。</p>
          </div>
          <div>
            <div className="field-label">标题</div>
            <input className="input-shell full-width" value={title} onChange={(e) => patch({ title: e.target.value })} placeholder="请输入通知标题" />
          </div>
          {triggerType !== 'webhook' && (
            <div>
              <div className="field-label">触发时间</div>
              {triggerType === 'once' ? (
                <DateTimePopover
                  value={{ date: selectedDate, hour: selectedHour, minute: selectedMinute, second: selectedSecond }}
                  minDate={todayValue}
                  onConfirm={({ date, hour, minute, second }) => {
                    patch({
                      selectedDate: date,
                      selectedHour: hour,
                      selectedMinute: minute,
                      selectedSecond: second,
                    });
                  }}
                />
              ) : (
                <>
                  <div className="input-shell highlight stack-gap">
                    <input className="full-width" value={cronExpression} onChange={(e) => patch({ cronExpression: e.target.value })} placeholder="支持 5 位或 6 位 Cron" style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit' }} />
                  </div>
                  <p className="helper-text">5 位：分 时 日 月 周；6 位：秒 分 时 日 月 周。</p>
                </>
              )}
            </div>
          )}
        </div>
        <div>
          <div className="field-label">正文</div>
          <textarea className="textarea-shell full-width" value={content} onChange={(e) => patch({ content: e.target.value })} placeholder="请输入通知正文..." />
        </div>
        <div className="preview-box">
          <strong>触发类型说明</strong>
          <ul className="bullet-list">
            <li>单次通知：在指定时间触发一次</li>
            <li>周期性通知：按 Cron 表达式循环触发</li>
            <li>Webhook 通知：提供 Webhook URL 供外部调用触发</li>
          </ul>
        </div>
        {triggerType === 'webhook' && (
          <div className="preview-box success">
            <strong>Webhook 调用规则</strong>
            <ul className="bullet-list" style={{ marginTop: 8 }}>
              <li>
                请求体可携带 <code>title</code> / <code>content</code>，若非空将
                <strong>覆盖</strong>上方预设；未传则使用预设值。
              </li>
              <li>
                预设或覆盖后的文本均支持 <code>{'{{body.xxx}}'}</code> 占位符，例如在标题中写
                <code>{'{{body.device.name}} 告警'}</code>，调用时传入 <code>device.name</code> 即会被替换。
              </li>
              <li>创建完成后可在详情页查看调用路径、复制 Token 与代码示例。</li>
            </ul>
          </div>
        )}
        <div className="form-actions">
          <button className="primary-button" type="button" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
            {isEdit ? '保存修改' : '创建通知'}
          </button>
        </div>
      </Card>
    </div>
  );
}
