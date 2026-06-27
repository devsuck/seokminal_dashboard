"use client";

const KNOWN_INSTRUMENTS = [
  "AAPL.NASDAQ",
  "MSFT.NASDAQ",
  "005930.XKRX",
  "000660.XKRX",
];

interface InstrumentSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function InstrumentSelect({ value, onChange }: InstrumentSelectProps) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {KNOWN_INSTRUMENTS.map((id) => (
        <option key={id} value={id}>{id}</option>
      ))}
    </select>
  );
}
