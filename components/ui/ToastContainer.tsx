"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast, type Toast } from "@/lib/toast";

const TYPE_STYLES: Record<Toast["type"], string> = {
  info:    "bg-panel border-border text-text-1",
  success: "bg-panel border-pos/40 text-pos",
  warn:    "bg-panel border-warn/40 text-warn",
  error:   "bg-panel border-neg/40 text-neg",
};

const TYPE_DOT: Record<Toast["type"], string> = {
  info:    "bg-accent",
  success: "bg-pos",
  warn:    "bg-warn",
  error:   "bg-neg",
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
          className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border shadow-xl text-sm w-full sm:w-auto sm:max-w-[340px] pointer-events-auto ${TYPE_STYLES[t.type]}`}
        >
          <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${TYPE_DOT[t.type]}`} />
          <div className="flex-1 leading-snug min-w-0">
            <span className="whitespace-pre-line">{t.message}</span>
            {t.link && (
              <Link
                href={t.link.href}
                onClick={() => toast.dismiss(t.id)}
                className="block mt-1.5 text-accent hover:underline text-xs font-medium"
              >
                {t.link.label} →
              </Link>
            )}
          </div>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="text-text-3 hover:text-text-1 ml-1 shrink-0 text-base leading-none">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
