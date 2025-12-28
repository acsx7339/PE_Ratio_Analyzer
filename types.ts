
export interface StockInfo {
  ticker: string;
  name: string;
  currentPrice: number;
  bvps: number;
  pb25: number;
  pb50: number;
  pb75: number;
  pb90: number;
  currency: string;
  dividendYield?: number;
  consecutiveDividendYears?: number;
  isProfitable?: boolean;
  roe: number;
  avgRoe3Y?: number;
  isRoeStable?: boolean;
  averageVolume20d: number;
  isLiquid: boolean;
}

export interface ChartPoint {
  date: string;
  price: number;
  river25: number;
  river50: number;
  river75: number;
  river90: number;
}

export interface AnalysisNarrative {
  conflictReason: string;
  story: {
    protagonist: string;
    events: string;
    actions: string;
  };
  outlook: string;
}

export interface AnalysisResult {
  stock: StockInfo;
  chartData: ChartPoint[];
  status: 'cheap' | 'fair' | 'expensive' | 'overvalued';
  currentPB: number;
  safetyScore: 'high' | 'medium' | 'low';
  narrative: AnalysisNarrative;
}

export interface ScannerResult {
  ticker: string;
  name: string;
  currentPrice: number;
  currentPB: number;
  greenThreshold: number; 
  gapToThreshold: number; 
  isGreenZone: boolean;
  dividendYield: number;
  consecutiveYears: number;
  roe: number; 
  avgRoe3Y: number; 
  eps: number;
  epsGrowth: number;
  isRoeStable: boolean;
  averageVolume20d: number;
  isLiquid: boolean;
  isSafe: boolean; 
  isLongTermInvest: boolean;
  retailCountCurrent: number;
  retailCountPrevious: number;
  isRetailDecreasing: boolean;
  monthlyTrendDesc: string; // 月線收斂狀態說明
  dailyPullbackDesc: string; // 日線拉回狀態說明
}

export interface MarketResult {
  ticker: string;
  name: string;
  currentPrice: number;
  priceLevel: number; 
  deviationFromYearly: number; 
  deviationFromQuarterly: number; 
  drawdownFromHigh: number; 
  dividendYield: number;
  status: 'crisis_buy' | 'bull_pullback' | 'neutral' | 'overheated';
  signal: string;
  description: string;
}

export interface SectorHeat {
  name: string;
  intensity: number; // 0-100
  reason: string;
}

export interface MarketPulse {
  trendSummary: string; // 整體市場氣氛總結
  hotSectors: SectorHeat[]; // 熱門板塊列表
}

export interface NewsItem {
  title: string;
  summary: string;
  category: 'Hype' | 'Chips' | 'Community' | 'Event' | 'Policy';
  sentiment: 'positive' | 'negative' | 'neutral';
  impactLevel: 'high' | 'medium' | 'low';
  relatedTickers: string[];
  keywords: string[];
}

export interface NewsResponse {
  news: NewsItem[];
  pulse: MarketPulse;
}

export const FINANCIAL_STOCKS = [
  '2881', '2882', '2891', '2886', '2884', '2892', '2880', '2885', '2883', '2890', 
  '2887', '2888', '5880', '2889', '2834', '2812', '2838', '2845', '2897', '5876', 
  '2850', '2851', '6005'
];

export const MARKET_TICKERS = [
  '^TWII', '0050.TW', '0056.TW', '006208.TW', '00878.TW'
];
