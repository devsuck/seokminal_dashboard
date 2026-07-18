"use client";

import { useState } from "react";
import type {
  NotebookBlock, BlockType,
  CommentBlock, MetricBlock, TableBlock, ChartBlock, ImageBlock,
} from "@/lib/notebook-storage";
import { Button } from "@/components/ui";

interface NoteBlockEditorProps {
  initial?: NotebookBlock;
  onSave: (block: NotebookBlock) => void;
  onCancel: () => void;
}

const DEFAULT_BLOCKS: Record<BlockType, NotebookBlock> = {
  comment: { type: "comment", markdown: "" },
  metric:  { type: "metric",  label: "", value: null, unit: "" },
  table:   { type: "table",   headers: ["Column 1", "Column 2"], rows: [["", ""]] },
  chart:   { type: "chart",   title: "", data: [] },
  image:   { type: "image",   src: "", alt: "" },
};

function labelForType(t: BlockType): string {
  return { comment: "Comment", metric: "Metric", table: "Table", chart: "Chart", image: "Image" }[t];
}

export function NoteBlockEditor({ initial, onSave, onCancel }: NoteBlockEditorProps) {
  const [blockType, setBlockType] = useState<BlockType>(initial?.type ?? "comment");
  const [draft, setDraft] = useState<NotebookBlock>(initial ?? DEFAULT_BLOCKS.comment);
  const [chartJson, setChartJson] = useState(
    initial?.type === "chart" ? JSON.stringify(initial.data, null, 2) : "");
  const [chartJsonError, setChartJsonError] = useState("");

  function handleTypeChange(t: BlockType) {
    setBlockType(t);
    setDraft(DEFAULT_BLOCKS[t]);
    setChartJson("");
    setChartJsonError("");
  }

  function updateDraft(updates: Partial<NotebookBlock>) {
    setDraft(prev => ({ ...prev, ...updates } as NotebookBlock));
  }

  function handleSave() {
    if (blockType === "chart") {
      try {
        const parsed = JSON.parse(chartJson || "[]") as Array<{ time: string; value: number }>;
        if (!Array.isArray(parsed)) throw new Error("Must be an array");
        for (const item of parsed) {
          if (!item.time || typeof item.value !== "number") throw new Error("Each item needs {time, value}");
        }
        onSave({ ...(draft as ChartBlock), data: parsed });
      } catch (e) {
        setChartJsonError(e instanceof Error ? e.message : "Invalid JSON");
      }
      return;
    }
    onSave(draft);
  }

  function renderFields() {
    switch (blockType) {
      case "comment":
        return (
          <textarea
            rows={6}
            value={(draft as CommentBlock).markdown}
            onChange={e => updateDraft({ markdown: e.target.value })}
            placeholder="Write your notes here…"className="w-full px-3 py-2 text-sm bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent resize-y font-sans"/>
        );

      case "metric":
        return (
          <div className="space-y-2">
            <input type="text" value={(draft as MetricBlock).label}
              onChange={e => updateDraft({ label: e.target.value })}
              placeholder="Label (e.g. Sharpe Ratio)"className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"/>
            <div className="flex gap-2">
              <input type="number" value={(draft as MetricBlock).value ?? ""}
                onChange={e => updateDraft({ value: e.target.value === "" ? null : parseFloat(e.target.value) })}
                placeholder="Value"className="flex-1 h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent font-data"/>
              <input type="text" value={(draft as MetricBlock).unit}
                onChange={e => updateDraft({ unit: e.target.value })}
                placeholder="Unit (optional)"className="w-24 h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"/>
            </div>
          </div>
        );

      case "table":
        return (
          <div className="space-y-2">
            <div>
              <label className="text-text-3 text-[10px] uppercase tracking-wider">Headers (comma-separated)</label>
              <input type="text"value={(draft as TableBlock).headers.join(",")}
                onChange={e => updateDraft({ headers: e.target.value.split(",").map(h => h.trim()) })}
                placeholder="Col A, Col B, Col C"className="w-full mt-1 h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"/>
            </div>
            <div>
              <label className="text-text-3 text-[10px] uppercase tracking-wider">Rows (JSON array of arrays)</label>
              <textarea rows={4}
                value={JSON.stringify((draft as TableBlock).rows, null, 2)}
                onChange={e => {
                  try {
                    const rows = JSON.parse(e.target.value);
                    if (Array.isArray(rows)) updateDraft({ rows });
                  } catch { /* ignore invalid JSON while typing */ }
                }}
                className="w-full mt-1 px-3 py-2 text-xs bg-panel border border-border rounded text-text-1 outline-none focus:border-accent resize-y font-data"/>
            </div>
          </div>
        );

      case "chart":
        return (
          <div className="space-y-2">
            <input type="text" value={(draft as ChartBlock).title}
              onChange={e => updateDraft({ title: e.target.value })}
              placeholder="Chart title (optional)"className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"/>
            <div>
              <label className="text-text-3 text-[10px] uppercase tracking-wider">Data (JSON array of {"{ time, value }"})</label>
              <textarea rows={6}
                value={chartJson}
                onChange={e => { setChartJson(e.target.value); setChartJsonError(""); }}
                placeholder={'[{"time": "2025-01-01", "value": 1.5}, ...]'}
                className="w-full mt-1 px-3 py-2 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent resize-y font-data"/>
              {chartJsonError && <p className="text-neg text-[10px] mt-1">{chartJsonError}</p>}
            </div>
          </div>
        );

      case "image":
        return (
          <div className="space-y-2">
            <input type="text" value={(draft as ImageBlock).src}
              onChange={e => updateDraft({ src: e.target.value })}
              placeholder="Image URL or paste base64 data"className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"/>
            <input type="text" value={(draft as ImageBlock).alt}
              onChange={e => updateDraft({ alt: e.target.value })}
              placeholder="Alt text (optional)"className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"/>
          </div>
        );
    }
  }

  return (
    <div className="bg-panel-2 border border-border rounded-lg p-4 space-y-4">
      {/* Type selector */}
      <div className="flex items-center gap-2">
        <span className="text-text-3 text-[10px] uppercase tracking-wider shrink-0">Block type</span>
        <div className="flex gap-1">
          {(["comment", "metric", "table", "chart", "image"] as BlockType[]).map(t => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className={`px-3 h-7 text-xs rounded border cursor-pointer capitalize transition-colors ${
                blockType === t
                  ? "border-accent text-text-1 bg-panel": "border-border text-text-3 hover:text-text-1 bg-panel"}`}
            >
              {labelForType(t)}
            </button>
          ))}
        </div>
      </div>

      {/* Type-specific fields */}
      {renderFields()}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="primary" size="md" onClick={handleSave}>
          {initial ? "Update" : "Add Block"}
        </Button>
        <button
          onClick={onCancel}
          className="px-4 h-8 bg-panel border border-border text-text-2 text-xs rounded cursor-pointer hover:text-text-1 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
