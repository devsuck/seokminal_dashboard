"use client";

interface DateRangePickerProps {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

export function DateRangePicker({ start, end, onStartChange, onEndChange }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <input type="date" value={start} onChange={(e) => onStartChange(e.target.value)} />
      <span className="text-text-3">–</span>
      <input type="date" value={end} onChange={(e) => onEndChange(e.target.value)} />
    </div>
  );
}
