"use client";

import { useEffect, useRef, useState } from "react";
import {
  getEdgeValidation, refreshEdgeValidation, getLabStatus, restartCollector,
  type EdgeValidationResponse, type LabStatus,
} from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/Card";
import { EdgeReportCard } from "@/components/charts/EdgeReportCard";
import { toast } from "@/lib/toast";

const HYP = "mlb_specialist_consensus";
const COLLECTOR_KEY = "polymarket_mlb_specialist_tick" as const;

function formatAge(ageSec: number | null): string {
  if (ageSec == null) return "데이터 없음";
  if (ageSec < 60) return `${ageSec}s 전`;
  if (ageSec < 3600) return `${Math.floor(ageSec / 60)}분 전`;
  return `${Math.floor(ageSec / 3600)}시간 전`;
}

function CollectorStatus({ sys, restarting, onRestart }: {
  sys: LabStatus | null; restarting: boolean; onRestart: () => void;
}) {
  const p = sys?.processes?.[COLLECTOR_KEY];
  const running = !!p?.running;
  return (
    <Card>
      <CardHeader>수집기 상태</CardHeader>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`text-[9px] font-data font-bold px-1.5 py-0.5 ${running ? "bg-ap-up/20 text-ap-up" : "bg-ap-down/10 text-ap-down animate-blink"}`}>
          {running ? "ON" : "OFF"}
        </span>
        <span className="text-[11px] font-data text-ap-ink-2">
          {sys ? formatAge(p?.age_sec ?? null) : "로딩 중…"}
        </span>
        {!running && sys && (
          <button
            onClick={onRestart}
            disabled={restarting}
            className="text-[10px] px-2 py-1 border border-ap-down/50 text-ap-down bg-ap-down/15 font-data font-bold hover:bg-ap-down/25 disabled:opacity-40"
          >
            {restarting ? "재시작중…" : "재시작"}
          </button>
        )}
      </div>
    </Card>
  );
}

export default function MlbPage() {
  const [edge, setEdge] = useState<EdgeValidationResponse | null>(null);
  const [sys, setSys] = useState<LabStatus | null>(null);
  const [restarting, setRestarting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const load = () => {
      getEdgeValidation(ctrl.signal).then(d => { if (mounted) setEdge(d); }).catch(() => {});
      getLabStatus(ctrl.signal).then(d => { if (mounted) setSys(d); }).catch(() => {});
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => { mounted = false; clearInterval(iv); ctrl.abort(); };
  }, []);

  async function handleRefresh() {
    try { await refreshEdgeValidation(); } catch { /* noop */ }
    setEdge(e => e ? { ...e, warming: true } : e);
  }

  async function handleRestart() {
    setRestarting(true);
    try {
      await restartCollector(COLLECTOR_KEY);
      toast.show("MLB 수집기 재시작 완료", "success");
      const s = await getLabStatus().catch(() => null);
      if (s) setSys(s);
    } catch (e) {
      toast.show(`재시작 실패: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setRestarting(false);
    }
  }

  const rep = edge?.reports?.[HYP];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 bg-ap-bg min-h-full">
      <div>
        <h1 className="text-xl font-semibold text-ap-ink-1">MLB Specialist Consensus</h1>
        <p className="text-ap-ink-3 text-sm mt-1">
          폴리마켓 MLB 스페셜리스트 지갑 컨센서스 스크리닝 — p-value/BH-FDR, 실집행 근거 아님.
        </p>
      </div>

      <CollectorStatus sys={sys} restarting={restarting} onRestart={handleRestart} />

      <div className="flex items-center justify-end">
        <button onClick={handleRefresh} disabled={edge?.warming}
          className="text-[11px] px-2.5 py-1 rounded border border-ap-line text-ap-ink-3 hover:text-ap-brand disabled:opacity-40">
          {edge?.warming ? "계산 중…" : "지금 다시 계산"}
        </button>
      </div>

      <div className="text-ap-caution text-[11px] bg-ap-caution/10 border border-ap-caution/20 rounded px-3 py-2">
        ⚠ 스크리닝 결과일 뿐 <b>실집행 근거 아님</b>. walk-forward 생략, 표본 기간 미달. BH-FDR 통과해도 전체 파이프라인 승격 검토 대상.
      </div>

      {!edge ? <div className="text-ap-ink-3 text-xs">로딩 중…</div>
        : !rep ? <div className="text-ap-ink-3 text-xs">{edge.warming ? "백그라운드 계산 중 — 잠시 후 표시됩니다…" : "검증 결과 없음"}</div>
        : <EdgeReportCard hyp={HYP} rep={rep} />}
    </div>
  );
}
