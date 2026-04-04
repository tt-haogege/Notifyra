type TriggerType = 'once' | 'recurring' | 'webhook';

const labels: Record<TriggerType, string> = {
  once: '单次',
  recurring: '循环',
  webhook: 'Webhook',
};

export function TriggerTypeSelector({
  value,
  onChange,
}: {
  value: TriggerType;
  onChange: (v: TriggerType) => void;
}) {
  return (
    <div className="trigger-selector">
      {(['once', 'recurring', 'webhook'] as TriggerType[]).map((t) => (
        <button
          key={t}
          type="button"
          className={`trigger-chip ${value === t ? 'active' : ''}`}
          onClick={() => onChange(t)}
        >
          {labels[t]}
        </button>
      ))}
    </div>
  );
}
