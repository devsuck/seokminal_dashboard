interface EmptyStateProps {
  message: string;
  hint?: string;
  /** Overrides default text-text-3 tone (e.g. ap- light-theme routes). */
  textClass?: string;
}

export function EmptyState({ message, hint, textClass = "text-text-3" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 h-full min-h-[200px] text-center px-8">
      <div className={`${textClass} text-sm`}>{message}</div>
      {hint && <div className={`${textClass} text-xs opacity-60`}>{hint}</div>}
    </div>
  );
}
