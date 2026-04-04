import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { Select } from '../components/common/Select';
import { channelsApi, type ChannelType, type CreateChannelDto, type UpdateChannelDto } from '../api/channels';
import { emitToast } from '../components/common/Toast';

const channelTypes: { value: ChannelType; label: string }[] = [
  { value: 'Bark', label: 'Bark' },
  { value: 'ServerChan', label: 'Server酱' },
  { value: 'PushDeer', label: 'PushDeer' },
  { value: 'Telegram', label: 'Telegram' },
  { value: 'Discord', label: 'Discord' },
  { value: 'Slack', label: 'Slack' },
  { value: 'WeCom', label: '企业微信' },
  { value: 'DingTalk', label: '钉钉' },
  { value: 'Feishu', label: '飞书' },
  { value: 'Email', label: '邮件' },
  { value: 'LINE', label: 'LINE' },
  { value: 'Gitter', label: 'Gitter' },
  { value: 'Mattermost', label: 'Mattermost' },
  { value: 'RocketChat', label: 'RocketChat' },
  { value: 'MicrosoftTeams', label: 'Microsoft Teams' },
];

const configFields: Record<ChannelType, { key: string; label: string; placeholder: string }[]> = {
  Bark: [
    { key: 'url', label: 'Bark URL', placeholder: 'https://api.day.app/你的Token' },
    { key: 'redirectUrl', label: '重定向 URL（可选）', placeholder: 'https://example.com' },
  ],
  ServerChan: [
    { key: 'token', label: 'Server酱 SendKey', placeholder: 'SCUxxx' },
  ],
  PushDeer: [
    { key: 'endpoint', label: 'PushDeer Endpoint', placeholder: 'https://api2.pushdeer.com' },
    { key: 'token', label: 'Push Token', placeholder: 'your-push-token' },
  ],
  Telegram: [
    { key: 'botToken', label: 'Bot Token', placeholder: '123456:ABC-DEF...' },
    { key: 'chatId', label: 'Chat ID', placeholder: '-1001234567890' },
  ],
  Discord: [
    { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://discord.com/api/webhooks/...' },
  ],
  Slack: [
    { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/...' },
  ],
  WeCom: [
    { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://qyapi.weixin.qq.com/...' },
  ],
  DingTalk: [
    { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://oapi.dingtalk.com/...' },
  ],
  Feishu: [
    { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://open.feishu.cn/...' },
  ],
  Email: [
    { key: 'host', label: 'SMTP Host', placeholder: 'smtp.example.com' },
    { key: 'port', label: 'SMTP Port', placeholder: '587' },
    { key: 'user', label: '用户名', placeholder: 'user@example.com' },
    { key: 'password', label: '密码', placeholder: '••••••••' },
    { key: 'from', label: '发件人', placeholder: 'notify@example.com' },
    { key: 'to', label: '收件人', placeholder: 'receiver@example.com' },
  ],
  LINE: [
    { key: 'channelSecret', label: 'Channel Secret', placeholder: '••••••••' },
    { key: 'channelAccessToken', label: 'Channel Access Token', placeholder: '••••••••' },
    { key: 'to', label: '用户 ID', placeholder: 'Uxxx' },
  ],
  Gitter: [
    { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://webhooks.gitter.im/...' },
  ],
  Mattermost: [
    { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://your-mattermost.com/hooks/...' },
  ],
  RocketChat: [
    { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://your-rocketchat.com/hooks/...' },
  ],
  MicrosoftTeams: [
    { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://outlook.office.com/webhook/...' },
  ],
};

export default function ChannelFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>('Bark');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [retryCount, setRetryCount] = useState(0);

  const { data: existing } = useQuery({
    queryKey: ['channel', id],
    queryFn: () => channelsApi.getDetail(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setType(existing.type);
      const flatConfig: Record<string, string> = {};
      if (existing.config) {
        Object.entries(existing.config).forEach(([k, v]) => {
          flatConfig[k] = String(v);
        });
      }
      setConfig(flatConfig);
      setRetryCount(existing.retryCount ?? 3);
    }
  }, [existing]);

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
    setConfig((prev) => ({ ...prev, [key]: value }));
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
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入渠道名称"
            />
          </div>
          <div>
            <div className="field-label">渠道类型</div>
            <Select
              className="input-shell full-width"
              value={type}
              onChange={(v) => setType(v as ChannelType)}
              options={channelTypes}
            />
          </div>
          <div>
            <div className="field-label">重试次数</div>
            <input
              className="input-shell full-width"
              type="number"
              value={retryCount}
              onChange={(e) => setRetryCount(Number(e.target.value))}
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
