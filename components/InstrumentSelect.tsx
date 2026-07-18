"use client";

// 예시일 뿐 제한 아님 — 카탈로그에 없는 종목은 백엔드가 yfinance에서 자동 수집.
// 형식: 미국 SYMBOL.NASDAQ|NYSE|ARCA · 한국 종목코드.XKRX · 크립토 COIN.HL
const KNOWN_INSTRUMENTS = [
  "AAPL.NASDAQ",
  "MSFT.NASDAQ",
  "NVDA.NASDAQ",
  "TSLA.NASDAQ",
  "GOOGL.NASDAQ",
  "SPY.ARCA",
  "005930.XKRX",
  "000660.XKRX",
  "035420.XKRX",
  "035720.XKRX",
  "BTC.HL",
  "ETH.HL",
  "PAXG.HL",
  "NQ",
];

interface InstrumentSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** 미지정 시 KNOWN_INSTRUMENTS(전체 카탈로그) 사용 — 오더플로우처럼 지원 종목이 좁은 페이지는 좁힌 목록 전달 */
  instruments?: string[];
}

export function InstrumentSelect({ value, onChange, instruments }: InstrumentSelectProps) {
  const options = instruments ?? KNOWN_INSTRUMENTS;
  return (
    <>
      <input
        list="known-instruments"
        className="border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm font-mono uppercase"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="AAPL.NASDAQ"
      />
      <datalist id="known-instruments">
        {options.map((id) => (
          <option key={id} value={id} />
        ))}
      </datalist>
    </>
  );
}
