"use client";
// 자본 청구 — 전략이 필요 자금을 청구, 엔벨로프 내면 AI 자율승인, 초과면 사람 대기열.
// /console/capital-claims/*, /console/capital-envelope. 배정 장부만 — 브로커 자금이동/주문 없음.
// 설계: seokminal-multi-venue/docs/superpowers/specs/2026-09-11-capital-claim-model-design.md
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getCapitalClaimQueue, decideCapitalClaim, getCapitalClaimHistory, submitCapitalClaim,
  getCapitalEnvelope, setCapitalEnvelope,
  type CapitalClaimQueueResp, type CapitalClaimHistoryResp, type CapitalEnvelope,
} from "@/lib/console-api";
import { ApPanel, ApPanelHead, ApBadge, ApSkeletonLines } from "@/components/ui/ApPrimitives";

const inputCls =
  "bg-[var(--c-panel-2)] border border-[var(--c-border)] text-[11px] text-[var(--c-text-1)] " +
  "px-2 h-8 w-full focus:outline-none focus:border-[var(--c-hud)]";

export default function CapitalClaimsPage() {
  const [queue, setQueue] = useState<CapitalClaimQueueResp | null>(null);
  const [hist, setHist] = useState<CapitalClaimHistoryResp | null>(null);
  const [env, setEnv] = useState<CapitalEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const [poolLimit, setPoolLimit] = useState("");
  const [paperLimit, setPaperLimit] = useState("");
  const [claimSid, setClaimSid] = useState("");
  const [claimAmt, setClaimAmt] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setErr(null);
    try {
      const [q, h, e] = await Promise.all([
        getCapitalClaimQueue(ctrl.signal),
        getCapitalClaimHistory("", 50, ctrl.signal),
        getCapitalEnvelope(ctrl.signal),
      ]);
      if (!ctrl.signal.aborted) {
        setQueue(q); setHist(h); setEnv(e);
        setPoolLimit((prev) => prev || String(e.pool_limit ?? 0));
        setPaperLimit((prev) => prev || String(e.default_paper_limit ?? 0));
      }
    } catch (ex) {
      if (!(ex instanceof DOMException && ex.name === "AbortError")) setErr((ex as Error).message);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => { run(); return () => abortRef.current?.abort(); }, [run]);

  const decide = async (claimId: string, approve: boolean) => {
    setBusy(true);
    try {
      await decideCapitalClaim(claimId, approve, notes[claimId] ?? "");
      await run();
    } finally {
      setBusy(false);
    }
  };

  const saveEnvelope = async () => {
    setBusy(true);
    try {
      await setCapitalEnvelope(Number(poolLimit) || 0, Number(paperLimit) || 0, env?.per_strategy_paper_limit ?? {});
      await run();
    } finally {
      setBusy(false);
    }
  };

  const submitClaim = async () => {
    if (!claimSid.trim()) return;
    setBusy(true);
    try {
      await submitCapitalClaim(claimSid.trim(), claimAmt ? Number(claimAmt) : undefined);
      setClaimSid(""); setClaimAmt("");
      await run();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[9px] font-semibold tracking-[0.24em] uppercase text-[var(--c-text-3)]">
            전략 자본 청구 · 사전 엔벨로프 내 AI 자율승인
          </div>
          <div className="text-[13px] font-semibold text-[var(--c-text-1)]">자본 청구</div>
        </div>
        <Link href="/investment-os" className="text-[11px] text-[var(--c-hud)] hover:underline no-underline">
          ← Investment OS
        </Link>
      </div>

      {/* Safety banner — 미션 핵심 */}
      <div className="bg-[var(--c-panel-2)] p-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-[9px] tracking-[0.2em] text-[var(--c-hud)] uppercase">보장 사항</span>
        <ApBadge tone="mute">배정 장부만 — 브로커 자금이동/주문 없음</ApBadge>
        <ApBadge tone="mute">LIVE 한도는 arm.py capital_limit 재사용(사람 이중게이트)</ApBadge>
        <ApBadge tone="mute">엔벨로프 초과 청구는 사람 승인 전까지 자본 0</ApBadge>
      </div>

      {!loading && err && <div className="text-[11px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

      {/* 엔벨로프 설정 */}
      <ApPanel>
        <ApPanelHead kicker="capital_envelope · 사람 전용" title="자율승인 엔벨로프"
          right={env && <ApBadge tone="mute">풀 {env.pool_limit.toLocaleString()} · 기본 PAPER {env.default_paper_limit.toLocaleString()}</ApBadge>} />
        <div className="p-4 space-y-3">
          {loading && <ApSkeletonLines rows={2} />}
          {!loading && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 w-40">
                <span className="text-[9px] uppercase tracking-wide text-[var(--c-text-3)]">전체 풀 한도</span>
                <input className={inputCls} value={poolLimit} onChange={(e) => setPoolLimit(e.target.value)} inputMode="decimal" />
              </label>
              <label className="flex flex-col gap-1 w-40">
                <span className="text-[9px] uppercase tracking-wide text-[var(--c-text-3)]">기본 PAPER 한도</span>
                <input className={inputCls} value={paperLimit} onChange={(e) => setPaperLimit(e.target.value)} inputMode="decimal" />
              </label>
              <button onClick={saveEnvelope} disabled={busy}
                className="px-4 h-8 text-[11px] font-semibold uppercase border cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[var(--c-hud)] border-[color-mix(in_srgb,var(--c-hud)_45%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_12%,transparent)]">
                저장
              </button>
            </div>
          )}
          <div className="text-[9px] text-[var(--c-text-3)]">
            LIVE 전략 한도는 여기서 관리하지 않음 — armed 전략은 arm() 호출 시 사람이 설정한 capital_limit 사용.
          </div>
        </div>
      </ApPanel>

      {/* 수동 청구 제출 (테스트/운영자용 — 실제로는 AI가 event-triggered로 제출) */}
      <ApPanel>
        <ApPanelHead kicker="submit_claim · AI 또는 사람" title="청구 제출" />
        <div className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 w-48">
              <span className="text-[9px] uppercase tracking-wide text-[var(--c-text-3)]">strategy_id</span>
              <input className={inputCls} value={claimSid} onChange={(e) => setClaimSid(e.target.value)} placeholder="예: S1" />
            </label>
            <label className="flex flex-col gap-1 w-40">
              <span className="text-[9px] uppercase tracking-wide text-[var(--c-text-3)]">요청 금액 (비우면 AI 제안치)</span>
              <input className={inputCls} value={claimAmt} onChange={(e) => setClaimAmt(e.target.value)} inputMode="decimal" />
            </label>
            <button onClick={submitClaim} disabled={busy || !claimSid.trim()}
              className="px-4 h-8 text-[11px] font-semibold uppercase border cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[var(--c-text-1)] border-[var(--c-border)]">
              제출
            </button>
          </div>
        </div>
      </ApPanel>

      {/* 대기열 */}
      <ApPanel>
        <ApPanelHead kicker="pending_queue · 사람 승인 대기" title="대기열"
          right={queue && <ApBadge tone={queue.count > 0 ? "warn" : "mute"}>{queue.count}건</ApBadge>} />
        <div className="p-4 space-y-2">
          {loading && <ApSkeletonLines rows={3} />}
          {!loading && !err && queue?.count === 0 && (
            <div className="text-[11px] text-[var(--c-text-3)]">대기 중인 청구 없음.</div>
          )}
          {!loading && queue?.queue.map((c) => (
            <div key={c.claim_id} className="border border-[var(--c-border)] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-[var(--c-text-1)] font-semibold">{c.strategy_id}</span>
                  <ApBadge tone="mute">{c.fulfillment_mode}</ApBadge>
                  <span className="c-num text-[var(--c-text-2)]">제안 {c.proposed_amount?.toLocaleString() ?? "-"}</span>
                </div>
                <span className="text-[9px] text-[var(--c-text-3)] c-num">{c.created_at}</span>
              </div>
              {c.envelope_check && (
                <div className="text-[9px] text-[var(--c-neg)]">
                  한도 초과 — 전략한도 {c.envelope_check.strategy_limit.toLocaleString()} / 풀한도 {c.envelope_check.pool_limit.toLocaleString()}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input className={inputCls + " max-w-xs"} placeholder="승인/거부 사유(선택)"
                  value={notes[c.claim_id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [c.claim_id]: e.target.value }))} />
                <button onClick={() => decide(c.claim_id, true)} disabled={busy}
                  className="px-3 h-8 text-[11px] font-semibold uppercase border cursor-pointer transition-colors disabled:opacity-50 text-[var(--c-pos)] border-[color-mix(in_srgb,var(--c-pos)_45%,transparent)] bg-[color-mix(in_srgb,var(--c-pos)_12%,transparent)]">
                  승인
                </button>
                <button onClick={() => decide(c.claim_id, false)} disabled={busy}
                  className="px-3 h-8 text-[11px] font-semibold uppercase border cursor-pointer transition-colors disabled:opacity-50 text-[var(--c-neg)] border-[color-mix(in_srgb,var(--c-neg)_45%,transparent)] bg-[color-mix(in_srgb,var(--c-neg)_12%,transparent)]">
                  거부
                </button>
              </div>
            </div>
          ))}
        </div>
      </ApPanel>

      {/* 이력 */}
      <ApPanel>
        <ApPanelHead kicker="claim_history" title="청구 이력" right={hist && <ApBadge tone="mute">{hist.count}건</ApBadge>} />
        <div className="p-4 space-y-1.5">
          {loading && <ApSkeletonLines rows={3} />}
          {!loading && !err && (hist?.count ?? 0) === 0 && (
            <div className="text-[11px] text-[var(--c-text-3)]">이력 없음.</div>
          )}
          {!loading && hist?.records.map((r) => (
            <div key={r.claim_id} className="flex items-center justify-between text-[11px] c-num text-[var(--c-text-2)] border-b border-[var(--c-border)] last:border-0 py-1 gap-2 flex-wrap">
              <span className="text-[var(--c-text-1)]">{r.strategy_id}</span>
              <span>{r.fulfillment_mode}</span>
              <span>{r.allocated_capital.toLocaleString()}</span>
              <ApBadge tone={r.status === "approved" ? "pos" : r.status === "queued" ? "warn" : "neg"}>{r.status}</ApBadge>
              <span className="text-[9px] text-[var(--c-text-3)]">{r.decided_by ?? "-"}</span>
              <span className="text-[9px]">{r.created_at}</span>
            </div>
          ))}
        </div>
      </ApPanel>
    </div>
  );
}
