"use client";

import Link from "next/link";
import { Panel, PanelHeader } from "@/components/ui/Panel";

/* 결과 읽는 법 — 백테스트/검증 결과의 숫자를 초보가 해석하는 가이드.
   각 지표: 뭔지 / 좋은 값 / 함정. */

const METRICS: { name: string; what: string; good: string; trap: React.ReactNode }[] = [
  { name: "수익률 (net)", what: "비용 뺀 순수익", good: "양수", trap: <>상승장이면 아무거나 양수 = <b className="text-neg">베타(실력 아님)</b>. 랜덤이랑 비교해야 의미.</> },
  { name: "percentile (vs random)", what: "랜덤 분포서 내 전략 위치", good: "≥95 (상위 5%)", trap: <>50 근처 = <b className="text-neg">그냥 랜덤</b>. 100인데 confound일 수도(SMT 사례).</> },
  { name: "p-value", what: "우연일 확률", good: "<0.05", trap: <>여러 개 테스트하면 우연히 낮게 나옴 → <b className="text-warn">BH-FDR로 보정</b> 필수.</> },
  { name: "walk-forward (전/후반)", what: "기간 나눠 안정성", good: "전·후반 둘 다 양수", trap: <>전반만 좋고 후반 죽음 = <b className="text-neg">과적합/소멸</b>(turn-of-month·크립토모멘텀).</> },
  { name: "Sharpe", what: "위험 1당 수익", good: "높을수록 (0.5+ 괜찮음)", trap: <>레버리지로 수익 키워도 Sharpe는 <b className="text-warn">안 변함</b>. 위험대비라 정직.</> },
  { name: "MDD (최대낙폭)", what: "고점서 최대 얼마 빠졌나", good: "작을수록", trap: <>수익만 보고 MDD 무시하면 <b className="text-neg">중간에 못 버티고 청산</b>. 분산으로 줄임.</> },
  { name: "승률 (win rate)", what: "이긴 거래 비율", good: "맥락따라", trap: <>승률 높아도 <b className="text-warn">가끔 큰 손실</b>이면 망함. 반대로 승률 낮아도(40%) 큰 수익 몇 번이면 OK. 승률만 보지 마.</> },
  { name: "상위꼬리 기여 (top-tail)", what: "상위 5%가 수익의 몇 %", good: "낮을수록 고름", trap: <>&gt;80%면 <b className="text-neg">몇 번 대박에 의존</b>(buyback이 이래서 '옐로'). 재현성 의심.</> },
];

export default function ReportPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-1">결과 읽는 법</h1>
        <p className="text-text-3 text-sm mt-1">
          백테스트·검증 결과의 숫자 해석. 각 지표의 <b className="text-text-1">뜻 / 좋은 값 / 함정</b>. 이거 알면 AI가 낸 판정을 이해함.
        </p>
      </div>

      {/* 판정 요약 규칙 */}
      <Panel>
        <PanelHeader>한눈 판정 규칙</PanelHeader>
        <div className="p-4 space-y-1.5 text-[13px]">
          <div className="flex gap-2"><span className="text-pos font-semibold w-24 shrink-0">CLEARED</span><span className="text-text-2">net&gt;0 · pct≥95 · p&lt;0.05 · WF 양쪽+ · 비용스트레스 통과 · 통제 다 통과</span></div>
          <div className="flex gap-2"><span className="text-warn font-semibold w-24 shrink-0">WATCHLIST</span><span className="text-text-2">양수인데 pct 80~95 or WF 약함 → 관찰만</span></div>
          <div className="flex gap-2"><span className="text-neg font-semibold w-24 shrink-0">REJECT</span><span className="text-text-2">랜덤과 구분 안 됨 or 비용후 음수 or 통제 실패</span></div>
          <div className="flex gap-2"><span className="text-info font-semibold w-24 shrink-0">BLOCKED</span><span className="text-text-2">필요한 통제/데이터를 아직 안 돌림(수정주가 등)</span></div>
        </div>
      </Panel>

      {/* 지표별 */}
      <div className="space-y-2">
        {METRICS.map(m => (
          <Panel key={m.name}>
            <PanelHeader right={<span>좋은 값: {m.good}</span>}>
              {m.name}
            </PanelHeader>
            <div className="p-4">
              <div className="text-[13px] text-text-2">{m.what}</div>
              <div className="text-[12px] text-text-3 mt-1"><b className="text-warn">함정:</b> {m.trap}</div>
            </div>
          </Panel>
        ))}
      </div>

      <div className="text-[11px] text-text-3 text-center pt-2">
        개념은 <Link href="/quant" className="text-accent no-underline">퀀트 배우기</Link> · 실습은 <Link href="/notebooks" className="text-accent no-underline">전략 만들기 연습</Link>.
      </div>
    </div>
  );
}
