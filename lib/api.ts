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

export interface Quote {
  symbol: string;
  price: number;
  ts: number;
}

/** 실시간 최신가 (US 주식, Finnhub) — 차트 마지막 봉 라이브 갱신용. */
export async function getQuote(symbol: string, signal?: AbortSignal): Promise<Quote> {
  const params = new URLSearchParams({ symbol });
  const response = await fetch(`${API_URL}/quote?${params.toString()}`, { signal });
  return handleResponse<Quote>(response);
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

export interface FxRate {
  rate: number | null;
  change_pct: number | null;
  change_5d: number | null;
}

export async function getForexOverview(signal?: AbortSignal): Promise<Record<string, FxRate>> {
  return handleResponse<Record<string, FxRate>>(
    await fetch(`${API_URL}/forex/overview`, { signal })
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

export const IB_BAR_SIZES = [
  "1 min", "5 mins", "15 mins", "30 mins",
  "1 hour", "4 hours",
  "1 day", "1 week", "1 month",
] as const;
export type IBBarSize = typeof IB_BAR_SIZES[number];

export interface IBBarsParams {
  symbol: string;
  asset_type: "stock" | "forex" | "future" | "option" | "crypto";
  end_date?: string;
  duration?: string;
  bar_size?: IBBarSize;
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
  if (params.bar_size)  p.set("bar_size",  params.bar_size);
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

export interface IBTick {
  symbol: string;
  time: number | null; // epoch seconds
  price: number;
  size: number;
  exchange: string;
  error?: string;
}

/** ws:// base derived from the HTTP API origin. */
export const WS_URL = API_URL.replace(/^http/, "ws");

export interface TradingMode {
  venues: {
    US: { mode: "paper" | "live" | "unknown"; ib_port: number };
    KR: { mode: "paper" | "live" };
    ALPACA: { mode: "paper" | "live" };
    HL: { mode: "live" };
  };
  risk: {
    max_order_qty: number;
    max_order_notional: number;
    max_position_qty: number;
    daily_loss_limit: number;
    kill_switch: boolean;
  };
  any_live: boolean;
}

export async function getTradingMode(signal?: AbortSignal): Promise<TradingMode> {
  const r = await fetch(`${API_URL}/trading/mode`, { signal });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── AI agents (multi-agent trading) ───────────────────────────────────────────

export type AgentType = "swing" | "longterm" | "daytrade" | "hl_daytrade" | "kr_daytrade";

export interface TradingAgent {
  id: string;
  name: string;
  type: AgentType;
  account_alloc: number;
  status: "running" | "stopped";
  paper: boolean;
  autonomy: number; // 1=fixed rules, 2=AI strategist, 3=full autonomy
  market: "US" | "KR" | "MIXED";
  created_at: string;
  profile: { label?: string; cadence_seconds?: number; buy_score_threshold?: number; venue?: string };
  session_live?: boolean;
}

export interface AgentCycle {
  cycle: number;
  ts: string;
  decision: "WATCH" | "BUY" | "SELL" | "SKIP" | "HOLD";
  symbol?: string | null;
  score?: number | null;
  max_score?: number | null;
  action?: string | null;
  next_trigger?: string | null;
  cash_pct?: number | null;
  note?: string | null;
}

export async function listAgents(signal?: AbortSignal): Promise<{ agents: TradingAgent[]; profiles: Record<string, { label: string }> }> {
  const r = await fetch(`${API_URL}/agents`, { signal });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createAgent(name: string, type: AgentType, account_alloc: number, paper: boolean, autonomy: number, market: "US" | "KR" | "MIXED" = "US"): Promise<TradingAgent> {
  const r = await fetch(`${API_URL}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, type, account_alloc, paper, autonomy, market }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function startAgent(id: string): Promise<{ status: string }> {
  const r = await fetch(`${API_URL}/agents/${id}/start`, { method: "POST" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function stopAgent(id: string): Promise<{ status: string }> {
  const r = await fetch(`${API_URL}/agents/${id}/stop`, { method: "POST" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteAgent(id: string): Promise<{ status: string }> {
  const r = await fetch(`${API_URL}/agents/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getAgentCycles(id: string, limit = 50, signal?: AbortSignal): Promise<{ cycles: AgentCycle[] }> {
  const r = await fetch(`${API_URL}/agents/${id}/cycles?limit=${limit}`, { signal });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export interface AgentTrade {
  ts: string | null;
  cycle: number | null;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  reason: string;
  realized_pnl: number | null;
}

export interface AgentOpenPosition {
  symbol: string;
  qty: number;
  avg_price: number;
  current_price: number | null;
  unrealized_pnl: number | null;
}

export interface AgentPerformance {
  agent_id: string;
  alloc: number;
  cash: number;
  invested: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  return_pct: number;
  open_positions: AgentOpenPosition[];
  trades: AgentTrade[];
}

export async function getAgentPerformance(id: string, signal?: AbortSignal): Promise<AgentPerformance> {
  const r = await fetch(`${API_URL}/agents/${id}/performance`, { signal });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export interface DistillResult {
  agent_id: string;
  proposal: { instrument_id: string; strategy: string; params: Record<string, number>; rationale: string };
  backtest: { sharpe_ratio?: number | null; total_pnl_pct?: number | null; win_rate?: number | null; error?: string };
  validated: boolean;
  verdict: string;
  trades_analyzed: number;
}

export async function distillAgent(id: string, signal?: AbortSignal): Promise<DistillResult> {
  const r = await fetch(`${API_URL}/agents/${id}/distill`, { method: "POST", signal });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export interface AgentOverviewRow {
  id: string; name: string; type: AgentType; paper: boolean;
  status: "running" | "stopped"; autonomy: number;
  alloc: number; realized_pnl: number; return_pct: number;
  invested: number; cash: number; open_positions: number; trades: number;
}
export interface AgentsOverview {
  agents: AgentOverviewRow[];
  totals: { count: number; alloc: number; realized_pnl: number; return_pct: number; running: number };
}

export async function getAgentsOverview(signal?: AbortSignal): Promise<AgentsOverview> {
  const r = await fetch(`${API_URL}/agents/overview/all`, { signal });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export interface AccountRow {
  venue: string; label: string; ccy: string; mode: string | null;
  balance: number | null; allocated: number; error?: string | null;
}
export interface AccountBalances {
  accounts: AccountRow[];
}

export async function getAccountBalances(signal?: AbortSignal): Promise<AccountBalances> {
  const r = await fetch(`${API_URL}/agents/accounts/balances`, { signal });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
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
  paper?: boolean;  // true=KIS 모의, false=실계좌
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
  paper?: boolean;  // true=Alpaca 페이퍼, false=IB(TWS) 실계좌
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

// ── Insider Trading ───────────────────────────────────────────────────────────

export interface DartCompany {
  corp_code: string;
  corp_name: string;
  stock_code: string;
}

export type InsiderTradeType =
  | "BUY" | "SELL"
  | "RIGHTS_ISSUE"   // 무상증자
  | "PAID_IN"        // 유상증자
  | "CANCELLATION"   // 주식소각
  | "HOLD_REPORT"    // 보유변동 없는 보고
  | "OTHER";

export interface InsiderTrade {
  trade_date: string;
  reporter: string;
  trade_type: InsiderTradeType;
  shares_change?: number | null;
  shares?: number | null;
  price_per_share?: number | null;
  value_usd?: number | null;
  shares_owned_after?: number | null;
  shares_total?: number | null;
  ownership_pct?: number | null;
  report_type?: string | null;
  corp_name?: string | null;
  ticker?: string | null;
  issuer?: string | null;
  role?: string | null;         // KR: 직책
  event_cause?: string | null;  // KR: 증감원인
  dart_url?: string | null;     // KR: 공시 원문 링크
}

export async function searchDartCompany(q: string, signal?: AbortSignal): Promise<DartCompany[]> {
  const r = await fetch(`${API_URL}/insider/kr/search?q=${encodeURIComponent(q)}`, { signal });
  return handleResponse<DartCompany[]>(r);
}

export async function getInsiderKR(corpCode: string, days: number, signal?: AbortSignal): Promise<InsiderTrade[]> {
  const r = await fetch(`${API_URL}/insider/kr?corp_code=${corpCode}&days=${days}`, { signal });
  return handleResponse<InsiderTrade[]>(r);
}

export async function getInsiderUS(ticker: string, days: number, signal?: AbortSignal): Promise<InsiderTrade[]> {
  const r = await fetch(`${API_URL}/insider/us?ticker=${encodeURIComponent(ticker)}&days=${days}`, { signal });
  return handleResponse<InsiderTrade[]>(r);
}

export async function getInsiderUSRecent(days: number, maxFilings: number, signal?: AbortSignal): Promise<InsiderTrade[]> {
  const r = await fetch(`${API_URL}/insider/us/recent?days=${days}&max_filings=${maxFilings}`, { signal });
  return handleResponse<InsiderTrade[]>(r);
}

export async function getInsiderKRRecent(days: number, maxCorps: number, signal?: AbortSignal): Promise<InsiderTrade[]> {
  const r = await fetch(`${API_URL}/insider/kr/recent?days=${days}&max_corps=${maxCorps}`, { signal });
  return handleResponse<InsiderTrade[]>(r);
}

export interface CongressTrade {
  chamber: "senate" | "house";
  trade_date: string;
  disclosure_date: string;
  reporter: string;
  district?: string | null;
  owner?: string | null;
  ticker?: string | null;
  asset?: string | null;
  trade_type: "BUY" | "SELL" | "OTHER";
  amount?: string | null;
  link?: string | null;
}

export async function getInsiderCongress(limit = 80, signal?: AbortSignal): Promise<CongressTrade[]> {
  const r = await fetch(`${API_URL}/insider/congress?limit=${limit}`, { signal });
  return handleResponse<CongressTrade[]>(r);
}

export interface GovContract {
  recipient: string;
  amount: number;
  agency?: string | null;
  description?: string | null;
  start_date?: string | null;
  award_id?: string | null;
}

export async function getGovContracts(days = 30, limit = 40, signal?: AbortSignal): Promise<GovContract[]> {
  const r = await fetch(`${API_URL}/insider/gov-contracts?days=${days}&limit=${limit}`, { signal });
  return handleResponse<GovContract[]>(r);
}

// ── Copy-Trade Autopilot (페이퍼) ────────────────────────────────────────────────

export interface CopySignal {
  source: string; name: string; role?: string | null;
  ticker: string; trade_type: string; date: string;
  disclosed?: string | null; amount?: string | null; link?: string | null;
}

export interface CopyPosition {
  ticker: string; qty: number; avg_price: number; current: number;
  market_value: number; unrealized_pl: number; unrealized_plpc: number;
}

// ── 성과 추적 ────────────────────────────────────────────────────────────────────

export interface PerfPoint { date: string; equity: number; benchmark?: number | null; }
export interface PerfSummary {
  points: PerfPoint[];
  return_pct: number; mdd_pct: number; sharpe: number;
  benchmark_return_pct?: number | null; excess_pct?: number | null;
  start_equity: number; end_equity: number;
}
export async function getPerformance(period = "1M", signal?: AbortSignal): Promise<PerfSummary> {
  const r = await fetch(`${API_URL}/performance/portfolio?period=${period}`, { signal });
  return handleResponse<PerfSummary>(r);
}

// ── DART 기업행위 오토파일럿 ─────────────────────────────────────────────────────

export interface DartSignal {
  corp_name: string; ticker?: string | null;
  action_type: string; action_label: string;
  verdict: string; note: string; weight: number; date: string; dart_url?: string | null;
}
export interface DartPosition {
  code: string; name: string; qty: number;
  avg_price: number; current: number; return_pct?: number | null;
}

export async function getDartSignals(days = 14, signal?: AbortSignal): Promise<DartSignal[]> {
  const r = await fetch(`${API_URL}/dart/signals?days=${days}`, { signal });
  return handleResponse<DartSignal[]>(r);
}
export async function getDartPositions(signal?: AbortSignal): Promise<DartPosition[]> {
  const r = await fetch(`${API_URL}/dart/positions`, { signal });
  return handleResponse<DartPosition[]>(r);
}
export interface DartBotLog {
  ts: string; kind: string; corp?: string; code?: string;
  action?: string; qty?: number; price?: number; msg?: string;
}
export interface DartBotStatus {
  enabled: boolean; budget: number; interval_sec: number;
  last_run: string | null; market_open: boolean; acted_count: number; log: DartBotLog[];
}
export async function getDartBotStatus(signal?: AbortSignal): Promise<DartBotStatus> {
  const r = await fetch(`${API_URL}/dart/auto/status`, { signal });
  return handleResponse<DartBotStatus>(r);
}
export async function setDartBotConfig(cfg: { enabled?: boolean; budget?: number; interval_sec?: number }): Promise<{ ok: boolean }> {
  const r = await fetch(`${API_URL}/dart/auto/config`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg),
  });
  return handleResponse(r);
}

export async function mirrorDart(code: string, krw: number): Promise<{ code: string; qty: number; price: number; status: string }> {
  const r = await fetch(`${API_URL}/dart/mirror`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, krw }),
  });
  return handleResponse(r);
}

export interface TraderHolding {
  ticker: string; date: string;
  entry?: number | null; current?: number | null; return_pct?: number | null;
}
export interface TraderCard {
  source: string; name: string; role?: string | null; initials: string;
  num_buys: number; avg_return_pct?: number | null; holdings: TraderHolding[];
}

export async function getCopyTraders(limit = 120, signal?: AbortSignal): Promise<TraderCard[]> {
  const r = await fetch(`${API_URL}/copytrade/traders?limit=${limit}`, { signal });
  return handleResponse<TraderCard[]>(r);
}

export async function getCopySignals(limit = 60, signal?: AbortSignal): Promise<CopySignal[]> {
  const r = await fetch(`${API_URL}/copytrade/signals?limit=${limit}`, { signal });
  return handleResponse<CopySignal[]>(r);
}

export async function getCopyPositions(signal?: AbortSignal): Promise<CopyPosition[]> {
  const r = await fetch(`${API_URL}/copytrade/positions`, { signal });
  return handleResponse<CopyPosition[]>(r);
}

export async function mirrorCopyTrade(ticker: string, notional: number): Promise<{ order_id: string; ticker: string; notional: number; status: string }> {
  const r = await fetch(`${API_URL}/copytrade/mirror`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, notional }),
  });
  return handleResponse(r);
}

// ── Economic Calendar ──────────────────────────────────────────────────────────

export interface EconomicEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
}

export async function getEconomicCalendar(week: "this" | "next", signal?: AbortSignal): Promise<EconomicEvent[]> {
  const r = await fetch(`${API_URL}/calendar/economic?week=${week}`, { signal });
  return handleResponse<EconomicEvent[]>(r);
}

// ── Fear & Greed ───────────────────────────────────────────────────────────────

export interface FearGreedResponse {
  value: number;
  classification: string;
  timestamp: string;
}

export async function getFearGreed(signal?: AbortSignal): Promise<FearGreedResponse> {
  const r = await fetch(`${API_URL}/macro/fear-greed`, { signal });
  return handleResponse<FearGreedResponse>(r);
}

// ── News ───────────────────────────────────────────────────────────────────────

export interface NewsItem {
  id: number | string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  category: string;
  related: string | null;
  image: string | null;
}

export async function getMarketNews(category = "general", signal?: AbortSignal): Promise<NewsItem[]> {
  const r = await fetch(`${API_URL}/news/market?category=${encodeURIComponent(category)}`, { signal });
  return handleResponse<NewsItem[]>(r);
}

export async function getCompanyNews(ticker: string, days = 7, signal?: AbortSignal): Promise<NewsItem[]> {
  const r = await fetch(`${API_URL}/news/company?ticker=${encodeURIComponent(ticker)}&days=${days}`, { signal });
  return handleResponse<NewsItem[]>(r);
}

// ── Screener ───────────────────────────────────────────────────────────────────

export interface ScreenerResult {
  instrument_id: string;
  last_price: number;
  rsi14: number | null;
  ema12: number | null;
  ema26: number | null;
  ema_signal: "bullish_cross" | "bearish_cross" | "above" | "below" | "neutral";
  change_pct: number | null;
}

export async function runScreener(params: {
  instruments: string;
  rsi_min?: number;
  rsi_max?: number;
  ema_signal?: string;
  days?: number;
}, signal?: AbortSignal): Promise<ScreenerResult[]> {
  const q = new URLSearchParams({ instruments: params.instruments });
  if (params.rsi_min != null) q.set("rsi_min", String(params.rsi_min));
  if (params.rsi_max != null) q.set("rsi_max", String(params.rsi_max));
  if (params.ema_signal) q.set("ema_signal", params.ema_signal);
  if (params.days != null) q.set("days", String(params.days));
  const r = await fetch(`${API_URL}/screener?${q}`, { signal });
  return handleResponse<ScreenerResult[]>(r);
}

// ── Hyperliquid Trading ────────────────────────────────────────────────────────

export interface HLAssetPosition {
  position: {
    coin: string;
    szi: string;        // signed size
    entryPx: string | null;
    positionValue: string;
    unrealizedPnl: string;
    leverage: { type: string; value: number };
    liquidationPx: string | null;
    returnOnEquity: string;
    maxLeverage: number;
  };
  type: string;
}

export interface HLMarginSummary {
  accountValue: string;
  totalNtlPos: string;
  totalRawUsd: string;
  totalMarginUsed: string;
}

export interface HLOpenOrder {
  coin: string;
  oid: number;
  side: string;
  limitPx: string;
  sz: string;
  timestamp: number;
  origSz: string;
}

export interface HLPositionsResponse {
  address: string;
  margin_summary: HLMarginSummary;
  cross_margin_summary: HLMarginSummary;
  asset_positions: HLAssetPosition[];
  open_orders: HLOpenOrder[];
}

export interface HLOrderRequest {
  coin: string;
  is_buy: boolean;
  size: number;
  order_type?: "market" | "limit";
  limit_px?: number;
  reduce_only?: boolean;
  slippage?: number;
  paper?: boolean;
}

export async function getHLPositions(paper = false, signal?: AbortSignal): Promise<HLPositionsResponse> {
  const r = await fetch(`${API_URL}/hl/positions?paper=${paper}`, { signal });
  return handleResponse<HLPositionsResponse>(r);
}

export async function placeHLOrder(req: HLOrderRequest, signal?: AbortSignal): Promise<{ status: string; paper: boolean; result: unknown }> {
  const r = await fetch(`${API_URL}/hl/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  return handleResponse(r);
}

export async function cancelHLOrder(coin: string, oid: number, paper = false, signal?: AbortSignal): Promise<{ status: string; result: unknown }> {
  const r = await fetch(`${API_URL}/hl/order/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coin, oid, paper }),
    signal,
  });
  return handleResponse(r);
}

export async function closeHLPosition(coin: string, size?: number, slippage = 0.05, paper = false, signal?: AbortSignal): Promise<{ status: string; result: unknown }> {
  const r = await fetch(`${API_URL}/hl/order/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coin, size: size ?? null, slippage, paper }),
    signal,
  });
  return handleResponse(r);
}

// ── CVaR / Expected Shortfall ─────────────────────────────────────────────────
export interface CVaRResponse {
  var_95: number; cvar_95: number;
  var_99: number; cvar_99: number;
}
export async function getCVaR(instrumentId: string, start: string, end: string, signal?: AbortSignal): Promise<CVaRResponse> {
  const r = await fetch(`${API_URL}/cvar?instrument_id=${encodeURIComponent(instrumentId)}&start=${start}&end=${end}`, { signal });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json();
}

// ── Hurst Exponent ────────────────────────────────────────────────────────────
export interface HurstResponse {
  hurst: number; interpretation: string; lags: number[]; rs_values: number[];
}
export async function getHurst(instrumentId: string, start: string, end: string, signal?: AbortSignal): Promise<HurstResponse> {
  const r = await fetch(`${API_URL}/hurst?instrument_id=${encodeURIComponent(instrumentId)}&start=${start}&end=${end}`, { signal });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json();
}

// ── Statistical Tests ─────────────────────────────────────────────────────────
export interface StatTestsResponse {
  adf: { statistic: number; pvalue: number; is_stationary: boolean; critical_values: Record<string, number>; interpretation: string };
  ljung_box: { statistic: number; pvalue: number; lags: number; is_autocorrelated: boolean; interpretation: string };
  jarque_bera: { statistic: number; pvalue: number; is_normal: boolean; skewness: number; excess_kurtosis: number; interpretation: string };
}
export async function getStatTests(instrumentId: string, start: string, end: string, signal?: AbortSignal): Promise<StatTestsResponse> {
  const r = await fetch(`${API_URL}/stat-tests?instrument_id=${encodeURIComponent(instrumentId)}&start=${start}&end=${end}`, { signal });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json();
}

// ── Kelly Criterion ───────────────────────────────────────────────────────────
export interface KellyResponse {
  kelly_full: number; kelly_half: number; kelly_quarter: number;
  win_rate: number; avg_win: number; avg_loss: number;
  win_loss_ratio: number; expected_value: number;
}
export async function getKelly(instrumentId: string, start: string, end: string, signal?: AbortSignal): Promise<KellyResponse> {
  const r = await fetch(`${API_URL}/kelly?instrument_id=${encodeURIComponent(instrumentId)}&start=${start}&end=${end}`, { signal });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json();
}

// ── VWAP / TWAP ───────────────────────────────────────────────────────────────
export interface VWAPResponse {
  vwap: number; twap: number; current_price: number;
  vwap_deviation_pct: number; twap_deviation_pct: number;
  total_volume: number; n_bars: number;
}
export async function getVWAP(instrumentId: string, start: string, end: string, signal?: AbortSignal): Promise<VWAPResponse> {
  const r = await fetch(`${API_URL}/vwap?instrument_id=${encodeURIComponent(instrumentId)}&start=${start}&end=${end}`, { signal });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json();
}

// ── GBM Monte Carlo ───────────────────────────────────────────────────────────
export interface GBMResponse {
  model: string; day_indices: number[];
  paths: { p5: number[]; p25: number[]; p50: number[]; p75: number[]; p95: number[] };
  prob_profit: number; prob_loss_20pct: number;
  terminal_p5: number; terminal_p25: number; terminal_median: number;
  terminal_p75: number; terminal_p95: number;
  ann_return_mean: number; ann_return_p5: number; ann_return_p95: number;
  mu_daily: number; sigma_daily: number; ito_drift_correction: number;
}
export async function getGBMMonteCarlo(instrumentId: string, start: string, end: string, horizonDays = 252, nSimulations = 1000, signal?: AbortSignal): Promise<GBMResponse> {
  const r = await fetch(`${API_URL}/monte-carlo-gbm?instrument_id=${encodeURIComponent(instrumentId)}&start=${start}&end=${end}&horizon_days=${horizonDays}&n_simulations=${nSimulations}`, { signal });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json();
}

// ── HMM Regime ────────────────────────────────────────────────────────────────
export interface HMMRegimeResponse {
  method: string; current_regime: string; n_components: number;
  regime_distribution: Record<string, number>;
  transition_matrix: number[][];
  state_means: number[]; state_vols: number[];
}
export async function getHMMRegime(instrumentId: string, start: string, end: string, nComponents = 2, signal?: AbortSignal): Promise<HMMRegimeResponse> {
  const r = await fetch(`${API_URL}/regime-hmm?instrument_id=${encodeURIComponent(instrumentId)}&start=${start}&end=${end}&n_components=${nComponents}`, { signal });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json();
}

// ── Pairs Trading / Cointegration ─────────────────────────────────────────────
export interface PairsResponse {
  cointegrated: boolean; eg_pvalue: number; eg_tstat: number;
  johansen_trace_stat: number; johansen_crit_95: number; johansen_cointegrated: boolean;
  hedge_ratio: number; intercept: number; half_life_days: number;
  spread: number[]; zscore: number[]; signals: string[];
  spread_mean: number; spread_std: number;
  n_buy_signals: number; n_sell_signals: number;
}
export async function getPairsTrading(instrumentA: string, instrumentB: string, start: string, end: string, signal?: AbortSignal): Promise<PairsResponse> {
  const r = await fetch(`${API_URL}/pairs?instrument_a=${encodeURIComponent(instrumentA)}&instrument_b=${encodeURIComponent(instrumentB)}&start=${start}&end=${end}`, { signal });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json();
}

// ── Stress Testing ────────────────────────────────────────────────────────────
export interface StressScenario {
  name: string; period: string; description: string;
  market_return: number; portfolio_impact: number; var_stressed: number; vol_spike_factor: number;
}
export interface StressTestResponse {
  beta_used: number; current_vol_ann: number; current_var95_daily: number;
  scenarios: StressScenario[];
}
export async function getStressTest(instrumentId: string, start: string, end: string, beta = 1.0, signal?: AbortSignal): Promise<StressTestResponse> {
  const r = await fetch(`${API_URL}/stress-test?instrument_id=${encodeURIComponent(instrumentId)}&start=${start}&end=${end}&beta=${beta}`, { signal });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json();
}

// ── Risk Parity ───────────────────────────────────────────────────────────────
export interface RiskParityResponse {
  weights: Record<string, number>; risk_contribution: Record<string, number>;
  expected_return: number; expected_vol: number; sharpe: number; converged: boolean;
}
export async function getRiskParity(instrumentIds: string[], start: string, end: string, signal?: AbortSignal): Promise<RiskParityResponse> {
  const r = await fetch(`${API_URL}/risk-parity?instrument_ids=${encodeURIComponent(instrumentIds.join(","))}&start=${start}&end=${end}`, { signal });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json();
}

// ── Black-Litterman ───────────────────────────────────────────────────────────
export interface BLView { instrument: string; expected_return: number; confidence: number; }
export interface BlackLittermanResponse {
  model: string;
  weights: Record<string, number>;
  expected_return: number; expected_vol: number; sharpe: number; converged: boolean;
  prior_returns?: Record<string, number>; posterior_returns?: Record<string, number>;
}
export async function getBlackLitterman(instrumentIds: string[], start: string, end: string, views: BLView[], tau = 0.05, riskAversion = 2.5, signal?: AbortSignal): Promise<BlackLittermanResponse> {
  const r = await fetch(`${API_URL}/black-litterman`, {
    method: "POST", signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instrument_ids: instrumentIds, start, end, views, tau, risk_aversion: riskAversion }),
  });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json();
}

// ── Fama-French Factor Attribution ────────────────────────────────────────────
export interface FactorAttributionResponse {
  model: string; alpha: number | null; alpha_pvalue: number | null;
  mkt_rf: number | null; mkt_rf_pvalue: number | null;
  smb: number | null; smb_pvalue: number | null;
  hml: number | null; hml_pvalue: number | null;
  r_squared: number | null; obs: number | null;
  dates?: string[]; factor_contributions?: Record<string, number[]>;
  error?: string;
}
export async function getFactorAttribution(instrumentId: string, start: string, end: string, signal?: AbortSignal): Promise<FactorAttributionResponse> {
  const r = await fetch(`${API_URL}/factor-attribution?instrument_id=${encodeURIComponent(instrumentId)}&start=${start}&end=${end}`, { signal });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json();
}

// ── Alpaca Autopilot ─────────────────────────────────────────────────────────
export interface AlpacaAccount {
  equity: number;
  buying_power: number;
  cash: number;
  portfolio_value: number;
  paper: boolean;
}

export interface AlpacaPosition {
  symbol: string;
  qty: number;
  avg_entry_price: number;
  current_price: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  market_value: number;
  side: string;
}

export interface AlpacaOrder {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  filled_qty: number;
  status: string;
  filled_avg_price: number | null;
  created_at: string;
}

export interface AlpacaContext {
  symbol: string;
  timestamp: string;
  price: { current: number; open: number; high: number; low: number };
  technicals: { rsi_14: number; macd: number; macd_signal: number; macd_hist: number; volume_ratio: number };
  bars_5min: { t: string; o: number; h: number; l: number; c: number; v: number }[];
  news: { headline: string; summary: string; datetime: string; source: string }[];
  position: { qty: number; avg_price: number; unrealized_pl: number; unrealized_plpc: number } | null;
  account: { equity: number; buying_power: number; cash: number };
}

export async function getAlpacaAccount(signal?: AbortSignal): Promise<AlpacaAccount> {
  return handleResponse<AlpacaAccount>(await fetch(`${API_URL}/alpaca/account`, { signal }));
}

export async function getAlpacaPositions(signal?: AbortSignal): Promise<AlpacaPosition[]> {
  return handleResponse<AlpacaPosition[]>(await fetch(`${API_URL}/alpaca/positions`, { signal }));
}

export async function getAlpacaOrders(signal?: AbortSignal): Promise<AlpacaOrder[]> {
  return handleResponse<AlpacaOrder[]>(await fetch(`${API_URL}/alpaca/orders`, { signal }));
}

export async function getAlpacaContext(symbol: string, signal?: AbortSignal): Promise<AlpacaContext> {
  return handleResponse<AlpacaContext>(await fetch(`${API_URL}/alpaca/context/${encodeURIComponent(symbol)}`, { signal }));
}

export async function placeAlpacaOrder(params: { symbol: string; side: "buy" | "sell"; qty: number; paper?: boolean }, signal?: AbortSignal): Promise<AlpacaOrder> {
  return handleResponse<AlpacaOrder>(await fetch(`${API_URL}/alpaca/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal,
  }));
}

export async function cancelAlpacaOrder(orderId: string, signal?: AbortSignal): Promise<void> {
  await handleResponse<void>(await fetch(`${API_URL}/alpaca/order/${orderId}`, { method: "DELETE", signal }));
}

export interface MarketOverviewData {
  sp500:  { value: number | null; change_pct: number | null };
  nasdaq: { value: number | null; change_pct: number | null };
  usdkrw: { value: number | null; change_pct: number | null };
  btcusd: { value: number | null; change_pct: number | null };
  vix:    { value: number | null; change_pct: number | null };
  gold:   { value: number | null; change_pct: number | null };
}

export async function getMarketOverview(signal?: AbortSignal): Promise<MarketOverviewData> {
  return handleResponse<MarketOverviewData>(await fetch(`${API_URL}/market-overview`, { signal }));
}

export async function initiateShutdown(signal?: AbortSignal): Promise<{ status: string }> {
  return handleResponse(await fetch(`${API_URL}/alpaca/shutdown/initiate`, { method: "POST", signal }));
}

export async function getShutdownStatus(signal?: AbortSignal): Promise<{ done: boolean; recent_lines: string[] }> {
  return handleResponse(await fetch(`${API_URL}/alpaca/shutdown/status`, { signal }));
}

export async function executeShutdown(signal?: AbortSignal): Promise<{ status: string }> {
  return handleResponse(await fetch(`${API_URL}/alpaca/shutdown/execute`, { method: "POST", signal }));
}

export interface FGMarket { value: number; classification: string; }
export interface FGMarketsResponse { crypto: FGMarket; us: FGMarket; kr: FGMarket; }

export async function getFGMarkets(signal?: AbortSignal): Promise<FGMarketsResponse> {
  return handleResponse<FGMarketsResponse>(await fetch(`${API_URL}/macro/fear-greed/markets`, { signal }));
}

export interface GroqStockPick { symbol: string; direction: "up" | "down"; }
export interface GroqSummaryResult { summary: string; picks: GroqStockPick[]; }

export async function getGroqSummary(
  content: string,
  mode: "news" | "calendar",
  signal?: AbortSignal,
): Promise<GroqSummaryResult> {
  return handleResponse<GroqSummaryResult>(
    await fetch(`${API_URL}/groq/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, mode }),
      signal,
    }),
  );
}
