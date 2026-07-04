"use client";

import { useEffect, useState, useCallback } from "react";
import { listAgents, getAgentCycles, type TradingAgent, type AgentCycle } from "@/lib/api";

type Market = "KR" | "US";

const KR_FOCUS = [
  { key: "AI기본법", label: "AI 기본법", desc: "고위험 AI 규제·데이터 거버넌스 의무화 (2026 시행)" },
  { key: "저출산", label: "저출산·인구구조", desc: "내수 축소, 부동산 장기 하락, 연금 고갈 압력" },
  { key: "반도체_인프라", label: "반도체·전력 인프라", desc: "HBM 수출 증가 → 전력망 병목 → 관련 인프라주 수혜" },
  { key: "지정학", label: "지정학 리스크", desc: "對中 관계, 한미 동맹, 방산·원전 수출" },
  { key: "금리_환율", label: "금리·원달러", desc: "한은 기준금리, KRW/USD, 외국인 수급" },
];

const US_FOCUS = [
  { key: "Fed", label: "Fed 정책", desc: "금리 결정, 대차대조표 축소, CME FedWatch 확률" },
  { key: "AI_capex", label: "AI CapEx 사이클", desc: "하이퍼스케일러 설비투자, GPU 수요, 공급망 병목" },
  { key: "달러_국채", label: "달러·국채", desc: "DXY, 10Y 실질금리, 수익률 곡선 기울기" },
  { key: "무역정책", label: "무역·관세", desc: "對中 수출 규제, 리쇼어링, CHIPS Act 집행 현황" },
  { key: "고용_인플레", label: "고용·인플레이션", desc: "NFP, CPI, PCE — stagflation 가능성 모니터링" },
];

const KR_METHODOLOGY = [
  { step: "1. 상황인지", desc: "거시 지표·정책 발표·뉴스에서 현재 환경 파악" },
  { step: "2. 영향분석", desc: "어느 섹터·종목에 어떤 방향으로 영향이 가는지 추론" },
  { step: "3. 포트폴리오", desc: "비중 조절 방향 결정 (최종 집행은 사람)" },
];

const US_METHODOLOGY = [
  { step: "1. 매크로 스캔", desc: "Fed 정책·달러·채권시장·경기선행지수 종합" },
  { step: "2. 섹터 로테이션", desc: "리스크온/오프 환경 판단 → 섹터 비중 방향" },
  { step: "3. 전략 수립", desc: "롱/숏 바이어스, 헤지 필요성, 주요 이벤트 대기" },
];

function JournalEditor({ market }: { market: Market }) {
  const key = `macro-journal-${market}`;
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setText(localStorage.getItem(key) ?? "");
  }, [key]);

  function save() {
    localStorage.setItem(key, text);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-text-3 text-[10px] uppercase tracking-wider">현재 테제 · 메모</span>
        <button onClick={save}
          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${saved ? "border-pos text-pos" : "border-border text-text-3 hover:border-text-3 hover:text-text-2"}`}>
          {saved ? "저장됨 ✓" : "저장"}
        </button>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={market === "KR"
          ? "한국 시장 현재 뷰 기록...\n예: '한은 동결 지속, 원화 약세 헤징 필요. 반도체 인프라 섹터 비중 ↑'"
          : "US 시장 현재 뷰 기록...\n예: 'Fed 9월 인하 50% 확률. AI capex 사이클 아직 초기. 빅테크 롱 유지.'"}
        rows={5}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); } }}
        className="w-full px-3 py-2.5 text-xs bg-bg border border-border rounded-lg text-text-1 placeholder:text-text-3 outline-none focus:border-accent resize-none leading-relaxed"
      />
      <p className="text-text-3 text-[9px]">Cmd+S 로 저장 · 브라우저 로컬 저장</p>
    </div>
  );
}

function CycleLog({ cycles }: { cycles: AgentCycle[] }) {
  if (cycles.length === 0) return (
    <p className="text-text-3 text-xs py-4 text-center">아직 분석 기록 없음 — 에이전트 실행 후 자동 기록.</p>
  );
  return (
    <div className="space-y-2">
      {cycles.slice(0, 20).map(c => (
        <div key={c.cycle} className="bg-bg border border-border rounded-lg px-3 py-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-text-3 text-[10px]">{new Date(c.ts).toLocaleString("ko-KR")}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
              c.decision === "BUY" ? "bg-pos/10 text-pos"
              : c.decision === "SELL" ? "bg-neg/10 text-neg"
              : "bg-panel text-text-3"}`}>
              {c.decision}
              {c.symbol ? ` · ${c.symbol}` : ""}
              {c.score != null ? ` (${c.score})` : ""}
            </span>
          </div>
          {c.note && <p className="text-text-2 text-[11px] leading-relaxed">{c.note}</p>}
          {c.action && <p className="text-text-3 text-[10px] mt-1">{c.action}</p>}
        </div>
      ))}
    </div>
  );
}

export default function MacroPage() {
  const [market, setMarket] = useState<Market>("KR");
  const [agents, setAgents] = useState<TradingAgent[]>([]);
  const [cycles, setCycles] = useState<AgentCycle[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(false);

  const loadAgents = useCallback(async () => {
    try {
      const { agents: all } = await listAgents();
      setAgents(all);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  // 해당 마켓의 매크로 에이전트 찾기
  const macroAgent = agents.find(a =>
    market === "KR" ? a.type === "kr_macro" : (a.type === "swing" || a.type === "autonomous") && a.market === "US"
  );

  useEffect(() => {
    if (!macroAgent) { setCycles([]); return; }
    setLoadingCycles(true);
    getAgentCycles(macroAgent.id, 30)
      .then(r => setCycles(r.cycles))
      .catch(() => setCycles([]))
      .finally(() => setLoadingCycles(false));
  }, [macroAgent?.id]);

  const focus = market === "KR" ? KR_FOCUS : US_FOCUS;
  const methodology = market === "KR" ? KR_METHODOLOGY : US_METHODOLOGY;

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      {/* 헤더 */}
      <div className="shrink-0 px-5 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-text-1 font-semibold text-sm">
            <span className="text-accent">Macro</span> Lab
            <span className="text-text-3 text-xs ml-2 font-normal">거시 분석 · 사고 기록</span>
          </h1>
        </div>
        <div className="flex gap-1">
          {(["KR", "US"] as Market[]).map(m => (
            <button key={m} onClick={() => setMarket(m)}
              className={`px-4 py-1 text-xs rounded border transition-colors ${
                market === m ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2"
              }`}>
              {m === "KR" ? "🇰🇷 KR 거시" : "🇺🇸 US 거시"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* 왼쪽: 방법론 + 포커스 영역 */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4 space-y-5">
          {/* 에이전트 상태 */}
          <div>
            <p className="text-text-3 text-[10px] uppercase tracking-wider mb-2">에이전트</p>
            {macroAgent ? (
              <div className="bg-panel border border-border rounded-lg p-2.5 space-y-1">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${macroAgent.status === "running" ? "bg-pos animate-pulse" : "bg-text-3"}`} />
                  <span className="text-text-1 text-xs font-medium">{macroAgent.name}</span>
                </div>
                <p className="text-text-3 text-[10px]">
                  {macroAgent.status === "running" ? "실행 중" : "정지"}
                  {" · "}{macroAgent.paper ? "페이퍼" : "실거래"}
                </p>
              </div>
            ) : (
              <p className="text-text-3 text-[11px]">
                {market === "KR" ? "KR 거시" : "US"} 에이전트 없음
              </p>
            )}
          </div>

          {/* 방법론 */}
          <div>
            <p className="text-text-3 text-[10px] uppercase tracking-wider mb-2">분석 방법론</p>
            <div className="space-y-2">
              {methodology.map(m => (
                <div key={m.step} className="bg-panel border border-border rounded px-2.5 py-2">
                  <p className="text-accent text-[10px] font-mono">{m.step}</p>
                  <p className="text-text-2 text-[10px] mt-0.5">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 핵심 포커스 */}
          <div>
            <p className="text-text-3 text-[10px] uppercase tracking-wider mb-2">핵심 모니터링</p>
            <div className="space-y-1.5">
              {focus.map(f => (
                <div key={f.key} className="border-l-2 border-accent/40 pl-2.5 py-0.5">
                  <p className="text-text-1 text-[11px] font-medium">{f.label}</p>
                  <p className="text-text-3 text-[10px]">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 메인: 저널 + 분석 로그 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* 개인 저널 */}
          <div className="bg-panel border border-border rounded-xl p-4">
            <JournalEditor market={market} />
          </div>

          {/* 에이전트 분석 로그 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-text-2 text-sm font-medium">
                {macroAgent ? `${macroAgent.name} 분석 로그` : "에이전트 분석 로그"}
              </p>
              {loadingCycles && <span className="text-text-3 text-[11px]">로딩…</span>}
            </div>
            {macroAgent ? (
              <CycleLog cycles={cycles} />
            ) : (
              <div className="bg-panel border border-border/50 rounded-xl p-6 text-center space-y-2">
                <p className="text-text-2 text-sm">
                  {market === "KR" ? "KR 거시 전략 AI" : "US 매크로"} 에이전트가 없습니다.
                </p>
                <p className="text-text-3 text-xs">
                  에이전트 페이지에서 {market === "KR" ? "kr_macro" : "swing/autonomous"} 타입을 생성하면 분석 기록이 여기 쌓입니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
