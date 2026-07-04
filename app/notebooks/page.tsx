"use client";

import Link from "next/link";

/* 전략 만들기 연습 — 초보가 직접 전략 하나를 처음부터 끝까지 만들어보는 가이드.
   quant(개념) → 여기(실습) → report(결과읽기) 순서. */

const STEPS: { n: number; title: string; body: React.ReactNode; link?: { href: string; label: string } }[] = [
  {
    n: 1, title: "가설 세우기 (왜 오를까?)",
    body: <>먼저 <b className="text-text-1">경제적 이유</b>를 정해. "차트가 예뻐서" ❌ → "회사가 자사주 사면 공급 줄고 저평가 신호라서" ✅.
      이유 없는 건 다 노이즈로 죽어. <b className="text-warn">한 줄로 왜 오를지 못 쓰면 = 하지 마.</b></>,
  },
  {
    n: 2, title: "규칙 정하기 (진입·청산·비용)",
    body: <>애매하면 안 됨. 숫자로: <span className="font-data text-text-1">진입=공시 익일 시가</span> · <span className="font-data text-text-1">청산=20거래일 뒤 종가</span> · <span className="font-data text-text-1">비용=왕복 40bps</span>.
      "적당히 오르면 판다" 같은 재량 = 백테스트 불가.</>,
  },
  {
    n: 3, title: "데이터 준비 (함정 조심)",
    body: <>과거 데이터 모으되 <b className="text-neg">지금 살아있는 종목만 쓰면 거짓말</b>(생존편향). 폐지·정지 종목도 포함(PIT). 수정주가 필요한 이벤트(무상증자·분할)는 조정.</>,
    link: { href: "/data-quality", label: "데이터 품질 확인" },
  },
  {
    n: 4, title: "백테스트 돌리기",
    body: <>규칙을 과거에 적용해서 수익 계산. <b className="text-warn">여기서 좋게 나와도 아직 믿지 마</b> — 다음 단계(검증)가 진짜.</>,
    link: { href: "/backtest", label: "백테스트 페이지" },
  },
  {
    n: 5, title: "검증 (랜덤 이기나?)",
    body: <>제일 중요. 같은 조건 <b className="text-text-1">랜덤 500번</b> 분포를 만들고 내 전략이 이기는지 봐(percentile ≥95, p&lt;0.05). 못 이기면 = 운/베타. 폐기.</>,
    link: { href: "/validation", label: "검증 터미널" },
  },
  {
    n: 6, title: "강건성 (walk-forward·비용스트레스)",
    body: <>전반/후반 나눠 <b className="text-text-1">둘 다 되나</b>(과적합·소멸 체크). 극단 비용(2~3배)서도 살아남나. 한 종목·한 해에 몰리지 않았나.</>,
  },
  {
    n: 7, title: "레드팀 통제",
    body: <>통과처럼 보여도 <b className="text-neg">confound·lookahead</b> 의심. 저점 진입이면 "그냥 딥매수 아냐?" 통제. 이걸로 우리 SMT가 죽음.</>,
  },
  {
    n: 8, title: "페이퍼 → forward → (사람) live",
    body: <>통과하면 <b className="text-text-1">페이퍼(모의)</b>로 실행하며 미래 데이터로 재확인(forward). 발견은 증거가 아냐 — OOS서 재현돼야. live는 사람이 결정.</>,
    link: { href: "/lab/tasks", label: "Lab Task (페이퍼 모니터)" },
  },
];

export default function NotebooksPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-1">전략 만들기 연습</h1>
        <p className="text-text-3 text-sm mt-1">
          전략 하나를 가설부터 페이퍼까지 8단계로. <Link href="/quant" className="text-accent no-underline">퀀트 배우기</Link>(개념) 먼저 읽고 오면 좋아.
        </p>
      </div>

      <div className="space-y-2">
        {STEPS.map(s => (
          <div key={s.n} className="bg-panel border border-border rounded-lg p-4 flex gap-3">
            <div className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-semibold font-data shrink-0">{s.n}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-text-1">{s.title}</div>
              <div className="text-[13px] text-text-2 mt-0.5 leading-relaxed">{s.body}</div>
              {s.link && (
                <Link href={s.link.href} className="inline-block text-xs text-accent border border-accent/30 rounded px-2.5 py-1 no-underline hover:bg-accent/10 mt-2">
                  {s.link.label} →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[11px] text-text-3 text-center pt-2">
        다 하면 결과 해석은 <Link href="/report" className="text-accent no-underline">결과 읽는 법</Link>으로.
      </div>
    </div>
  );
}
