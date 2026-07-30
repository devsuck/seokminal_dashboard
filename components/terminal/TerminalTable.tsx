"use client";

import { useMemo, useState, type ReactNode } from "react";

// console/widgets.tsx 의 DataTable과 시각 언어(폰트 크기/패딩/보더)는 동일하게 맞추되,
// 정렬 기능이 필요해 별도 파일로 격리 — DataTable은 이미 43개 콘솔 페이지가 쓰고 있어
// 그 파일 자체를 건드리면 회귀 리스크가 크기 때문에 새 컴포넌트로 분리(변경 격리 원칙).

export interface TerminalTableColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  align?: "l" | "r";
  width?: string;
  sortable?: boolean;
  sortValue?: (row: T) => number | string;
}

export interface TerminalTableProps<T> {
  columns: TerminalTableColumn<T>[];
  rows: T[];
  keyFn: (row: T, i: number) => string;
  onRowClick?: (row: T) => void;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  dense?: boolean;
}

export function TerminalTable<T>({
  columns,
  rows,
  keyFn,
  onRowClick,
  defaultSort,
  dense = false,
}: TerminalTableProps<T>) {
  const [sort, setSort] = useState(defaultSort ?? null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const extract = col.sortValue ?? ((r: T) => (r as Record<string, unknown>)[col.key] as number | string);
    const sorted = [...rows].sort((a, b) => {
      const av = extract(a);
      const bv = extract(b);
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sort.dir === "desc" ? sorted.reverse() : sorted;
  }, [rows, sort, columns]);

  function toggleSort(col: TerminalTableColumn<T>) {
    if (!col.sortable) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: "asc" };
      if (prev.dir === "asc") return { key: col.key, dir: "desc" };
      return null;
    });
  }

  const rowPad = dense ? "py-1" : "py-2";
  const cellText = dense ? "text-[11px]" : "text-[11.5px]";

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--c-border)]">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c)}
                  className={`text-[9px] font-semibold tracking-[0.16em] text-[var(--c-text-3)] uppercase px-3 py-2 select-none ${
                    c.align === "r" ? "text-right" : "text-left"
                  } ${c.sortable ? "cursor-pointer hover:text-[var(--c-text-1)]" : ""}`}
                  style={{ width: c.width }}
                >
                  <span className={active ? "text-[var(--c-hud)]" : ""}>
                    {c.label}
                    {c.sortable && active && (sort!.dir === "asc" ? " ▲" : " ▼")}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r, i) => (
            <tr
              key={keyFn(r, i)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`border-b border-[var(--c-border)] transition-colors ${
                onRowClick ? "cursor-pointer hover:bg-[var(--c-panel-2)]" : ""
              }`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 ${rowPad} ${cellText} text-[var(--c-text-2)] ${
                    c.align === "r" ? "text-right c-num" : ""
                  }`}
                >
                  {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
