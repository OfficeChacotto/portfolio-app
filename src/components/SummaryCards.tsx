import type { Stock } from '../types/stock';

interface Props {
  stocks: Stock[];
}

function fmt(n: number | null, digits = 0): string {
  if (n === null || isNaN(n)) return '—';
  return n.toLocaleString('ja-JP', { maximumFractionDigits: digits });
}

function fmtPct(n: number | null): string {
  if (n === null || isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

const TOKUTEI_TAX_RATE = 0.20315;

function calcMV(s: Stock): number {
  return s.latestPrice !== null ? s.latestPrice * s.shares : 0;
}
function calcPurchase(s: Stock): number {
  return s.avgCost !== null ? s.avgCost * s.shares : 0;
}

export default function SummaryCards({ stocks }: Props) {
  // ---- 国内株式（undefined も domestic 扱い）----
  const domesticStocks = stocks.filter(s => !s.assetClass || s.assetClass === 'domestic');
  const usStocks = stocks.filter(s => s.assetClass === 'us');

  const totalMarketValue = stocks.reduce((sum, s) => sum + calcMV(s), 0);
  const totalPurchase = stocks.reduce((sum, s) => sum + calcPurchase(s), 0);

  // 総損益: 銘柄一覧の損益合計と一致するよう latestPrice・avgCost 両方揃った銘柄のみ集計
  const totalProfitLoss = stocks.reduce((sum, s) => {
    if (s.latestPrice === null || s.avgCost === null) return sum;
    return sum + (s.latestPrice - s.avgCost) * s.shares;
  }, 0);
  const plBase = stocks.reduce((sum, s) => {
    if (s.latestPrice === null || s.avgCost === null) return sum;
    return sum + s.avgCost * s.shares;
  }, 0);
  const profitLossPct = plBase > 0 ? (totalProfitLoss / plBase) * 100 : null;

  // 購入額の内訳（国内・米国）
  const domesticPurchaseTotal = domesticStocks.reduce((sum, s) => sum + calcPurchase(s), 0);
  const usPurchaseTotal = usStocks.reduce((sum, s) => sum + calcPurchase(s), 0);

  // 損益の内訳（国内・米国）: 両方揃った銘柄のみ
  const calcPL = (list: Stock[]) => list.reduce((sum, s) => {
    if (s.latestPrice === null || s.avgCost === null) return sum;
    return sum + (s.latestPrice - s.avgCost) * s.shares;
  }, 0);
  const domesticPL = calcPL(domesticStocks);
  const usPL = calcPL(usStocks);
  const domesticPLValid = domesticStocks.some(s => s.latestPrice !== null && s.avgCost !== null);
  const usPLValid = usStocks.some(s => s.latestPrice !== null && s.avgCost !== null);

  // 配当: 国内株式 + 配当単価が設定されている米国株式
  const dividendStocks = stocks.filter((s) => s.dividendPerShare !== null);
  const totalDividend = dividendStocks.reduce((sum, s) => {
    return sum + (s.dividendPerShare !== null ? s.dividendPerShare * s.shares : 0);
  }, 0);
  const totalDividendAfterTax = dividendStocks.reduce((sum, s) => {
    const d = s.dividendPerShare !== null ? s.dividendPerShare * s.shares : 0;
    return sum + (s.checked ? d * (1 - TOKUTEI_TAX_RATE) : d);
  }, 0);

  // 平均配当利回り: 国内株式ベース
  const domesticDividend = domesticStocks.reduce((sum, s) => {
    return sum + (s.dividendPerShare !== null ? s.dividendPerShare * s.shares : 0);
  }, 0);
  const domesticMV = domesticStocks.reduce((sum, s) => sum + calcMV(s), 0);
  const avgYield = domesticMV > 0 ? (domesticDividend / domesticMV) * 100 : null;
  const domesticPurchase = domesticStocks.reduce((sum, s) => sum + calcPurchase(s), 0);
  const avgYieldCost = domesticPurchase > 0 ? (domesticDividend / domesticPurchase) * 100 : null;

  // ---- ディフェンシブ比率（shares > 0 のみ） ----
  const activeStocks = stocks.filter((s) => s.shares > 0);
  const defensiveStocks = activeStocks.filter((s) => s.defensive);
  const hasDefensive = defensiveStocks.length > 0;

  const defensivePurchase = defensiveStocks.reduce((sum, s) => sum + calcPurchase(s), 0);
  const totalPurchaseActive = activeStocks.reduce((sum, s) => sum + calcPurchase(s), 0);
  const defensivePurchaseRatio = totalPurchaseActive > 0 ? (defensivePurchase / totalPurchaseActive) * 100 : null;

  const defensiveMarket = defensiveStocks.reduce((sum, s) => sum + calcMV(s), 0);
  const totalMarketActive = activeStocks.reduce((sum, s) => sum + calcMV(s), 0);
  const defensiveMarketRatio = totalMarketActive > 0 ? (defensiveMarket / totalMarketActive) * 100 : null;

  const calcAfterTaxDiv = (s: Stock) => {
    const d = (s.dividendPerShare ?? 0) * s.shares;
    return s.checked ? d * (1 - TOKUTEI_TAX_RATE) : d;
  };
  const defensiveDivAfterTax = defensiveStocks.reduce((sum, s) => sum + calcAfterTaxDiv(s), 0);
  const totalDivAfterTaxActive = activeStocks.reduce((sum, s) => sum + calcAfterTaxDiv(s), 0);
  const defensiveDivRatio = totalDivAfterTaxActive > 0 ? (defensiveDivAfterTax / totalDivAfterTaxActive) * 100 : null;

  // ---- 資産クラス別合計 ----
  const usMV = stocks.filter(s => s.assetClass === 'us').reduce((sum, s) => sum + calcMV(s), 0);
  const trustMV = stocks.filter(s => s.assetClass === 'trust').reduce((sum, s) => sum + calcMV(s), 0);
  const fxMV = stocks.filter(s => s.assetClass === 'foreignCash').reduce((sum, s) => sum + calcMV(s), 0);
  const goldMV = stocks.filter(s => s.assetClass === 'goldPlatinum').reduce((sum, s) => sum + calcMV(s), 0);
  const hasNonDomestic = usMV > 0 || trustMV > 0 || fxMV > 0 || goldMV > 0;

  // カラーマップ
  const colorMap: Record<string, string> = {
    blue:   'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700',
    gray:   'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    green:  'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700',
    red:    'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700',
    purple: 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700',
    teal:   'bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-700',
  };
  const textColorMap: Record<string, string> = {
    blue:   'text-blue-700 dark:text-blue-300',
    gray:   'text-gray-700 dark:text-gray-300',
    green:  'text-green-700 dark:text-green-300',
    red:    'text-red-700 dark:text-red-300',
    yellow: 'text-yellow-700 dark:text-yellow-300',
    purple: 'text-purple-700 dark:text-purple-300',
    teal:   'text-teal-700 dark:text-teal-300',
  };

  const assetClassCards = [
    { label: '国内株式', value: domesticMV, bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-300' },
    { label: '米国株式', value: usMV,       bg: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700', text: 'text-indigo-700 dark:text-indigo-300' },
    { label: '投資信託', value: trustMV,    bg: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700', text: 'text-violet-700 dark:text-violet-300' },
    { label: '外貨預り金', value: fxMV,     bg: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-700', text: 'text-cyan-700 dark:text-cyan-300' },
    { label: '金・プラチナ', value: goldMV, bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700', text: 'text-yellow-700 dark:text-yellow-300' },
    { label: '資産合計', value: totalMarketValue, bg: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600', text: 'text-gray-800 dark:text-gray-100', bold: true },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* 総評価額 */}
        <div className={`rounded-xl border p-4 ${colorMap['blue']}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">総評価額</p>
          <p className={`text-xl font-bold ${textColorMap['blue']}`}>¥{fmt(totalMarketValue)}</p>
        </div>

        {/* 総購入額 */}
        <div className={`rounded-xl border p-4 ${colorMap['gray']}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">総購入額</p>
          <p className={`text-xl font-bold ${textColorMap['gray']}`}>¥{fmt(totalPurchase)}</p>
          <div className="mt-1 space-y-0.5">
            {domesticPurchaseTotal > 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                国内 ¥{fmt(domesticPurchaseTotal)}
              </p>
            )}
            {usPurchaseTotal > 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                米国 ¥{fmt(usPurchaseTotal)}
              </p>
            )}
          </div>
        </div>

        {/* 総損益 */}
        <div className={`rounded-xl border p-4 ${colorMap[totalProfitLoss >= 0 ? 'green' : 'red']}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">総損益</p>
          <p className={`text-xl font-bold ${textColorMap[totalProfitLoss >= 0 ? 'green' : 'red']}`}>
            ¥{fmt(totalProfitLoss)}
          </p>
          {profitLossPct !== null && (
            <p className={`text-sm font-medium ${textColorMap[totalProfitLoss >= 0 ? 'green' : 'red']}`}>
              {fmtPct(profitLossPct)}
            </p>
          )}
          <div className="mt-1 space-y-0.5">
            {domesticPLValid && (
              <p className={`text-xs ${domesticPL >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                国内 {domesticPL >= 0 ? '+' : ''}¥{fmt(domesticPL)}
              </p>
            )}
            {usPLValid && (
              <p className={`text-xs ${usPL >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                米国 {usPL >= 0 ? '+' : ''}¥{fmt(usPL)}
              </p>
            )}
          </div>
        </div>

        {/* 年間予想配当金 */}
        <div className={`rounded-xl border p-4 ${colorMap['yellow']}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">年間予想配当金</p>
          <p className={`text-xl font-bold ${textColorMap['yellow']}`}>¥{fmt(totalDividend)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            ¥{fmt(totalDividendAfterTax)}(税引後)
          </p>
        </div>

        {/* 平均配当利回り（時価） */}
        <div className={`rounded-xl border p-4 ${colorMap['purple']}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">平均配当利回り（時価）</p>
          <p className={`text-xl font-bold ${textColorMap['purple']}`}>
            {avgYield !== null ? `${avgYield.toFixed(2)}%` : '—'}
          </p>
        </div>

        {/* 平均配当利回り（取得） */}
        <div className={`rounded-xl border p-4 ${colorMap['teal']}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">平均配当利回り（取得）</p>
          <p className={`text-xl font-bold ${textColorMap['teal']}`}>
            {avgYieldCost !== null ? `${avgYieldCost.toFixed(2)}%` : '—'}
          </p>
        </div>

        {/* ディフェンシブ銘柄比率 */}
        <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 col-span-2 md:col-span-1">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">🛡️ ディフェンシブ比率</p>
          {!hasDefensive ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">ディフェンシブ銘柄が未設定です</p>
          ) : (
            <div className="space-y-1 mt-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">購入金額</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {defensivePurchaseRatio !== null ? `${defensivePurchaseRatio.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">現在価格</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {defensiveMarketRatio !== null ? `${defensiveMarketRatio.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">配当金(税引後)</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {defensiveDivRatio !== null ? `${defensiveDivRatio.toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 資産クラス別合計（非国内資産がある場合のみ表示） */}
      {hasNonDomestic && (
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
            資産クラス別合計
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {assetClassCards.map(({ label, value, bg, text, bold }) => (
              <div key={label} className={`rounded-xl border p-4 ${bg}`}>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                <p className={`${bold ? 'text-xl' : 'text-lg'} font-bold ${text}`}>
                  ¥{fmt(value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
