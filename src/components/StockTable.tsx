import { useState, useMemo, useEffect, useRef } from 'react';
import type { Stock, SortKey, SortOrder, AssetClass } from '../types/stock';
import { ASSET_CLASS_LABELS } from '../types/stock';
import { CURRENCY_SYMBOLS } from '../utils/csvParser';

type MarkFilter = 'all' | 'lion' | 'defensive' | 'both';

// ---- Column visibility ----
type ColKey =
  | 'avgCost'
  | 'purchaseAmount'
  | 'latestPrice'
  | 'marketValue'
  | 'marketValueRatio'
  | 'profitLoss'
  | 'profitLossPct'
  | 'dividendPerShare';

const COL_LABELS: Record<ColKey, string> = {
  avgCost: '取得単価',
  purchaseAmount: '購入額',
  latestPrice: '直近終値',
  marketValue: '評価額',
  marketValueRatio: '割合%',
  profitLoss: '損益',
  profitLossPct: '損益%',
  dividendPerShare: '配当単価',
};

const ALL_COLS: ColKey[] = [
  'avgCost', 'purchaseAmount', 'latestPrice', 'marketValue',
  'marketValueRatio', 'profitLoss', 'profitLossPct', 'dividendPerShare',
];

const DEFAULT_VIS: Record<ColKey, boolean> = {
  avgCost: true, purchaseAmount: true, latestPrice: true, marketValue: true,
  marketValueRatio: true, profitLoss: true, profitLossPct: true, dividendPerShare: true,
};
const LS_KEY_VIS = 'portfolio_column_visibility';

function loadVis(): Record<ColKey, boolean> {
  try {
    const raw = localStorage.getItem(LS_KEY_VIS);
    if (!raw) return { ...DEFAULT_VIS };
    return { ...DEFAULT_VIS, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT_VIS }; }
}
function saveVis(v: Record<ColKey, boolean>) {
  try { localStorage.setItem(LS_KEY_VIS, JSON.stringify(v)); } catch { /* ignore */ }
}

const FIXED_COLS = 16; // 非トグル列数

// ---- Asset class filter ----
const ALL_ASSET_CLASSES: AssetClass[] = ['domestic', 'us', 'trust', 'foreignCash', 'goldPlatinum'];

function stockAssetClass(s: Stock): AssetClass {
  return s.assetClass ?? 'domestic';
}

// ---- Props ----
interface Props {
  stocks: Stock[];
  onUpdateStock: (code: string, changes: Partial<Stock>) => void;
  onRemoveStock: (code: string) => void;
  onToggleCheck: (code: string) => void;
  onToggleExclude: (code: string) => void;
  onToggleLion: (code: string) => void;
  onToggleDefensive: (code: string) => void;
}

// ---- Helpers ----
function fmt(n: number | null, digits = 0): string {
  if (n === null || isNaN(n)) return '—';
  return n.toLocaleString('ja-JP', { maximumFractionDigits: digits });
}
function fmtPct(n: number | null, digits = 2): string {
  if (n === null || isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
}
function calcPurchase(s: Stock) { return s.avgCost !== null ? s.avgCost * s.shares : null; }
function calcMarket(s: Stock)   { return s.latestPrice !== null ? s.latestPrice * s.shares : null; }
function calcPL(s: Stock) {
  const p = calcPurchase(s); const m = calcMarket(s);
  if (p === null || m === null) return null;
  return m - p;
}
function calcPLPct(s: Stock) {
  const p = calcPurchase(s); const pl = calcPL(s);
  if (p === null || pl === null || p === 0) return null;
  return (pl / p) * 100;
}
function calcDivTotal(s: Stock) {
  if (s.dividendPerShare === null) return null;
  return s.dividendPerShare * s.shares;
}
function calcYieldPrice(s: Stock) {
  const d = calcDivTotal(s); const m = calcMarket(s);
  if (d === null || m === null || m === 0) return null;
  return (d / m) * 100;
}
function calcYieldCost(s: Stock) {
  const d = calcDivTotal(s); const p = calcPurchase(s);
  if (d === null || p === null || p === 0) return null;
  return (d / p) * 100;
}
function calcYield1Share(s: Stock): number | null {
  if (s.shares !== 0) return null;
  if (s.latestPrice === null || s.dividendPerShare === null || s.latestPrice === 0) return null;
  return (s.dividendPerShare / s.latestPrice) * 100;
}
const TOKUTEI_TAX = 0.20315;
function calcAfterTax(s: Stock): number | null {
  const d = calcDivTotal(s);
  if (d === null) return null;
  return s.checked ? d * (1 - TOKUTEI_TAX) : d;
}

/**
 * 米国株式の avgCost が USD建てのまま保存されている疑いがあるか判定
 * latestPrice(JPY) / avgCost(USD) ≈ USDJPY（50〜300）なら USD建てと判断
 */
function usAvgCostIsUsd(s: Stock): boolean {
  if (s.assetClass !== 'us') return false;
  if (s.avgCost === null || s.avgCost <= 0) return false;
  if (s.latestPrice === null || s.latestPrice <= 0) return false;
  // JPY建てなら ratio ≈ 0.5〜2、USD建てなら ratio ≈ USDJPY(100〜200)
  return s.latestPrice / s.avgCost > 20;
}

/** 外貨アノテーション文字列（例: "$2,914.80"） */
function fmtForeign(s: Stock): string | null {
  if (!s.foreignCurrency || s.foreignAmount === undefined) return null;
  const sym = CURRENCY_SYMBOLS[s.foreignCurrency] ?? s.foreignCurrency;
  return `${sym}${s.foreignAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

type EditingCell = { code: string; field: 'shares' | 'avgCost' | 'dividendPerShare' };
interface SectorStats { total: number; map: Map<string, number>; }

export default function StockTable({ stocks, onUpdateStock, onRemoveStock, onToggleCheck, onToggleExclude, onToggleLion, onToggleDefensive }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('code');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [markFilter, setMarkFilter] = useState<MarkFilter>('all');
  const [assetFilter, setAssetFilter] = useState<Set<AssetClass>>(new Set());

  // Column visibility
  const [colVis, setColVis] = useState<Record<ColKey, boolean>>(loadVis);
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showColMenu) return;
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setShowColMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColMenu]);

  const toggleColVis = (key: ColKey) => {
    setColVis((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveVis(next);
      return next;
    });
  };
  const visibleColCount = FIXED_COLS + ALL_COLS.filter((k) => colVis[k]).length;
  const hiddenCount = ALL_COLS.filter((k) => !colVis[k]).length;

  // 資産クラスフィルターで存在するクラスを検出
  const presentClasses = useMemo(() => {
    const s = new Set<AssetClass>();
    stocks.forEach(st => s.add(stockAssetClass(st)));
    return s;
  }, [stocks]);
  const hasMultipleClasses = presentClasses.size > 1;

  const toggleAssetClass = (cls: AssetClass) => {
    setAssetFilter(prev => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls); else next.add(cls);
      return next;
    });
  };

  // 集計
  const totalMarketValue = useMemo(() => stocks.reduce((s, st) => s + (calcMarket(st) ?? 0), 0), [stocks]);
  const totalDividend = useMemo(() => stocks.reduce((s, st) => s + (calcDivTotal(st) ?? 0), 0), [stocks]);

  const sectorStats: SectorStats = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    for (const s of stocks) {
      const mv = calcMarket(s) ?? 0;
      const sector = s.sector || '不明';
      map.set(sector, (map.get(sector) ?? 0) + mv);
      total += mv;
    }
    return { total, map };
  }, [stocks]);

  const sectorPurchaseStats = useMemo(() => {
    const checkedMap = new Map<string, number>();
    const uncheckedMap = new Map<string, number>();
    let checkedTotal = 0, uncheckedTotal = 0;
    for (const s of stocks) {
      const purchase = (s.avgCost ?? 0) * s.shares;
      const sector = s.sector || '不明';
      if (s.checked) {
        checkedMap.set(sector, (checkedMap.get(sector) ?? 0) + purchase);
        checkedTotal += purchase;
      } else {
        uncheckedMap.set(sector, (uncheckedMap.get(sector) ?? 0) + purchase);
        uncheckedTotal += purchase;
      }
    }
    return { checkedMap, checkedTotal, uncheckedMap, uncheckedTotal };
  }, [stocks]);

  // ソート
  const sorted = useMemo(() => {
    const arr = [...stocks];
    arr.sort((a, b) => {
      let va: number | string | null = null;
      let vb: number | string | null = null;
      switch (sortKey) {
        case 'code': va = a.code; vb = b.code; break;
        case 'name': va = a.name; vb = b.name; break;
        case 'sector': va = a.sector; vb = b.sector; break;
        case 'shares': va = a.shares; vb = b.shares; break;
        case 'avgCost': va = a.avgCost; vb = b.avgCost; break;
        case 'latestPrice': va = a.latestPrice; vb = b.latestPrice; break;
        case 'dividendPerShare': va = a.dividendPerShare; vb = b.dividendPerShare; break;
        case 'purchaseAmount': va = calcPurchase(a); vb = calcPurchase(b); break;
        case 'marketValue': va = calcMarket(a); vb = calcMarket(b); break;
        case 'profitLoss': va = calcPL(a); vb = calcPL(b); break;
        case 'profitLossPct': va = calcPLPct(a); vb = calcPLPct(b); break;
        case 'dividendTotal': va = calcDivTotal(a); vb = calcDivTotal(b); break;
        case 'dividendYieldPrice': va = calcYieldPrice(a); vb = calcYieldPrice(b); break;
        case 'dividendYieldCost': va = calcYieldCost(a); vb = calcYieldCost(b); break;
        case 'marketValueRatio':
          va = totalMarketValue > 0 ? (calcMarket(a) ?? 0) / totalMarketValue : 0;
          vb = totalMarketValue > 0 ? (calcMarket(b) ?? 0) / totalMarketValue : 0;
          break;
        case 'dividendRatio':
          va = totalDividend > 0 ? (calcDivTotal(a) ?? 0) / totalDividend : 0;
          vb = totalDividend > 0 ? (calcDivTotal(b) ?? 0) / totalDividend : 0;
          break;
        case 'sectorRatio':
          va = sectorStats.total > 0 ? (sectorStats.map.get(a.sector || '不明') ?? 0) / sectorStats.total : 0;
          vb = sectorStats.total > 0 ? (sectorStats.map.get(b.sector || '不明') ?? 0) / sectorStats.total : 0;
          break;
      }
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === 'string' && typeof vb === 'string')
        return sortOrder === 'asc' ? va.localeCompare(vb, 'ja') : vb.localeCompare(va, 'ja');
      return sortOrder === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [stocks, sortKey, sortOrder, totalMarketValue, totalDividend, sectorStats]);

  // 資産クラスフィルター → マークフィルター の順で適用
  const displayed = useMemo(() => {
    let arr = sorted;
    if (assetFilter.size > 0) {
      arr = arr.filter(s => assetFilter.has(stockAssetClass(s)));
    }
    if (markFilter !== 'all') {
      arr = arr.filter(s => {
        if (markFilter === 'lion') return !!s.lion;
        if (markFilter === 'defensive') return !!s.defensive;
        if (markFilter === 'both') return !!s.lion && !!s.defensive;
        return true;
      });
    }
    return arr;
  }, [sorted, assetFilter, markFilter]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('asc'); }
  };

  const startEdit = (code: string, field: EditingCell['field'], currentVal: number | null) => {
    setEditing({ code, field });
    setEditValue(currentVal !== null ? String(currentVal) : '');
  };
  const commitEdit = () => {
    if (!editing) return;
    const num = parseFloat(editValue);
    if (!isNaN(num) && num >= 0) {
      const changes: Partial<Stock> = { [editing.field]: num };
      if (editing.field === 'dividendPerShare') changes.dividendManuallySet = true;
      onUpdateStock(editing.code, changes);
    } else if (editValue === '' && editing.field !== 'shares') {
      onUpdateStock(editing.code, { [editing.field]: null });
    }
    setEditing(null);
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-500 ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };
  const Th = ({ label, k, className = '' }: { label: string; k: SortKey; className?: string }) => (
    <th
      className={`px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap select-none ${className}`}
      onClick={() => handleSort(k)}
    >
      {label}<SortIcon k={k} />
    </th>
  );

  const filterBtnClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-indigo-600 text-white'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
    }`;

  return (
    <div className="space-y-3">
      {/* フィルター行 */}
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* マークフィルター */}
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">フィルター:</span>
          <button className={filterBtnClass(markFilter === 'all')} onClick={() => setMarkFilter('all')}>すべて</button>
          <button className={filterBtnClass(markFilter === 'lion')} onClick={() => setMarkFilter('lion')}>🦁のみ</button>
          <button className={filterBtnClass(markFilter === 'defensive')} onClick={() => setMarkFilter('defensive')}>🛡️のみ</button>
          <button className={filterBtnClass(markFilter === 'both')} onClick={() => setMarkFilter('both')}>🦁かつ🛡️</button>
          {(markFilter !== 'all' || assetFilter.size > 0) && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {displayed.length} / {stocks.length} 件表示中
            </span>
          )}
        </div>

        {/* 列の表示設定 */}
        <div className="relative" ref={colMenuRef}>
          <button
            onClick={() => setShowColMenu(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              showColMenu
                ? 'bg-gray-700 text-white border-gray-700'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            列の表示設定
            {hiddenCount > 0 && (
              <span className="bg-indigo-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {hiddenCount}非表示
              </span>
            )}
          </button>
          {showColMenu && (
            <div className="absolute right-0 top-full mt-1 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 min-w-44">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">列の表示</span>
                <button
                  onClick={() => { const n = { ...DEFAULT_VIS }; saveVis(n); setColVis(n); }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >すべて表示</button>
              </div>
              <div className="space-y-1">
                {ALL_COLS.map(key => (
                  <label key={key} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={colVis[key]} onChange={() => toggleColVis(key)} className="accent-indigo-600 cursor-pointer" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{COL_LABELS[key]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 資産クラスフィルター（非国内資産がある場合のみ表示） */}
      {hasMultipleClasses && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">資産クラス:</span>
          <button
            className={filterBtnClass(assetFilter.size === 0)}
            onClick={() => setAssetFilter(new Set())}
          >
            すべて
          </button>
          {ALL_ASSET_CLASSES.filter(cls => presentClasses.has(cls)).map(cls => (
            <button
              key={cls}
              className={filterBtnClass(assetFilter.has(cls))}
              onClick={() => toggleAssetClass(cls)}
            >
              {ASSET_CLASS_LABELS[cls]}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-6"></th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">口座</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-8">No</th>
              <Th label="コード" k="code" />
              <Th label="銘柄名" k="name" />
              <Th label="業種" k="sector" />
              <Th label="業種比%" k="sectorRatio" />
              <Th label="保有数" k="shares" />
              {colVis.avgCost && <Th label="取得単価" k="avgCost" />}
              {colVis.purchaseAmount && <Th label="購入額" k="purchaseAmount" />}
              {colVis.latestPrice && <Th label="直近終値" k="latestPrice" />}
              {colVis.marketValue && <Th label="評価額" k="marketValue" />}
              {colVis.marketValueRatio && <Th label="割合%" k="marketValueRatio" />}
              {colVis.profitLoss && <Th label="損益" k="profitLoss" />}
              {colVis.profitLossPct && <Th label="損益%" k="profitLossPct" />}
              {colVis.dividendPerShare && <Th label="配当単価" k="dividendPerShare" />}
              <Th label="配当金" k="dividendTotal" />
              <Th label="配当割合%" k="dividendRatio" />
              <Th label="利回り時価" k="dividendYieldPrice" />
              <Th label="利回り取得" k="dividendYieldCost" />
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">リンク</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">マーク</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap" title="グラフ分析から除外">グラフ除外</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {displayed.map((stock, idx) => {
              const isUsdAvgCost = usAvgCostIsUsd(stock); // avgCostがUSD建てで保存されている疑い
              const purchase = isUsdAvgCost ? null : calcPurchase(stock);
              const market = calcMarket(stock);
              const pl = isUsdAvgCost ? null : calcPL(stock);
              const plPct = isUsdAvgCost ? null : calcPLPct(stock);
              const divTotal = calcDivTotal(stock);
              const afterTaxDiv = calcAfterTax(stock);
              const yieldPrice = calcYieldPrice(stock);
              const yieldCost = isUsdAvgCost ? null : calcYieldCost(stock);
              const mvRatio = totalMarketValue > 0 && market !== null ? (market / totalMarketValue) * 100 : null;
              const divRatio = totalDividend > 0 && divTotal !== null ? (divTotal / totalDividend) * 100 : null;
              const sectorPct = stock.checked
                ? (sectorPurchaseStats.checkedTotal > 0
                  ? ((sectorPurchaseStats.checkedMap.get(stock.sector || '不明') ?? 0) / sectorPurchaseStats.checkedTotal) * 100
                  : null)
                : (sectorPurchaseStats.uncheckedTotal > 0
                  ? ((sectorPurchaseStats.uncheckedMap.get(stock.sector || '不明') ?? 0) / sectorPurchaseStats.uncheckedTotal) * 100
                  : null);
              const yield1Share = calcYield1Share(stock);
              const isHighYield = (yieldPrice !== null && yieldPrice >= 4) || (yieldCost !== null && yieldCost >= 4);
              const plColor = pl === null ? '' : pl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
              const isDom = !stock.assetClass || stock.assetClass === 'domestic';
              const foreignNote = fmtForeign(stock);

              const rowBg = stock.excluded
                ? 'opacity-40'
                : stock.checked
                  ? 'bg-orange-50 dark:bg-orange-900/10'
                  : isDom
                    ? 'bg-green-50/30 dark:bg-green-900/5'
                    : 'bg-blue-50/20 dark:bg-blue-900/5';

              return (
                <tr
                  key={stock.code}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${stock.excluded ? rowBg : isHighYield && isDom ? 'bg-yellow-50 dark:bg-yellow-900/10' : rowBg}`}
                >
                  {/* 特定/NISA チェックボックス */}
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!stock.checked}
                      onChange={() => onToggleCheck(stock.code)}
                      className="cursor-pointer accent-orange-500"
                      title="チェック=特定口座"
                    />
                  </td>

                  {/* 口座種別バッジ */}
                  <td className="px-1 py-2">
                    {stock.checked ? (
                      <span className="inline-block text-xs font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 whitespace-nowrap">特定</span>
                    ) : (
                      <span className="inline-block text-xs font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">NISA</span>
                    )}
                  </td>

                  <td className="px-2 py-2 text-gray-400 text-xs">{idx + 1}</td>

                  {/* コード */}
                  <td className="px-2 py-2 font-mono font-medium text-gray-900 dark:text-gray-100">
                    <div>{stock.code}</div>
                    {!isDom && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 font-sans font-normal">
                        {ASSET_CLASS_LABELS[stock.assetClass!]}
                      </div>
                    )}
                  </td>

                  {/* 銘柄名 */}
                  <td className="px-2 py-2 text-gray-900 dark:text-gray-100 whitespace-nowrap max-w-36 overflow-hidden text-ellipsis">
                    <span>{stock.name || '—'}</span>
                    {stock.lion && <span className="ml-1" title="学長高配当マガジン掲載">🦁</span>}
                    {stock.defensive && <span className="ml-0.5" title="ディフェンシブ銘柄">🛡️</span>}
                  </td>

                  {/* 業種 */}
                  <td className="px-2 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">{stock.sector || '—'}</td>

                  {/* 業種比% */}
                  <td className="px-2 py-2 text-right text-gray-600 dark:text-gray-400 text-xs">
                    {sectorPct !== null ? `${sectorPct.toFixed(1)}%` : '—'}
                  </td>

                  {/* 保有数 */}
                  <td className="px-2 py-2">
                    {editing?.code === stock.code && editing.field === 'shares' ? (
                      <input type="number" value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => e.key === 'Enter' && commitEdit()}
                        className="w-20 border rounded px-1 text-sm dark:bg-gray-800 dark:text-white dark:border-gray-600"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded"
                        onClick={() => startEdit(stock.code, 'shares', stock.shares)}
                      >
                        {stock.shares}
                        {stock.assetClass === 'foreignCash' && stock.foreignCurrency && (
                          <span className="text-xs text-gray-400 ml-0.5">{stock.foreignCurrency}</span>
                        )}
                      </span>
                    )}
                  </td>

                  {/* 取得単価 */}
                  {colVis.avgCost && (
                    <td className="px-2 py-2">
                      {editing?.code === stock.code && editing.field === 'avgCost' ? (
                        <input type="number" value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={e => e.key === 'Enter' && commitEdit()}
                          className="w-24 border rounded px-1 text-sm dark:bg-gray-800 dark:text-white dark:border-gray-600"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded"
                          onClick={() => startEdit(stock.code, 'avgCost', stock.avgCost)}
                          title={isUsdAvgCost ? '⚠️ USD建てで保存されています。CSVを再インポートしてください。' : undefined}
                        >
                          {stock.avgCost !== null
                            ? isUsdAvgCost
                              ? <span className="text-amber-500">${fmt(stock.avgCost, 2)}<span className="text-xs ml-0.5">⚠️</span></span>
                              : `¥${fmt(stock.avgCost)}`
                            : '—'}
                        </span>
                      )}
                    </td>
                  )}

                  {/* 購入額 */}
                  {colVis.purchaseAmount && (
                    <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-300">
                      {purchase !== null ? `¥${fmt(purchase)}` : '—'}
                    </td>
                  )}

                  {/* 直近終値（外貨預り金は為替レート） */}
                  {colVis.latestPrice && (
                    <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-300">
                      {stock.latestPrice !== null ? (
                        <div>
                          <div>¥{fmt(stock.latestPrice)}</div>
                          {stock.assetClass === 'foreignCash' && stock.foreignCurrency && (
                            <div className="text-xs text-gray-400">円/{stock.foreignCurrency}</div>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                  )}

                  {/* 評価額（外貨アノテーション付き） */}
                  {colVis.marketValue && (
                    <td className="px-2 py-2 text-right font-medium text-gray-900 dark:text-gray-100">
                      {market !== null ? (
                        <div>
                          <div>¥{fmt(market)}</div>
                          {foreignNote && (
                            <div className="text-xs text-gray-400 dark:text-gray-500">（{foreignNote}）</div>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                  )}

                  {/* 割合% */}
                  {colVis.marketValueRatio && (
                    <td className="px-2 py-2 text-right text-gray-600 dark:text-gray-400">
                      {fmtPct(mvRatio)}
                    </td>
                  )}

                  {/* 損益 */}
                  {colVis.profitLoss && (
                    <td className={`px-2 py-2 text-right font-medium ${plColor}`}>
                      {pl !== null ? `${pl >= 0 ? '+' : ''}¥${fmt(pl)}` : '—'}
                    </td>
                  )}

                  {/* 損益% */}
                  {colVis.profitLossPct && (
                    <td className={`px-2 py-2 text-right font-medium ${plColor}`}>
                      {plPct !== null ? `${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%` : '—'}
                    </td>
                  )}

                  {/* 配当単価（国内株式のみ自動取得。非国内は手動入力のみ） */}
                  {colVis.dividendPerShare && (
                    <td className="px-2 py-2">
                      {editing?.code === stock.code && editing.field === 'dividendPerShare' ? (
                        <input type="number" value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={e => e.key === 'Enter' && commitEdit()}
                          className="w-20 border rounded px-1 text-sm dark:bg-gray-800 dark:text-white dark:border-gray-600"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded"
                          onClick={() => startEdit(stock.code, 'dividendPerShare', stock.dividendPerShare)}
                          title={stock.dividendManuallySet ? '手動設定済み' : (isDom || stock.assetClass === 'us') ? '自動取得（価格更新ボタン）' : '手動入力のみ'}
                        >
                          {stock.dividendPerShare !== null ? `¥${fmt(stock.dividendPerShare, 1)}` : '—'}
                          {stock.dividendManuallySet && <span className="text-xs text-blue-400 ml-1">✎</span>}
                        </span>
                      )}
                    </td>
                  )}

                  {/* 配当金 */}
                  <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-300">
                    {divTotal !== null ? (
                      <div>
                        <div>¥{fmt(divTotal)}</div>
                        {afterTaxDiv !== null && stock.checked && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            ¥{fmt(afterTaxDiv)}(税引後)
                          </div>
                        )}
                      </div>
                    ) : '—'}
                  </td>

                  <td className="px-2 py-2 text-right text-gray-600 dark:text-gray-400">{fmtPct(divRatio)}</td>

                  {/* 利回り時価 */}
                  <td className={`px-2 py-2 text-right font-medium ${yieldPrice !== null && yieldPrice >= 4 ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {stock.shares === 0 && yield1Share !== null ? (
                      <div><div>{fmtPct(yield1Share)}</div><div className="text-xs text-gray-400">※1株</div></div>
                    ) : fmtPct(yieldPrice)}
                  </td>

                  {/* 利回り取得 */}
                  <td className={`px-2 py-2 text-right font-medium ${yieldCost !== null && yieldCost >= 4 ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {fmtPct(yieldCost)}
                  </td>

                  {/* リンク */}
                  <td className="px-2 py-2 whitespace-nowrap">
                    {isDom ? (
                      <>
                        <a href={`https://irbank.net/${stock.code}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800 mr-1">
                          IR BANK
                        </a>
                        <a href={`https://finance.yahoo.co.jp/quote/${stock.code}.T`} target="_blank" rel="noopener noreferrer"
                          className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-1 rounded hover:bg-red-200 dark:hover:bg-red-800">
                          Yahoo!
                        </a>
                      </>
                    ) : stock.assetClass === 'us' ? (
                      <a href={`https://finance.yahoo.com/quote/${stock.code}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800">
                        Yahoo! Finance
                      </a>
                    ) : null}
                  </td>

                  {/* マークトグル */}
                  <td className="px-2 py-2 text-center whitespace-nowrap">
                    <button onClick={() => onToggleLion(stock.code)}
                      className={`text-base leading-none mr-1 transition-opacity ${stock.lion ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                      title="学長高配当マガジン掲載">🦁</button>
                    <button onClick={() => onToggleDefensive(stock.code)}
                      className={`text-base leading-none transition-opacity ${stock.defensive ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                      title="ディフェンシブ銘柄">🛡️</button>
                  </td>

                  {/* グラフ除外 */}
                  <td className="px-2 py-2 text-center">
                    <input type="checkbox" checked={!!stock.excluded}
                      onChange={() => onToggleExclude(stock.code)}
                      className="cursor-pointer accent-gray-500"
                      title="グラフ分析から除外" />
                  </td>

                  {/* 削除 */}
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => {
                        if (confirm(`${stock.name || stock.code} を削除しますか？`)) onRemoveStock(stock.code);
                      }}
                      className="text-gray-300 hover:text-red-500 text-base leading-none"
                      title="削除">🗑</button>
                  </td>
                </tr>
              );
            })}
            {stocks.length === 0 && (
              <tr>
                <td colSpan={visibleColCount} className="px-4 py-12 text-center text-gray-400 dark:text-gray-600">
                  銘柄がありません。「銘柄追加」または「CSVインポート」で銘柄を登録してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
