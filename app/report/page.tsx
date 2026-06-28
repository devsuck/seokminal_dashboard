"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { getExperiments, type Experiment } from "@/lib/experiment-storage";
import { getStrategies, type Strategy } from "@/lib/strategy-storage";
import { getNotebooks, type Notebook } from "@/lib/notebook-storage";
import {
  experimentToMarkdown,
  strategyToMarkdown,
  notebookToMarkdown,
} from "@/lib/report-utils";

type SourceType = "experiment" | "strategy" | "notebook";

export default function ReportPage() {
  const [sourceType, setSourceType] = useState<SourceType>("experiment");
  const [selectedId, setSelectedId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const experiments = useMemo(() => getExperiments(), []);
  const strategies = useMemo(() => getStrategies(), []);
  const notebooks = useMemo(() => getNotebooks(), []);

  // Reset selection when source type changes
  useEffect(() => {
    setSelectedId("");
    setCopied(false);
  }, [sourceType]);

  const items = useMemo(() => {
    if (sourceType === "experiment") return experiments.map(e => ({ id: e.id, label: e.label }));
    if (sourceType === "strategy")  return strategies.map(s => ({ id: s.id, label: s.name }));
    return notebooks.map(n => ({ id: n.id, label: n.title }));
  }, [sourceType, experiments, strategies, notebooks]);

  const markdown = useMemo((): string => {
    if (!selectedId) return "";
    if (sourceType === "experiment") {
      const exp = experiments.find((e: Experiment) => e.id === selectedId);
      return exp ? experimentToMarkdown(exp) : "";
    }
    if (sourceType === "strategy") {
      const strat = strategies.find((s: Strategy) => s.id === selectedId);
      return strat ? strategyToMarkdown(strat) : "";
    }
    const nb = notebooks.find((n: Notebook) => n.id === selectedId);
    return nb ? notebookToMarkdown(nb) : "";
  }, [selectedId, sourceType, experiments, strategies, notebooks]);

  const copy = useCallback(async () => {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [markdown]);

  const print = useCallback(() => {
    if (!markdown) return;
    window.print();
  }, [markdown]);

  const SOURCE_TYPES: { value: SourceType; label: string }[] = [
    { value: "experiment", label: "Experiment" },
    { value: "strategy",   label: "Strategy" },
    { value: "notebook",   label: "Notebook" },
  ];

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Report Builder</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Export research objects as Markdown or PDF.
        </p>
      </div>

      {/* Source picker */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="space-y-1">
          <label className="text-text-3 text-[11px] uppercase tracking-wider">Source Type</label>
          <div className="flex gap-1">
            {SOURCE_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setSourceType(t.value)}
                className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                  sourceType === t.value
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border text-text-3 hover:text-text-2 bg-transparent"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-text-3 text-[11px] uppercase tracking-wider">Select Item</label>
          {items.length === 0 ? (
            <p className="text-text-3 text-xs py-1">
              No {sourceType}s saved yet.
            </p>
          ) : (
            <select
              value={selectedId}
              onChange={e => { setSelectedId(e.target.value); setCopied(false); }}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent w-full max-w-sm"
            >
              <option value="">— choose —</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          )}
        </div>

        {markdown && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={copy}
              className="h-8 px-4 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0"
            >
              {copied ? "Copied!" : "Copy Markdown"}
            </button>
            <button
              onClick={print}
              className="h-8 px-4 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0"
            >
              Print / PDF
            </button>
          </div>
        )}
      </div>

      {/* Preview */}
      {markdown ? (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">Markdown Preview</span>
            <span className="text-text-3 text-[11px] font-data">{markdown.length} chars</span>
          </div>
          <pre className="p-4 text-text-2 text-xs font-data leading-relaxed overflow-auto max-h-[600px] whitespace-pre-wrap">
            {markdown}
          </pre>
        </div>
      ) : (
        <div className="text-center py-12 text-text-3 text-sm">
          Select a source above to preview the report.
        </div>
      )}
    </div>
  );
}
