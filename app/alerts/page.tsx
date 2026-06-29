"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertRule,
  AlertConditionType,
  TriggeredAlert,
  createAlertRule,
  getAlertRules,
  deleteAlertRule,
  getTriggeredAlerts,
} from "@/lib/api";
import { mergeTriggered, getCachedTriggered, clearCachedTriggered } from "@/lib/alert-storage";
import { PageBanner } from "@/components/PageBanner";

const CONDITION_LABELS: Record<AlertConditionType, string> = {
  price_above: "Price Above",
  price_below: "Price Below",
  pnl_above:   "PnL Above",
  pnl_below:   "PnL Below",
  bot_error:   "Bot Error",
  bot_stopped: "Bot Stopped",
};

const THRESHOLD_REQUIRED: AlertConditionType[] = [
  "price_above", "price_below", "pnl_above", "pnl_below",
];

export default function AlertsPage() {
  const [rules, setRules]           = useState<AlertRule[]>([]);
  const [triggered, setTriggered]   = useState<TriggeredAlert[]>([]);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [trigError, setTrigError]   = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);

  const [label, setLabel]                     = useState("");
  const [conditionType, setConditionType]     = useState<AlertConditionType>("price_above");
  const [botId, setBotId]                     = useState("");
  const [threshold, setThreshold]             = useState("");
  const [createError, setCreateError]         = useState<string | null>(null);
  const [creating, setCreating]               = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const trigAbortRef = useRef<AbortController | null>(null);

  const loadRules = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const data = await getAlertRules(ctrl.signal);
      setRules(data);
      setRulesError(null);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setRulesError(e instanceof Error ? e.message : "Failed to load rules");
    }
  }, []);

  const loadTriggered = useCallback(async () => {
    trigAbortRef.current?.abort();
    const ctrl = new AbortController();
    trigAbortRef.current = ctrl;
    setLoading(true);
    try {
      const fresh = await getTriggeredAlerts(ctrl.signal);
      const merged = mergeTriggered(fresh);
      setTriggered(merged);
      setTrigError(null);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setTrigError(e instanceof Error ? e.message : "Failed to load triggered alerts");
      setTriggered(getCachedTriggered());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
    loadTriggered();
    return () => {
      abortRef.current?.abort();
      trigAbortRef.current?.abort();
    };
  }, [loadRules, loadTriggered]);

  const handleCreate = async () => {
    if (!label.trim() || !botId.trim()) {
      setCreateError("Label and Bot ID are required");
      return;
    }
    const needsThreshold = THRESHOLD_REQUIRED.includes(conditionType);
    if (needsThreshold && !threshold) {
      setCreateError("Threshold is required for this condition type");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await createAlertRule({
        label: label.trim(),
        condition_type: conditionType,
        bot_id: botId.trim(),
        threshold: needsThreshold ? parseFloat(threshold) : undefined,
      });
      setLabel("");
      setBotId("");
      setThreshold("");
      await loadRules();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    try {
      await deleteAlertRule(id);
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : "Delete failed");
      await loadRules();
    }
  };

  const handleClearTriggered = () => {
    clearCachedTriggered();
    setTriggered([]);
  };

  const needsThreshold = THRESHOLD_REQUIRED.includes(conditionType);

  return (
    <div className="min-h-screen bg-bg p-6">
      <PageBanner pageKey="alerts" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Rules Panel ── */}
        <div className="bg-panel border border-border rounded-lg p-4 flex flex-col gap-4">
          <h2 className="text-text-1 font-medium">Alert Rules</h2>

          {/* Create form */}
          <div className="bg-panel-2 rounded-md p-3 flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-text-3 text-xs">Label</label>
              <input
                className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-sm"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="My alert"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-text-3 text-xs">Condition</label>
              <select
                className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-sm"
                value={conditionType}
                onChange={e => setConditionType(e.target.value as AlertConditionType)}
              >
                {(Object.keys(CONDITION_LABELS) as AlertConditionType[]).map(ct => (
                  <option key={ct} value={ct}>{CONDITION_LABELS[ct]}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-text-3 text-xs">Bot ID</label>
                <input
                  className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-sm"
                  value={botId}
                  onChange={e => setBotId(e.target.value)}
                  placeholder="bot_id"
                />
              </div>
              {needsThreshold && (
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-text-3 text-xs">Threshold</label>
                  <input
                    type="number"
                    className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-sm font-data"
                    value={threshold}
                    onChange={e => setThreshold(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
            {createError && <p className="text-neg text-xs">{createError}</p>}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="bg-accent text-black rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 self-start"
            >
              {creating ? "Creating…" : "Create Rule"}
            </button>
          </div>

          {/* Rules list */}
          {rulesError && <p className="text-neg text-sm">{rulesError}</p>}
          {rules.length === 0 ? (
            <p className="text-text-3 text-sm">No alert rules yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {rules.map(rule => (
                <div
                  key={rule.id}
                  className="bg-panel-2 border border-border rounded-md p-3 flex items-start justify-between gap-2"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-text-1 text-sm font-medium truncate">{rule.label}</span>
                    <span className="text-text-3 text-xs">
                      {CONDITION_LABELS[rule.condition_type as AlertConditionType]} · bot: {rule.bot_id}
                      {rule.threshold !== null && ` · ${rule.threshold}`}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-neg text-xs border border-neg rounded px-2 py-0.5 shrink-0"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Triggered Panel ── */}
        <div className="bg-panel border border-border rounded-lg p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-text-1 font-medium">Triggered Alerts</h2>
            <div className="flex gap-2">
              <button
                onClick={loadTriggered}
                disabled={loading}
                className="text-accent text-xs border border-accent rounded px-2 py-0.5"
              >
                Refresh
              </button>
              <button
                onClick={handleClearTriggered}
                className="text-text-3 text-xs border border-border rounded px-2 py-0.5"
              >
                Clear
              </button>
            </div>
          </div>

          {trigError && <p className="text-warn text-xs">{trigError} (showing cached)</p>}
          {triggered.length === 0 ? (
            <p className="text-text-3 text-sm">No triggered alerts.</p>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[60vh]">
              {triggered.map((t, i) => (
                <div
                  key={`${t.rule_id}-${t.triggered_at}-${i}`}
                  className="bg-panel-2 border border-border rounded-md p-3 flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-warn text-sm font-medium truncate">{t.rule_label}</span>
                    <span className="text-text-3 text-xs shrink-0">
                      {new Date(t.triggered_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <span className="text-text-2 text-xs">
                    {CONDITION_LABELS[t.condition_type as AlertConditionType]} · bot: {t.bot_id}
                  </span>
                  {t.detail && (
                    <span className="text-text-3 text-xs font-data">{t.detail}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
