"use client";

import { useEffect, useRef, useState } from "react";
import { searchKR, searchUS } from "@/lib/api";

interface Option {
  id: string;      // instrument_id 형식 — "AAPL.NASDAQ" / "005930.XKRX"
  label: string;   // 회사 이름
  meta: string;    // 거래소/시장
}

/** 이름·티커 겸용 심볼 검색 입력.
 *  직접 타이핑한 값도 그대로 쓸 수 있고(자유 입력 유지), 2글자 이상 치면
 *  US(IB 심볼검색)+KR(국내 종목명) 결과를 드롭다운으로 제안한다. */
export function SymbolSearchInput({
  value, onChange, placeholder = "티커 또는 회사명", className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function handleInput(q: string) {
    onChange(q.toUpperCase());
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2 || q.includes(".")) { setOptions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      setSearching(true);
      try {
        const [us, kr] = await Promise.allSettled([
          searchUS(q, ctrl.signal),
          searchKR(q, ctrl.signal),
        ]);
        if (ctrl.signal.aborted) return;
        const opts: Option[] = [];
        if (us.status === "fulfilled") {
          for (const r of us.value.results.slice(0, 6)) {
            if (r.sec_type !== "STK" || !r.exchange) continue;
            opts.push({ id: `${r.symbol}.${r.exchange}`, label: r.name, meta: r.exchange });
          }
        }
        if (kr.status === "fulfilled") {
          for (const r of kr.value.results.slice(0, 4)) {
            opts.push({ id: `${r.code}.XKRX`, label: r.name, meta: r.market || "KRX" });
          }
        }
        setOptions(opts);
        setOpen(opts.length > 0);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 350);
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        value={value}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => options.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full bg-panel-2 border border-border rounded px-2.5 py-1.5 text-text-1 text-sm font-data outline-none focus:border-accent"
      />
      {searching && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-3 text-[10px] animate-pulse">검색…</span>
      )}
      {open && (
        <div className="absolute z-30 mt-1 w-72 max-h-64 overflow-y-auto bg-panel border border-border rounded-lg shadow-xl">
          {options.map(o => (
            <button key={o.id}
              onClick={() => { onChange(o.id); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-panel-2 flex items-center gap-2">
              <span className="font-data text-xs text-accent shrink-0">{o.id}</span>
              <span className="text-text-2 text-xs truncate flex-1">{o.label}</span>
              <span className="text-text-3 text-[10px] shrink-0">{o.meta}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
