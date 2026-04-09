import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { Stock } from '../types/stock';

interface Props {
  stocks: Stock[];
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280',
  '#14B8A6', '#A855F7', '#FB923C', '#22C55E', '#E11D48',
];

const TOKUTEI_TAX_RATE = 0.20315;

interface SectorData {
  name: string;
  marketValue: number;
  dividend: number;
  dividendAfterTax: number;
  purchaseAmount: number;
}


// Feature 3: external label renderer
const renderOutsideLabel = (hideLabels: boolean) => ({
  cx, cy, midAngle, outerRadius, percent, name,
}: {
  cx: number; cy: number; midAngle: number; outerRadius: number; percent: number; name: string;
}) => {
  if (hideLabels || percent < 0.03) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 28;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const pctStr = `${(percent * 100).toFixed(1)}%`;
  const shortName = name.length > 6 ? name.slice(0, 6) + '…' : name;
  return (
    <text
      x={x}
      y={y}
      fill="#6B7280"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={10}
    >
      {`${shortName} ${pctStr}`}
    </text>
  );
};

type MarkFilter = 'all' | 'lion' | 'defensive' | 'both';

export default function PortfolioChart({ stocks }: Props) {
  // Feature 7: toggle to exclude checked (特定口座) stocks
  const [excludeChecked, setExcludeChecked] = useState(false);
  const hasChecked = stocks.some((s) => s.checked);

  // Feature 13: excluded stocks (グラフ除外フラグ)
  const excludedCount = stocks.filter((s) => s.excluded).length;

  // Feature 15/16: mark filter
  const [markFilter, setMarkFilter] = useState<MarkFilter>('all');
  const hasLion = stocks.some((s) => s.lion);
  const hasDefensive = stocks.some((s) => s.defensive);
  const hasMarks = hasLion || hasDefensive;

  // Filtered stocks for chart (Feature 7 + Feature 13 + Feature 15/16)
  const filteredStocks = useMemo(() => {
    return stocks.filter((s) => {
      if (s.excluded) return false;
      if (excludeChecked && s.checked) return false;
      if (markFilter === 'lion' && !s.lion) return false;
      if (markFilter === 'defensive' && !s.defensive) return false;
      if (markFilter === 'both' && !(s.lion && s.defensive)) return false;
      return true;
    });
  }, [stocks, excludeChecked, markFilter]);

  // 業種別集計
  const data: SectorData[] = useMemo(() => {
    const sectorMap = new Map<string, SectorData>();
    for (const s of filteredStocks) {
      const sector = s.sector || '不明';
      const mv = s.latestPrice !== null ? s.latestPrice * s.shares : 0;
      const divRaw = s.dividendPerShare !== null ? s.dividendPerShare * s.shares : 0;
      const divAfterTax = s.checked ? divRaw * (1 - TOKUTEI_TAX_RATE) : divRaw;
      const purchase = s.avgCost !== null ? s.avgCost * s.shares : 0;

      const existing = sectorMap.get(sector) ?? { name: sector, marketValue: 0, dividend: 0, dividendAfterTax: 0, purchaseAmount: 0 };
      sectorMap.set(sector, {
        name: sector,
        marketValue: existing.marketValue + mv,
        dividend: existing.dividend + divRaw,
        dividendAfterTax: existing.dividendAfterTax + divAfterTax,
        purchaseAmount: existing.purchaseAmount + purchase,
      });
    }
    return Array.from(sectorMap.values()).sort((a, b) => b.marketValue - a.marketValue);
  }, [filteredStocks]);

  const totalMV = data.reduce((s, d) => s + d.marketValue, 0);
  const totalDividend = data.reduce((s, d) => s + d.dividend, 0);
  const totalDividendAfterTax = data.reduce((s, d) => s + d.dividendAfterTax, 0);
  const totalPurchase = data.reduce((s, d) => s + d.purchaseAmount, 0);

  if (stocks.length === 0) {
    return (
      <div className="text-center text-gray-400 dark:text-gray-600 py-12">
        銘柄を追加するとグラフが表示されます
      </div>
    );
  }

  const pieDataMV = data.map((d) => ({ name: d.name, value: d.marketValue }));
  const pieDataDiv = data.map((d) => ({ name: d.name, value: d.dividend }));

  // Feature 3: if >8 sectors, hide labels (use tooltip only)
  const hideLabels = data.length > 8;

  const MvLabel = renderOutsideLabel(hideLabels);
  const DivLabel = renderOutsideLabel(hideLabels);

  return (
    <div className="space-y-8">
      {/* Feature 7 & 13: Filter toggles + exclusion badges */}
      <div className="flex items-center gap-3 flex-wrap">
        {hasChecked && (
          <button
            onClick={() => setExcludeChecked((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              excludeChecked
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-100 dark:hover:bg-orange-900/30'
            }`}
          >
            特定口座を除外
          </button>
        )}
        {excludeChecked && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
            特定口座銘柄を除外中
          </span>
        )}
        {/* Feature 13: グラフ除外バッジ */}
        {excludedCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            <span>📊</span>
            <span>{excludedCount}銘柄を除外中</span>
          </span>
        )}

        {/* Feature 15/16: マーク絞り込みフィルター */}
        {hasMarks && (
          <>
            <span className="text-xs text-gray-400 dark:text-gray-500">|</span>
            {(['all', 'lion', 'defensive', 'both'] as MarkFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setMarkFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  markFilter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {f === 'all' ? 'すべて' : f === 'lion' ? '🦁のみ' : f === 'defensive' ? '🛡️のみ' : '🦁かつ🛡️'}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Feature 8: 2 pie charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 評価額割合 円グラフ - Feature 3 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            業種別 評価額割合
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
              <Pie
                data={pieDataMV}
                cx="50%"
                cy="50%"
                labelLine={!hideLabels}
                label={MvLabel}
                outerRadius={130}
                dataKey="value"
              >
                {pieDataMV.map((_, index) => (
                  <Cell key={`mv-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`¥${value.toLocaleString('ja-JP')}`, '評価額']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 配当金割合 円グラフ - Feature 8 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            業種別 配当金割合
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
              <Pie
                data={pieDataDiv}
                cx="50%"
                cy="50%"
                labelLine={!hideLabels}
                label={DivLabel}
                outerRadius={130}
                dataKey="value"
              >
                {pieDataDiv.map((_, index) => (
                  <Cell key={`div-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`¥${value.toLocaleString('ja-JP')}`, '配当金']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 業種別サマリーテーブル */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">業種別サマリー</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">業種</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400 min-w-[120px]">
                  <span className="text-blue-500">■</span> 評価額割合
                  <br />
                  <span className="text-green-500">■</span> 配当金割合
                </th>
                <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400">評価額</th>
                <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400">割合</th>
                <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400">取得金額</th>
                <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400">配当金</th>
                <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400">配当金割合</th>
                <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400">配当利回り(時価)</th>
                <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400">利回り（取得）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
              {data.map((d, i) => {
                const mvPct  = totalMV > 0 ? (d.marketValue / totalMV) * 100 : 0;
                const divPct = totalDividendAfterTax > 0 ? (d.dividendAfterTax / totalDividendAfterTax) * 100 : 0;
                const maxMvPct  = totalMV > 0 ? (Math.max(...data.map(x => x.marketValue)) / totalMV) * 100 : 100;
                const maxDivPct = totalDividendAfterTax > 0 ? (Math.max(...data.map(x => x.dividendAfterTax)) / totalDividendAfterTax) * 100 : 100;
                return (
                  <tr key={d.name} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    {/* 業種名 */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-gray-900 dark:text-gray-100 whitespace-nowrap">{d.name}</span>
                      </div>
                    </td>
                    {/* 棒グラフ（評価額割合・配当金割合） */}
                    <td className="px-3 py-2">
                      <div className="space-y-1 min-w-[110px]">
                        {/* 評価額割合バー */}
                        <div className="flex items-center gap-1.5">
                          <div className="w-96 h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${maxMvPct > 0 ? (mvPct / maxMvPct) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-blue-600 dark:text-blue-400 w-10 text-right">
                            {totalMV > 0 ? `${mvPct.toFixed(2)}%` : '—'}
                          </span>
                        </div>
                        {/* 配当金割合バー */}
                        <div className="flex items-center gap-1.5">
                          <div className="w-96 h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-green-500"
                              style={{ width: `${maxDivPct > 0 ? (divPct / maxDivPct) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-green-600 dark:text-green-400 w-10 text-right">
                            {totalDividendAfterTax > 0 ? `${divPct.toFixed(2)}%` : '—'}
                          </span>
                        </div>
                      </div>
                    </td>
                    {/* 評価額 */}
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                      ¥{Math.floor(d.marketValue).toLocaleString('ja-JP')}
                    </td>
                    {/* 割合 */}
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                      {totalMV > 0 ? `${mvPct.toFixed(2)}%` : '—'}
                    </td>
                    {/* 取得金額 */}
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                      {d.purchaseAmount > 0 ? `¥${Math.floor(d.purchaseAmount).toLocaleString('ja-JP')}` : '—'}
                    </td>
                    {/* 配当金 */}
                    <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">
                      ¥{Math.floor(d.dividend).toLocaleString('ja-JP')}
                    </td>
                    {/* 配当金割合（税引後） */}
                    <td className="px-3 py-2 text-right text-green-700 dark:text-green-300 font-medium">
                      {totalDividendAfterTax > 0 ? `${divPct.toFixed(2)}%` : '—'}
                    </td>
                    {/* 配当利回り(時価) */}
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                      {d.marketValue > 0 ? `${((d.dividend / d.marketValue) * 100).toFixed(2)}%` : '—'}
                    </td>
                    {/* 利回り（取得） */}
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                      {d.purchaseAmount > 0 ? `${((d.dividend / d.purchaseAmount) * 100).toFixed(2)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
              {/* 合計行 */}
              <tr className="bg-gray-50 dark:bg-gray-800 font-medium">
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">合計</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  ¥{Math.floor(totalMV).toLocaleString('ja-JP')}
                </td>
                <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">100%</td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  {totalPurchase > 0 ? `¥${Math.floor(totalPurchase).toLocaleString('ja-JP')}` : '—'}
                </td>
                <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">
                  ¥{Math.floor(totalDividend).toLocaleString('ja-JP')}
                </td>
                <td className="px-3 py-2 text-right text-green-700 dark:text-green-300">100%</td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  {totalMV > 0 ? `${((totalDividend / totalMV) * 100).toFixed(2)}%` : '—'}
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  {totalPurchase > 0 ? `${((totalDividend / totalPurchase) * 100).toFixed(2)}%` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
