/**
 * 时间格式化工具。
 *
 * 提供"相对时间"（刚刚 / 2 小时后 / 3 天前）与"绝对时间"的互换，
 * 便于在详情/列表中用更扫视友好的形式展示时间，同时保留精确值作为 title。
 */

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function toDate(input: Date | string): Date {
  return typeof input === 'string' ? new Date(input) : input;
}

/** 相对中文时间。超过 30 天回退为本地日期；非法输入原样展示。 */
export function formatRelativeTime(
  input: Date | string,
  now: Date = new Date(),
): string {
  const date = toDate(input);
  if (Number.isNaN(date.getTime())) return '-';

  const diffMs = date.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const suffix = diffMs >= 0 ? '后' : '前';

  if (absMs < 30 * SEC) return '刚刚';
  if (absMs < HOUR) return `${Math.round(absMs / MIN)} 分钟${suffix}`;
  if (absMs < DAY) return `${Math.round(absMs / HOUR)} 小时${suffix}`;
  if (absMs < 30 * DAY) return `${Math.round(absMs / DAY)} 天${suffix}`;

  return date.toLocaleDateString('zh-CN');
}

/** 绝对本地化时间（zh-CN）。 */
export function formatAbsoluteTime(input: Date | string): string {
  const date = toDate(input);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN');
}
