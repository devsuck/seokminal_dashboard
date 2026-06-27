export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export interface BarOut {
  ts_event: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BarsResponse {
  instrument_id: string;
  bars: BarOut[];
}

export interface TradeRecord {
  entry_ts_ns: number;
  exit_ts_ns: number | null;
  entry_price: number;
  exit_price: number | null;
  side: string;
  pnl: number | null;
  qty: number;
}

export interface BacktestResponse {
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  max_drawdown: number | null;
  volatility: number | null;
  beta: number | null;
  total_pnl: number | null;
  total_pnl_pct: number | null;
  win_rate: number | null;
  profit_loss_ratio: number | null;
  avg_win: number | null;
  avg_loss: number | null;
  bar_count: number;
  trades: TradeRecord[];
}

export interface MCPaths { p5: number[]; p25: number[]; p50: number[]; p75: number[]; p95: number[]; }
export interface MonteCarloResponse {
  instrument_id: string;
  n_simulations: number;
  horizon_days: number;
  day_indices: number[];
  paths: MCPaths;
  terminal_mean: number;
  terminal_median: number;
  terminal_p5: number;
  terminal_p95: number;
  prob_profit: number;
  prob_loss_20pct: number;
  ann_return_mean: number;
  ann_return_p5: number;
  ann_return_p95: number;
  max_dd_mean: number;
  max_dd_p95: number;
}

export interface RegimePoint { date_index: number; vol: number; sma: number; price: number; regime: string; }
export interface RegimeResponse {
  instrument_id: string;
  current_regime: string;
  current_vol: number | null;
  current_sma: number | null;
  vol_threshold: number;
  sma_period: number;
  vol_period: number;
  regime_distribution: Record<string, number>;
  regimes: RegimePoint[];
}

export async function getMonteCarlo(
  instrumentId: string, start: string, end: string,
  horizonDays = 252, nSimulations = 1000,
  signal?: AbortSignal,
): Promise<MonteCarloResponse> {
  const p = new URLSearchParams({ instrument_id: instrumentId, start, end, horizon_days: String(horizonDays), n_simulations: String(nSimulations) });
  return handleResponse<MonteCarloResponse>(await fetch(`${API_URL}/monte-carlo?${p}`, { signal }));
}

export async function getRegime(
  instrumentId: string, start: string, end: string,
  smaPeriod = 50, volPeriod = 20,
  signal?: AbortSignal,
): Promise<RegimeResponse> {
  const p = new URLSearchParams({ instrument_id: instrumentId, start, end, sma_period: String(smaPeriod), vol_period: String(volPeriod) });
  return handleResponse<RegimeResponse>(await fetch(`${API_URL}/regime?${p}`, { signal }));
}

export interface TimeSeriesPoint {
  ts_ns: number;
  daily_return: number;
  cumulative_return: number;
  drawdown: number;
  rolling_sharpe: number | null;
  benchmark_cumulative: number | null;
}

export interface TimeSeriesResponse {
  instrument_id: string;
  points: TimeSeriesPoint[];
}

export interface BetaResponse {
  instrument_id: string;
  benchmark_id: string;
  beta: number;
  correlation: number;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, body.detail ?? response.statusText);
  }
  return response.json() as Promise<T>;
}

export async function getBars(
  instrumentId: string,
  start: string,
  end: string,
  timeframe?: string,
  signal?: AbortSignal
): Promise<BarsResponse> {
  const params = new URLSearchParams({
    instrument_id: instrumentId,
    start,
    end,
  });
  if (timeframe) params.set("timeframe", timeframe);
  const response = await fetch(`${API_URL}/bars?${params.toString()}`, { signal });
  return handleResponse<BarsResponse>(response);
}

export async function getBacktest(
  instrumentId: string,
  start: string,
  end: string,
  strategy: string,
  strategyParams: Record<string, string>,
  benchmarkId?: string,
  signal?: AbortSignal
): Promise<BacktestResponse> {
  const params = new URLSearchParams({
    instrument_id: instrumentId,
    start,
    end,
    strategy,
    ...strategyParams,
  });
  if (benchmarkId) params.set("benchmark_id", benchmarkId);
  const response = await fetch(`${API_URL}/backtest?${params.toString()}`, { signal });
  return handleResponse<BacktestResponse>(response);
}

export async function getBeta(
  instrumentId: string,
  benchmarkId: string,
  start: string,
  end: string,
  signal?: AbortSignal
): Promise<BetaResponse> {
  const params = new URLSearchParams({
    instrument_id: instrumentId,
    benchmark_id: benchmarkId,
    start,
    end,
  });
  const response = await fetch(`${API_URL}/beta?${params.toString()}`, { signal });
  return handleResponse<BetaResponse>(response);
}

export interface RiskMetricsResponse {
  instrument_id: string;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  volatility: number | null;
  max_drawdown: number | null;
  var_95: number | null;
  calmar_ratio: number | null;
  alpha: number | null;
  r_squared: number | null;
  annualized_return: number | null;
  observation_count: number;
}

export async function getTimeSeries(
  instrumentId: string,
  start: string,
  end: string,
  benchmarkId?: string,
  rollingWindow?: number,
  signal?: AbortSignal
): Promise<TimeSeriesResponse> {
  const params = new URLSearchParams({ instrument_id: instrumentId, start, end });
  if (benchmarkId) params.set("benchmark_id", benchmarkId);
  if (rollingWindow) params.set("rolling_window", String(rollingWindow));
  return handleResponse<TimeSeriesResponse>(
    await fetch(`${API_URL}/timeseries?${params}`, { signal })
  );
}

export async function getRisk(
  instrumentId: string,
  start: string,
  end: string,
  benchmarkId?: string,
  signal?: AbortSignal
): Promise<RiskMetricsResponse> {
  const params = new URLSearchParams({ instrument_id: instrumentId, start, end });
  if (benchmarkId) params.set("benchmark_id", benchmarkId);
  const response = await fetch(`${API_URL}/risk?${params.toString()}`, { signal });
  return handleResponse<RiskMetricsResponse>(response);
}

export interface RollingBetaPoint { ts_ns: number; beta: number; correlation: number; }
export interface RollingBetaResponse {
  instrument_id: string;
  benchmark_id: string;
  window: number;
  points: RollingBetaPoint[];
}

export async function getRollingBeta(
  instrumentId: string,
  benchmarkId: string,
  start: string,
  end: string,
  window: number = 30,
  signal?: AbortSignal
): Promise<RollingBetaResponse> {
  const params = new URLSearchParams({
    instrument_id: instrumentId,
    benchmark_id: benchmarkId,
    start,
    end,
    window: String(window),
  });
  const response = await fetch(`${API_URL}/rolling-beta?${params.toString()}`, { signal });
  return handleResponse<RollingBetaResponse>(response);
}

export interface PortfolioWeights { weights: Record<string, number>; expected_return: number; volatility: number; sharpe?: number | null; }
export interface FrontierPoint { expected_return: number; volatility: number; }
export interface PortfolioOptimizeResponse {
  instruments: string[];
  min_variance: PortfolioWeights;
  max_sharpe: PortfolioWeights;
  efficient_frontier: FrontierPoint[];
}

export async function getPortfolioOptimize(
  instrumentIds: string[],
  start: string,
  end: string,
  signal?: AbortSignal
): Promise<PortfolioOptimizeResponse> {
  const params = new URLSearchParams({
    instrument_ids: instrumentIds.join(","),
    start,
    end,
  });
  const response = await fetch(`${API_URL}/portfolio/optimize?${params.toString()}`, { signal });
  return handleResponse<PortfolioOptimizeResponse>(response);
}

// ── FRED ─────────────────────────────────────────────────────────────────────

export interface FREDObservation { date: string; value: number | null; }
export interface FREDSeriesResponse {
  series_id: string; label: string; unit: string; category: string;
  observations: FREDObservation[];
}
export interface FREDCatalogItem { series_id: string; label: string; unit: string; category: string; }

export async function getFREDCatalog(): Promise<FREDCatalogItem[]> {
  return handleResponse<FREDCatalogItem[]>(await fetch(`${API_URL}/fred/catalog`));
}

export async function getFREDSeries(
  seriesId: string, start: string, end: string, signal?: AbortSignal
): Promise<FREDSeriesResponse> {
  const params = new URLSearchParams({ series_id: seriesId, start, end });
  return handleResponse<FREDSeriesResponse>(await fetch(`${API_URL}/fred/series?${params}`, { signal }));
}

// ── ECOS ─────────────────────────────────────────────────────────────────────

export interface ECOSObservation { date: string; value: number | null; }
export interface ECOSSeriesResponse {
  series_id: string; label: string; unit: string; category: string;
  observations: ECOSObservation[];
}
export interface ECOSCatalogItem { series_id: string; label: string; unit: string; category: string; }

export async function getECOSCatalog(): Promise<ECOSCatalogItem[]> {
  return handleResponse<ECOSCatalogItem[]>(await fetch(`${API_URL}/ecos/catalog`));
}

export async function getECOSSeries(
  seriesId: string, start: string, end: string, signal?: AbortSignal
): Promise<ECOSSeriesResponse> {
  const params = new URLSearchParams({ series_id: seriesId, start, end });
  return handleResponse<ECOSSeriesResponse>(await fetch(`${API_URL}/ecos/series?${params}`, { signal }));
}

// ── Corp Finance ─────────────────────────────────────────────────────────────

export interface CorpFinancialYear {
  biz_year: string;
  report_type: string;
  currency: string;
  sale_amt: number;
  op_profit: number;
  net_profit: number;
  total_assets: number;
  total_debt: number;
  total_equity: number;
  paid_in_capital: number;
  op_margin_pct: number | null;
  net_margin_pct: number | null;
  roe_pct: number | null;
  debt_ratio_pct: number;
}

export interface CorpFinanceSummaryResponse {
  stock_code: string;
  crno: string;
  years: CorpFinancialYear[];
}

export interface CorpCrnoItem { stock_code: string; crno: string; }

export async function getCorpCrnoCatalog(): Promise<CorpCrnoItem[]> {
  return handleResponse<CorpCrnoItem[]>(await fetch(`${API_URL}/corp-finance/crno-catalog`));
}

export async function getCorpFinanceSummary(
  stockCode: string,
  startYear: number,
  endYear: number,
  crno?: string,
  fnclDcd = "110",
  signal?: AbortSignal,
): Promise<CorpFinanceSummaryResponse> {
  const params = new URLSearchParams({
    stock_code: stockCode,
    start_year: String(startYear),
    end_year: String(endYear),
    fncl_dcd: fnclDcd,
  });
  if (crno) params.set("crno", crno);
  return handleResponse<CorpFinanceSummaryResponse>(
    await fetch(`${API_URL}/corp-finance/summary?${params}`, { signal }),
  );
}

// ── SEC EDGAR ─────────────────────────────────────────────────────────────────

export interface EdgarAnnualRow {
  year: number;
  revenue: number | null;
  gross_profit: number | null;
  op_income: number | null;
  net_income: number | null;
  total_assets: number | null;
  equity: number | null;
  long_term_debt: number | null;
  eps_diluted: number | null;
  op_margin_pct: number | null;
  net_margin_pct: number | null;
  roe_pct: number | null;
}

export interface EdgarSummaryResponse {
  ticker: string;
  cik: string;
  rows: EdgarAnnualRow[];
}

export interface EdgarConceptRow { end: string; val: number; form: string | null; filed: string | null; unit: string; }
export interface EdgarConceptResponse { ticker: string; cik: string; concept: string; rows: EdgarConceptRow[]; }

export async function getEdgarSummary(
  ticker: string, startYear: number, endYear: number, signal?: AbortSignal
): Promise<EdgarSummaryResponse> {
  const p = new URLSearchParams({ ticker, start_year: String(startYear), end_year: String(endYear) });
  return handleResponse<EdgarSummaryResponse>(await fetch(`${API_URL}/edgar/summary?${p}`, { signal }));
}

export async function getEdgarConcept(
  ticker: string, concept: string, annualOnly = true, signal?: AbortSignal
): Promise<EdgarConceptResponse> {
  const p = new URLSearchParams({ ticker, concept, annual_only: String(annualOnly) });
  return handleResponse<EdgarConceptResponse>(await fetch(`${API_URL}/edgar/concept?${p}`, { signal }));
}

// ── KRX ──────────────────────────────────────────────────────────────────────

export interface KRXIndexRow { bas_dd: string; idx_nm: string | null; clpr: number | null; vs: number | null; flt_rt: number | null; raw: Record<string, unknown>; }
export interface KRXIndexResponse { bas_dd: string; index_type: string; rows: KRXIndexRow[]; }
export interface KRXStockBaseRow { isu_cd: string | null; isu_nm: string | null; mkt_nm: string | null; mktcap: number | null; list_shrs: number | null; raw: Record<string, unknown>; }
export interface KRXStockBaseResponse { market: string; rows: KRXStockBaseRow[]; }

export async function getKRXIndex(basDd: string, indexType = "KOSPI", signal?: AbortSignal): Promise<KRXIndexResponse> {
  const p = new URLSearchParams({ bas_dd: basDd, index_type: indexType });
  return handleResponse<KRXIndexResponse>(await fetch(`${API_URL}/krx/index?${p}`, { signal }));
}

export async function getKRXStockBase(market = "KOSPI", signal?: AbortSignal): Promise<KRXStockBaseResponse> {
  const p = new URLSearchParams({ market });
  return handleResponse<KRXStockBaseResponse>(await fetch(`${API_URL}/krx/stock-base?${p}`, { signal }));
}

// ── KSD ──────────────────────────────────────────────────────────────────────

export interface KSDDividendRow {
  raw: Record<string, unknown>;
  isin_cd: string | null;
  isin_cd_nm: string | null;
  dvdn_bas_dt: string | null;
  cash_dvdn_pay_dt: string | null;
  stck_genr_dvdn_amt: string | null;
  stck_genr_cash_dvdn_rt: string | null;
  stck_dvdn_rcd: string | null;
  stck_dvdn_rcd_nm: string | null;
  scrs_itms_kcd_nm: string | null;
}
export interface KSDDividendResponse { isin_cd: string; rows: KSDDividendRow[]; }

export interface KSDBorrowRow {
  raw: Record<string, unknown>;
  rank: number | null;
  isin_cd: string | null;
  isin_cd_nm: string | null;
  bas_dt: string | null;
  lnb_ccl_stck_cnt: string | null;
  lnb_rman_stck_cnt: string | null;
  lnb_bal: string | null;
}
export interface KSDBorrowResponse { bas_dt: string; rows: KSDBorrowRow[]; }

export interface KSDRightsRow {
  raw: Record<string, unknown>;
  bas_dt: string | null;
  crno: string | null;
  stck_issu_cmpy_nm: string | null;
  stck_issu_rcd_nm: string | null;
  rgt_exert_rcd: string | null;
  rgt_exert_rcd_nm: string | null;
  rgt_exert_sttg_dt: string | null;
  rgt_exert_ed_dt: string | null;
  nmls_lck_sttg_dt: string | null;
  nmls_lck_ed_dt: string | null;
}
export interface KSDRightsResponse { rows: KSDRightsRow[]; }

export async function getKSDDividend(
  stockCode: string, beginDt?: string, endDt?: string, signal?: AbortSignal
): Promise<KSDDividendResponse> {
  const p = new URLSearchParams({ stock_code: stockCode });
  if (beginDt) p.set("begin_dt", beginDt);
  if (endDt) p.set("end_dt", endDt);
  return handleResponse<KSDDividendResponse>(await fetch(`${API_URL}/ksd/dividend?${p}`, { signal }));
}

export async function getKSDBorrowRank(
  basDt: string, topN = 30, signal?: AbortSignal
): Promise<KSDBorrowResponse> {
  const p = new URLSearchParams({ bas_dt: basDt, top_n: String(topN) });
  return handleResponse<KSDBorrowResponse>(await fetch(`${API_URL}/ksd/borrow-rank?${p}`, { signal }));
}

export async function getKSDRightsSchedule(
  basDt?: string, beginDt?: string, endDt?: string, crno?: string, signal?: AbortSignal
): Promise<KSDRightsResponse> {
  const p = new URLSearchParams();
  if (basDt) p.set("bas_dt", basDt);
  if (beginDt) p.set("begin_dt", beginDt);
  if (endDt) p.set("end_dt", endDt);
  if (crno) p.set("crno", crno);
  return handleResponse<KSDRightsResponse>(await fetch(`${API_URL}/ksd/rights-schedule?${p}`, { signal }));
}

// ── Bot live status ───────────────────────────────────────────────────────────

export interface LiveBotStatus {
  bot_id: string;
  running: boolean;
  position: string;
  qty: number;
  last_price: number | null;
  last_signal: string | null;
  recent_orders: { order_id: string; status: string; filled: number }[];
  error: string | null;
}

export async function getLiveBotStatus(id: string): Promise<LiveBotStatus> {
  return handleResponse<LiveBotStatus>(await fetch(`${API_URL}/bots/${id}/live-status`));
}

// ── Bots ──────────────────────────────────────────────────────────────────────

export interface BotRecord {
  id: string;
  name: string;
  strategy: string;
  instrument_id: string;
  fast_ema: number;
  slow_ema: number;
  trade_size: number;
  status: "stopped" | "running" | "error";
  created_at: string;
}

export interface BotConfig {
  name: string;
  strategy: string;
  instrument_id: string;
  fast_ema: number;
  slow_ema: number;
  trade_size: number;
}

export async function listBots(signal?: AbortSignal): Promise<BotRecord[]> {
  return handleResponse<BotRecord[]>(await fetch(`${API_URL}/bots`, { signal }));
}

export async function createBot(config: BotConfig): Promise<BotRecord> {
  return handleResponse<BotRecord>(
    await fetch(`${API_URL}/bots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    })
  );
}

export async function startBot(id: string): Promise<BotRecord> {
  return handleResponse<BotRecord>(await fetch(`${API_URL}/bots/${id}/start`, { method: "POST" }));
}

export async function stopBot(id: string): Promise<BotRecord> {
  return handleResponse<BotRecord>(await fetch(`${API_URL}/bots/${id}/stop`, { method: "POST" }));
}

export async function deleteBot(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/bots/${id}`, { method: "DELETE" });
  if (!res.ok) { const b = await res.json().catch(() => ({ detail: res.statusText })); throw new ApiError(res.status, b.detail); }
}
