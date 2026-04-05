import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface DateTimePopoverValue {
  date: string;
  hour: string;
  minute: string;
  second: string;
}

interface DateTimePopoverProps {
  value: DateTimePopoverValue;
  onConfirm: (value: DateTimePopoverValue) => void;
  minDate?: string;
  maxDate?: string;
  disabledDate?: (date: string) => boolean;
  placeholder?: string;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const HOURS = Array.from({ length: 24 }, (_, index) => index.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, index) => index.toString().padStart(2, '0'));
const SECONDS = Array.from({ length: 60 }, (_, index) => index.toString().padStart(2, '0'));

const padNumber = (value: number) => value.toString().padStart(2, '0');

const formatDateValue = (date: Date) =>
  `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;

const parseDateValue = (value: string) => {
  if (!value) return null;
  const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return null;
  return new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
};

const formatDateLabel = (value: string) => {
  const date = parseDateValue(value);
  if (!date) return '请选择日期';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

const getMonthDays = (viewMonth: Date) => {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + index);
    return {
      value: formatDateValue(current),
      day: current.getDate(),
      inCurrentMonth: current.getMonth() === month,
    };
  });
};

export function DateTimePopover({
  value,
  onConfirm,
  minDate,
  maxDate,
  disabledDate,
  placeholder = '请选择日期时间',
}: DateTimePopoverProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  const secondListRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(value.date);
  const [draftHour, setDraftHour] = useState(value.hour || '09');
  const [draftMinute, setDraftMinute] = useState(value.minute || '00');
  const [draftSecond, setDraftSecond] = useState(value.second || '00');
  const [viewMonth, setViewMonth] = useState(() => parseDateValue(value.date) ?? new Date());
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(null);

  const todayValue = formatDateValue(new Date());

  const isDateSelectable = (dateValue: string) => {
    if (!dateValue) return false;
    if (minDate && dateValue < minDate) return false;
    if (maxDate && dateValue > maxDate) return false;
    if (disabledDate?.(dateValue)) return false;
    return true;
  };

  const findFirstSelectableDateInMonth = (month: Date) => {
    const cursor = new Date(month.getFullYear(), month.getMonth(), 1);
    while (cursor.getMonth() === month.getMonth()) {
      const dateValue = formatDateValue(cursor);
      if (isDateSelectable(dateValue)) return dateValue;
      cursor.setDate(cursor.getDate() + 1);
    }
    return '';
  };

  const resolveInitialDate = (candidate: string) => {
    if (isDateSelectable(candidate)) return candidate;

    const candidateDate = parseDateValue(candidate);
    if (candidateDate) {
      const monthMatch = findFirstSelectableDateInMonth(candidateDate);
      if (monthMatch) return monthMatch;
    }

    const todayMatch = findFirstSelectableDateInMonth(new Date());
    if (todayMatch) return todayMatch;

    if (minDate && isDateSelectable(minDate)) return minDate;
    if (maxDate && isDateSelectable(maxDate)) return maxDate;
    return '';
  };

  const monthDays = useMemo(() => getMonthDays(viewMonth), [viewMonth]);
  const canViewPrevMonth = useMemo(
    () => Boolean(findFirstSelectableDateInMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))),
    [viewMonth],
  );
  const canViewNextMonth = useMemo(
    () => Boolean(findFirstSelectableDateInMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))),
    [viewMonth],
  );
  const canConfirm = isDateSelectable(draftDate);

  useEffect(() => {
    if (!open) {
      const nextDate = resolveInitialDate(value.date);
      setDraftDate(nextDate);
      setDraftHour(value.hour || '09');
      setDraftMinute(value.minute || '00');
      setDraftSecond(value.second || '00');
      setViewMonth(parseDateValue(nextDate) ?? new Date());
    }
  }, [open, value.date, value.hour, value.minute, value.second, minDate, maxDate, disabledDate]);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const width = Math.min(468, window.innerWidth - 32);
      const maxLeft = Math.max(16, window.innerWidth - width - 16);
      setPanelStyle({
        top: rect.bottom + 8,
        left: Math.min(rect.left, maxLeft),
        width,
      });
    };

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const activeHour = hourListRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    const activeMinute = minuteListRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    const activeSecond = secondListRef.current?.querySelector<HTMLElement>('[data-active="true"]');

    activeHour?.scrollIntoView({ block: 'center' });
    activeMinute?.scrollIntoView({ block: 'center' });
    activeSecond?.scrollIntoView({ block: 'center' });
  }, [open, draftHour, draftMinute, draftSecond]);

  const triggerLabel = value.date ? `${formatDateLabel(value.date)} ${value.hour}:${value.minute}:${value.second}` : placeholder;
  const summaryDateLabel = draftDate ? formatDateLabel(draftDate) : '请选择日期';
  const selectedDate = parseDateValue(draftDate);
  const selectedWeekday = selectedDate ? WEEKDAY_LABELS[(selectedDate.getDay() + 6) % 7] : '';
  const summaryTimeLabel = `${draftHour}:${draftMinute}:${draftSecond}${selectedWeekday ? ` · 周${selectedWeekday}` : ''}`;

  const presetOptions = [
    { label: '今天', offset: 0 },
    { label: '明天', offset: 1 },
    { label: '一周后', offset: 7 },
  ].map((preset) => {
    const candidateDate = new Date();
    candidateDate.setDate(candidateDate.getDate() + preset.offset);
    const value = formatDateValue(candidateDate);
    return {
      ...preset,
      value,
      resolvedValue: resolveInitialDate(value),
    };
  });

  const handleOpen = () => {
    const nextDate = resolveInitialDate(value.date);
    setDraftDate(nextDate);
    setDraftHour(value.hour || '09');
    setDraftMinute(value.minute || '00');
    setDraftSecond(value.second || '00');
    setViewMonth(parseDateValue(nextDate) ?? new Date());
    setOpen(true);
  };

  const handleCancel = () => {
    const nextDate = resolveInitialDate(value.date);
    setDraftDate(nextDate);
    setDraftHour(value.hour || '09');
    setDraftMinute(value.minute || '00');
    setDraftSecond(value.second || '00');
    setViewMonth(parseDateValue(nextDate) ?? new Date());
    setOpen(false);
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({ date: draftDate, hour: draftHour, minute: draftMinute, second: draftSecond });
    setOpen(false);
  };

  const panel = open && panelStyle ? createPortal(
    <div
      ref={panelRef}
      className="datetime-popover-panel"
      style={{ top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
    >
      <div className='flex justify-between items-center'>
        <div className="datetime-popover-header">
          <span className="datetime-popover-label">选择触发时间</span>
          <div className="datetime-popover-summary">
            <strong>{summaryDateLabel}</strong>
            <span>{summaryTimeLabel}</span>
          </div>
        </div>

        <div className="datetime-popover-presets">
          {presetOptions.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={`datetime-popover-chip ${draftDate === preset.resolvedValue ? 'active' : ''}`.trim()}
              onClick={() => preset.resolvedValue && setDraftDate(preset.resolvedValue)}
              disabled={!preset.resolvedValue}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="datetime-popover-content">
        <div className="datetime-popover-calendar-section">
          <div className="datetime-popover-calendar-header">
            <span className="datetime-popover-calendar-title">
              {viewMonth.getFullYear()} 年 {MONTH_LABELS[viewMonth.getMonth()]}
            </span>
            <div className="datetime-popover-calendar-nav">
              <button
                className="datetime-popover-nav-button"
                type="button"
                onClick={() => canViewPrevMonth && setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                disabled={!canViewPrevMonth}
              >
                ‹
              </button>
              <button
                className="datetime-popover-nav-button"
                type="button"
                onClick={() => canViewNextMonth && setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                disabled={!canViewNextMonth}
              >
                ›
              </button>
            </div>
          </div>

          <div className="datetime-popover-weekdays">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="datetime-popover-calendar-grid">
            {monthDays.map((day) => {
              const disabled = !isDateSelectable(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  className={[
                    'datetime-popover-day',
                    day.inCurrentMonth ? '' : 'muted',
                    draftDate === day.value ? 'active' : '',
                    todayValue === day.value ? 'today' : '',
                    disabled ? 'disabled' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => !disabled && setDraftDate(day.value)}
                  disabled={disabled}
                >
                  <span>{day.day}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="datetime-popover-time-section">
          <span className="datetime-popover-time-title">时间（时:分:秒）</span>
          <div className="datetime-popover-time-picker">
            <div className="datetime-popover-time-highlight" />
            <div ref={hourListRef} className="datetime-popover-time-list">
              <div className="datetime-popover-time-spacer" />
              {HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  data-active={draftHour === hour}
                  className={`datetime-popover-time-item ${draftHour === hour ? 'active' : ''}`}
                  onClick={() => setDraftHour(hour)}
                >
                  {hour}
                </button>
              ))}
              <div className="datetime-popover-time-spacer" />
            </div>
            <div className="datetime-popover-time-divider">:</div>
            <div ref={minuteListRef} className="datetime-popover-time-list">
              <div className="datetime-popover-time-spacer" />
              {MINUTES.map((minute) => (
                <button
                  key={minute}
                  type="button"
                  data-active={draftMinute === minute}
                  className={`datetime-popover-time-item ${draftMinute === minute ? 'active' : ''}`}
                  onClick={() => setDraftMinute(minute)}
                >
                  {minute}
                </button>
              ))}
              <div className="datetime-popover-time-spacer" />
            </div>
            <div className="datetime-popover-time-divider">:</div>
            <div ref={secondListRef} className="datetime-popover-time-list">
              <div className="datetime-popover-time-spacer" />
              {SECONDS.map((second) => (
                <button
                  key={second}
                  type="button"
                  data-active={draftSecond === second}
                  className={`datetime-popover-time-item ${draftSecond === second ? 'active' : ''}`}
                  onClick={() => setDraftSecond(second)}
                >
                  {second}
                </button>
              ))}
              <div className="datetime-popover-time-spacer" />
            </div>
          </div>
        </div>
      </div>

      <div className="datetime-popover-footer">
        <button className="ghost-button" type="button" onClick={handleCancel}>
          取消
        </button>
        <button className="primary-button" type="button" onClick={handleConfirm} disabled={!canConfirm}>
          确认
        </button>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`input-shell full-width datetime-popover-trigger ${value.date ? '' : 'placeholder'}`.trim()}
        onClick={() => (open ? setOpen(false) : handleOpen())}
      >
        <span className="datetime-popover-trigger-content">
          <span className="datetime-popover-trigger-icon">◷</span>
          <span className="datetime-popover-trigger-text">{triggerLabel}</span>
        </span>
        <span className="datetime-popover-trigger-arrow">▼</span>
      </button>
      {panel}
    </>
  );
}
