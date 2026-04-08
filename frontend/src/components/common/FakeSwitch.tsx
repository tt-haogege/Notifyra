export function FakeSwitch({ checked, onChange, disabled }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={`fake-switch ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={() => { if (!disabled) onChange?.(!checked); }}
      disabled={disabled}
      style={{ cursor: disabled ? 'not-allowed' : (onChange ? 'pointer' : 'default') }}
    >
      <span className="fake-switch-thumb" />
    </button>
  );
}
