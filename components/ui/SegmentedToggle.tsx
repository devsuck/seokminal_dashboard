const DEFAULT_ACTIVE_CLASS = "border-accent text-accent bg-accent/10";
const INACTIVE_CLASS = "border-border text-text-3 hover:text-text-2";
const AP_PILL_WRAP = "flex gap-1 p-1 bg-ap-bg rounded-full border border-ap-line";
const AP_PILL_ACTIVE = "bg-ap-ink-1 text-white";
const AP_PILL_INACTIVE = "text-ap-ink-3";

export interface SegmentedOption<T extends string | boolean> {
  value: T;
  label: string;
  /** CSS classes applied to the active/selected option */
  activeClass?: string;
}

interface SegmentedToggleProps<T extends string | boolean> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  /** CSS classes applied to inactive/unselected options */
  inactiveClass?: string;
  variant?: "default" | "ap-pill";
}

const SIZE_CLASS = {
  sm: "text-[11px] py-1",
  md: "text-sm py-1.5",
};

export function SegmentedToggle<T extends string | boolean>({
  options, value, onChange, size = "md", inactiveClass, variant = "default",
}: SegmentedToggleProps<T>) {
  if (variant === "ap-pill") {
    return (
      <div className={AP_PILL_WRAP}>
        {options.map(opt => {
          const active = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              onClick={() => onChange(opt.value)}
              className={`flex-1 rounded-full font-medium font-data ${SIZE_CLASS[size]} ${active ? AP_PILL_ACTIVE : AP_PILL_INACTIVE}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }
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
