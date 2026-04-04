export type ChannelType =
  | 'wecom_webhook'
  | 'feishu_webhook'
  | 'dingtalk_webhook'
  | 'bark'
  | 'generic_webhook'
  | 'pushplus';

export type ChannelDriverSendInput = {
  channel: {
    id: string;
    name: string;
    type: string;
  };
  config: Record<string, unknown>;
  title: string;
  content: string;
};

export type ChannelDriverSendResult = {
  success: boolean;
  errorMessage?: string;
  raw?: unknown;
};

export interface ChannelDriver {
  type: ChannelType;
  send(input: ChannelDriverSendInput): Promise<ChannelDriverSendResult>;
}
