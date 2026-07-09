"use client";

import { useState } from "react";
import { Panel, PanelHeader } from "@/components/ui/Panel";

// ── 페이오프 계산 ───────────────────────────────────────────────────────────────
function callPayoff(S: number, K: number, premium: number): number {
  return Math.max(S - K, 0) - premium;
}
function putPayoff(S: number, K: number, premium: number): number {
  return Math.max(K - S, 0) - premium;
}
function coveredCallPayoff(S: number, K: number, premium: number, entryStock: number): number {
  return (S - entryStock) + premium - Math.max(S - K, 0);
}

// ── 페이오프 차트 (SVG) ───────────────────────────────────────────────────────
function PayoffChart({
  fn, K, S0, label, color = "text-accent",
}: {
  fn: (S: number) => number;
  K: number; S0: number; label: string; color?: string;
}) {
  const W = 280, H = 120;
  const prices = Array.from({ length: 61 }, (_, i) => S0 * (0.7 + i * 0.01));
  const payoffs = prices.map(fn);
  const minP = Math.min(...payoffs, -5), maxP = Math.max(...payoffs, 5);
  const range = maxP - minP || 1;

  const toX = (i: number) => (i / 60) * W;
  const toY = (p: number) => H - ((p - minP) / range) * H;

  const pts = prices.map((_, i) => `${toX(i)},${toY(payoffs[i])}`).join(" ");
  const zeroY = toY(0);
  const colorClass = color.replace("text-", "");

  return (
    <Panel>
      <PanelHeader>{label}</PanelHeader>
      <div className="p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "100px" }}>
          {/* 제로선 */}
          <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="currentColor" strokeWidth="0.5"
            className="text-border" strokeDasharray="4,2" />
          {/* 행사가 수직선 */}
          <line x1={toX(30)} y1="0" x2={toX(30)} y2={H} stroke="currentColor" strokeWidth="0.5"
            className="text-text-3" strokeDasharray="2,2" />
          {/* 페이오프 곡선 */}
          <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5"
            className={`text-${colorClass}`} />
          {/* K 라벨 */}
          <text x={toX(30) + 2} y="10" className="text-text-3" fill="currentColor"
            fontSize="8">K={K}</text>
        </svg>
        <div className="flex justify-between text-[10px] text-text-3 mt-1">
          <span>{(S0 * 0.7).toFixed(0)}</span>
          <span>주가</span>
          <span>{(S0 * 1.3).toFixed(0)}</span>
        </div>
      </div>
    </Panel>
  );
}

// ── Greeks 카드 ─────────────────────────────────────────────────────────────────
function GreekCard({ symbol, name, ko, what, example, color }: {
  symbol: string; name: string; ko: string; what: string; example: string; color: string;
}) {
  return (
    <div className="bg-panel border border-border rounded-lg p-3 space-y-1">
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-semibold font-data ${color}`}>{symbol}</span>
        <span className="text-sm text-text-1 font-semibold">{name}</span>
        <span className="text-[11px] text-text-3">{ko}</span>
      </div>
      <p className="text-[12px] text-text-2">{what}</p>
      <div className="text-[11px] text-text-3 bg-panel-2 rounded px-2 py-1">{example}</div>
    </div>
  );
}

// ── 전략 탭 ─────────────────────────────────────────────────────────────────────
type Strategy = {
  id: string; name: string; ko: string;
  desc: string; when: string; risk: string; reward: string;
  payoffFn: (S: number) => number; color: string;
};

const S0 = 100;
const STRATEGIES: Strategy[] = [
  {
    id: "long_call", name: "Long Call", ko: "콜 매수",
    desc: "주가 상승 시 이익. 하락해도 프리미엄($3)만 잃음.",
    when: "주가 상승 확신할 때. 레버리지 효과.",
    risk: "최대 손실 = 프리미엄 ($3)", reward: "이론상 무한",
    payoffFn: (S) => callPayoff(S, 100, 3), color: "text-pos",
  },
  {
    id: "long_put", name: "Long Put", ko: "풋 매수",
    desc: "주가 하락 시 이익. 상승해도 프리미엄($3)만 잃음.",
    when: "주가 하락 예상 시. 헤지 또는 숏 대체.",
    risk: "최대 손실 = 프리미엄 ($3)", reward: "K가 최대 (주가→0)",
    payoffFn: (S) => putPayoff(S, 100, 3), color: "text-neg",
  },
  {
    id: "covered_call", name: "Covered Call", ko: "커버드 콜",
    desc: "주식 보유 중 콜 매도. 프리미엄 수익+상승 제한.",
    when: "주식 보유 중. 박스권 or 완만한 상승 예상.",
    risk: "주가 급락 (주식 보유 손실)", reward: "최대 = K - 매수가 + 프리미엄",
    payoffFn: (S) => coveredCallPayoff(S, 110, 4, 100), color: "text-info",
  },
  {
    id: "protective_put", name: "Protective Put", ko: "방어적 풋",
    desc: "주식 보유 + 풋 매수. 보험처럼 하방 보호.",
    when: "주식 들고 있는데 단기 하락 우려.",
    risk: "프리미엄 비용 ($3) — 주가 올라도 $3 손해",
    reward: "상승은 무한, 하락은 K까지 보호",
    payoffFn: (S) => (S - 100) + putPayoff(S, 100, 3), color: "text-warn",
  },
];

export default function OptionsLearnPage() {
  const [activeStrategy, setActiveStrategy] = useState<string>("long_call");
  const [activeSection, setActiveSection] = useState<"basics" | "greeks" | "strategies" | "howto">("basics");

  const strat = STRATEGIES.find(s => s.id === activeStrategy)!;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="bg-panel border border-border rounded-lg p-4">
        <h1 className="text-xl font-semibold text-text-1">옵션 트레이딩 입문</h1>
        <p className="text-[12px] text-text-3 mt-1">
          콜/풋 기초 · Greeks · 4대 전략 · 이 시스템에서 쓰는 법
        </p>
      </div>

      {/* 섹션 탭 */}
      <div className="flex gap-1 bg-panel border border-border rounded-lg p-1">
        {([
          ["basics", "기초"],
          ["greeks", "Greeks"],
          ["strategies", "전략"],
          ["howto", "시스템 활용"],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setActiveSection(id)}
            className={`flex-1 py-1.5 text-xs rounded cursor-pointer border-0 transition-colors ${
              activeSection === id
                ? "bg-accent/10 text-accent border border-accent/30"
                : "text-text-3 bg-transparent hover:text-text-2"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* 기초 */}
      {activeSection === "basics" && (
        <div className="space-y-3">
          <Section title="옵션이란?">
            <p className="text-[12px] text-text-2 leading-relaxed">
              옵션은 <span className="text-accent">특정 가격(행사가, K)에 사거나 팔 권리</span>를 사고파는 계약.
              만기일 또는 그 전에 행사 가능. 권리를 사려면 <span className="text-accent">프리미엄</span>을 냄.
            </p>
          </Section>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-panel border border-border rounded-lg p-3 space-y-1.5">
              <div className="text-pos font-semibold text-sm">CALL (콜)</div>
              <p className="text-[12px] text-text-2">
                "<b>살 권리</b>" — 주가가 K 위로 오르면 이익
              </p>
              <div className="text-[11px] text-text-3 bg-panel-2 rounded px-2 py-1">
                AAPL $150 콜 보유 → 주가 $170 → $20 이익<br />
                주가 $130 → 행사 포기, 프리미엄만 손실
              </div>
            </div>
            <div className="bg-panel border border-border rounded-lg p-3 space-y-1.5">
              <div className="text-neg font-semibold text-sm">PUT (풋)</div>
              <p className="text-[12px] text-text-2">
                "<b>팔 권리</b>" — 주가가 K 아래로 내리면 이익
              </p>
              <div className="text-[11px] text-text-3 bg-panel-2 rounded px-2 py-1">
                AAPL $150 풋 보유 → 주가 $130 → $20 이익<br />
                주가 $170 → 행사 포기, 프리미엄만 손실
              </div>
            </div>
          </div>

          <Section title="핵심 용어">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {[
                ["ITM (내가격)", "행사하면 이익 (콜: S>K, 풋: S<K)"],
                ["OTM (외가격)", "행사하면 손해 (콜: S<K, 풋: S>K)"],
                ["ATM (등가격)", "S ≈ K — 가장 민감"],
                ["만기일", "권리가 소멸되는 날 (미국: 매월 셋째 금요일)"],
                ["프리미엄", "옵션 가격 = 내재가치 + 시간가치"],
                ["계약 단위", "1계약 = 100주 (미국 기준)"],
              ].map(([k, v]) => (
                <div key={k} className="bg-panel-2 border border-border rounded px-2 py-1.5">
                  <div className="text-text-3 text-[10px] uppercase tracking-wide">{k}</div>
                  <div className="text-text-1">{v}</div>
                </div>
              ))}
            </div>
          </Section>

          <Panel>
            <PanelHeader>이 시스템과 관련성</PanelHeader>
            <p className="p-3 text-[12px] text-text-2 leading-relaxed">
              buyback 공시 → 20일 drift 예측 있음 →{" "}
              <span className="text-pos">콜 매수</span>로 레버리지 효과 (주식 직접 매수 대비 프리미엄만 리스크).
              지연 데이터(15분)로도 D+1 진입 전략에 충분.
            </p>
          </Panel>
        </div>
      )}

      {/* Greeks */}
      {activeSection === "greeks" && (
        <div className="space-y-3">
          <p className="text-[12px] text-text-2">
            Greeks = 옵션 가격이 각 변수에 얼마나 민감한지. 리스크 관리의 핵심.
          </p>
          <GreekCard symbol="Δ" name="Delta" ko="델타"
            what="주가 $1 변화 → 옵션 가격 얼마 변화? ATM 콜 ≈ 0.5"
            example="Delta 0.5 콜 보유 → 주가 +$2 → 옵션 +$1"
            color="text-accent" />
          <GreekCard symbol="Θ" name="Theta" ko="세타"
            what="시간 1일 경과 → 옵션 가격 얼마 감소? (시간가치 소멸)"
            example="Theta −$0.05 → 매일 $5 손실 (1계약=100주)"
            color="text-warn" />
          <GreekCard symbol="Γ" name="Gamma" ko="감마"
            what="주가 $1 변화 → Delta 얼마 변화? ATM에서 최대"
            example="Gamma 0.02 → 주가 +$1 → Delta 0.5→0.52"
            color="text-info" />
          <GreekCard symbol="Vega" name="Vega" ko="베가"
            what="내재변동성(IV) 1% 변화 → 옵션 가격 변화"
            example="Vega $0.15 → IV +1% → 옵션 +$0.15"
            color="text-pos" />

          <Panel>
            <PanelHeader>실전 요약</PanelHeader>
            <div className="p-3 space-y-1 text-[12px] text-text-2">
              <div>• 방향성 베팅 → <span className="text-accent">Delta</span> 가장 중요</div>
              <div>• 장기 보유 → <span className="text-warn">Theta</span> 적은 게 유리 (시간가치 안 녹도록)</div>
              <div>• 변동성 터질 것 같으면 → <span className="text-pos">Vega</span> 높은 옵션</div>
              <div>• 델타 헤징 시 → <span className="text-info">Gamma</span> 추적 필요</div>
            </div>
          </Panel>
        </div>
      )}

      {/* 전략 */}
      {activeSection === "strategies" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {STRATEGIES.map(s => (
              <button key={s.id} onClick={() => setActiveStrategy(s.id)}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                  activeStrategy === s.id
                    ? "border-accent/50 bg-accent/10"
                    : "border-border bg-panel hover:bg-panel-2"}`}>
                <div className={`text-xs font-semibold ${s.color}`}>{s.name}</div>
                <div className="text-[10px] text-text-3">{s.ko}</div>
              </button>
            ))}
          </div>

          <Panel>
            <PanelHeader right={<span className="normal-case tracking-normal font-normal">{strat.ko}</span>}>
              {strat.name}
            </PanelHeader>
            <div className="p-3 space-y-2">
              <p className="text-[12px] text-text-2">{strat.desc}</p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-panel-2 border border-border rounded px-2 py-1.5">
                  <div className="text-[10px] text-text-3 uppercase tracking-wide">언제?</div>
                  <div className="text-text-1">{strat.when}</div>
                </div>
                <div className="space-y-1">
                  <div className="bg-panel-2 border border-neg/30 rounded px-2 py-1">
                    <span className="text-[10px] text-text-3">리스크: </span>
                    <span className="text-neg text-[11px]">{strat.risk}</span>
                  </div>
                  <div className="bg-panel-2 border border-pos/30 rounded px-2 py-1">
                    <span className="text-[10px] text-text-3">보상: </span>
                    <span className="text-pos text-[11px]">{strat.reward}</span>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <PayoffChart
            fn={strat.payoffFn} K={100} S0={S0}
            label={`${strat.name} 페이오프 (K=100, 현재가=100)`}
            color={strat.color}
          />
        </div>
      )}

      {/* 시스템 활용 */}
      {activeSection === "howto" && (
        <div className="space-y-3">
          <Section title="buyback 전략 + 콜 옵션 조합">
            <div className="space-y-2 text-[12px] text-text-2">
              <p>지금 buyback drift 전략 (20일 보유) + 콜 매수 덧대기:</p>
              <div className="bg-panel-2 border border-border rounded p-2.5 space-y-1 text-[11px]">
                <div>1. DART buyback 공시 감지 → D+1 진입 신호</div>
                <div>2. 주식 직접 매수 대신 <span className="text-pos">ATM 콜 매수</span> (만기 1~2개월 후)</div>
                <div>3. 20일 후 (또는 만기 전) 청산</div>
                <div className="text-text-3 mt-1.5">
                  장점: 주식 매수 대비 프리미엄만 리스크<br />
                  단점: 시간가치 소멸 (Theta), 레버리지 → 변동성 ↑
                </div>
              </div>
            </div>
          </Section>

          <Section title="IB 옵션 체인 보는 법">
            <div className="space-y-1.5 text-[12px] text-text-2">
              <p>이 시스템에서 IB 연결 후 옵션 체인 조회 가능:</p>
              <div className="bg-panel-2 border border-border rounded p-2 font-data text-[11px] text-text-1">
                GET /ib/options/chain?symbol=AAPL
              </div>
              <p className="text-[11px] text-text-3">
                지연 데이터(15분) 사용. OPRA 구독 불필요.<br />
                반환: 만기별 · 행사가별 bid/ask/IV/delta
              </p>
            </div>
          </Section>

          <Section title="현재 상태 / 로드맵">
            <div className="space-y-1.5 text-[11px]">
              {[
                ["✅", "IB 옵션 체인 조회 (/ib/options/chain)", "text-pos"],
                ["✅", "지연 데이터 옵션 호가", "text-pos"],
                ["🔬", "buyback × 콜 백테스트 (미착수)", "text-warn"],
                ["🔬", "옵션 주문 실행 (IB order_client 확장 예정)", "text-warn"],
                ["❌", "Delta 헤징 자동화 (실시간 데이터 필요)", "text-neg"],
              ].map(([icon, label, color]) => (
                <div key={label} className="flex gap-2 items-start">
                  <span className={color}>{icon}</span>
                  <span className={`text-text-2 ${color === "text-neg" ? "text-text-3" : ""}`}>{label}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel>
      <PanelHeader>{title}</PanelHeader>
      <div className="p-3 space-y-2">{children}</div>
    </Panel>
  );
}
