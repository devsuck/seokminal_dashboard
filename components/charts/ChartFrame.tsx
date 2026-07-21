import type { ReactNode } from "react";

export interface LegendItem { label: string; color: string; }

/** 차트 공통 래퍼 — 제목 + (2계열↑) 범례 + 캡션. dataviz: 식별은 색 단독이 아니라 범례로. */
export function ChartFrame({ title, legend, caption, children }: {
  title?: string;
  legend?: LegendItem[];
  caption?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {(title || (legend && legend.length > 0)) && (
        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
          {title && <span className="text-[10px] uppercase tracking-wider text-text-3 font-data">{title}</span>}
          {legend && legend.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {legend.map(l => (
                <span key={l.label} className="inline-flex items-center gap-1 text-[10px] text-text-2 font-data">
                  {/* 동적 데이터 색이라 토큰 클래스로 못 뺌 — ICT 범례 선례와 동일 */}
                  <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto">{children}</div>
      {caption && <p className="text-[9px] text-text-3 mt-1 font-data">{caption}</p>}
    </div>
  );
}
