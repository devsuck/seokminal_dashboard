import type { Experiment } from "@/lib/experiment-storage";
import type { Strategy } from "@/lib/strategy-storage";
import type { Notebook, NotebookBlock } from "@/lib/notebook-storage";

function fmt(v: number | null | undefined, decimals = 4): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(decimals);
}

function isoDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function experimentToMarkdown(exp: Experiment): string {
  const p = exp.params;
  const m = exp.metrics;
  const lines: string[] = [
    `# ${exp.label}`,
    ``,
    `**Run date:** ${isoDate(exp.timestamp)}`,
    ``,
    `## Parameters`,
    ``,
    `| Key | Value |`,
    `|-----|-------|`,
    `| Instrument | ${p.instrumentId} |`,
    `| Strategy | ${p.strategy} |`,
    `| Start | ${p.start} |`,
    `| End | ${p.end} |`,
    `| Timeframe | ${p.timeframe} |`,
    `| Benchmark | ${p.benchmarkId || "—"} |`,
  ];

  if (p.strategy === "ema_cross") {
    lines.push(`| Fast EMA | ${p.fast ?? "—"} |`);
    lines.push(`| Slow EMA | ${p.slow ?? "—"} |`);
  } else {
    lines.push(`| Rules | ${p.rulesCount ?? "—"} |`);
  }

  lines.push(
    ``,
    `## Metrics`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Sharpe Ratio | ${fmt(m.sharpe, 4)} |`,
    `| Sortino Ratio | ${fmt(m.sortino, 4)} |`,
    `| Max Drawdown | ${fmt(m.maxDrawdown, 4)} |`,
    `| Win Rate | ${fmt(m.winRate, 4)} |`,
    `| Total PnL % | ${fmt(m.totalPnlPct, 4)} |`,
    `| Volatility | ${fmt(m.volatility, 4)} |`,
    `| Total Trades | ${m.totalTrades} |`,
  );

  if (exp.notes) {
    lines.push(``, `## Notes`, ``, exp.notes);
  }

  return lines.join("\n");
}

export function strategyToMarkdown(strategy: Strategy): string {
  const p = strategy.params;
  const lines: string[] = [
    `# ${strategy.name}`,
    ``,
    `**Created:** ${isoDate(strategy.createdAt)}  `,
    `**Updated:** ${isoDate(strategy.updatedAt)}  `,
    `**Tags:** ${strategy.tags.length > 0 ? strategy.tags.join(", ") : "—"}`,
    ``,
  ];

  if (strategy.description) {
    lines.push(strategy.description, ``);
  }

  lines.push(`## Parameters`, ``);

  if (p.type === "ema_cross") {
    lines.push(
      `| Key | Value |`,
      `|-----|-------|`,
      `| Type | EMA Cross |`,
      `| Fast EMA | ${p.fast} |`,
      `| Slow EMA | ${p.slow} |`,
    );
  } else {
    lines.push(
      `| Key | Value |`,
      `|-----|-------|`,
      `| Type | Gated |`,
      `| Rules | ${p.rules.length} |`,
    );
  }

  lines.push(
    ``,
    `## Version History`,
    ``,
    `${strategy.versions.length} saved version${strategy.versions.length !== 1 ? "s" : ""}.`,
  );

  if (strategy.versions.length > 0) {
    lines.push(``, `| # | Date | Note |`, `|---|------|------|`);
    strategy.versions.forEach((v, i) => {
      lines.push(`| ${i + 1} | ${isoDate(v.savedAt)} | ${v.note || "—"} |`);
    });
  }

  return lines.join("\n");
}

function blockToMarkdown(block: NotebookBlock): string {
  switch (block.type) {
    case "comment":
      return block.markdown;
    case "metric": {
      const val = block.value !== null ? `${block.value}${block.unit ? " " + block.unit : ""}` : "—";
      return `**${block.label}**: ${val}`;
    }
    case "table": {
      const header = `| ${block.headers.join(" | ")} |`;
      const sep = `| ${block.headers.map(() => "---").join(" | ")} |`;
      const rows = block.rows.map(r => `| ${r.map(c => String(c ?? "")).join(" | ")} |`).join("\n");
      return [header, sep, rows].join("\n");
    }
    case "chart":
      return `_[Chart: ${block.title}]_`;
    case "image":
      return `![${block.alt}](${block.src})`;
  }
}

export function notebookToMarkdown(notebook: Notebook): string {
  const lines: string[] = [
    `# ${notebook.title}`,
    ``,
    `**Tags:** ${notebook.tags.length > 0 ? notebook.tags.join(", ") : "—"}  `,
    `**Linked Experiments:** ${notebook.experimentIds.length > 0 ? notebook.experimentIds.join(", ") : "—"}`,
    ``,
    `---`,
    ``,
  ];

  for (const entry of notebook.entries) {
    lines.push(blockToMarkdown(entry.block), ``);
  }

  return lines.join("\n").trimEnd();
}
