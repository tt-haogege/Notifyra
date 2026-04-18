import { emitToast } from './toast-events';
import { CopyIcon } from './icons';

type Props = {
  value: string;
  /** 无障碍文案 + 悬浮提示（同时作为复制成功的 toast 前缀）。 */
  label?: string;
  /** 复制成功后的 toast 文案；默认 `${label} 已复制` 或 `已复制`。 */
  successMessage?: string;
  size?: number;
};

/**
 * 通用复制图标按钮（透明底 + 品牌色图标）。
 * 与项目内其他 token / 链接复制位保持一致视觉。
 */
export function CopyIconButton({
  value,
  label = '复制',
  successMessage,
  size = 16,
}: Props) {
  const handleCopy = () => {
    void navigator.clipboard.writeText(value);
    emitToast(successMessage ?? `${label} 已复制`, 'success');
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={handleCopy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        border: 'none',
        background: 'transparent',
        color: 'var(--color-primary)',
        cursor: 'pointer',
        lineHeight: 0,
      }}
    >
      <CopyIcon size={size} />
    </button>
  );
}
