"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  validateSpawnRules,
  evaluateSpawnRules,
  type SpawnValidateResponse,
  type SpawnEvaluateResponse,
} from "@/lib/api";
import {
  listSavedRules,
  saveRule,
  deleteRule,
  type SavedSpawnRule,
} from "@/lib/spawner-storage";
import { PageBanner } from "@/components/PageBanner";

// ── Types ─────────────────────────────────────────────────────────────────────

type OperandType = "literal" | "indicator";
type IndicatorType = "RSI" | "MA" | "BB" | "MACD" | "CCI" | "OBV";
type OpType = "<" | "<=" | ">" | ">=" | "==";
type Combinator = "AND" | "OR";

interface IndicatorParams {
  period: string;
  ma_type: string;
  fast_period: string;
  slow_period: string;
  k: string;
  band: string;
}

interface OperandForm {
  opType: OperandType;
  value: string;
  indicator: IndicatorType;
  barType: string;
  params: IndicatorParams;
}

interface ConditionRow {
  id: number;
  left: OperandForm;
  op: OpType;
  right: OperandForm;
}

interface RuleForm {
  combinator: Combinator;
  conditions: ConditionRow[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INDICATORS: IndicatorType[] = ["RSI", "MA", "BB", "MACD", "CCI", "OBV"];
const MA_TYPES = ["SIMPLE", "EXPONENTIAL", "WILDER", "HULL"];
const OPS: OpType[] = ["<", "<=", ">", ">=", "=="];

const DEFAULT_PARAMS: IndicatorParams = {
  period: "14",
  ma_type: "SIMPLE",
  fast_period: "12",
  slow_period: "26",
  k: "2",
  band: "upper",
};

const DEFAULT_BAR_TYPE = "AAPL.NASDAQ-1-DAY-LAST-EXTERNAL";

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultOperand(): OperandForm {
  return {
    opType: "indicator",
    value: "30",
    indicator: "RSI",
    barType: DEFAULT_BAR_TYPE,
    params: { ...DEFAULT_PARAMS },
  };
}

let _nextId = 1;
function nextId() { return _nextId++; }

function defaultCondition(): ConditionRow {
  return {
    id: nextId(),
    left: defaultOperand(),
    op: "<",
    right: { ...defaultOperand(), opType: "literal", value: "30" },
  };
}

function defaultRule(): RuleForm {
  return { combinator: "AND", conditions: [defaultCondition()] };
}

function operandToJson(op: OperandForm): object {
  if (op.opType === "literal") return { value: parseFloat(op.value) || 0 };
  const params: Record<string, string | number> = {};
  if (["RSI", "MA", "BB", "CCI"].includes(op.indicator)) {
    params.period = parseInt(op.params.period) || 14;
  }
  if (op.indicator === "MA") params.ma_type = op.params.ma_type;
  if (op.indicator === "BB") {
    params.k = parseFloat(op.params.k) || 2;
    params.band = op.params.band;
  }
  if (op.indicator === "MACD") {
    params.fast_period = parseInt(op.params.fast_period) || 12;
    params.slow_period = parseInt(op.params.slow_period) || 26;
  }
  return { indicator: op.indicator, bar_type: op.barType, params };
}

function ruleFormToJson(rule: RuleForm): object {
  return {
    condition: {
      combinator: rule.combinator,
      conditions: rule.conditions.map(c => ({
        left: operandToJson(c.left),
        op: c.op,
        right: operandToJson(c.right),
      })),
    },
    strategy: { class: "backtest_runner.ema_cross_flat:EMACrossFlat", params: {} },
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function IndicatorParamsEditor({
  indicator,
  params,
  onChange,
}: {
  indicator: IndicatorType;
  params: IndicatorParams;
  onChange: (p: IndicatorParams) => void;
}) {
  function numInput(key: keyof IndicatorParams, placeholder: string) {
    return (
      <input
        key={key}
        type="number"
        className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-xs w-20"
        placeholder={placeholder}
        value={params[key]}
        onChange={e => onChange({ ...params, [key]: e.target.value })}
      />
    );
  }
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {(indicator === "RSI" || indicator === "MA" || indicator === "BB" || indicator === "CCI") &&
        numInput("period", "period")}
      {indicator === "MA" && (
        <select
          className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-xs"
          value={params.ma_type}
          onChange={e => onChange({ ...params, ma_type: e.target.value })}
        >
          {MA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
      {indicator === "BB" && (
        <>
          {numInput("k", "k")}
          <select
            className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-xs"
            value={params.band}
            onChange={e => onChange({ ...params, band: e.target.value })}
          >
            <option value="upper">upper</option>
            <option value="middle">middle</option>
            <option value="lower">lower</option>
          </select>
        </>
      )}
      {indicator === "MACD" && (
        <>
          {numInput("fast_period", "fast")}
          {numInput("slow_period", "slow")}
        </>
      )}
    </div>
  );
}

function OperandEditor({
  value,
  onChange,
}: {
  value: OperandForm;
  onChange: (v: OperandForm) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <select
        className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-sm"
        value={value.opType}
        onChange={e => onChange({ ...value, opType: e.target.value as OperandType })}
      >
        <option value="indicator">Indicator</option>
        <option value="literal">Literal</option>
      </select>
      {value.opType === "literal" ? (
        <input
          type="number"
          className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-sm w-28"
          placeholder="value"
          value={value.value}
          onChange={e => onChange({ ...value, value: e.target.value })}
        />
      ) : (
        <>
          <select
            className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-sm"
            value={value.indicator}
            onChange={e =>
              onChange({ ...value, indicator: e.target.value as IndicatorType, params: { ...DEFAULT_PARAMS } })
            }
          >
            {INDICATORS.map(ind => <option key={ind} value={ind}>{ind}</option>)}
          </select>
          <input
            className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-xs"
            placeholder="bar_type e.g. AAPL.NASDAQ-1-DAY-LAST-EXTERNAL"
            value={value.barType}
            onChange={e => onChange({ ...value, barType: e.target.value })}
          />
          <IndicatorParamsEditor
            indicator={value.indicator}
            params={value.params}
            onChange={params => onChange({ ...value, params })}
          />
        </>
      )}
    </div>
  );
}

function ConditionRowEditor({
  condition,
  onChange,
  onRemove,
}: {
  condition: ConditionRow;
  onChange: (c: ConditionRow) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-start p-3 bg-panel-2 rounded border border-border">
      <div>
        <p className="text-xs text-text-3 mb-1">Left</p>
        <OperandEditor
          value={condition.left}
          onChange={left => onChange({ ...condition, left })}
        />
      </div>
      <div className="flex flex-col items-center pt-6">
        <select
          className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-sm"
          value={condition.op}
          onChange={e => onChange({ ...condition, op: e.target.value as OpType })}
        >
          {OPS.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
      </div>
      <div>
        <p className="text-xs text-text-3 mb-1">Right</p>
        <OperandEditor
          value={condition.right}
          onChange={right => onChange({ ...condition, right })}
        />
      </div>
      <button
        className="text-neg text-lg leading-none mt-6 px-1"
        onClick={onRemove}
        aria-label="Remove condition"
      >
        ✕
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SpawnerPage() {
  const [rule, setRule] = useState<RuleForm>(defaultRule);
  const [validateResult, setValidateResult] = useState<SpawnValidateResponse | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [savedRules, setSavedRules] = useState<SavedSpawnRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [instrument, setInstrument] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2026-06-28");
  const [evalResult, setEvalResult] = useState<SpawnEvaluateResponse | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSavedRules(listSavedRules());
  }, []);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const rulesJson = JSON.stringify([ruleFormToJson(rule)], null, 2);

  function addCondition() {
    setRule(r => ({ ...r, conditions: [...r.conditions, defaultCondition()] }));
  }

  function removeCondition(id: number) {
    setRule(r => ({ ...r, conditions: r.conditions.filter(c => c.id !== id) }));
  }

  function updateCondition(id: number, updated: ConditionRow) {
    setRule(r => ({
      ...r,
      conditions: r.conditions.map(c => (c.id === id ? updated : c)),
    }));
  }

  async function handleValidate() {
    setValidateResult(null);
    setValidateError(null);
    try {
      const result = await validateSpawnRules(rulesJson);
      setValidateResult(result);
    } catch (e) {
      setValidateError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleSave() {
    if (!saveName.trim()) return;
    const updated = saveRule(saveName.trim(), rulesJson);
    setSavedRules(updated);
    setSaveName("");
  }

  function handleDelete(name: string) {
    const updated = deleteRule(name);
    setSavedRules(updated);
    if (selectedRule === name) setSelectedRule(null);
  }

  async function handleEvaluate() {
    const jsonToEval =
      selectedRule
        ? (savedRules.find(r => r.name === selectedRule)?.json ?? rulesJson)
        : rulesJson;

    let parsedRules: object[];
    try {
      parsedRules = JSON.parse(jsonToEval) as object[];
    } catch {
      setEvalError("Invalid JSON");
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setEvalResult(null);
    setEvalError(null);

    try {
      const result = await evaluateSpawnRules(
        { spawn_rules: parsedRules, instrument_id: instrument, start, end },
        ctrl.signal,
      );
      if (abortRef.current !== ctrl) return;
      setEvalResult(result);
    } catch (e) {
      if (abortRef.current !== ctrl) return;
      if (e instanceof Error && e.name === "AbortError") return;
      setEvalError(e instanceof Error ? e.message : String(e));
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg text-text-1 p-6">
      <PageBanner pageKey="spawner" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Condition Builder ── */}
        <section className="space-y-4">
          <div className="bg-panel border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide mb-4">
              Condition Builder
            </h2>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-text-2">Combinator:</span>
              <select
                className="border border-border bg-panel-2 text-text-1 rounded px-2 py-1 text-sm"
                value={rule.combinator}
                onChange={e =>
                  setRule(r => ({ ...r, combinator: e.target.value as Combinator }))
                }
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            </div>

            <div className="space-y-3">
              {rule.conditions.map(cond => (
                <ConditionRowEditor
                  key={cond.id}
                  condition={cond}
                  onChange={updated => updateCondition(cond.id, updated)}
                  onRemove={() => removeCondition(cond.id)}
                />
              ))}
            </div>

            <button
              className="mt-3 text-sm text-accent border border-accent/40 rounded px-3 py-1 hover:bg-accent/10"
              onClick={addCondition}
            >
              + Add Condition
            </button>
          </div>

          {/* Validate */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="bg-accent text-black text-sm font-medium rounded px-4 py-1.5"
                onClick={handleValidate}
              >
                Validate
              </button>
              {validateResult && (
                <span
                  className={`text-sm font-medium ${
                    validateResult.valid ? "text-pos" : "text-neg"
                  }`}
                >
                  {validateResult.valid
                    ? `✓ Valid — ${validateResult.rules[0]?.condition_count ?? 0} condition(s)`
                    : `✗ ${validateResult.errors[0]?.error}`}
                </span>
              )}
              {validateError && (
                <span className="text-sm text-neg">{validateError}</span>
              )}
            </div>
          </div>

          {/* JSON preview */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide mb-2">
              JSON Preview
            </h2>
            <textarea
              className="w-full h-32 bg-panel-2 border border-border text-text-2 text-xs font-mono rounded p-2 resize-none"
              readOnly
              value={rulesJson}
            />
          </div>

          {/* Save */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide mb-3">
              Save Rule
            </h2>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm"
                placeholder="Rule name…"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
              />
              <button
                className="bg-accent text-black text-sm font-medium rounded px-4 py-1.5 disabled:opacity-40"
                onClick={handleSave}
                disabled={!saveName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </section>

        {/* ── Right: Saved rules + Evaluate ── */}
        <section className="space-y-4">
          {/* Saved rules */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide mb-3">
              Saved Rules
            </h2>
            {savedRules.length === 0 ? (
              <p className="text-sm text-text-3">No saved rules yet.</p>
            ) : (
              <div className="space-y-2">
                {savedRules.map(r => (
                  <div
                    key={r.name}
                    className={`flex items-center justify-between px-3 py-2 rounded border cursor-pointer ${
                      selectedRule === r.name
                        ? "border-accent text-accent bg-accent/10"
                        : "border-border bg-panel-2 text-text-1"
                    }`}
                    onClick={() =>
                      setSelectedRule(selectedRule === r.name ? null : r.name)
                    }
                  >
                    <div>
                      <span className="text-sm font-medium">{r.name}</span>
                      <span className="text-xs text-text-3 ml-2">
                        {r.savedAt.slice(0, 10)}
                      </span>
                    </div>
                    <button
                      className="text-xs text-neg hover:underline"
                      onClick={e => {
                        e.stopPropagation();
                        handleDelete(r.name);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evaluate */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide mb-3">
              Evaluate Against History
            </h2>
            <p className="text-xs text-text-3 mb-3">
              {selectedRule
                ? `Using saved rule: "${selectedRule}"`
                : "Using current builder rule"}
            </p>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-text-2 w-24 shrink-0">Instrument</label>
                <input
                  className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-2 py-1 text-sm"
                  value={instrument}
                  onChange={e => setInstrument(e.target.value)}
                  placeholder="e.g. AAPL.NASDAQ"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-text-2 w-24 shrink-0">Start</label>
                <input
                  type="date"
                  className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-2 py-1 text-sm"
                  value={start}
                  onChange={e => setStart(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-text-2 w-24 shrink-0">End</label>
                <input
                  type="date"
                  className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-2 py-1 text-sm"
                  value={end}
                  onChange={e => setEnd(e.target.value)}
                />
              </div>
            </div>

            <button
              className="bg-accent text-black text-sm font-medium rounded px-4 py-1.5 disabled:opacity-40"
              onClick={handleEvaluate}
              disabled={loading}
            >
              {loading ? "Running…" : "Run Evaluate"}
            </button>

            {evalError && (
              <p className="mt-2 text-sm text-neg">{evalError}</p>
            )}

            {evalResult && (
              <div className="mt-4">
                <p className="text-sm text-text-2 mb-2">
                  {evalResult.bar_count} bars &bull;{" "}
                  {evalResult.trigger_events.length} trigger event(s)
                </p>
                {evalResult.trigger_events.length > 0 ? (
                  <div className="overflow-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-text-3 border-b border-border">
                          <th className="py-1 text-left font-medium">Rule #</th>
                          <th className="py-1 text-left font-medium">Trigger Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evalResult.trigger_events.map((ev, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-1.5 text-text-1">Rule {ev.rule_index + 1}</td>
                            <td className="py-1.5 text-pos font-mono">{ev.trigger_date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-text-3">
                    No conditions triggered in this range.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
