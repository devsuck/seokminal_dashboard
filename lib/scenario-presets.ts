export interface ScenarioPreset {
  id: string;
  label: string;
  start: string;
  end: string;
  description: string;
}

export const SCENARIOS: ScenarioPreset[] = [
  {
    id: "gfc",
    label: "2008 Financial Crisis",
    start: "2007-10-01",
    end: "2009-03-31",
    description: "Lehman collapse, global credit freeze",
  },
  {
    id: "covid",
    label: "COVID Crash",
    start: "2020-02-01",
    end: "2020-04-30",
    description: "Fastest 30% drawdown in history",
  },
  {
    id: "dotcom",
    label: "Dot-com Bubble",
    start: "2000-03-01",
    end: "2002-10-31",
    description: "NASDAQ -78% peak to trough",
  },
  {
    id: "ukraine",
    label: "Ukraine War",
    start: "2022-02-01",
    end: "2022-06-30",
    description: "Commodity shock + rate hike cycle",
  },
  {
    id: "inflation",
    label: "Inflation Cycle",
    start: "2021-03-01",
    end: "2023-06-30",
    description: "CPI surge 2.5% → 9.1% → 3%",
  },
  {
    id: "highrate",
    label: "High Rate Period",
    start: "2022-03-01",
    end: "2024-01-01",
    description: "Fed funds 0.25% → 5.5%",
  },
  {
    id: "bull2017",
    label: "Bull Market 2017",
    start: "2017-01-01",
    end: "2017-12-31",
    description: "S&P +21.8%, low volatility",
  },
  {
    id: "bear2022",
    label: "Bear Market 2022",
    start: "2022-01-01",
    end: "2022-12-31",
    description: "S&P -19.4%, stocks and bonds fell together",
  },
];

export function findScenario(id: string): ScenarioPreset | undefined {
  return SCENARIOS.find(s => s.id === id);
}
