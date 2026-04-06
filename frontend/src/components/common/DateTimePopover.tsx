import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
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

interface DateTimeDraft {
  date: string;
  hour: string;
  minute: string;
  second: string;
  viewMonth: Date;
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
  const hourScrollTimeoutRef = useRef<number | null>(null);
  const minuteScrollTimeoutRef = useRef<number | null>(null);
  const secondScrollTimeoutRef = useRef<number | null>(null);
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

  const buildDraftFromValue = (): DateTimeDraft => {
    const date = resolveInitialDate(value.date);
    return {
      date,
      hour: value.hour || '09',
      minute: value.minute || '00',
      second: value.second || '00',
      viewMonth: parseDateValue(date) ?? new Date(),
    };
  };

  const applyDraft = (draft: DateTimeDraft) => {
    setDraftDate(draft.date);
    setDraftHour(draft.hour);
    setDraftMinute(draft.minute);
    setDraftSecond(draft.second);
    setViewMonth(draft.viewMonth);
  };

  const closePopover = (resetDraft = true) => {
    if (resetDraft) applyDraft(buildDraftFromValue());
    setOpen(false);
    setPanelStyle(null);
  };

  const scrollTimeListToActive = (
    list: HTMLDivElement | null,
    itemSelector: string,
    activeValue: string,
  ) => {
    if (!list) return;

    const items = Array.from(list.querySelectorAll<HTMLElement>(itemSelector));
    const activeItem = items.find((item) => item.textContent?.trim() === activeValue);
    if (!activeItem) return;

    const targetScrollTop = activeItem.offsetTop - (list.clientHeight - activeItem.offsetHeight) / 2;
    list.scrollTop = Math.max(targetScrollTop, 0);
  };

  const getCenteredTimeValue = (list: HTMLDivElement | null) => {
    if (!list) return '';

    const items = Array.from(list.querySelectorAll<HTMLElement>('.datetime-popover-time-item'));
    if (items.length === 0) return '';

    const listCenter = list.scrollTop + list.clientHeight / 2;

    const closestItem = items.reduce((closest, item) => {
      const itemCenter = item.offsetTop + item.offsetHeight / 2;
      const distance = Math.abs(itemCenter - listCenter);

      if (!closest || distance < closest.distance) {
        return { item, distance };
      }

      return closest;
    }, null as { item: HTMLElement; distance: number } | null);

    return closestItem?.item.textContent?.trim() ?? '';
  };

  const syncTimeValueFromScroll = (
    list: HTMLDivElement | null,
    timeoutRef: MutableRefObject<number | null>,
    setValue: (value: string) => void,
  ) => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

    timeoutRef.current = window.setTimeout(() => {
      const nextValue = getCenteredTimeValue(list);
      if (nextValue) setValue(nextValue);
      timeoutRef.current = null;
    }, 120);
  };

  const monthDays = getMonthDays(viewMonth);
  const canViewPrevMonth = Boolean(findFirstSelectableDateInMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1)));
  const canViewNextMonth = Boolean(findFirstSelectableDateInMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)));
  const canConfirm = isDateSelectable(draftDate);

  useEffect(() => {
    if (open) return;
    applyDraft(buildDraftFromValue());
  }, [open, value.date, value.hour, value.minute, value.second, minDate, maxDate, disabledDate]);

  useEffect(() => {
    if (!open) return;

    const updatePanelPosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const width = Math.min(468, window.innerWidth - 32);
      const maxLeft = Math.max(16, window.innerWidth - width - 16);
      const nextStyle = {
        top: rect.bottom + 8,
        left: Math.min(rect.left, maxLeft),
        width,
      };

      setPanelStyle((current) => {
        if (
          current
          && current.top === nextStyle.top
          && current.left === nextStyle.left
          && current.width === nextStyle.width
        ) {
          return current;
        }

        return nextStyle;
      });
    };

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
      setPanelStyle(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setPanelStyle(null);
      }
    };

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !panelStyle) return;

    const frameId = window.requestAnimationFrame(() => {
      scrollTimeListToActive(hourListRef.current, '.datetime-popover-time-item', draftHour);
      scrollTimeListToActive(minuteListRef.current, '.datetime-popover-time-item', draftMinute);
      scrollTimeListToActive(secondListRef.current, '.datetime-popover-time-item', draftSecond);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [open, panelStyle, draftHour, draftMinute, draftSecond]);

  useEffect(() => {
    return () => {
      if (hourScrollTimeoutRef.current) window.clearTimeout(hourScrollTimeoutRef.current);
      if (minuteScrollTimeoutRef.current) window.clearTimeout(minuteScrollTimeoutRef.current);
      if (secondScrollTimeoutRef.current) window.clearTimeout(secondScrollTimeoutRef.current);
    };
  }, []);

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
    applyDraft(buildDraftFromValue());
    setOpen(true);
  };

  const handleCancel = () => {
    closePopover();
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({ date: draftDate, hour: draftHour, minute: draftMinute, second: draftSecond });
    closePopover(false);
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
            <div
              ref={hourListRef}
              className="datetime-popover-time-list"
              onScroll={() => syncTimeValueFromScroll(hourListRef.current, hourScrollTimeoutRef, setDraftHour)}
            >
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
            <div
              ref={minuteListRef}
              className="datetime-popover-time-list"
              onScroll={() => syncTimeValueFromScroll(minuteListRef.current, minuteScrollTimeoutRef, setDraftMinute)}
            >
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
            <div
              ref={secondListRef}
              className="datetime-popover-time-list"
              onScroll={() => syncTimeValueFromScroll(secondListRef.current, secondScrollTimeoutRef, setDraftSecond)}
            >
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
        onClick={() => (open ? closePopover() : handleOpen())}
        aria-expanded={open}
      >
        <span className="datetime-popover-trigger-text">{triggerLabel}</span>
        <span className="datetime-popover-trigger-arrow">▼</span>
      </button>
      {panel}
    </>
  );
}
