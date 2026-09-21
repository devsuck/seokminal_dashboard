"use client";
// 자본 청구 — 전략이 필요 자금을 청구, 엔벨로프 내면 AI 자율승인, 초과면 사람 대기열.
// /console/capital-claims/*, /console/capital-envelope. 배정 장부만 — 브로커 자금이동/주문 없음.
// 설계: seokminal-multi-venue/docs/superpowers/specs/2026-09-11-capital-claim-model-design.md
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getCapitalClaimQueue, decideCapitalClaim, getCapitalClaimHistory, submitCapitalClaim,
  getCapitalClaimCandidates, getCapitalEnvelope, setCapitalEnvelope,
  type CapitalClaimQueueResp, type CapitalClaimHistoryResp, type CapitalEnvelope,
  type CapitalClaimCandidatesResp,
} from "@/lib/console-api";
import { ApPanel, ApPanelHead, ApBadge, ApSkeletonLines, ApButton, ApLightHero, ApListRow } from "@/components/ui/ApPrimitives";

const inputCls =
  "bg-ap-bg-page border border-ap-line rounded-ap-md text-ap-body text-ap-ink-1 " +
  "px-2 h-8 w-full focus:outline-none focus:border-ap-brand";

export default function CapitalClaimsPage() {
  const [queue, setQueue] = useState<CapitalClaimQueueResp | null>(null);
  const [hist, setHist] = useState<CapitalClaimHistoryResp | null>(null);
  const [env, setEnv] = useState<CapitalEnvelope | null>(null);
  const [candidates, setCandidates] = useState<CapitalClaimCandidatesResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const [poolLimit, setPoolLimit] = useState("");
  const [paperLimit, setPaperLimit] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [candAmts, setCandAmts] = useState<Record<string, string>>({});

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setErr(null);
    try {
      const [q, h, e, cd] = await Promise.all([
        getCapitalClaimQueue(ctrl.signal),
        getCapitalClaimHistory("", 50, ctrl.signal),
        getCapitalEnvelope(ctrl.signal),
        getCapitalClaimCandidates(ctrl.signal),
      ]);
      if (!ctrl.signal.aborted) {
        setQueue(q); setHist(h); setEnv(e); setCandidates(cd);
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

  const submitCandidate = async (strategyId: string, suggested: number | null) => {
    setBusy(true);
    try {
      const raw = candAmts[strategyId];
      const amt = raw !== undefined && raw !== "" ? Number(raw) : suggested ?? undefined;
      await submitCapitalClaim(strategyId, amt);
      setCandAmts((n) => { const { [strategyId]: _drop, ...rest } = n; return rest; });
      await run();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full p-4 space-y-4 bg-ap-bg-page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-ap-title font-semibold text-ap-ink-1">자본 청구</div>
          <div className="text-ap-body text-ap-ink-3 mt-0.5">
            배정 장부만 — 브로커 자금이동/주문 없음. 초과분은 사람 승인 전까지 자본 0.
          </div>
        </div>
        <Link href="/investment-os" className="text-ap-body text-ap-brand hover:underline no-underline">
          ← Investment OS
        </Link>
      </div>

      {!loading && err && <div className="text-ap-body text-ap-down">백엔드 연결 실패: {err}</div>}

      {/* 자율승인 풀 현황 — hero */}
      {loading ? (
        <ApSkeletonLines rows={3} />
      ) : (
        <ApLightHero
          label="자율승인 풀"
          value={`${(env?.pool_limit ?? 0).toLocaleString()}`}
          sub="LIVE 한도는 arm.py capital_limit 재사용(사람 이중게이트) · 여기선 관리 안 함"
          rows={[
            { label: "기본 PAPER 한도", value: (env?.default_paper_limit ?? 0).toLocaleString() },
            { label: "대기열", value: `${queue?.count ?? 0}건`, cls: (queue?.count ?? 0) > 0 ? "text-ap-brand" : undefined },
          ]}
        />
      )}

      {/* AI 제안 후보 — 아직 제출 전, 승인/수정 필요 */}
      <ApPanel>
        <ApPanelHead kicker="candidates · AI 제안 · 미제출" title="제안 후보"
          right={candidates && <ApBadge tone={candidates.count > 0 ? "info" : "mute"}>{candidates.count}건</ApBadge>} />
        <div className="p-4 space-y-2">
          {loading && <ApSkeletonLines rows={2} />}
          {!loading && !err && (candidates?.count ?? 0) === 0 && (
            <div className="text-ap-body text-ap-ink-3">대기 중인 제안 후보 없음.</div>
          )}
          {!loading && candidates?.candidates.map((c) => (
            <div key={c.strategy_id} className="rounded-ap-xl bg-ap-surface shadow-ap-sm p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-ap-body">
                  <span className="text-ap-ink-1 font-semibold">{c.strategy_id}</span>
                  {c.stale && <ApBadge tone="warn">stale</ApBadge>}
                  <span className="c-num text-ap-ink-2">AI 제안 {c.suggested_amount?.toLocaleString() ?? "-"}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input className={inputCls + " max-w-xs"}
                  placeholder={`제안대로면 비워둠 (${c.suggested_amount?.toLocaleString() ?? "-"})`}
                  value={candAmts[c.strategy_id] ?? ""} inputMode="decimal"
                  onChange={(e) => setCandAmts((n) => ({ ...n, [c.strategy_id]: e.target.value }))} />
                <ApButton onClick={() => submitCandidate(c.strategy_id, c.suggested_amount)} loading={busy}>
                  {candAmts[c.strategy_id] ? "수정해서 제출" : "제안대로 제출"}
                </ApButton>
              </div>
            </div>
          ))}
          {!loading && (candidates?.count ?? 0) > 0 && (
            <div className="text-ap-micro text-ap-ink-3">
              거절(무시)은 그냥 제출 안 하면 됨 — 다음 갱신에도 계속 후보로 뜸. 제출하면 아래 대기열/자율승인으로 넘어감.
            </div>
          )}
        </div>
      </ApPanel>

      {/* 대기열 */}
      <ApPanel>
        <ApPanelHead kicker="pending_queue · 사람 승인 대기" title="대기열"
          right={queue && <ApBadge tone={queue.count > 0 ? "warn" : "mute"}>{queue.count}건</ApBadge>} />
        <div className="p-4 space-y-2">
          {loading && <ApSkeletonLines rows={3} />}
          {!loading && !err && queue?.count === 0 && (
            <div className="text-ap-body text-ap-ink-3">대기 중인 청구 없음.</div>
          )}
          {!loading && queue?.queue.map((c) => (
            <div key={c.claim_id} className="rounded-ap-xl bg-ap-surface shadow-ap-sm p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-ap-body">
                  <span className="text-ap-ink-1 font-semibold">{c.strategy_id}</span>
                  <ApBadge tone="mute">{c.fulfillment_mode}</ApBadge>
                  <span className="c-num text-ap-ink-2">제안 {c.proposed_amount?.toLocaleString() ?? "-"}</span>
                </div>
                <span className="text-ap-micro text-ap-ink-3 c-num">{c.created_at}</span>
              </div>
              {c.envelope_check && (
                <div className="text-ap-micro text-ap-down">
                  한도 초과 — 전략한도 {c.envelope_check.strategy_limit.toLocaleString()} / 풀한도 {c.envelope_check.pool_limit.toLocaleString()}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input className={inputCls + " max-w-xs"} placeholder="승인/거부 사유(선택)"
                  value={notes[c.claim_id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [c.claim_id]: e.target.value }))} />
                <ApButton onClick={() => decide(c.claim_id, true)} loading={busy}>승인</ApButton>
                <ApButton variant="danger" onClick={() => decide(c.claim_id, false)} loading={busy}>거부</ApButton>
              </div>
            </div>
          ))}
        </div>
      </ApPanel>

      {/* 이력 */}
      <ApPanel>
        <ApPanelHead kicker="claim_history" title="청구 이력" right={hist && <ApBadge tone="mute">{hist.count}건</ApBadge>} />
        <div className="px-1">
          {loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
          {!loading && !err && (hist?.count ?? 0) === 0 && (
            <div className="p-4 text-ap-body text-ap-ink-3">이력 없음.</div>
          )}
          {!loading && hist?.records.map((r) => (
            <ApListRow
              key={r.claim_id}
              title={r.strategy_id}
              subtitle={`${r.fulfillment_mode} · ${r.decided_by ?? "-"} · ${r.created_at}`}
              trailing={<span className="c-num">{r.allocated_capital.toLocaleString()}</span>}
              trailingSub={<ApBadge tone={r.status === "approved" ? "pos" : r.status === "queued" ? "warn" : "neg"}>{r.status}</ApBadge>}
            />
          ))}
        </div>
      </ApPanel>

      {/* 엔벨로프 설정 (사람 전용 관리자 패널) */}
      <ApPanel>
        <ApPanelHead kicker="capital_envelope · 사람 전용" title="한도 조정" />
        <div className="p-4 space-y-3">
          {loading && <ApSkeletonLines rows={2} />}
          {!loading && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 w-40">
                <span className="text-ap-micro uppercase tracking-wide text-ap-ink-3">전체 풀 한도</span>
                <input className={inputCls} value={poolLimit} onChange={(e) => setPoolLimit(e.target.value)} inputMode="decimal" />
              </label>
              <label className="flex flex-col gap-1 w-40">
                <span className="text-ap-micro uppercase tracking-wide text-ap-ink-3">기본 PAPER 한도</span>
                <input className={inputCls} value={paperLimit} onChange={(e) => setPaperLimit(e.target.value)} inputMode="decimal" />
              </label>
              <ApButton variant="secondary" onClick={saveEnvelope} loading={busy}>저장</ApButton>
            </div>
          )}
        </div>
      </ApPanel>

    </div>
  );
}
