"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getRiskStatus, setKillSwitch, getIBGatewayStatus, type RiskStatus, type IBGatewayStatus } from "@/lib/api";
import { ApPanel, ApPanelHead } from "@/components/ui/ApPrimitives";
import { EmptyState, LoadingState, Bar } from "@/components/ui";

const won = (n: number) => `₩${n.toLocaleString()}`;

const VENUE_LABEL: Record<string, string> = {
  KR: "KR (한국주식)", HL: "HL (Hyperliquid)", US_IB: "US_IB (옵션)", US_ALPACA: "US_ALPACA (미국주식)",
};

function KVRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-[13px] font-data border-b border-ap-line/60 last:border-0">
      <span className="text-ap-ink-3">{k}</span>
      <span className="text-ap-ink-1 text-right truncate tabular-nums">{v}</span>
    </div>
  );
}

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<RiskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const [ibStatus, setIbStatus] = useState<IBGatewayStatus | null>(null);
  const [ibError, setIbError] = useState<string | null>(null);
  const ibCtrl = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    ctrl.current?.abort(); const c = new AbortController(); ctrl.current = c;
    getRiskStatus(c.signal)
      .then((d) => { if (!c.signal.aborted) { setData(d); setLoading(false); } })
      .catch((e) => { if (!c.signal.aborted) { setError(e instanceof ApiError ? e.message : String(e)); setLoading(false); } });
  }, []);

  const loadIB = useCallback(() => {
    ibCtrl.current?.abort(); const c = new AbortController(); ibCtrl.current = c;
    setIbError(null);
    getIBGatewayStatus(c.signal)
      .then((d) => { if (!c.signal.aborted) { setIbStatus(d); setIbError(null); } })
      .catch((e) => { if (!c.signal.aborted && e.name !== "AbortError") setIbError(e instanceof ApiError ? e.message : String(e)); });
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    loadIB();
    const iv = setInterval(() => { load(); loadIB(); }, 30_000);
    return () => { clearInterval(iv); ctrl.current?.abort(); ibCtrl.current?.abort(); };
  }, [open, load, loadIB]);

  async function toggleKill() {
    if (!data) return;
    const next = !data.kill_engaged;
    if (next && !confirm("⚠ 킬스위치 ON — 모든 자동봇/주문 즉시 차단. 계속?")) return;
    setBusy(true);
    try { await setKillSwitch(next, "manual"); load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function toggleVenueKill(venue: string, engaged: boolean) {
    const next = !engaged;
    const label = VENUE_LABEL[venue] ?? venue;
    if (next && !confirm(`⚠ ${label} 킬스위치 ON — 이 venue 신규 진입 즉시 차단(청산은 계속 가능). 계속?`)) return;
    setBusy(true);
    try { await setKillSwitch(next, "manual", venue); load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  if (!open) return null;

  // 전체(_AGGREGATE) 전용 상태 — data.kill_engaged/current_drawdown_pct는 "venue중
  // 하나라도 killed/최악값" compat 필드라 상단 카드(_AGGREGATE 토글)엔 안 맞음.
  const agg = data?.venues?.["_AGGREGATE"];
  const dd = agg?.current_drawdown_pct ?? data?.current_drawdown_pct ?? null;
  const limit = agg?.max_drawdown_limit_pct ?? data?.max_drawdown_limit_pct ?? 15;
  const ddFrac = dd != null ? Math.min(Math.abs(dd) / limit, 1) : 0;
  const killed = agg?.kill_engaged ?? data?.kill_engaged;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-[420px] h-full bg-ap-bg border-l border-ap-line overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-ap-ink-1 text-lg font-semibold tracking-tight">설정 · 리스크 가드</h2>
          <button onClick={onClose} className="text-ap-ink-3 text-xs border-0 bg-transparent cursor-pointer min-h-11 min-w-11 px-3 flex items-center justify-center">닫기</button>
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
          <div className="space-y-4">
            <ApPanel className={killed ? "border-ap-down/40" : ""}>
              <div className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${killed ? "bg-ap-down animate-pulse" : "bg-ap-up"}`} />
                  <div>
                    <div className={`text-[13px] font-semibold ${killed ? "text-ap-down" : "text-ap-ink-1"}`}>
                      킬스위치 {killed ? "ON — 전체 차단됨" : "OFF — 정상"}
                    </div>
                    <div className="text-[11px] text-ap-ink-3 mt-0.5">
                      {killed ? `사유: ${agg?.kill_reason || data.kill_reason || "manual"}` : "아래 버튼은 전체(firm-wide) 즉시 차단 — 개별 venue는 하단에서"}
                    </div>
                  </div>
                </div>
                <button onClick={toggleKill} disabled={busy}
                  className={`text-[13px] font-semibold px-4 py-2 border rounded-ap-sm cursor-pointer disabled:opacity-40 transition-colors bg-transparent ${
                    killed ? "border-ap-up/50 text-ap-up hover:bg-ap-up/10"
                           : "border-ap-down/50 text-ap-down hover:bg-ap-down/10"}`}>
                  {killed ? "전체 해제" : "전체 긴급정지"}
                </button>
              </div>
            </ApPanel>

            <ApPanel>
              <ApPanelHead title="최대 낙폭 (고점 대비)" right={
                <span className={killed ? "text-ap-down" : dd != null && dd < 0 ? "text-ap-caution" : "text-ap-ink-2"}>
                  {dd != null ? `${dd}%` : "—"} / 한도 -{limit}%
                </span>
              } />
              <div className="p-4">
                <Bar
                  ratio={ddFrac}
                  tone={killed ? "bg-ap-down" : ddFrac > 0.6 ? "bg-ap-caution" : "bg-ap-up"}
                  width="w-full"
                  trackClass="bg-ap-bg border-ap-line"
                />
                {killed && (
                  <p className="text-ap-down text-[11px] mt-2 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-ap-down shrink-0" /> 낙폭 한도 초과 — 자동 킬 발동. 원인 점검 후 수동 해제.
                  </p>
                )}
              </div>
            </ApPanel>

            <ApPanel>
              <ApPanelHead title="Venue별 상태" />
              <div className="p-4 space-y-2.5">
                {Object.entries(data.venues ?? {}).filter(([venue]) => venue !== "_AGGREGATE").map(([venue, v]) => {
                  const vDd = v.current_drawdown_pct ?? null;
                  const vKilled = v.kill_engaged;
                  return (
                    <div key={venue} className="flex items-center justify-between gap-3 py-1 border-b border-ap-line/60 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${vKilled ? "bg-ap-down animate-pulse" : "bg-ap-up"}`} />
                        <div className="min-w-0">
                          <div className={`text-[12px] font-semibold truncate ${vKilled ? "text-ap-down" : "text-ap-ink-1"}`}>
                            {VENUE_LABEL[venue] ?? venue}
                          </div>
                          <div className="text-[10px] text-ap-ink-3 truncate">
                            {vKilled ? `사유: ${v.kill_reason || "manual"}` : `${vDd != null ? `${vDd}%` : "—"} / 한도 -${v.max_drawdown_limit_pct}%`}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => toggleVenueKill(venue, vKilled)} disabled={busy}
                        className={`text-[11px] font-semibold px-3 py-1.5 border rounded-ap-sm cursor-pointer disabled:opacity-40 transition-colors bg-transparent shrink-0 ${
                          vKilled ? "border-ap-up/50 text-ap-up hover:bg-ap-up/10"
                                  : "border-ap-down/50 text-ap-down hover:bg-ap-down/10"}`}>
                        {vKilled ? "해제" : "차단"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </ApPanel>

            <ApPanel>
              <ApPanelHead title="주문 한도 (서버 강제)" />
              <div className="p-4">
                <KVRow k="1회 주문 최대 수량" v={data.limits.max_order_qty.toLocaleString()} />
                <KVRow k="1회 주문 최대 금액" v={won(data.limits.max_order_notional)} />
                <KVRow k="종목당 최대 보유수량" v={data.limits.max_position_qty.toLocaleString()} />
                <KVRow k="일일 손실 한도" v={won(data.limits.daily_loss_limit)} />
                <div className="pt-2 mt-1 text-[11px] text-ap-ink-3">※ 한도는 .env(MAX_ORDER_*, DAILY_LOSS_LIMIT, MAX_DRAWDOWN_PCT)에서 조정.</div>
              </div>
            </ApPanel>
          </div>
        )}

        <ApPanel>
          <ApPanelHead title="IB Gateway 연결" />
          <div className="p-4">
            {ibError ? (
              <div className="text-[13px] text-ap-down">상태 조회 실패: {ibError}</div>
            ) : !ibStatus ? (
              <div className="text-[13px] text-ap-ink-3">상태 조회 중…</div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${ibStatus.connected ? "bg-ap-up" : "bg-ap-down"}`} />
                <div className="text-[13px]">
                  <span className={ibStatus.connected ? "text-ap-up font-semibold" : "text-ap-down font-semibold"}>
                    {ibStatus.connected ? "연결됨" : "연결 안 됨"}
                  </span>
                  {ibStatus.last_auth_ts && (
                    <span className="text-ap-ink-3 ml-2">마지막 인증: {ibStatus.last_auth_ts}</span>
                  )}
                </div>
              </div>
            )}
            {ibStatus?.needs_manual_action && (
              <p className="text-ap-down text-[11px] mt-2">
                IBKR Mobile 앱에서 재인증 승인 필요
              </p>
            )}
          </div>
        </ApPanel>
      </div>
    </div>
  );
}
