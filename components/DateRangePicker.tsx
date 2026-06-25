"use client";

interface DateRangePickerProps {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

export function DateRangePicker({
  start,
  end,
  onStartChange,
  onEndChange,
}: DateRangePickerProps) {
  return (
    <div className="flex gap-2 items-center">
      <input
        type="date"
        value={start}
        onChange={(e) => onStartChange(e.target.value)}
        className="border border-gray-300 rounded px-3 py-2"
      />
      <span>to</span>
      <input
        type="date"
        value={end}
        onChange={(e) => onEndChange(e.target.value)}
        className="border border-gray-300 rounded px-3 py-2"
      />
    </div>
  );
}
