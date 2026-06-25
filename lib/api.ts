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

export interface BacktestResponse {
  sharpe_ratio: number | null;
  max_drawdown: number | null;
  total_pnl: number | null;
  total_pnl_pct: number | null;
  bar_count: number;
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
  end: string
): Promise<BarsResponse> {
  const params = new URLSearchParams({
    instrument_id: instrumentId,
    start,
    end,
  });
  const response = await fetch(`${API_URL}/bars?${params.toString()}`);
  return handleResponse<BarsResponse>(response);
}

export async function getBacktest(
  instrumentId: string,
  start: string,
  end: string,
  fast: number,
  slow: number
): Promise<BacktestResponse> {
  const params = new URLSearchParams({
    instrument_id: instrumentId,
    start,
    end,
    strategy: "ema_cross",
    fast: String(fast),
    slow: String(slow),
  });
  const response = await fetch(`${API_URL}/backtest?${params.toString()}`);
  return handleResponse<BacktestResponse>(response);
}
