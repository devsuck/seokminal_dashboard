import { describe, it, expect } from "vitest";
import {
  experimentToMarkdown,
  strategyToMarkdown,
  notebookToMarkdown,
} from "../../lib/report-utils";
import type { Experiment } from "../../lib/experiment-storage";
import type { Strategy } from "../../lib/strategy-storage";
import type { Notebook } from "../../lib/notebook-storage";

const BASE_EXP: Experiment = {
  id: "exp_1_abc12",
  timestamp: 1750000000000,
  label: "005930.XKRX EMA 10/20",
  notes: "Good result",
  params: {
    strategy: "ema_cross",
    instrumentId: "005930.XKRX",
    start: "2024-01-01",
    end: "2025-01-01",
    timeframe: "1D",
    benchmarkId: "KOSPI.XKRX",
    fast: 10,
    slow: 20,
  },
  metrics: {
    sharpe: 1.42,
    sortino: 2.1,
    maxDrawdown: -0.12,
    winRate: 0.55,
    totalPnlPct: 0.22,
    totalTrades: 43,
    volatility: 0.18,
  },
};

const BASE_STRATEGY: Strategy = {
  id: "strat_1_xyz99",
  name: "EMA Cross 10/20",
  description: "Simple EMA crossover",
  tags: ["ema", "trend"],
  favorite: true,
  archived: false,
  params: { type: "ema_cross", fast: 10, slow: 20 },
  versions: [
    { params: { type: "ema_cross", fast: 5, slow: 15 }, savedAt: 1749000000000, note: "v1" },
  ],
  createdAt: 1749000000000,
  updatedAt: 1750000000000,
};

const BASE_NOTEBOOK: Notebook = {
  id: "nb_1_aaa11",
  title: "My Research Notes",
  tags: ["research", "ema"],
  experimentIds: ["exp_1_abc12"],
  entries: [
    { id: "blk_1", block: { type: "comment", markdown: "# Intro\nThis is a test." } },
    { id: "blk_2", block: { type: "metric", label: "Sharpe", value: 1.42, unit: "" } },
    { id: "blk_3", block: { type: "table", headers: ["Year", "Return"], rows: [["2024", "22%"]] } },
    { id: "blk_4", block: { type: "chart", title: "Equity Curve", data: [] } },
    { id: "blk_5", block: { type: "image", src: "https://example.com/img.png", alt: "Chart" } },
  ],
  createdAt: 1749000000000,
  updatedAt: 1750000000000,
};

describe("experimentToMarkdown", () => {
  it("includes the experiment label as h1", () => {
    const md = experimentToMarkdown(BASE_EXP);
    expect(md).toContain("# 005930.XKRX EMA 10/20");
  });

  it("includes instrument, start, end from params", () => {
    const md = experimentToMarkdown(BASE_EXP);
    expect(md).toContain("005930.XKRX");
    expect(md).toContain("2024-01-01");
    expect(md).toContain("2025-01-01");
  });

  it("includes sharpe and winRate metrics", () => {
    const md = experimentToMarkdown(BASE_EXP);
    expect(md).toContain("1.42");
    expect(md).toContain("0.55");
  });

  it("includes notes when non-empty", () => {
    const md = experimentToMarkdown(BASE_EXP);
    expect(md).toContain("Good result");
  });

  it("handles null metrics gracefully", () => {
    const exp: Experiment = {
      ...BASE_EXP,
      metrics: { ...BASE_EXP.metrics, sharpe: null, sortino: null },
    };
    const md = experimentToMarkdown(exp);
    expect(md).toContain("—");
  });
});

describe("strategyToMarkdown", () => {
  it("includes strategy name as h1", () => {
    const md = strategyToMarkdown(BASE_STRATEGY);
    expect(md).toContain("# EMA Cross 10/20");
  });

  it("includes description and tags", () => {
    const md = strategyToMarkdown(BASE_STRATEGY);
    expect(md).toContain("Simple EMA crossover");
    expect(md).toContain("ema");
    expect(md).toContain("trend");
  });

  it("includes EMA params for ema_cross type", () => {
    const md = strategyToMarkdown(BASE_STRATEGY);
    expect(md).toContain("10");
    expect(md).toContain("20");
  });

  it("includes version count", () => {
    const md = strategyToMarkdown(BASE_STRATEGY);
    expect(md).toContain("1");
  });
});

describe("notebookToMarkdown", () => {
  it("includes notebook title as h1", () => {
    const md = notebookToMarkdown(BASE_NOTEBOOK);
    expect(md).toContain("# My Research Notes");
  });

  it("includes tags", () => {
    const md = notebookToMarkdown(BASE_NOTEBOOK);
    expect(md).toContain("research");
    expect(md).toContain("ema");
  });

  it("renders comment blocks as raw markdown", () => {
    const md = notebookToMarkdown(BASE_NOTEBOOK);
    expect(md).toContain("# Intro");
    expect(md).toContain("This is a test.");
  });

  it("renders metric blocks as bold label: value", () => {
    const md = notebookToMarkdown(BASE_NOTEBOOK);
    expect(md).toContain("**Sharpe**");
    expect(md).toContain("1.42");
  });

  it("renders table blocks as markdown table", () => {
    const md = notebookToMarkdown(BASE_NOTEBOOK);
    expect(md).toContain("| Year | Return |");
    expect(md).toContain("| 2024 | 22% |");
  });

  it("renders chart block as placeholder text", () => {
    const md = notebookToMarkdown(BASE_NOTEBOOK);
    expect(md).toContain("Equity Curve");
  });

  it("renders image blocks as markdown image syntax", () => {
    const md = notebookToMarkdown(BASE_NOTEBOOK);
    expect(md).toContain("![Chart](https://example.com/img.png)");
  });

  it("handles empty notebook (no entries)", () => {
    const nb: Notebook = { ...BASE_NOTEBOOK, entries: [], tags: [], experimentIds: [] };
    const md = notebookToMarkdown(nb);
    expect(md).toContain("# My Research Notes");
  });
});
