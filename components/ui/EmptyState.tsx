interface EmptyStateProps {
  message: string;
  hint?: string;
}

export function EmptyState({ message, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 h-full min-h-[200px] text-center px-8">
      <div className="text-text-3 text-sm">{message}</div>
      {hint && <div className="text-text-3 text-xs opacity-60">{hint}</div>}
    </div>
  );
}
