import { formatAbsoluteTime, formatRelativeTime } from '../../utils/time';

type Props = {
  value: Date | string | null | undefined;
  /** 无值时的占位文案。 */
  fallback?: string;
};

/**
 * 展示为相对时间（如"2 小时后"），hover 时显示精确绝对时间。
 * 统一替代详情/列表中散落的 `new Date(x).toLocaleString('zh-CN')` 写法。
 */
export function RelativeTime({ value, fallback = '-' }: Props) {
  if (!value) return <span>{fallback}</span>;
  return (
    <span title={formatAbsoluteTime(value)}>{formatRelativeTime(value)}</span>
  );
}
