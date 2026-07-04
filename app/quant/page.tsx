"use client";

import { useState } from "react";
import Link from "next/link";

/* 초보 퀀트 교육 — 이 플랫폼서 실제로 겪은 것(급등주·ICT·SMT·buyback)으로 엮음.
   목표: 뚝딱거리며 배워서, AI가 돌리는 전략을 이해하기. */

interface Lesson { q: string; a: React.ReactNode; }
interface Module { id: string; title: string; sub: string; lessons: Lesson[]; try?: { href: string; label: string }; }

const MODULES: Module[] = [
  {
    id: "why", title: "1. 왜 퀀트인가", sub: "감·차트 vs 규칙·데이터·검증",
    lessons: [
      { q: "퀀트 트레이딩이 뭐야?", a: <>감(感)이나 차트 모양으로 매매하는 게 아니라, <b className="text-text-1">명확한 규칙</b>을 정하고
        (예: "자사주 매입 공시 다음날 사서 20일 뒤 판다"), 그 규칙을 <b className="text-text-1">과거 데이터로 검증</b>한 뒤 <b className="text-text-1">기계적으로 실행</b>하는 것. 사람의 기분·공포·욕심을 빼는 게 핵심.</> },
      { q: "왜 대부분의 개인은 지나?", a: <>시장엔 똑똑한 사람이 많아. 네가 차트 보고 "이거 오르겠다" 싶은 건 <b className="text-neg">이미 남들도 다 봤고 가격에 반영</b>됐어. 그리고 매매할 때마다 <b className="text-neg">비용(수수료·슬리피지)</b>이 나가. 감으로 하면 이 둘한테 진다.</> },
      { q: "그럼 퀀트는 이기나?", a: <>퀀트도 대부분 실패해. 근데 <b className="text-pos">정직하게 검증</b>하면 최소한 "이건 노이즈다"를 알고 안 하게 돼. 지는 걸 안 하는 것만으로도 크게 앞선다.</> },
    ],
  },
  {
    id: "alpha", title: "2. 알파 vs 베타 vs 랜덤", sub: "돈 벌어도 실력이 아닐 수 있다",
    lessons: [
      { q: "알파가 뭐야?", a: <><b className="text-pos">알파 = 실력.</b> 아무 종목이나 무작위로 산 것(랜덤)보다, 그리고 그냥 시장 따라간 것(베타)보다 <b className="text-text-1">더 번 부분</b>. 이게 진짜 엣지.</> },
      { q: "돈 벌면 알파 아냐?", a: <>아니. 상승장에선 <b className="text-warn">아무 주식이나 사도 돈 벌어</b> — 그건 시장이 오른 거지(=베타) 네 실력이 아냐. 운 좋게 몇 번 딴 것도 실력 아님. <b className="text-text-1">랜덤을 이겨야</b> 알파.</> },
      { q: "어떻게 구분해?", a: <>같은 조건(같은 횟수·비용·보유기간)으로 <b className="text-text-1">아무 때나 무작위로 500번 매매</b>한 분포를 만들고, 내 전략이 그 분포를 이기는지 봐. 못 이기면 = 그냥 변동성 베팅(도박).</> },
      { q: "카지노 비유", a: <>알파 없음 = 넌 <b className="text-neg">도박꾼</b>(가끔 따도 오래 하면 잃음). 알파 있음 = 넌 <b className="text-pos">하우스</b>(장기적으로 이김). 우리 목표 = 하우스가 되는 것.</> },
    ],
    try: { href: "/validation", label: "검증 터미널서 '랜덤 이기나' 확인" },
  },
  {
    id: "backtest", title: "3. 백테스트란", sub: "과거로 돌려보기 — 근데 거짓말을 잘한다",
    lessons: [
      { q: "백테스트가 뭐야?", a: <>내 규칙을 <b className="text-text-1">과거 데이터에 적용</b>해서 "만약 그때 이렇게 했으면 얼마 벌었나" 계산하는 것. 실제 돈 넣기 전 검증 단계.</> },
      { q: "백테스트 좋게 나오면 진짜야?", a: <><b className="text-neg">아니, 절대.</b> 백테스트는 거짓말을 정말 잘해. 과거에 맞춘 결과일 뿐, 미래엔 안 통하는 경우가 대부분. 그래서 <b className="text-text-1">함정 6개</b>(다음 모듈)를 반드시 통제해야 해.</> },
      { q: "우리 실제 예", a: <>이 플랫폼서 "급등주 눌림목" 전략이 백테스트로 +2.28% 나왔는데, 폐지된 종목까지 넣으니 <b className="text-neg">-1.66%</b>였어. 백테스트가 거짓말한 거야(survivorship 함정, 다음 모듈).</> },
    ],
  },
  {
    id: "traps", title: "4. 함정 6개", sub: "백테스트가 거짓말하는 6가지 — 우리가 실제로 당한 것",
    lessons: [
      { q: "① Survivorship (생존편향)", a: <>지금 살아있는 종목만 보면 백테스트가 거짓말해. <b className="text-neg">폭락해서 상장폐지된 종목이 빠져있으니까.</b> → 폐지·정지 종목도 넣어야(PIT). 우리 급등주 전략이 이걸로 죽음.</> },
      { q: "② 비용 (슬리피지·수수료)", a: <>매매마다 돈 나가. 특히 <b className="text-warn">단타(잦은 매매)</b>는 비용이 엣지를 다 먹어. 극단 비용(2~3배) 넣어도 살아남아야 진짜. ICT 단타가 이걸로 전멸.</> },
      { q: "③ Lookahead (미래참조)", a: <>신호에 <b className="text-neg">미래 데이터가 몰래 들어가면</b> 백테스트가 뻥튀기돼. 예: "스윙 저점"은 2봉 뒤에나 확정되는데 그 시점에 산 것처럼 계산하면 반칙. 실전선 그 가격에 못 사.</> },
      { q: "④ 과적합 (walk-forward로 잡음)", a: <>과거에 <b className="text-warn">너무 딱 맞춘</b> 전략은 미래에 무너져. 데이터를 전반/후반 나눠서 <b className="text-text-1">둘 다 잘 되나</b> 봐. turn-of-month·크립토모멘텀이 전반만 좋고 후반 죽음(=과적합/소멸).</> },
      { q: "⑤ 다중검정 (데이터 드레징)", a: <>전략 1000개 돌리면 <b className="text-neg">우연히 50개가 좋게 나와</b>(운). 많이 시도할수록 가짜가 늘어. → BH-FDR로 "몇 개 시도했나" 보정. 낚시하면 안 됨.</> },
      { q: "⑥ Confound (교란)", a: <>"엣지"처럼 보이는 게 <b className="text-neg">사실 딴 이유</b>일 수 있어. 우리 SMT(스마트머니)가 통과했는데 알고 보니 "저점서 사서 반등"한 거지 스마트머니랑 무관이었어. 통제하니 증발.</> },
    ],
  },
  {
    id: "survivors", title: "5. 살아남은 전략 읽기", sub: "왜 이건 진짜였나",
    lessons: [
      { q: "자사주 매입 (buyback)", a: <>회사가 <b className="text-text-1">자기 주식을 사면 = 공급 감소 + 저평가 신호</b>(경영진이 싸다고 판단). 경제 논리 명확 + 랜덤·비용·생존편향·walk-forward 다 통과. 우리 최고 엣지. <b className="text-warn">단, 팻테일 의존(가끔 대박이 평균을 만듦)이라 '옐로'.</b></> },
      { q: "추세추종 (TSMOM, 선물)", a: <>여러 시장의 <b className="text-text-1">추세를 따라가고 변동성으로 크기 조절</b>. 무상관 시장 많이 묶어 분산. Sharpe 0.56, walk-forward 안정.</> },
      { q: "왜 가격패턴(ICT 등)은 죽었나?", a: <>차트 모양(오더블록·FVG 등)은 <b className="text-neg">경제 논리가 약하고</b> 붐비고 비용에 먹혀. 우리가 8개 객관 모델 만들어 검증했는데 전멸. 유튜브 버즈 ≠ 알파.</> },
    ],
    try: { href: "/lab/tasks", label: "Lab Task서 실제 검증된 전략 보기" },
  },
  {
    id: "risk", title: "6. 리스크 · 사이징", sub: "얼마나 걸까 (엣지랑 별개)",
    lessons: [
      { q: "레버리지 = 알파?", a: <><b className="text-neg">아니.</b> 레버리지는 엣지를 <b className="text-text-1">확대만</b> 해(수익도 손실도 2배). Sharpe(위험대비)는 그대로. 없는 엣지에 레버리지 = 손실만 증폭 = 자살.</> },
      { q: "분산 (무상관)", a: <>서로 <b className="text-pos">무상관인 엣지</b>를 묶으면 위험이 줄어. TSMOM(선물)+buyback(주식) 상관 -0.07 → 합치니 낙폭(MDD) 반토막. 이게 진짜 값어치.</> },
      { q: "Kelly (베팅 크기)", a: <>엣지가 확인되면 <b className="text-text-1">얼마 걸지</b>는 엣지 크기·승률로 정해(Kelly). 근데 대부분 Kelly 절반 이하로(보수적). 엣지 없으면 크기는 무의미.</> },
    ],
    try: { href: "/risk-guard", label: "리스크 관리 페이지" },
  },
  {
    id: "glossary", title: "7. 용어 사전", sub: "빠른 참조",
    lessons: [
      { q: "핵심 용어", a: (
        <div className="space-y-1">
          {([["알파", "랜덤·시장 이긴 실력 부분"], ["베타", "시장 따라간 수익(실력 아님)"],
            ["Sharpe", "위험 1당 수익. 높을수록 좋음"], ["MDD", "최대 낙폭(고점서 얼마 빠졌나)"],
            ["p-value", "우연일 확률. 낮을수록 진짜 (우린 <0.05 + BH-FDR)"], ["PIT", "그 시점에 실제 알 수 있던 데이터만"],
            ["paper", "모의투자(실제 돈 X)"], ["forward-test", "미래 실데이터 재검증(발견≠증거)"]] as [string, string][]).map(([t, d]) => (
            <div key={t} className="flex gap-2"><span className="text-accent font-data w-24 shrink-0">{t}</span><span className="text-text-2">{d}</span></div>
          ))}
        </div>
      ) },
    ],
  },
];

export default function QuantLearnPage() {
  const [open, setOpen] = useState<string | null>("why");
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-1">퀀트 배우기</h1>
        <p className="text-text-3 text-sm mt-1">
          완전 초보용. 이 플랫폼서 실제로 겪은 것(급등주·ICT·자사주)으로 배운다. 다 읽으면 AI가 돌리는 전략을 이해하게 됨.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {MODULES.map(m => (
          <button key={m.id} onClick={() => setOpen(m.id)}
            className={`text-xs px-2.5 py-1 rounded border cursor-pointer transition-colors ${
              open === m.id ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-1 bg-transparent"}`}>
            {m.title.split(".")[0]}
          </button>
        ))}
      </div>

      {MODULES.map(m => (
        <div key={m.id} className="bg-panel border border-border rounded-lg overflow-hidden">
          <button onClick={() => setOpen(open === m.id ? null : m.id)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 cursor-pointer bg-transparent border-0 text-left">
            <div>
              <div className="text-sm font-semibold text-text-1">{m.title}</div>
              <div className="text-[11px] text-text-3">{m.sub}</div>
            </div>
            <span className={`text-text-3 transition-transform ${open === m.id ? "rotate-90" : ""}`}>›</span>
          </button>
          {open === m.id && (
            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
              {m.lessons.map((l, i) => (
                <div key={i}>
                  <div className="text-sm text-text-1 font-medium">{l.q}</div>
                  <div className="text-[13px] text-text-2 mt-0.5 leading-relaxed">{l.a}</div>
                </div>
              ))}
              {m.try && (
                <Link href={m.try.href} className="inline-block text-xs text-accent border border-accent/30 rounded px-2.5 py-1 no-underline hover:bg-accent/10 mt-1">
                  직접 해보기 → {m.try.label}
                </Link>
              )}
            </div>
          )}
        </div>
      ))}

      <div className="text-[11px] text-text-3 text-center pt-2">
        더 배우고 싶은 주제 있으면 말해줘 — 모듈 추가함. (다음: 페어트레이딩·이벤트스터디·팩터 심화)
      </div>
    </div>
  );
}
