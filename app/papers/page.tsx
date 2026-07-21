"use client";

import { useEffect, useState } from "react";
import { getPapers, type PapersResponse } from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState, LoadingState } from "@/components/ui";

export default function PapersPage() {
  const [data, setData] = useState<PapersResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const c = new AbortController();
    getPapers(c.signal).then(setData).catch(e => { if (!c.signal.aborted) setErr(e instanceof Error ? e.message : String(e)); });
    return () => c.abort();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-1">논문 → 가설 파이프라인</h1>
        <p className="text-text-3 text-sm mt-1">
          arXiv q-fin 논문에서 LLM으로 스펙 추출·코드 생성한 가설. 수동 파이프라인(<span className="font-data">run_paper_ingest</span>) 산출물 —
          <span className="text-warn"> 검증 전 후보</span>이며 매매 근거 아님.
        </p>
      </div>

      {err && <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded px-4 py-2.5">백엔드 연결 실패: {err}</div>}
      {!data && !err && <LoadingState message="논문 파이프라인 로딩 중…" />}

      {data && (
        <Panel>
          <PanelHeader right={<span className="text-text-3 tabular-nums">{data.n_ingested}건</span>}>생성된 가설</PanelHeader>
          {data.ingested.length === 0
            ? <EmptyState message="생성된 가설 없음" hint="python -m research.run_paper_ingest 로 arXiv 폴링" />
            : (
              <div className="divide-y divide-border/50">
                {data.ingested.map(p => (
                  <div key={p.file} className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-accent font-data text-xs font-bold">{p.name ?? "—"}</span>
                      <span className="text-text-3 text-[10px] font-data">{p.file}</span>
                    </div>
                    {p.description && <p className="text-text-2 text-xs mt-1">{p.description}</p>}
                    {p.title && <p className="text-text-3 text-[11px] mt-1 italic">{p.title}</p>}
                  </div>
                ))}
              </div>
            )}
        </Panel>
      )}

      {data && data.rejected.length > 0 && (
        <Panel>
          <PanelHeader right={<span className="text-text-3 tabular-nums">{data.n_rejected}건</span>}>리젝 (사유)</PanelHeader>
          <div className="divide-y divide-border/50 text-xs">
            {data.rejected.map((r, i) => (
              <div key={i} className="px-4 py-2 flex items-center gap-3">
                <span className="text-text-3 font-data w-24 shrink-0 truncate">{r.arxiv_id ?? "—"}</span>
                <span className="text-warn font-data w-24 shrink-0">{r.stage ?? "—"}</span>
                <span className="text-text-2 truncate flex-1">{r.reason ?? r.title ?? ""}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
