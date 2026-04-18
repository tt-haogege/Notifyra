import { ChannelType } from './drivers/channel-driver.interface';

const legacyTypeMap: Record<string, ChannelType> = {
  Bark: 'bark',
  ServerChan: 'pushplus',
  PushDeer: 'pushplus',
  Telegram: 'generic_webhook',
  Discord: 'generic_webhook',
  Slack: 'generic_webhook',
  WeCom: 'wecom_webhook',
  DingTalk: 'dingtalk_webhook',
  Feishu: 'feishu_webhook',
  Email: 'generic_webhook',
  LINE: 'generic_webhook',
  Gitter: 'generic_webhook',
  Mattermost: 'generic_webhook',
  RocketChat: 'generic_webhook',
  MicrosoftTeams: 'generic_webhook',
};

const supportedTypes = new Set<ChannelType>([
  'wecom_webhook',
  'feishu_webhook',
  'dingtalk_webhook',
  'bark',
  'generic_webhook',
  'pushplus',
]);

const frontendConfigKeyMap: Partial<
  Record<ChannelType, Record<string, string>>
> = {
  wecom_webhook: { webhookUrl: 'webhook' },
  feishu_webhook: { webhookUrl: 'webhook' },
  dingtalk_webhook: { webhookUrl: 'webhook' },
  generic_webhook: { webhookUrl: 'webhook' },
  bark: { url: 'serverUrl' },
};

export function normalizeChannelType(type: string): ChannelType | string {
  if (supportedTypes.has(type as ChannelType)) {
    return type as ChannelType;
  }

  return legacyTypeMap[type] ?? type;
}

export function normalizeChannelConfig(
  type: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const normalizedType = normalizeChannelType(type);
  const keyMap = frontendConfigKeyMap[normalizedType as ChannelType];
  if (!keyMap) {
    return { ...config };
  }

  const nextConfig = { ...config };
  Object.entries(keyMap).forEach(([fromKey, toKey]) => {
    if (nextConfig[toKey] === undefined && nextConfig[fromKey] !== undefined) {
      nextConfig[toKey] = nextConfig[fromKey];
    }
    delete nextConfig[fromKey];
  });

  return nextConfig;
}

export function serializeChannelConfig(
  type: string,
  config: Record<string, unknown>,
): string {
  return JSON.stringify(normalizeChannelConfig(type, config));
}

export function parseChannelConfig(
  type: string,
  configJson: string,
): Record<string, unknown> {
  return normalizeChannelConfig(
    type,
    JSON.parse(configJson) as Record<string, unknown>,
  );
}
