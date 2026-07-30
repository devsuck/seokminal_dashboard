"use client";

import { useState } from "react";
import { ApiError, getSmartSignal, type SmartSignal } from "@/lib/api";
import { Button, LoadingState } from "@/components/ui";
import { Panel, PanelHead } from "@/components/console/primitives";
import { PageHeader } from "@/components/console/widgets";
import { AIInsightPanel, FinancialMetric, SignalBadge, type SignalKind, type Tone } from "@/components/terminal";

const PRESETS = ["AAPL.NASDAQ", "MSFT.NASDAQ", "SPY.ARCA", "005930.XKRX", "000660.XKRX"];

// SmartSignal.verdict(BUY/HOLD/AVOID) → SignalBadge의 4종 signal로 매핑.
// AVOID는 "매도"가 아니라 "회피"지만, SignalBadge엔 그 뉘앙스가 없어 위험 신호로서 SELL(적색)에 배정.
// 실제 라벨은 별도로 한국어 텍스트를 병기해 의미 손실 없음.
const VERDICT_KIND: Record<string, SignalKind> = { BUY: "BUY", HOLD: "WATCH", AVOID: "SELL" };
const VERDICT_LABEL: Record<string, string> = { BUY: "매수", HOLD: "관망", AVOID: "회피" };

function regimeLabel(r: string): string {
  return { bull_low_vol: "강세·저변동", bull_high_vol: "강세·고변동", bear_low_vol: "약세·저변동", bear_high_vol: "약세·고변동" }[r] ?? r;
}
function regimeTone(r: string): Tone {
  return r.startsWith("bull") ? "pos" : r === "bear_high_vol" ? "neg" : "warn";
}

export default function SmartSignalPage() {
  const [instrument, setInstrument] = useState("AAPL.NASDAQ");
  const [data, setData] = useState<SmartSignal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(iid: string) {
    setInstrument(iid);
    setLoading(true); setError(null); setData(null);
    try { setData(await getSmartSignal(iid)); }
    catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-full">
      <PageHeader
        kicker="리서치 결과 · 참고용, 보장 아님"
        title="스마트 시그널"
        right={data && <SignalBadge signal={VERDICT_KIND[data.verdict]} timestamp={Date.now()} />}
      />

      <div className="p-5 grid grid-cols-1 lg:grid-cols-[240px_1fr_280px] gap-4 items-start">
        {/* LEFT — instrument lookup */}
        <Panel>
          <PanelHead kicker="조회" title="종목" />
          <div className="p-3 space-y-2.5">
            <input
              value={instrument}
              onChange={(e) => setInstrument(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && run(instrument)}
              placeholder="AAPL.NASDAQ"
              className="w-full bg-[var(--c-panel-2)] border border-[var(--c-border)] rounded px-2.5 py-1.5 text-[var(--c-text-1)] text-sm c-num outline-none focus:border-[var(--c-hud)]"
            />
            <Button variant="primary" size="md" onClick={() => run(instrument)} className="w-full">분석</Button>
            <div className="pt-1 space-y-1">
              <div className="text-[9px] tracking-[0.18em] text-[var(--c-text-3)] uppercase">프리셋</div>
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => run(p)}
                  className="w-full text-left text-[11px] px-2 py-1.5 rounded border border-[var(--c-border)] text-[var(--c-text-3)] hover:text-[var(--c-hud)] hover:border-[var(--c-hud)] c-num transition-colors"
                >
                  {p.split(".")[0]}
                </button>
              ))}
            </div>
          </div>
        </Panel>

        {/* CENTER — research output */}
        <div className="space-y-4 min-w-0">
          {error && <div className="text-[var(--c-neg)] text-sm bg-[color-mix(in_srgb,var(--c-neg)_10%,transparent)] border border-[color-mix(in_srgb,var(--c-neg)_30%,transparent)] rounded px-3 py-2">{error}</div>}
          {loading && <LoadingState message="레짐·모멘텀·Kelly 계산 중…" />}
          {!loading && !error && !data && (
            <div className="text-[11px] text-[var(--c-text-3)] py-16 text-center">종목을 선택하면 리서치 노트가 표시됩니다.</div>
          )}
          {data && (
            <>
              <AIInsightPanel
                agent="스마트 시그널 엔진"
                summary={`${VERDICT_LABEL[data.verdict]} — 레짐(HMM) 게이트 + 모멘텀 팩터 + Kelly 사이징 결합 판단${
                  data.verdict === "BUY" ? `. 제안 비중 ${data.suggested_position_pct}%` : ""
                }`}
                reasoning={data.notes}
                timestamp={Date.now()}
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <FinancialMetric label="레짐" value={regimeLabel(data.current_regime)} format="raw" tone={regimeTone(data.current_regime)} size="sm" />
                <FinancialMetric label="연 변동성" value={data.vol_annual_pct ?? 0} format="percent" precision={1} tone="warn" size="sm" />
                <FinancialMetric label="모멘텀 60일" value={data.momentum_60d_pct ?? 0} format="percent" precision={1} signColor size="sm" />
                <FinancialMetric label="SMA50 대비" value={data.price_vs_sma50_pct ?? 0} format="percent" precision={1} signColor size="sm" />
                <FinancialMetric label="Kelly½" value={data.kelly_half ?? "—"} format="raw" size="sm" />
                {data.verdict === "BUY" && (
                  <FinancialMetric
                    label="제안 비중"
                    value={data.suggested_position_pct}
                    format="percent"
                    precision={0}
                    tone="pos"
                    size="sm"
                    unit={
                      data.sizing_constraint === "cvar" ? "CVaR 제약" : data.sizing_constraint === "cap" ? "상한 25%" : "Kelly·변동성"
                    }
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* RIGHT — tail risk */}
        <Panel>
          <PanelHead kicker="P&R" title="꼬리 위험" />
          <div className="p-3 space-y-3">
            <FinancialMetric label="CVaR 95 (일간)" value={data?.cvar_95_pct ?? 0} format="percent" precision={1} tone="neg" size="sm" />
            <p className="text-[10px] text-[var(--c-text-3)] leading-relaxed pt-1 border-t border-[var(--c-border)]">
              레짐이 약세·고변동으로 전환되면 회피 판정. 강세+모멘텀에서만 매수, Kelly½(상한 25%)로 비중 제안.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
