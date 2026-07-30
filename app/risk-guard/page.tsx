"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getRiskStatus, setKillSwitch, type RiskStatus } from "@/lib/api";
import { PageHeader, StateBlock, KV } from "@/components/console/widgets";
import { Panel, PanelHead, Meter, Badge, Dot } from "@/components/console/primitives";

const won = (n: number) => `₩${n.toLocaleString()}`;

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
    <div className="min-h-full">
      <PageHeader kicker="리스크 가드" title="킬스위치 및 낙폭(드로다운) 제어"
        right={<Badge tone={killed ? "neg" : "pos"}>{killed ? "킬 작동중" : "정상"}</Badge>} />
      <div className="p-5 space-y-5 max-w-[900px]">
        <StateBlock loading={loading} err={error} empty={!loading && !error && !data}>
          {data && (
            <>
              {/* 킬스위치 */}
              <Panel className={`overflow-hidden ${killed ? "c-panel-hud" : ""}`} hud={killed}>
                <div className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-start gap-3">
                    <Dot tone={killed ? "neg" : "pos"} pulse={killed} />
                    <div>
                      <div className={`text-[13px] font-semibold ${killed ? "text-[var(--c-neg)]" : "text-[var(--c-text-1)]"}`}>
                        킬스위치 {killed ? "ON — 거래 차단됨" : "OFF — 정상"}
                      </div>
                      <div className="text-[11px] text-[var(--c-text-3)] mt-0.5">
                        {killed ? `사유: ${data.kill_reason || "manual"}` : "모든 자동봇/주문 즉시 중단 스위치"}
                      </div>
                    </div>
                  </div>
                  <button onClick={toggleKill} disabled={busy}
                    className={`text-[12px] font-semibold px-4 py-2 border cursor-pointer disabled:opacity-40 transition-colors bg-transparent ${
                      killed ? "border-[color-mix(in_srgb,var(--c-pos)_50%,transparent)] text-[var(--c-pos)] hover:bg-[color-mix(in_srgb,var(--c-pos)_10%,transparent)]"
                             : "border-[color-mix(in_srgb,var(--c-neg)_50%,transparent)] text-[var(--c-neg)] hover:bg-[color-mix(in_srgb,var(--c-neg)_10%,transparent)]"}`}>
                    {killed ? "해제" : "긴급 정지"}
                  </button>
                </div>
              </Panel>

              {/* MDD 게이지 */}
              <Panel className="overflow-hidden">
                <PanelHead kicker="낙폭" title="최대 낙폭 (고점 대비)"
                  right={<span className={`c-num text-[11px] ${data.drawdown_breached ? "text-[var(--c-neg)]" : dd != null && dd < 0 ? "text-[var(--c-warn)]" : "text-[var(--c-text-2)]"}`}>
                    {dd != null ? `${dd}%` : "—"} / 한도 -{limit}%</span>} />
                <div className="p-4">
                  <Meter value={ddFrac} tone={data.drawdown_breached ? "neg" : ddFrac > 0.6 ? "warn" : "pos"} />
                  {data.drawdown_breached && (
                    <p className="text-[var(--c-neg)] text-[11px] mt-2 flex items-center gap-1.5">
                      <Dot tone="neg" /> 낙폭 한도 초과 — 자동 킬 발동. 원인 점검 후 수동 해제.
                    </p>
                  )}
                </div>
              </Panel>

              {/* 주문 한도 */}
              <Panel className="overflow-hidden">
                <PanelHead kicker="한도" title="주문 한도 (서버 강제)" />
                <div className="p-4">
                  <KV k="1회 주문 최대 수량" v={data.limits.max_order_qty.toLocaleString()} />
                  <KV k="1회 주문 최대 금액" v={won(data.limits.max_order_notional)} />
                  <KV k="종목당 최대 보유수량" v={data.limits.max_position_qty.toLocaleString()} />
                  <KV k="일일 손실 한도" v={won(data.limits.daily_loss_limit)} />
                  <div className="pt-2 mt-1 text-[10px] text-[var(--c-text-3)]">※ 한도는 .env(MAX_ORDER_*, DAILY_LOSS_LIMIT, MAX_DRAWDOWN_PCT)에서 조정.</div>
                </div>
              </Panel>
            </>
          )}
        </StateBlock>
      </div>
    </div>
  );
}
