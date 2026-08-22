"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getRiskStatus, setKillSwitch, type RiskStatus } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, LoadingState, Bar } from "@/components/ui";

const won = (n: number) => `₩${n.toLocaleString()}`;

function KVRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-[11.5px] font-data border-b border-ap-line/60 last:border-0">
      <span className="text-ap-ink-3">{k}</span>
      <span className="text-ap-ink-1 text-right truncate tabular-nums">{v}</span>
    </div>
  );
}

export default function RiskGuardPage() {
  const [data, setData] = useState<RiskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    ctrl.current?.abort(); const c = new AbortController(); ctrl.current = c;
    getRiskStatus(c.signal)
      .then((d) => { if (!c.signal.aborted) { setData(d); setLoading(false); } })
      .catch((e) => { if (!c.signal.aborted) { setError(e instanceof ApiError ? e.message : String(e)); setLoading(false); } });
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => { clearInterval(iv); ctrl.current?.abort(); };
  }, [load]);

  async function toggleKill() {
    if (!data) return;
    const next = !data.kill_engaged;
    if (next && !confirm("⚠ 킬스위치 ON — 모든 자동봇/주문 즉시 차단. 계속?")) return;
    setBusy(true);
    try { await setKillSwitch(next, "manual"); load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  const dd = data?.current_drawdown_pct ?? null;
  const limit = data?.max_drawdown_limit_pct ?? 15;
  const ddFrac = dd != null ? Math.min(Math.abs(dd) / limit, 1) : 0;
  const killed = data?.kill_engaged;

  return (
    <div className="min-h-full bg-ap-bg p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-ap-ink-1 text-lg font-semibold tracking-tight">리스크 가드</h1>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-ap-sm text-[10px] font-semibold uppercase tracking-wide border ${
          killed ? "text-ap-down border-ap-down/40 bg-ap-down/10" : "text-ap-up border-ap-up/40 bg-ap-up/10"
        }`}>
          {killed ? "킬 작동중" : "정상"}
        </span>
      </div>

      {loading ? (
        <LoadingState message="리스크 상태 로딩 중…" textClass="text-ap-ink-3" spinnerClass="border-ap-line border-t-ap-brand" />
      ) : error ? (
        <div className="p-4 rounded-ap-lg border border-ap-down/40 bg-ap-down/5 text-ap-down text-xs">
          백엔드 연결 실패: {error} <span className="text-ap-ink-3">· api_server(:8000) 기동 확인</span>
        </div>
      ) : !data ? (
        <EmptyState message="데이터 없음" textClass="text-ap-ink-3" />
      ) : (
        <div className="space-y-4 max-w-[900px]">
          {/* 킬스위치 */}
          <Card className={killed ? "border-ap-down/40" : ""}>
            <div className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${killed ? "bg-ap-down animate-pulse" : "bg-ap-up"}`} />
                <div>
                  <div className={`text-[13px] font-semibold ${killed ? "text-ap-down" : "text-ap-ink-1"}`}>
                    킬스위치 {killed ? "ON — 거래 차단됨" : "OFF — 정상"}
                  </div>
                  <div className="text-[11px] text-ap-ink-3 mt-0.5">
                    {killed ? `사유: ${data.kill_reason || "manual"}` : "모든 자동봇/주문 즉시 중단 스위치"}
                  </div>
                </div>
              </div>
              <button onClick={toggleKill} disabled={busy}
                className={`text-[12px] font-semibold px-4 py-2 border rounded-ap-sm cursor-pointer disabled:opacity-40 transition-colors bg-transparent ${
                  killed ? "border-ap-up/50 text-ap-up hover:bg-ap-up/10"
                         : "border-ap-down/50 text-ap-down hover:bg-ap-down/10"}`}>
                {killed ? "해제" : "긴급 정지"}
              </button>
            </div>
          </Card>

          {/* MDD 게이지 */}
          <Card>
            <CardHeader right={
              <span className={data.drawdown_breached ? "text-ap-down" : dd != null && dd < 0 ? "text-ap-caution" : "text-ap-ink-2"}>
                {dd != null ? `${dd}%` : "—"} / 한도 -{limit}%
              </span>
            }>
              최대 낙폭 (고점 대비)
            </CardHeader>
            <div className="p-4">
              <Bar
                ratio={ddFrac}
                tone={data.drawdown_breached ? "bg-ap-down" : ddFrac > 0.6 ? "bg-ap-caution" : "bg-ap-up"}
                width="w-full"
                trackClass="bg-ap-bg border-ap-line"
              />
              {data.drawdown_breached && (
                <p className="text-ap-down text-[11px] mt-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-ap-down shrink-0" /> 낙폭 한도 초과 — 자동 킬 발동. 원인 점검 후 수동 해제.
                </p>
              )}
            </div>
          </Card>

          {/* 주문 한도 */}
          <Card>
            <CardHeader>주문 한도 (서버 강제)</CardHeader>
            <div className="p-4">
              <KVRow k="1회 주문 최대 수량" v={data.limits.max_order_qty.toLocaleString()} />
              <KVRow k="1회 주문 최대 금액" v={won(data.limits.max_order_notional)} />
              <KVRow k="종목당 최대 보유수량" v={data.limits.max_position_qty.toLocaleString()} />
              <KVRow k="일일 손실 한도" v={won(data.limits.daily_loss_limit)} />
              <div className="pt-2 mt-1 text-[10px] text-ap-ink-3">※ 한도는 .env(MAX_ORDER_*, DAILY_LOSS_LIMIT, MAX_DRAWDOWN_PCT)에서 조정.</div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
