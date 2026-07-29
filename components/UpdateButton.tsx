"use client";

import { useState, useRef } from "react";
import { executeUpdate, checkApiHealth } from "@/lib/api";

type Phase = "idle" | "restarting" | "waiting" | "done" | "error";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  restarting: "서버 재시작 요청 중...",
  waiting: "재기동 대기 중...",
  done: "완료",
  error: "재기동 확인 실패 — 수동으로 확인해줘",
};

const POLL_MS = 1500;
const MAX_POLLS = 40; // ~60s

export function UpdateButton({ collapsed }: { collapsed: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleClick() {
    if (phase !== "idle") return;
    setPhase("restarting");
    try {
      await executeUpdate();
    } catch {
      // 재시작 스크립트가 프로세스를 죽이는 과정이라 응답 자체가 안 올 수도 있음 — 정상.
    }
    setPhase("waiting");

    let attempts = 0;
    let sawDown = false;

    function poll() {
      attempts += 1;
      checkApiHealth().then(healthy => {
        if (!healthy) sawDown = true;
        if (healthy && sawDown) {
          setPhase("done");
          setTimeout(() => setPhase("idle"), 1500);
          return;
        }
        if (attempts >= MAX_POLLS) {
          setPhase("error");
          setTimeout(() => setPhase("idle"), 4000);
          return;
        }
        pollRef.current = setTimeout(poll, POLL_MS);
      });
    }
    pollRef.current = setTimeout(poll, POLL_MS);
  }

  return (
    <>
      {collapsed ? (
        <button
          onClick={handleClick}
          disabled={phase !== "idle"}
          title="업데이트 (API 서버 재시작)"
          className="w-7 h-7 flex items-center justify-center text-text-3 hover:text-accent hover:bg-accent/10 rounded transition-colors bg-transparent border-0 cursor-pointer disabled:opacity-30 mx-auto"
        >
          <svg
            width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className={phase === "restarting" || phase === "waiting" ? "animate-spin" : ""}
          >
            <path d="M11.5 4.5A5 5 0 1 0 12.5 7" />
            <path d="M11.5 1.5v3h-3" />
          </svg>
        </button>
      ) : (
        <button
          onClick={handleClick}
          disabled={phase !== "idle"}
          className="w-full py-2 rounded border border-border text-text-2 text-[11px] font-medium hover:bg-accent/8 hover:text-accent hover:border-accent/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer bg-transparent"
        >
          {phase === "idle" ? "⟳ 업데이트" : PHASE_LABEL[phase]}
        </button>
      )}
    </>
  );
}
