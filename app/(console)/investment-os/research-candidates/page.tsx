"use client";
// 리서치 후보 검토 — auto-research 리더보드 중 verdict=CANDIDATE만 사람 승인 대기.
// 승격하면 lab/registry/promote-paper로 페이퍼 트레이딩 편입. 라이브 전환은 여기서 안 함(돈길 게이트 별도).
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getAutoResearch, promoteToPaper, type AutoResearchStatus, type AutoResearchEntry } from "@/lib/api";
import { ApPanel, ApPanelHead, ApBadge, ApSkeletonLines, ApButton, ApLightHero } from "@/components/ui/ApPrimitives";

function CandidateRow({ e, onPromote, busy }: { e: AutoResearchEntry; onPromote: (cid: string) => void; busy: boolean }) {
  return (
    <div className="rounded-ap-xl bg-ap-surface shadow-ap-sm p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-ap-body">
          <span className="text-ap-ink-1 font-semibold">{e.category}</span>
          <ApBadge tone="mute">{e.direction}</ApBadge>
          {e.bh_survivor && <ApBadge tone="pos">BH 생존</ApBadge>}
        </div>
        <span className="text-ap-micro text-ap-ink-3 c-num">{e.cid}</span>
      </div>
      <div className="text-ap-body text-ap-ink-2">{e.thesis}</div>
      <div className="flex flex-wrap gap-3 text-ap-micro text-ap-ink-3 c-num">
        <span>n {e.n ?? "-"}</span>
        <span>net {e.net?.toFixed(3) ?? "-"}</span>
        <span>median {e.median?.toFixed(3) ?? "-"}</span>
        <span>percentile {e.percentile?.toFixed(1) ?? "-"}</span>
        <span>p {e.p?.toFixed(3) ?? "-"}</span>
        <span>wf1 {e.wf_first?.toFixed(3) ?? "-"}</span>
        <span>wf2 {e.wf_second?.toFixed(3) ?? "-"}</span>
      </div>
      {e.redteam_failed.length > 0 && (
        <div className="text-ap-micro text-ap-down">레드팀 실패: {e.redteam_failed.join(", ")}</div>
      )}
      <ApButton onClick={() => onPromote(e.cid)} loading={busy}>페이퍼로 승격</ApButton>
    </div>
  );
}

export default function ResearchCandidatesPage() {
  const [data, setData] = useState<AutoResearchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyCid, setBusyCid] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setErr(null);
    try {
      const d = await getAutoResearch(ctrl.signal);
      if (!ctrl.signal.aborted) setData(d);
    } catch (ex) {
      if (!(ex instanceof DOMException && ex.name === "AbortError")) setErr((ex as Error).message);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => { run(); return () => abortRef.current?.abort(); }, [run]);

  const promote = async (cid: string) => {
    setBusyCid(cid);
    try {
      const res = await promoteToPaper(cid);
      setPromoted((m) => ({ ...m, [cid]: res.already_existed ? "이미 등록됨" : `등록됨: ${res.strategy_id}` }));
    } finally {
      setBusyCid(null);
    }
  };

  const candidates = (data?.leaderboard ?? []).filter((e) => e.verdict === "CANDIDATE");
  const rejected = (data?.leaderboard ?? []).filter((e) => e.verdict !== "CANDIDATE");

  return (
    <div className="min-h-full p-4 space-y-4 bg-ap-bg-page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-ap-title font-semibold text-ap-ink-1">리서치 후보 검토</div>
          <div className="text-ap-body text-ap-ink-3 mt-0.5">
            auto-research가 통계 검증(BH+레드팀) 통과시킨 후보만 여기 뜸. 승격하면 페이퍼 트레이딩으로 편입.
          </div>
        </div>
        <Link href="/investment-os" className="text-ap-body text-ap-brand hover:underline no-underline">
          ← Investment OS
        </Link>
      </div>

      {!loading && err && <div className="text-ap-body text-ap-down">백엔드 연결 실패: {err}</div>}

      {loading ? (
        <ApSkeletonLines rows={3} />
      ) : (
        <ApLightHero
          label="검증 현황"
          value={`${data?.n_tested ?? 0}건 검증`}
          sub={data?.honest_note ?? ""}
          rows={[
            { label: "후보", value: `${data?.n_candidates ?? 0}건`, cls: (data?.n_candidates ?? 0) > 0 ? "text-ap-brand" : undefined },
            { label: "저검정력", value: `${data?.n_underpowered ?? 0}건` },
          ]}
        />
      )}

      <ApPanel>
        <ApPanelHead kicker="candidates · BH+redteam 통과" title="후보"
          right={<ApBadge tone={candidates.length > 0 ? "info" : "mute"}>{candidates.length}건</ApBadge>} />
        <div className="p-4 space-y-2">
          {loading && <ApSkeletonLines rows={3} />}
          {!loading && !err && candidates.length === 0 && (
            <div className="text-ap-body text-ap-ink-3">검토 대기 중인 후보 없음.</div>
          )}
          {!loading && candidates.map((e) => (
            <div key={e.cid} className="space-y-1">
              <CandidateRow e={e} onPromote={promote} busy={busyCid === e.cid} />
              {promoted[e.cid] && <div className="text-ap-micro text-ap-up pl-1">{promoted[e.cid]}</div>}
            </div>
          ))}
        </div>
      </ApPanel>

      {rejected.length > 0 && (
        <ApPanel>
          <ApPanelHead kicker="rejected · BH/레드팀 탈락" title="탈락 후보"
            right={<ApBadge tone="mute">{rejected.length}건</ApBadge>} />
          <div className="p-2 space-y-1">
            {rejected.map((e) => (
              <div key={e.cid} className="flex items-center gap-2 px-2 py-1 text-ap-body border-b border-ap-line last:border-0">
                <ApBadge tone="neg">{e.verdict}</ApBadge>
                <span className="text-ap-ink-2 truncate flex-1">{e.thesis}</span>
              </div>
            ))}
          </div>
        </ApPanel>
      )}
    </div>
  );
}
