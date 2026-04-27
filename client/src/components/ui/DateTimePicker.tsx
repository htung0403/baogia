import { useRef, useEffect, useCallback } from 'react';
import { DayPicker } from 'react-day-picker';
import { vi } from 'date-fns/locale';
import * as Popover from '@radix-ui/react-popover';
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatDisplay(date: Date | undefined): string {
  if (!date) return '';
  const d = pad2(date.getDate());
  const m = pad2(date.getMonth() + 1);
  const y = date.getFullYear();
  const h = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  return `${d}/${m}/${y} ${h}:${min}`;
}

const ITEM_H = 36;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

interface TimeScrollerProps {
  values: number[];
  selected: number;
  onSelect: (v: number) => void;
  label: string;
}

function TimeScroller({ values, selected, onSelect, label }: TimeScrollerProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const idx = values.indexOf(selected);
    if (idx >= 0) {
      el.scrollTop = idx * ITEM_H - ITEM_H;
    }
  }, [selected, values]);

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: 56 }}>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pb-1">
        {label}
      </span>
      <div
        ref={listRef}
        className="overflow-y-auto scrollbar-hide"
        style={{ height: 180, scrollSnapType: 'y mandatory' }}
      >
        <div style={{ height: ITEM_H }} />
        {values.map((v) => (
          <div
            key={v}
            onClick={() => onSelect(v)}
            style={{ scrollSnapAlign: 'center', height: ITEM_H, minWidth: 44 }}
            className={cn(
              'flex items-center justify-center cursor-pointer rounded-lg text-[14px] font-bold transition-colors select-none mx-auto',
              v === selected
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
            )}
          >
            {pad2(v)}
          </div>
        ))}
        <div style={{ height: ITEM_H }} />
      </div>
    </div>
  );
}

const dayPickerClassNames = {
  root: 'p-3 select-none',
  months: 'flex',
  month: 'w-full',
  month_caption: 'flex justify-center pt-1 relative items-center mb-2',
  caption_label: 'text-sm font-medium text-slate-800',
  nav: 'flex items-center absolute w-full justify-between left-0 px-1',
  button_previous:
    'w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors cursor-pointer',
  button_next:
    'w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors cursor-pointer',
  weekdays: 'grid grid-cols-7 mb-1',
  weekday: 'text-center text-[10px] font-bold text-slate-400 py-1',
  weeks: 'grid gap-y-0.5',
  week: 'grid grid-cols-7',
  day: 'flex items-center justify-center',
  day_button:
    'h-8 w-8 rounded-lg text-[13px] font-semibold transition-all cursor-pointer text-slate-700 hover:bg-slate-100',
  selected: '!bg-indigo-600 !text-white shadow-sm',
  today: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  outside: 'text-slate-300 pointer-events-none',
  disabled: 'opacity-40 pointer-events-none',
  hidden: 'invisible',
} as const;

interface DateTimePicker24hProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateTimePicker24h({
  value,
  onChange,
  placeholder = 'Chọn ngày giờ',
  className,
  disabled = false,
}: DateTimePicker24hProps) {
  const now = new Date();
  const selectedHour = value?.getHours() ?? 8;
  const selectedMinute = value?.getMinutes() ?? 0;

  const handleDaySelect = useCallback(
    (day: Date | undefined) => {
      if (!day) {
        onChange(undefined);
        return;
      }
      const next = new Date(day);
      next.setHours(selectedHour, selectedMinute, 0, 0);
      onChange(next);
    },
    [selectedHour, selectedMinute, onChange]
  );

  const handleHourChange = useCallback(
    (h: number) => {
      if (!value) {
        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, selectedMinute, 0, 0);
        onChange(next);
      } else {
        const next = new Date(value);
        next.setHours(h);
        onChange(next);
      }
    },
    [value, selectedMinute, onChange, now]
  );

  const handleMinuteChange = useCallback(
    (m: number) => {
      if (!value) {
        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), selectedHour, m, 0, 0);
        onChange(next);
      } else {
        const next = new Date(value);
        next.setMinutes(m);
        onChange(next);
      }
    },
    [value, selectedHour, onChange, now]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(undefined);
    },
    [onChange]
  );

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'w-full flex items-center gap-2 h-8 px-3 text-[13px] border rounded-lg transition-all',
            'bg-slate-50 border-slate-200 focus:outline-none',
            'data-[state=open]:border-indigo-500 data-[state=open]:ring-2 data-[state=open]:ring-indigo-100',
            'hover:border-slate-300',
            disabled && 'opacity-50 cursor-not-allowed',
            !value ? 'text-slate-400' : 'text-slate-800',
            className
          )}
        >
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="flex-1 text-left truncate">
            {value ? formatDisplay(value) : placeholder}
          </span>
          {value && (
            <span
              onClick={handleClear}
              role="button"
              className="ml-auto p-0.5 rounded hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3 text-slate-400" />
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className={cn(
            'z-[9999] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden',
            'flex flex-row',
            'animate-in fade-in-0 zoom-in-95 duration-100'
          )}
        >
          <div className="min-w-[240px]">
            <DayPicker
              mode="single"
              selected={value}
              onSelect={handleDaySelect}
              defaultMonth={value ?? now}
              locale={vi}
              classNames={dayPickerClassNames}
              components={{
                Chevron: ({ orientation }) =>
                  orientation === 'left' ? (
                    <ChevronLeft className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  ),
              }}
            />
          </div>

          <div className="w-px bg-slate-100 my-3" />

          <div className="flex flex-col px-3 py-3 gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              GIỜ (24H)
            </div>

            <div className="flex items-center gap-0">
              <TimeScroller
                values={HOURS}
                selected={selectedHour}
                onSelect={handleHourChange}
                label="GIỜ"
              />
              <div
                className="text-[20px] font-bold text-slate-400 flex items-center justify-center pb-1"
                style={{ width: 20, height: ITEM_H }}
              >
                :
              </div>
              <TimeScroller
                values={MINUTES}
                selected={selectedMinute}
                onSelect={handleMinuteChange}
                label="PHÚT"
              />
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default DateTimePicker24h;
