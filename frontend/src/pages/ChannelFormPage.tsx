import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { Select } from '../components/common/Select';
import { channelsApi, type ChannelType, type CreateChannelDto, type UpdateChannelDto } from '../api/channels';
import { CHANNEL_TYPE_OPTIONS } from '../constants/channelTypes';
import { emitToast } from '../components/common/toast-events';

const configFields: Record<ChannelType, { key: string; label: string; placeholder: string }[]> = {
  bark: [
    { key: 'serverUrl', label: 'Bark Server URL', placeholder: 'https://api.day.app/你的Token' },
    { key: 'redirectUrl', label: '重定向 URL（可选）', placeholder: 'https://example.com' },
  ],
  wecom_webhook: [
    { key: 'webhook', label: 'Webhook URL', placeholder: 'https://qyapi.weixin.qq.com/...' },
  ],
  dingtalk_webhook: [
    { key: 'webhook', label: 'Webhook URL', placeholder: 'https://oapi.dingtalk.com/...' },
  ],
  feishu_webhook: [
    { key: 'webhook', label: 'Webhook URL', placeholder: 'https://open.feishu.cn/...' },
  ],
  generic_webhook: [
    { key: 'webhook', label: 'Webhook URL', placeholder: 'https://example.com/webhook' },
  ],
  pushplus: [
    { key: 'token', label: 'PushPlus Token', placeholder: 'your-pushplus-token' },
  ],
};

const toFlatConfig = (config: Record<string, unknown> | null | undefined) => {
  const flatConfig: Record<string, string> = {};
  if (!config) return flatConfig;
  Object.entries(config).forEach(([key, value]) => {
    flatConfig[key] = String(value);
  });
  return flatConfig;
};

export default function ChannelFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [draft, setDraft] = useState<{
    name?: string;
    type?: ChannelType;
    config?: Record<string, string>;
    retryCount?: number;
  }>({});

  const { data: existing } = useQuery({
    queryKey: ['channel', id],
    queryFn: () => channelsApi.getDetail(id!),
    enabled: isEdit,
  });

  const existingConfig = toFlatConfig(existing?.config);
  const name = draft.name ?? existing?.name ?? '';
  const type = draft.type ?? existing?.type ?? 'bark';
  const config = draft.config ?? existingConfig;
  const retryCount = draft.retryCount ?? (existing ? (existing.retryCount ?? 3) : 0);

  const createMutation = useMutation({
    mutationFn: (data: CreateChannelDto) => channelsApi.create(data),
    onSuccess: (data) => {
      emitToast('渠道创建成功', 'success');
      navigate(`/channels/${data.id}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateChannelDto) => channelsApi.update(id!, data),
    onSuccess: () => {
      emitToast('渠道修改成功', 'success');
      navigate(`/channels/${id}`);
    },
  });

  const updateConfig = (key: string, value: string) => {
    setDraft((prev) => ({
      ...prev,
      config: { ...(prev.config ?? config), [key]: value },
    }));
  };

  const handleSubmit = () => {
    if (isEdit) {
      const payload: UpdateChannelDto = {
        name,
        config: config as Record<string, unknown>,
        retryCount,
      };
      updateMutation.mutate(payload);
      return;
    }

    const payload: CreateChannelDto = {
      name,
      type,
      config: config as Record<string, unknown>,
      retryCount,
    };
    createMutation.mutate(payload);
  };

  const fields = configFields[type] || [];

  return (
    <div className="page-stack">
      <PageHeader
        title={isEdit ? '编辑渠道' : '新建渠道'}
        description={isEdit ? '调整渠道配置。' : '添加一个新的通知渠道。'}
        actions={
          <button className="ghost-button" type="button" onClick={() => navigate('/channels')}>取消</button>
        }
      />
      <Card className="stack-gap">
        <div>
          <h3>{isEdit ? '编辑配置' : '创建渠道'}</h3>
          <p className="muted-text">填写渠道信息与认证配置。</p>
        </div>
        <div className="form-grid two-columns">
          <div>
            <div className="field-label">渠道名称</div>
            <input
              className="input-shell full-width"
              value={name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="请输入渠道名称"
            />
          </div>
          <div>
            <div className="field-label">渠道类型</div>
            <Select
              className="input-shell full-width"
              value={type}
              onChange={(value) => setDraft((prev) => ({ ...prev, type: value as ChannelType }))}
              options={CHANNEL_TYPE_OPTIONS}
            />
          </div>
          <div>
            <div className="field-label">重试次数</div>
            <input
              className="input-shell full-width"
              type="number"
              value={retryCount}
              onChange={(e) => setDraft((prev) => ({ ...prev, retryCount: Number(e.target.value) }))}
              min={0}
              max={3}
            />
          </div>
        </div>
        {fields.map((field) => (
          <div key={field.key}>
            <div className="field-label">{field.label}</div>
            <input
              className="input-shell full-width"
              value={config[field.key] || ''}
              onChange={(e) => updateConfig(field.key, e.target.value)}
              placeholder={field.placeholder}
            />
          </div>
        ))}
        <div className="form-actions">
          <button className="primary-button" type="button" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
            {isEdit ? '保存修改' : '创建渠道'}
          </button>
          {(createMutation.error || updateMutation.error) && (
            <span className="muted-text" style={{ color: 'var(--color-danger, #dc2626)' }}>
              {isEdit ? '保存失败，请检查后端配置或稍后重试。' : '创建失败，请检查后端配置或稍后重试。'}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
