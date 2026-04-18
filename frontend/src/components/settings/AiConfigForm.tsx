import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '../common/toast-context';
import { settingsApi } from '../../api/settings';

interface AiDraft {
  aiBaseUrl: string;
  aiModel: string;
}

const EMPTY_DRAFT: AiDraft = { aiBaseUrl: '', aiModel: '' };

/**
 * AI 配置子组件：Base URL + API Key + 模型名称。
 *
 * draft 使用 sourceKey 派生模式：settings 变化时自动同步，用户编辑期间保持修改。
 */
export function AiConfigForm() {
  const { toast } = useToast();
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });

  const sourceKey = settings
    ? JSON.stringify([settings.aiBaseUrl ?? '', settings.aiModel ?? ''])
    : 'loading';
  const hydrated: AiDraft = settings
    ? { aiBaseUrl: settings.aiBaseUrl || '', aiModel: settings.aiModel || '' }
    : EMPTY_DRAFT;

  const [draft, setDraft] = useState<{ key: string; value: AiDraft }>({
    key: 'initial',
    value: EMPTY_DRAFT,
  });
  const current = draft.key === sourceKey ? draft.value : hydrated;
  const patch = (changes: Partial<AiDraft>) =>
    setDraft({ key: sourceKey, value: { ...current, ...changes } });

  const [apiKey, setApiKey] = useState('');

  const mutate = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      toast('设置已保存', 'success');
      setApiKey('');
    },
  });

  return (
    <>
      <div>
        <div className="field-label">AI Base URL</div>
        <input
          className="input-shell full-width"
          value={current.aiBaseUrl}
          onChange={(e) => patch({ aiBaseUrl: e.target.value })}
          placeholder="https://api.openai.com/v1 或其他兼容 API 地址"
        />
      </div>
      <div>
        <div className="field-label">API Key</div>
        <input
          className="input-shell full-width"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={settings?.hasAiApiKey ? '已设置（留空则保持不变）' : 'sk-...'}
          type="password"
        />
        <p className="helper-text">
          {settings?.hasAiApiKey
            ? '已保存 API Key。留空保存时将保持当前 Key，不会明文回显。'
            : 'API Key 仅在保存时传输，不会明文显示。'}
        </p>
      </div>
      <div>
        <div className="field-label">模型名称</div>
        <input
          className="input-shell full-width"
          value={current.aiModel}
          onChange={(e) => patch({ aiModel: e.target.value })}
          placeholder="gpt-4o、gpt-3.5-turbo 等"
        />
      </div>
      <div>
        <button
          className="primary-button"
          type="button"
          onClick={() =>
            mutate.mutate({
              aiBaseUrl: current.aiBaseUrl || null,
              aiApiKey: apiKey || undefined,
              aiModel: current.aiModel || null,
            })
          }
          disabled={mutate.isPending}
        >
          {mutate.isPending ? '保存中...' : '保存'}
        </button>
      </div>
    </>
  );
}
