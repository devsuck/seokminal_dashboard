import type { TimeSeriesPoint } from "@/lib/api";

export interface AttributionInput {
  instrumentId: string;
  weight: number;
}

export interface InstrumentAttribution {
  instrumentId: string;
  weight: number;
  totalReturn: number;
  contribution: number;
}

export interface PortfolioAttribution {
  portfolioReturn: number;
  instruments: InstrumentAttribution[];
}

export function computeAttribution(
  inputs: AttributionInput[],
  seriesMap: Record<string, TimeSeriesPoint[]>,
): PortfolioAttribution {
  if (inputs.length === 0) {
    return { portfolioReturn: 0, instruments: [] };
  }
  const instruments: InstrumentAttribution[] = inputs.map(({ instrumentId, weight }) => {
    const points = seriesMap[instrumentId] ?? [];
    const totalReturn = points.length > 0 ? points[points.length - 1].cumulative_return : 0;
    return { instrumentId, weight, totalReturn, contribution: weight * totalReturn };
  });
  instruments.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const portfolioReturn = instruments.reduce((s, i) => s + i.contribution, 0);
  return { portfolioReturn, instruments };
}
