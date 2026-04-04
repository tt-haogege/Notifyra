import type { ChannelType } from '../api/channels';

export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  bark: 'Bark',
  wecom_webhook: '企业微信',
  dingtalk_webhook: '钉钉',
  feishu_webhook: '飞书',
  generic_webhook: '通用 Webhook',
  pushplus: 'PushPlus',
};

export const CHANNEL_TYPE_OPTIONS: { value: ChannelType; label: string }[] = [
  { value: 'bark', label: CHANNEL_TYPE_LABELS.bark },
  { value: 'wecom_webhook', label: CHANNEL_TYPE_LABELS.wecom_webhook },
  { value: 'dingtalk_webhook', label: CHANNEL_TYPE_LABELS.dingtalk_webhook },
  { value: 'feishu_webhook', label: CHANNEL_TYPE_LABELS.feishu_webhook },
  { value: 'generic_webhook', label: CHANNEL_TYPE_LABELS.generic_webhook },
  { value: 'pushplus', label: CHANNEL_TYPE_LABELS.pushplus },
];

export const CHANNEL_CONFIG_FIELD_LABELS: Record<string, string> = {
  webhook: 'Webhook URL',
  serverUrl: 'Bark Server URL',
  token: 'Token',
  redirectUrl: '重定向 URL',
};
