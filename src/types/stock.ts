export type AssetClass = 'domestic' | 'us' | 'trust' | 'foreignCash' | 'goldPlatinum';

export type Stock = {
  code: string;
  name: string;
  sector: string;
  shares: number;
  avgCost: number | null;
  latestPrice: number | null;
  dividendPerShare: number | null;
  lastUpdated: string;
  account?: string;
  dividendManuallySet?: boolean;
  checked?: boolean;             // true = 特定口座, false/undefined = NISA
  excluded?: boolean;            // true = グラフ分析から除外
  lion?: boolean;                // true = 🦁 学長高配当マガジン掲載銘柄
  lionManuallySet?: boolean;     // true = ユーザーが手動でトグル済み（自動付与を上書きしない）
  defensive?: boolean;           // true = 🛡️ ディフェンシブ銘柄
  defensiveManuallySet?: boolean; // true = ユーザーが手動でトグル済み（自動付与を上書きしない）
  // 資産クラス（undefined = 'domestic' として後方互換）
  assetClass?: AssetClass;
  foreignCurrency?: string;      // 'USD', 'EUR' など（米国株・外貨預り金）
  foreignAmount?: number;        // 外貨建て合計額（表示用アノテーション）
};

export type SortKey = keyof Stock | 'purchaseAmount' | 'marketValue' | 'profitLoss' | 'profitLossPct' | 'dividendTotal' | 'dividendYieldPrice' | 'dividendYieldCost' | 'marketValueRatio' | 'dividendRatio' | 'sectorRatio';

export type SortOrder = 'asc' | 'desc';

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  domestic: '国内株式',
  us: '米国株式',
  trust: '投資信託',
  foreignCash: '外貨預り金',
  goldPlatinum: '金・プラチナ',
};
