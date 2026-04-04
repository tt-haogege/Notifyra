export function FakeSwitch({ checked, onChange }: { checked: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`fake-switch ${checked ? 'checked' : ''}`}
      onClick={() => onChange?.(!checked)}
      style={{ cursor: onChange ? 'pointer' : 'default' }}
    >
      <span className="fake-switch-thumb" />
    </button>
  );
}
