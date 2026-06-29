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

export interface OptimizeResponse {
  best_params: Record<string, number>;
  best_sharpe: number | null;
  combinations_tested: number;
}

export async function runBacktestOptimize(
  instrumentId: string,
  start: string,
  end: string,
  strategy: "macd" | "rsi",
  signal?: AbortSignal,
): Promise<OptimizeResponse> {
  const params = new URLSearchParams({
    instrument_id: instrumentId,
    start,
    end,
    strategy,
  });
  return handleResponse<OptimizeResponse>(
    await fetch(`${API_URL}/backtest/optimize?${params.toString()}`, { signal })
  );
}

export interface PortfolioInstrumentResult {
  instrument_id: string;
  sharpe_ratio: number | null;
  total_pnl: number | null;
  total_pnl_pct: number | null;
  max_drawdown: number | null;
  win_rate: number | null;
  trade_count: number;
  bar_count: number;
}

export interface EquityPoint {
  ts_ns: number;
  equity: number;
}

export interface PortfolioBacktestResponse {
  results: PortfolioInstrumentResult[];
  portfolio_equity: EquityPoint[];
  portfolio_total_pnl: number | null;
  portfolio_max_drawdown: number | null;
  portfolio_sharpe: number | null;
}

export async function runPortfolioBacktest(
  instrumentIds: string[],
  start: string,
  end: string,
  strategy: string,
  strategyParams: Record<string, string>,
  signal?: AbortSignal,
): Promise<PortfolioBacktestResponse> {
  const params = new URLSearchParams({
    instrument_ids: instrumentIds.join(","),
    start,
    end,
    strategy,
    ...strategyParams,
  });
  return handleResponse<PortfolioBacktestResponse>(
    await fetch(`${API_URL}/backtest/portfolio?${params.toString()}`, { signal })
  );
}

export interface AiRecommendation {
  instrument_id: string;
  strategy: string;
  params: Record<string, number>;
  reasoning: string;
}

export async function getAiRecommendation(
  instrumentId: string,
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<AiRecommendation> {
  const params = new URLSearchParams({ instrument_id: instrumentId, start, end });
  return handleResponse<AiRecommendation>(
    await fetch(`${API_URL}/ai/strategy-recommend?${params.toString()}`, { signal })
  );
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

export async function getFREDCatalog(signal?: AbortSignal): Promise<FREDCatalogItem[]> {
  return handleResponse<FREDCatalogItem[]>(await fetch(`${API_URL}/fred/catalog`, { signal }));
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

export interface ClosedTrade {
  entry_ts_ns: number | null;
  exit_ts_ns: number;
  side: "LONG" | "SHORT";
  entry_price: number;
  exit_price: number;
  qty: number;
  pnl: number;
}

export interface SignalEntry {
  ts_ns: number;
  signal: string;
  price: number;
}

export interface BotTradeLogResponse {
  bot_id: string;
  trades: ClosedTrade[];
}

export interface BotSignalLogResponse {
  bot_id: string;
  signals: SignalEntry[];
}

export async function getBot(id: string): Promise<BotRecord> {
  return handleResponse<BotRecord>(await fetch(`${API_URL}/bots/${encodeURIComponent(id)}`));
}

export async function fetchBotTrades(id: string, signal?: AbortSignal): Promise<BotTradeLogResponse> {
  return handleResponse<BotTradeLogResponse>(
    await fetch(`${API_URL}/bots/${encodeURIComponent(id)}/trades`, { signal })
  );
}

export async function fetchBotSignals(id: string, signal?: AbortSignal): Promise<BotSignalLogResponse> {
  return handleResponse<BotSignalLogResponse>(
    await fetch(`${API_URL}/bots/${encodeURIComponent(id)}/signals`, { signal })
  );
}

// ── Correlation ───────────────────────────────────────────────────────────────

export interface CorrelationPair {
  a: string;
  b: string;
  correlation: number;
}

export interface CorrelationResponse {
  pairs: CorrelationPair[];
}

export async function getCorrelation(
  instrumentIds: string[],
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<CorrelationResponse> {
  const params = new URLSearchParams({
    instrument_ids: instrumentIds.join(","),
    start,
    end,
  });
  return handleResponse<CorrelationResponse>(
    await fetch(`${API_URL}/correlation?${params}`, { signal }),
  );
}

// ── Options ─────────────────────────────────────────────────────────────────

export interface OptionsGreeksResponse {
  option_type: string;
  spot: number;
  strike: number;
  expiry_days: number;
  rate: number;
  vol: number;
  price: number;
  intrinsic_value: number;
  time_value: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface OptionsChainRow {
  strike: number;
  call_price: number;
  call_delta: number;
  call_gamma: number;
  call_theta: number;
  call_vega: number;
  put_price: number;
  put_delta: number;
  put_gamma: number;
  put_theta: number;
  put_vega: number;
}

export interface OptionsChainResponse {
  spot: number;
  expiry_days: number;
  rate: number;
  vol: number;
  rows: OptionsChainRow[];
}

export interface OptionsIvSurfaceResponse {
  spot: number;
  rate: number;
  atm_vol: number;
  strikes: number[];
  expiry_days: number[];
  iv_surface: number[][];
}

export async function getOptionsGreeks(
  optionType: string,
  spot: number,
  strike: number,
  expiryDays: number,
  rate: number,
  vol: number,
  signal?: AbortSignal
): Promise<OptionsGreeksResponse> {
  const params = new URLSearchParams({
    option_type: optionType,
    spot: String(spot),
    strike: String(strike),
    expiry_days: String(expiryDays),
    rate: String(rate),
    vol: String(vol),
  });
  return handleResponse<OptionsGreeksResponse>(
    await fetch(`${API_URL}/options/greeks?${params}`, { signal })
  );
}

export async function getOptionsChain(
  spot: number,
  expiryDays: number,
  rate: number,
  vol: number,
  signal?: AbortSignal
): Promise<OptionsChainResponse> {
  const params = new URLSearchParams({
    spot: String(spot),
    expiry_days: String(expiryDays),
    rate: String(rate),
    vol: String(vol),
  });
  return handleResponse<OptionsChainResponse>(
    await fetch(`${API_URL}/options/chain?${params}`, { signal })
  );
}

export async function getOptionsIvSurface(
  spot: number,
  rate: number,
  atmVol: number,
  skew?: number,
  smile?: number,
  signal?: AbortSignal
): Promise<OptionsIvSurfaceResponse> {
  const params = new URLSearchParams({
    spot: String(spot),
    rate: String(rate),
    atm_vol: String(atmVol),
  });
  if (skew !== undefined) params.set("skew", String(skew));
  if (smile !== undefined) params.set("smile", String(smile));
  return handleResponse<OptionsIvSurfaceResponse>(
    await fetch(`${API_URL}/options/iv-surface?${params}`, { signal })
  );
}

// ── Futures ──────────────────────────────────────────────────────────────────

export interface FuturesPriceResponse {
  spot: number;
  rate: number;
  convenience_yield: number;
  expiry_days: number;
  price: number;
  basis: number;
  basis_pct: number;
  annualized_carry: number;
  market_structure: string;
}

export interface FuturesCalendarRow {
  expiry_days: number;
  price: number;
  basis: number;
  basis_pct: number;
  annualized_carry: number;
  market_structure: string;
}

export interface FuturesCalendarResponse {
  spot: number;
  rate: number;
  convenience_yield: number;
  rows: FuturesCalendarRow[];
}

export interface FuturesRollRow {
  front_days: number;
  back_days: number;
  front_price: number;
  back_price: number;
  roll_cost: number;
  roll_cost_pct: number;
  annualized_roll_yield: number;
  days_to_roll: number;
}

export interface FuturesRollResponse {
  spot: number;
  rate: number;
  convenience_yield: number;
  front_days: number;
  rolls: FuturesRollRow[];
}

export async function getFuturesPrice(
  spot: number,
  rate: number,
  convenienceYield: number,
  expiryDays: number,
  signal?: AbortSignal
): Promise<FuturesPriceResponse> {
  const params = new URLSearchParams({
    spot: String(spot),
    rate: String(rate),
    convenience_yield: String(convenienceYield),
    expiry_days: String(expiryDays),
  });
  return handleResponse<FuturesPriceResponse>(
    await fetch(`${API_URL}/futures/price?${params}`, { signal })
  );
}

export async function getFuturesCalendar(
  spot: number,
  rate: number,
  convenienceYield: number,
  signal?: AbortSignal
): Promise<FuturesCalendarResponse> {
  const params = new URLSearchParams({
    spot: String(spot),
    rate: String(rate),
    convenience_yield: String(convenienceYield),
  });
  return handleResponse<FuturesCalendarResponse>(
    await fetch(`${API_URL}/futures/calendar?${params}`, { signal })
  );
}

export async function getFuturesRoll(
  spot: number,
  rate: number,
  convenienceYield: number,
  frontDays: number,
  signal?: AbortSignal
): Promise<FuturesRollResponse> {
  const params = new URLSearchParams({
    spot: String(spot),
    rate: String(rate),
    convenience_yield: String(convenienceYield),
    front_days: String(frontDays),
  });
  return handleResponse<FuturesRollResponse>(
    await fetch(`${API_URL}/futures/roll?${params}`, { signal })
  );
}

// ── Forex ─────────────────────────────────────────────────────────────────────

export interface ForexForwardResponse {
  spot: number;
  rate_domestic: number;
  rate_foreign: number;
  days: number;
  forward: number;
  forward_points: number;
  forward_points_pct: number;
  annualized_differential: number;
  market_structure: string;
}

export interface ForexCurveRow {
  tenor_days: number;
  forward: number;
  forward_points: number;
  forward_points_pct: number;
  annualized_differential: number;
  market_structure: string;
}

export interface ForexCurveResponse {
  spot: number;
  rate_domestic: number;
  rate_foreign: number;
  rows: ForexCurveRow[];
}

export interface ForexCarryResponse {
  spot: number;
  rate_domestic: number;
  rate_foreign: number;
  days: number;
  forward: number;
  carry_rate: number;
  net_carry_pct: number;
  breakeven_move_pct: number;
  favorable: boolean;
  uip_expected_move_pct: number;
}

export async function getForexForward(
  spot: number,
  rateDomestic: number,
  rateForeign: number,
  days: number,
  signal?: AbortSignal
): Promise<ForexForwardResponse> {
  const params = new URLSearchParams({
    spot: String(spot),
    rate_domestic: String(rateDomestic),
    rate_foreign: String(rateForeign),
    days: String(days),
  });
  return handleResponse<ForexForwardResponse>(
    await fetch(`${API_URL}/forex/forward?${params}`, { signal })
  );
}

export async function getForexCurve(
  spot: number,
  rateDomestic: number,
  rateForeign: number,
  signal?: AbortSignal
): Promise<ForexCurveResponse> {
  const params = new URLSearchParams({
    spot: String(spot),
    rate_domestic: String(rateDomestic),
    rate_foreign: String(rateForeign),
  });
  return handleResponse<ForexCurveResponse>(
    await fetch(`${API_URL}/forex/curve?${params}`, { signal })
  );
}

export async function getForexCarry(
  spot: number,
  rateDomestic: number,
  rateForeign: number,
  days: number,
  signal?: AbortSignal
): Promise<ForexCarryResponse> {
  const params = new URLSearchParams({
    spot: String(spot),
    rate_domestic: String(rateDomestic),
    rate_foreign: String(rateForeign),
    days: String(days),
  });
  return handleResponse<ForexCarryResponse>(
    await fetch(`${API_URL}/forex/carry?${params}`, { signal })
  );
}

// ── Crypto (Hyperliquid) ──────────────────────────────────────────────────────

export interface CryptoAsset {
  name: string;
  mid_price: number;
  mark_price: number;
  funding_rate_8h: number;   // % per 8h
  funding_rate: number;      // annualized %
  open_interest: number;
  day_change_pct: number;
  day_volume: number;
}

export interface CryptoAssetsResponse {
  assets: CryptoAsset[];
  count: number;
}

export interface CryptoCandle {
  time_ms: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  num_trades: number;
}

export interface CryptoCandlesResponse {
  coin: string;
  interval: string;
  candles: CryptoCandle[];
}

export interface BookLevel {
  price: number;
  size: number;
  num_orders: number;
}

export interface CryptoBookResponse {
  coin: string;
  bids: BookLevel[];
  asks: BookLevel[];
  mid_price: number;
  spread: number;
  spread_pct: number;
}

export async function getCryptoAssets(
  signal?: AbortSignal
): Promise<CryptoAssetsResponse> {
  return handleResponse<CryptoAssetsResponse>(
    await fetch(`${API_URL}/crypto/assets`, { signal })
  );
}

export async function getCryptoCandles(
  coin: string,
  interval: string,
  days: number,
  signal?: AbortSignal
): Promise<CryptoCandlesResponse> {
  const params = new URLSearchParams({
    coin,
    interval,
    days: String(days),
  });
  return handleResponse<CryptoCandlesResponse>(
    await fetch(`${API_URL}/crypto/candles?${params}`, { signal })
  );
}

export async function getCryptoBook(
  coin: string,
  signal?: AbortSignal
): Promise<CryptoBookResponse> {
  const params = new URLSearchParams({ coin });
  return handleResponse<CryptoBookResponse>(
    await fetch(`${API_URL}/crypto/book?${params}`, { signal })
  );
}

// ── IB Market Data ────────────────────────────────────────────────────────────

export interface IBBar {
  ts_ms: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IBBarsResponse {
  symbol: string;
  asset_type: string;
  bars: IBBar[];
  count: number;
}

export interface IBBarsParams {
  symbol: string;
  asset_type: "stock" | "forex" | "future" | "option" | "crypto";
  end_date?: string;
  duration?: string;
  exchange?: string;
  expiry?: string;
  strike?: number;
  right?: "C" | "P";
}

export async function getIBBars(
  params: IBBarsParams,
  signal?: AbortSignal
): Promise<IBBarsResponse> {
  const p = new URLSearchParams({ symbol: params.symbol, asset_type: params.asset_type });
  if (params.end_date)  p.set("end_date",  params.end_date);
  if (params.duration)  p.set("duration",  params.duration);
  if (params.exchange)  p.set("exchange",  params.exchange);
  if (params.expiry)    p.set("expiry",    params.expiry);
  if (params.strike !== undefined && Number.isFinite(params.strike) && params.strike !== 0) p.set("strike", String(params.strike));
  if (params.right)     p.set("right",     params.right);
  return handleResponse<IBBarsResponse>(
    await fetch(`${API_URL}/ib/bars?${p}`, { signal })
  );
}

// ── KR Universe Search ──────────────────────────────────────────────────────────

export interface KRSearchResult {
  code: string;
  name: string;
  market: string;
}

export interface KRSearchResponse {
  query: string;
  results: KRSearchResult[];
  count: number;
}

export interface USSearchResult {
  symbol: string;
  name: string;
  sec_type: string;
  exchange: string;
  currency: string;
}

export interface USSearchResponse {
  query: string;
  results: USSearchResult[];
  count: number;
}

export interface KRBar {
  date: string; // YYYYMMDD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface KRBarsResponse {
  code: string;
  name: string;
  bars: KRBar[];
  count: number;
}

export interface KISTick {
  code: string;
  time: string; // HHMMSS
  price: number;
  change: number;
  change_rate: number;
  trade_volume: number;
  total_volume: number;
  error?: string;
}

export async function searchKR(
  q: string,
  signal?: AbortSignal,
): Promise<KRSearchResponse> {
  const r = await fetch(
    `${API_URL}/search/kr?q=${encodeURIComponent(q)}`,
    { signal },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function searchUS(
  q: string,
  signal?: AbortSignal,
): Promise<USSearchResponse> {
  const r = await fetch(
    `${API_URL}/search/us?q=${encodeURIComponent(q)}`,
    { signal },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getKRBars(
  code: string,
  days: number,
  signal?: AbortSignal,
): Promise<KRBarsResponse> {
  const r = await fetch(
    `${API_URL}/kr/bars?code=${encodeURIComponent(code)}&days=${days}`,
    { signal },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── Spawner ───────────────────────────────────────────────────────────────────

export interface ConditionInfo {
  rule_index: number;
  combinator: string;
  condition_count: number;
  indicators: string[];
}

export interface SpawnValidationError {
  rule_index: number;
  error: string;
}

export interface SpawnValidateResponse {
  valid: boolean;
  errors: SpawnValidationError[];
  rules: ConditionInfo[];
}

export interface TriggerEvent {
  rule_index: number;
  trigger_date: string;
}

export interface SpawnEvaluateRequest {
  spawn_rules: object[];
  instrument_id: string;
  start: string;
  end: string;
}

export interface SpawnEvaluateResponse {
  instrument_id: string;
  start: string;
  end: string;
  bar_count: number;
  trigger_events: TriggerEvent[];
}

export async function validateSpawnRules(
  spawnRulesJson: string,
  signal?: AbortSignal,
): Promise<SpawnValidateResponse> {
  const r = await fetch(`${API_URL}/spawner/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spawn_rules: JSON.parse(spawnRulesJson) as object[] }),
    signal,
  });
  return handleResponse<SpawnValidateResponse>(r);
}

export async function evaluateSpawnRules(
  req: SpawnEvaluateRequest,
  signal?: AbortSignal,
): Promise<SpawnEvaluateResponse> {
  const r = await fetch(`${API_URL}/spawner/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  return handleResponse<SpawnEvaluateResponse>(r);
}

// ── Orders ────────────────────────────────────────────────────────────────────

export interface KROrderRequest {
  code: string;
  side: "BUY" | "SELL";
  quantity: number;
  order_type: "MARKET" | "LIMIT";
  price?: number;
}

export interface KROrderResponse {
  order_id: string;
  status: string;
  filled: number;
  remaining: number;
}

export interface KRCancelRequest {
  code: string;
  quantity: number;
}

export interface BotLiveEntry {
  bot_id: string;
  name: string;
  instrument_id: string;
  running: boolean;
  position: string;
  qty: number;
  last_price: number | null;
  last_signal: string | null;
  error: string | null;
  entry_price: number | null;
  unrealized_pnl: number | null;
}

export interface AllBotsStatusResponse {
  bots: BotLiveEntry[];
}

export async function placeKROrder(
  req: KROrderRequest,
  signal?: AbortSignal,
): Promise<KROrderResponse> {
  const r = await fetch(`${API_URL}/orders/kr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  return handleResponse<KROrderResponse>(r);
}

export async function cancelKROrder(
  orderNo: string,
  req: KRCancelRequest,
  signal?: AbortSignal,
): Promise<KROrderResponse> {
  const r = await fetch(`${API_URL}/orders/kr/${encodeURIComponent(orderNo)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  return handleResponse<KROrderResponse>(r);
}

export async function getKROrderStatus(
  orderNo: string,
  date: string,
  signal?: AbortSignal,
): Promise<KROrderResponse> {
  const r = await fetch(
    `${API_URL}/orders/kr/${encodeURIComponent(orderNo)}/status?date=${encodeURIComponent(date)}`,
    { signal },
  );
  return handleResponse<KROrderResponse>(r);
}

export async function getAllBotsLiveStatus(
  signal?: AbortSignal,
): Promise<AllBotsStatusResponse> {
  const r = await fetch(`${API_URL}/bots/all-live-status`, { signal });
  return handleResponse<AllBotsStatusResponse>(r);
}

// ── US Orders ─────────────────────────────────────────────────────────────────

export interface USOrderRequest {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  order_type: "MARKET" | "LIMIT";
  limit_price?: number;
}

export interface USOrderResponse {
  order_id: number;
  status: string;
  filled: number;
  remaining: number;
}

export async function placeUSOrder(
  req: USOrderRequest,
  signal?: AbortSignal,
): Promise<USOrderResponse> {
  const r = await fetch(`${API_URL}/orders/us`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  return handleResponse<USOrderResponse>(r);
}

export async function cancelUSOrder(
  orderId: number,
  signal?: AbortSignal,
): Promise<USOrderResponse> {
  const r = await fetch(`${API_URL}/orders/us/${orderId}/cancel`, {
    method: "POST",
    signal,
  });
  return handleResponse<USOrderResponse>(r);
}

// ── Alert System ──────────────────────────────────────────────

export type AlertConditionType =
  | "price_above"
  | "price_below"
  | "pnl_above"
  | "pnl_below"
  | "bot_error"
  | "bot_stopped";

export interface AlertRule {
  id: string;
  label: string;
  condition_type: AlertConditionType;
  bot_id: string;
  threshold: number | null;
  created_at: string;
}

export interface CreateAlertRuleRequest {
  label: string;
  condition_type: AlertConditionType;
  bot_id: string;
  threshold?: number;
}

export interface AlertRulesResponse {
  rules: AlertRule[];
}

export interface TriggeredAlert {
  rule_id: string;
  rule_label: string;
  condition_type: AlertConditionType;
  bot_id: string;
  detail: string;
  triggered_at: string;
}

export interface TriggeredAlertsResponse {
  triggered: TriggeredAlert[];
}

export async function createAlertRule(
  req: CreateAlertRuleRequest,
  signal?: AbortSignal,
): Promise<AlertRule> {
  const r = await fetch(`${API_URL}/alerts/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail ?? r.statusText);
  }
  return r.json();
}

export async function getAlertRules(signal?: AbortSignal): Promise<AlertRule[]> {
  const r = await fetch(`${API_URL}/alerts/rules`, { signal });
  if (!r.ok) throw new Error(r.statusText);
  const data: AlertRulesResponse = await r.json();
  return data.rules;
}

export async function deleteAlertRule(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  const r = await fetch(`${API_URL}/alerts/rules/${id}`, {
    method: "DELETE",
    signal,
  });
  if (!r.ok && r.status !== 204) throw new Error(r.statusText);
}

export async function getTriggeredAlerts(
  signal?: AbortSignal,
): Promise<TriggeredAlert[]> {
  const r = await fetch(`${API_URL}/alerts/triggered`, { signal });
  if (!r.ok) throw new Error(r.statusText);
  const data: TriggeredAlertsResponse = await r.json();
  return data.triggered;
}

// ── Walk-Forward ──────────────────────────────────────────────────────────────

export interface WalkForwardWindow {
  window_start: string;
  window_end: string;
  sharpe_ratio: number | null;
  total_pnl_pct: number | null;
  win_rate: number | null;
  max_drawdown: number | null;
  num_trades: number;
}

export interface WalkForwardSummary {
  avg_sharpe: number | null;
  avg_pnl_pct: number | null;
  profitable_windows: number;
  total_windows: number;
  avg_max_drawdown: number | null;
}

export interface WalkForwardResponse {
  instrument_id: string;
  strategy: string;
  n_windows: number;
  windows: WalkForwardWindow[];
  summary: WalkForwardSummary;
}

export async function getWalkForward(
  instrumentId: string,
  start: string,
  end: string,
  strategy: string,
  strategyParams: Record<string, string>,
  nWindows: number,
  signal?: AbortSignal,
): Promise<WalkForwardResponse> {
  const params = new URLSearchParams({
    instrument_id: instrumentId,
    start,
    end,
    strategy,
    n_windows: String(nWindows),
    ...strategyParams,
  });
  const r = await fetch(`${API_URL}/backtest/walk-forward?${params.toString()}`, { signal });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new ApiError(r.status, err.detail ?? r.statusText);
  }
  return r.json();
}
