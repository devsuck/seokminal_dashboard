"use client";

import { useState, useRef } from "react";
import { initiateShutdown, getShutdownStatus, executeShutdown } from "@/lib/api";

type Phase = "idle" | "initiating" | "handoff" | "done" | "killing";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  initiating: "인수인계 시작 중...",
  handoff: "Claude가 인수인계 작업 중...",
  done: "인수인계 완료. 서버 종료 중...",
  killing: "모든 서버 종료 중...",
};

export function ShutdownButton({ collapsed }: { collapsed: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleClick() {
    if (phase !== "idle") return;
    setPhase("initiating");
    setLines([]);
    try {
      await initiateShutdown();
      setPhase("handoff");

      function poll() {
        getShutdownStatus()
          .then(data => {
            setLines(data.recent_lines);
            if (data.done) {
              setPhase("done");
              setTimeout(async () => {
                setPhase("killing");
                try { await executeShutdown(); } catch { /* server goes down */ }
              }, 1500);
            } else {
              pollRef.current = setTimeout(poll, 2000);
            }
          })
          .catch(() => { pollRef.current = setTimeout(poll, 2000); });
      }
      pollRef.current = setTimeout(poll, 2000);
    } catch {
      setPhase("idle");
    }
  }

  function cancel() {
    if (pollRef.current) clearTimeout(pollRef.current);
    setPhase("idle");
    setLines([]);
  }

  return (
    <>
      {/* Modal */}
      {phase !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-ap-surface border border-ap-line rounded-2xl w-[92vw] max-w-[520px] max-h-[80vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-ap-line flex items-center gap-3">
              {phase === "done" || phase === "killing" ? (
                <span className="w-5 h-5 rounded-full bg-ap-up flex items-center justify-center text-black text-xs font-bold shrink-0">✓</span>
              ) : (
                <span className="w-5 h-5 rounded-full border-2 border-ap-brand border-t-transparent animate-spin inline-block shrink-0" />
              )}
              <span className="text-ap-ink-1 font-semibold flex-1">
                {phase === "killing" ? "서버 종료 중..." : "Mr. Seokminal 인수인계"}
              </span>
              {phase === "handoff" && (
                <button onClick={cancel} className="text-[11px] text-ap-ink-3 hover:text-ap-down bg-transparent border-0 cursor-pointer">
                  취소
                </button>
              )}
            </div>

            {/* Phase label */}
            <div className="px-6 py-2 text-[11px] text-ap-brand">{PHASE_LABEL[phase]}</div>

            {/* Log */}
            {lines.length > 0 && (
              <div className="flex-1 overflow-y-auto px-6 pb-4 font-mono text-[11px] text-ap-ink-2 leading-relaxed space-y-0.5 max-h-64">
                {lines.map((l, i) => (
                  <div key={i} className={l.includes("HANDOFF_COMPLETE") ? "text-ap-up font-semibold" : ""}>{l}</div>
                ))}
              </div>
            )}

            {phase === "killing" && (
              <div className="px-6 py-4 text-center text-ap-ink-3 text-sm">창을 닫으셔도 됩니다.</div>
            )}
          </div>
        </div>
      )}

      {/* Button */}
      {collapsed ? (
        <button
          onClick={handleClick}
          disabled={phase !== "idle"}
          title="종료"className="w-7 h-7 flex items-center justify-center text-ap-down/60 hover:text-ap-down hover:bg-ap-down/10 rounded transition-colors bg-transparent border-0 cursor-pointer disabled:opacity-30 mx-auto">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="7" cy="7" r="5.5" />
            <line x1="7" y1="3" x2="7" y2="7" />
            <path d="M4.5 4.5 A4 4 0 1 0 9.5 4.5" />
          </svg>
        </button>
      ) : (
        <button
          onClick={handleClick}
          disabled={phase !== "idle"}
          className="w-full py-2 rounded border border-ap-down/30 text-ap-down/70 text-[11px] font-medium hover:bg-ap-down/8 hover:text-ap-down hover:border-ap-down/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer bg-transparent">
          {phase === "idle" ? "⏹ 종료" : "종료 중..."}
        </button>
      )}
    </>
  );
}
