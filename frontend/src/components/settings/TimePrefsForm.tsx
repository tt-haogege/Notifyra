import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FakeSwitch } from '../common/FakeSwitch';
import { useToast } from '../common/toast-context';
import { settingsApi } from '../../api/settings';

interface TimePrefsDraft {
  afternoonTime: string;
  eveningTime: string;
  tomorrowMorningTime: string;
  allowHighFrequencyScheduling: boolean;
}

const EMPTY_DRAFT: TimePrefsDraft = {
  afternoonTime: '',
  eveningTime: '',
  tomorrowMorningTime: '',
  allowHighFrequencyScheduling: false,
};

/**
 * 时间偏好子组件：推送时间段 + 高频调度开关。
 *
 * 使用 sourceKey 派生 draft：settings 变化时 draft 自动同步，
 * 用户编辑期间保持自己的修改不被覆盖。无需 useEffect。
 */
export function TimePrefsForm() {
  const { toast } = useToast();
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });

  const sourceKey = settings
    ? JSON.stringify([
        settings.afternoonTime ?? '',
        settings.eveningTime ?? '',
        settings.tomorrowMorningTime ?? '',
        settings.allowHighFrequencyScheduling ?? false,
      ])
    : 'loading';

  const hydrated: TimePrefsDraft = settings
    ? {
        afternoonTime: settings.afternoonTime || '',
        eveningTime: settings.eveningTime || '',
        tomorrowMorningTime: settings.tomorrowMorningTime || '',
        allowHighFrequencyScheduling: settings.allowHighFrequencyScheduling ?? false,
      }
    : EMPTY_DRAFT;

  const [draft, setDraft] = useState<{ key: string; value: TimePrefsDraft }>({
    key: 'initial',
    value: EMPTY_DRAFT,
  });
  const current = draft.key === sourceKey ? draft.value : hydrated;
  const patch = (changes: Partial<TimePrefsDraft>) =>
    setDraft({ key: sourceKey, value: { ...current, ...changes } });

  const mutate = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => toast('设置已保存', 'success'),
  });

  return (
    <>
      <div>
        <div className="field-label">下午时间</div>
        <input
          className="input-shell full-width"
          value={current.afternoonTime}
          onChange={(e) => patch({ afternoonTime: e.target.value })}
          placeholder="例如 14:00"
        />
      </div>
      <div>
        <div className="field-label">晚间时间</div>
        <input
          className="input-shell full-width"
          value={current.eveningTime}
          onChange={(e) => patch({ eveningTime: e.target.value })}
          placeholder="例如 20:00"
        />
      </div>
      <div>
        <div className="field-label">次日上午时间</div>
        <input
          className="input-shell full-width"
          value={current.tomorrowMorningTime}
          onChange={(e) => patch({ tomorrowMorningTime: e.target.value })}
          placeholder="例如 09:00"
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 0',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div>
          <div className="field-label" style={{ marginBottom: 4 }}>
            允许高频调度
          </div>
          <div className="helper-text" style={{ marginTop: 0 }}>
            开启后，允许 recurring cron 低于每 5 分钟一次执行；关闭后，最小执行间隔为 5 分钟。
          </div>
        </div>
        <FakeSwitch
          checked={current.allowHighFrequencyScheduling}
          onChange={(checked) => patch({ allowHighFrequencyScheduling: checked })}
        />
      </div>
      <div>
        <button
          className="primary-button"
          type="button"
          onClick={() =>
            mutate.mutate({
              afternoonTime: current.afternoonTime || null,
              eveningTime: current.eveningTime || null,
              tomorrowMorningTime: current.tomorrowMorningTime || null,
              allowHighFrequencyScheduling: current.allowHighFrequencyScheduling,
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
