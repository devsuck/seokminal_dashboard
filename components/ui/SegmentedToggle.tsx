const DEFAULT_ACTIVE_CLASS = "border-accent text-accent bg-accent/10";
const INACTIVE_CLASS = "border-border text-text-3 hover:text-text-2";

export interface SegmentedOption<T extends string | boolean> {
  value: T;
  label: string;
  /** Overrides DEFAULT_ACTIVE_CLASS when this option is selected (e.g. buy/sell coloring). */
  activeClass?: string;
}

interface SegmentedToggleProps<T extends string | boolean> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  /** Overrides INACTIVE_CLASS for every option (e.g. light-surface token set). */
  inactiveClass?: string;
}

const SIZE_CLASS = {
  sm: "text-[11px] py-1",
  md: "text-sm py-1.5",
};

export function SegmentedToggle<T extends string | boolean>({ options, value, onChange, size = "md", inactiveClass }: SegmentedToggleProps<T>) {
  return (
    <div className="flex gap-2">
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={`flex-1 border font-medium font-data ${SIZE_CLASS[size]} ${active ? (opt.activeClass ?? DEFAULT_ACTIVE_CLASS) : (inactiveClass ?? INACTIVE_CLASS)}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
