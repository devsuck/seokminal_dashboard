interface LoadingStateProps {
  /** 로딩 문구. 기본 "로딩 중…" */
  message?: string;
  /** 보조 안내 (예: 소요 시간) */
  hint?: string;
}

/** 페이지/패널 공용 로딩 표시 — EmptyState와 동일 레이아웃, 스피너 포함. */
export function LoadingState({ message = "로딩 중…", hint }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 h-full min-h-[200px] text-center px-8">
      <Spinner />
      <div className="text-text-3 text-sm">{message}</div>
      {hint && <div className="text-text-3 text-xs opacity-60">{hint}</div>}
    </div>
  );
}

/** 인라인 스피너 — 버튼/헤더 등 좁은 공간용. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin ${className}`}
      aria-label="loading"
    />
  );
}
