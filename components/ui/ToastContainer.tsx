"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast, type Toast } from "@/lib/toast";

const TYPE_STYLES: Record<Toast["type"], string> = {
  info:    "bg-ap-surface border-ap-line text-ap-ink-1",
  success: "bg-ap-surface border-ap-up/40 text-ap-up",
  warn:    "bg-ap-surface border-ap-caution/40 text-ap-caution",
  error:   "bg-ap-surface border-ap-down/40 text-ap-down",
};

const TYPE_DOT: Record<Toast["type"], string> = {
  info:    "bg-ap-brand",
  success: "bg-ap-up",
  warn:    "bg-ap-caution",
  error:   "bg-ap-down",
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => toast.subscribe(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-2 left-2 sm:left-auto sm:bottom-4 sm:right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-2.5 px-4 py-3 rounded-ap-lg border shadow-ap-md text-sm w-full sm:w-auto sm:max-w-[340px] pointer-events-auto ${TYPE_STYLES[t.type]}`}
        >
          <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${TYPE_DOT[t.type]}`} />
          <div className="flex-1 leading-snug min-w-0">
            <span className="whitespace-pre-line">{t.message}</span>
            {t.link && (
              <Link
                href={t.link.href}
                onClick={() => toast.dismiss(t.id)}
                className="block mt-1.5 text-ap-brand hover:underline text-xs font-medium"
              >
                {t.link.label} →
              </Link>
            )}
          </div>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="text-ap-ink-3 hover:text-ap-ink-1 ml-1 shrink-0 text-base leading-none">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
