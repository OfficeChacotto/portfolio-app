import { useState, useCallback, useEffect } from 'react';
import type { Stock } from '../types/stock';
import { fetchStockData, fetchUsStockData } from './useYahooFinance';
import { applyGakuchoMark } from '../data/gakuchoCodes';
import {
  getAccounts,
  saveAccounts,
  getPortfolio,
  savePortfolio,
  getLastUpdated,
  saveLastUpdated,
  deleteAccount,
} from '../utils/localStorage';

/** ストレージから読み込んだ銘柄配列に🦁🛡️自動付与を適用し、変化があれば保存する */
function loadAndMark(accountName: string): Stock[] {
  const loaded = getPortfolio(accountName);
  const marked = loaded.map(applyGakuchoMark);
  if (marked.some((s, i) => s.lion !== loaded[i]?.lion || s.defensive !== loaded[i]?.defensive)) {
    savePortfolio(accountName, marked);
  }
  return marked;
}

/** 国内株式かどうか（undefined も domestic 扱い） */
function isDomestic(s: Stock): boolean {
  return !s.assetClass || s.assetClass === 'domestic';
}

export function usePortfolio() {
  const [accounts, setAccounts] = useState<string[]>(() => getAccounts());
  const [currentAccount, setCurrentAccount] = useState<string>(() => {
    const accs = getAccounts();
    return accs[0] ?? '';
  });
  const [stocks, setStocks] = useState<Stock[]>(() => {
    const accs = getAccounts();
    return accs[0] ? loadAndMark(accs[0]) : [];
  });
  const [lastUpdated, setLastUpdated] = useState<string | null>(() => {
    const accs = getAccounts();
    return accs[0] ? getLastUpdated(accs[0]) : null;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ done: 0, total: 0 });

  // アカウント切り替え
  const switchAccount = useCallback((name: string) => {
    setCurrentAccount(name);
    setStocks(loadAndMark(name));
    setLastUpdated(getLastUpdated(name));
  }, []);

  // アカウント追加
  const addAccount = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAccounts((prev) => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      saveAccounts(next);
      return next;
    });
    if (!currentAccount) {
      setCurrentAccount(trimmed);
    }
  }, [currentAccount]);

  // アカウント削除
  const removeAccount = useCallback((name: string) => {
    deleteAccount(name);
    setAccounts((prev) => {
      const next = prev.filter((a) => a !== name);
      saveAccounts(next);
      return next;
    });
    if (currentAccount === name) {
      const remaining = getAccounts().filter((a) => a !== name);
      const next = remaining[0] ?? '';
      setCurrentAccount(next);
      setStocks(next ? loadAndMark(next) : []);
      setLastUpdated(next ? getLastUpdated(next) : null);
    }
  }, [currentAccount]);

  // 銘柄削除
  const removeStock = useCallback((code: string) => {
    if (!currentAccount) return;
    setStocks((prev) => {
      const next = prev.filter((s) => s.code !== code);
      savePortfolio(currentAccount, next);
      return next;
    });
  }, [currentAccount]);

  // 銘柄更新（単一フィールド）
  const updateStock = useCallback((code: string, changes: Partial<Stock>) => {
    if (!currentAccount) return;
    setStocks((prev) => {
      const next = prev.map((s) => s.code === code ? { ...s, ...changes } : s);
      savePortfolio(currentAccount, next);
      return next;
    });
  }, [currentAccount]);

  // Yahoo Finance から指定銘柄（国内株式のみ）を逐次取得してリアルタイムで状態を更新
  const fetchAndSave = useCallback(async (targetStocks: Stock[], allStocks: Stock[]) => {
    if (!currentAccount || targetStocks.length === 0) return;
    setIsRefreshing(true);
    setRefreshProgress({ done: 0, total: targetStocks.length });

    const map = new Map(allStocks.map((s) => [s.code, s]));
    const now = new Date().toISOString();

    try {
      for (let i = 0; i < targetStocks.length; i++) {
        const stock = targetStocks[i];
        const data = await fetchStockData(stock.code);

        const updated: Stock = {
          ...stock,
          latestPrice: data.price ?? stock.latestPrice,
          name: data.name ?? stock.name,
          sector: data.sector ?? stock.sector,
          dividendPerShare: stock.dividendManuallySet
            ? stock.dividendPerShare
            : (data.dividend ?? stock.dividendPerShare),
          lastUpdated: now,
        };

        map.set(updated.code, updated);
        const current = Array.from(map.values());
        setStocks(current);
        savePortfolio(currentAccount, current);
        setRefreshProgress({ done: i + 1, total: targetStocks.length });

        if (i < targetStocks.length - 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      const displayNow = new Date().toLocaleString('ja-JP');
      saveLastUpdated(currentAccount, displayNow);
      setLastUpdated(displayNow);
    } finally {
      setIsRefreshing(false);
      setRefreshProgress({ done: 0, total: 0 });
    }
  }, [currentAccount]);

  // 銘柄追加（国内株式のみ。追加後に株価・配当・業種を自動フェッチ）
  const addStock = useCallback(async (stock: Stock) => {
    if (!currentAccount) return;
    const exists = stocks.find((s) => s.code === stock.code);
    const processedStock = exists ? stock : applyGakuchoMark(stock);
    const next = exists
      ? stocks.map((s) => s.code === processedStock.code ? { ...s, ...processedStock } : s)
      : [...stocks, processedStock];
    setStocks(next);
    savePortfolio(currentAccount, next);
    await fetchAndSave([processedStock], next);
  }, [currentAccount, stocks, fetchAndSave]);

  // CSVインポート（全資産クラス対応）
  const importStocks = useCallback(async (imported: Stock[]) => {
    if (!currentAccount) return;
    const map = new Map(stocks.map((s) => [s.code, s]));

    for (const s of imported) {
      if (map.has(s.code)) {
        const existing = map.get(s.code)!;
        if (isDomestic(s)) {
          // 国内株式: shares・avgCost・name だけ更新（lion/defensive 手動設定を保持）
          map.set(s.code, { ...existing, shares: s.shares, avgCost: s.avgCost, name: s.name || existing.name });
        } else {
          // 非国内: CSV から取得した価格情報全体を更新（ただし手動設定フラグは保持）
          map.set(s.code, {
            ...s,
            lion: existing.lion,
            lionManuallySet: existing.lionManuallySet,
            defensive: existing.defensive,
            defensiveManuallySet: existing.defensiveManuallySet,
            checked: existing.checked,
            excluded: existing.excluded,
          });
        }
      } else {
        // 新規銘柄: 🦁🛡️自動付与
        map.set(s.code, applyGakuchoMark(s));
      }
    }

    const merged = Array.from(map.values());
    savePortfolio(currentAccount, merged);
    setStocks(merged);

    // 国内株式のうち価格未取得のもののみ自動フェッチ
    const needsFetch = merged.filter((s) => s.latestPrice === null && isDomestic(s));
    await fetchAndSave(needsFetch, merged);
  }, [currentAccount, stocks, fetchAndSave]);

  // Yahoo Finance から国内株式＋米国株式の配当を全件手動更新
  const refreshPrices = useCallback(async () => {
    if (!currentAccount || stocks.length === 0) return;
    const domesticStocks = stocks.filter(isDomestic);
    const usStocks = stocks.filter((s) => s.assetClass === 'us');
    const totalCount = domesticStocks.length + usStocks.length;
    if (totalCount === 0) return;

    setIsRefreshing(true);
    setRefreshProgress({ done: 0, total: totalCount });

    const map = new Map(stocks.map((s) => [s.code, s]));
    const now = new Date().toISOString();
    let done = 0;

    try {
      // 国内株式: 株価・名前・業種・配当を取得
      for (const stock of domesticStocks) {
        const data = await fetchStockData(stock.code);
        const updated: Stock = {
          ...stock,
          latestPrice: data.price ?? stock.latestPrice,
          name: data.name ?? stock.name,
          sector: data.sector ?? stock.sector,
          dividendPerShare: stock.dividendManuallySet
            ? stock.dividendPerShare
            : (data.dividend ?? stock.dividendPerShare),
          lastUpdated: now,
        };
        map.set(updated.code, updated);
        const current = Array.from(map.values());
        setStocks(current);
        savePortfolio(currentAccount, current);
        done++;
        setRefreshProgress({ done, total: totalCount });
        if (done < totalCount) await new Promise((r) => setTimeout(r, 300));
      }

      // 米国株式: 配当のみ取得（手動設定済みはスキップ）
      for (const stock of usStocks) {
        if (!stock.dividendManuallySet) {
          const data = await fetchUsStockData(stock.code);
          if (data.dividendJpy !== null) {
            const updated: Stock = {
              ...stock,
              dividendPerShare: data.dividendJpy,
              lastUpdated: now,
            };
            map.set(updated.code, updated);
            const current = Array.from(map.values());
            setStocks(current);
            savePortfolio(currentAccount, current);
          }
        }
        done++;
        setRefreshProgress({ done, total: totalCount });
        if (done < totalCount) await new Promise((r) => setTimeout(r, 300));
      }

      const displayNow = new Date().toLocaleString('ja-JP');
      saveLastUpdated(currentAccount, displayNow);
      setLastUpdated(displayNow);
    } finally {
      setIsRefreshing(false);
      setRefreshProgress({ done: 0, total: 0 });
    }
  }, [currentAccount, stocks]);

  const toggleCheck = useCallback((code: string) => {
    if (!currentAccount) return;
    setStocks((prev) => {
      const next = prev.map((s) => s.code === code ? { ...s, checked: !s.checked } : s);
      savePortfolio(currentAccount, next);
      return next;
    });
  }, [currentAccount]);

  // 🦁マーク切り替え（手動操作なので lionManuallySet: true を記録）
  const toggleLion = useCallback((code: string) => {
    if (!currentAccount) return;
    setStocks((prev) => {
      const next = prev.map((s) =>
        s.code === code ? { ...s, lion: !s.lion, lionManuallySet: true } : s,
      );
      savePortfolio(currentAccount, next);
      return next;
    });
  }, [currentAccount]);

  // 🛡️マーク切り替え（手動操作なので defensiveManuallySet: true を記録）
  const toggleDefensive = useCallback((code: string) => {
    if (!currentAccount) return;
    setStocks((prev) => {
      const next = prev.map((s) =>
        s.code === code ? { ...s, defensive: !s.defensive, defensiveManuallySet: true } : s,
      );
      savePortfolio(currentAccount, next);
      return next;
    });
  }, [currentAccount]);

  // グラフ除外フラグ切り替え
  const toggleExclude = useCallback((code: string) => {
    if (!currentAccount) return;
    setStocks((prev) => {
      const next = prev.map((s) => s.code === code ? { ...s, excluded: !s.excluded } : s);
      savePortfolio(currentAccount, next);
      return next;
    });
  }, [currentAccount]);

  // コードのみCSVによる一括追加（国内株式のみ）
  const bulkAddByCode = useCallback(async (
    codes: string[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<string[]> => {
    if (!currentAccount || codes.length === 0) return [];

    const currentMap = new Map(stocks.map((s) => [s.code, s]));
    for (const code of codes) {
      if (!currentMap.has(code)) {
        const bareStock: Stock = {
          code, name: code, sector: '', shares: 0,
          avgCost: null, latestPrice: null, dividendPerShare: null,
          lastUpdated: new Date().toISOString(),
        };
        currentMap.set(code, applyGakuchoMark(bareStock));
      }
    }
    const merged = Array.from(currentMap.values());
    setStocks(merged);
    savePortfolio(currentAccount, merged);

    const workMap = new Map(merged.map((s) => [s.code, s]));
    const now = new Date().toISOString();
    const failed: string[] = [];

    for (let i = 0; i < codes.length; i++) {
      onProgress?.(i, codes.length);
      const code = codes[i];
      try {
        const data = await fetchStockData(code);
        const stock = workMap.get(code)!;
        workMap.set(code, {
          ...stock,
          latestPrice: data.price ?? stock.latestPrice,
          name: data.name ?? stock.name,
          sector: data.sector ?? stock.sector,
          dividendPerShare: stock.dividendManuallySet
            ? stock.dividendPerShare
            : (data.dividend ?? stock.dividendPerShare),
          lastUpdated: now,
        });
      } catch {
        failed.push(code);
      }

      const current = Array.from(workMap.values());
      setStocks(current);
      savePortfolio(currentAccount, current);
      onProgress?.(i + 1, codes.length);

      if (i < codes.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    const displayNow = new Date().toLocaleString('ja-JP');
    saveLastUpdated(currentAccount, displayNow);
    setLastUpdated(displayNow);

    return failed;
  }, [currentAccount, stocks]);

  // アカウントが変わったとき
  useEffect(() => {
    if (currentAccount) saveAccounts(accounts);
  }, [accounts, currentAccount]);

  // 初回ロード・アカウント切替時に国内株式の価格未取得分を自動フェッチ
  useEffect(() => {
    const needsFetch = stocks.filter((s) => s.latestPrice === null && isDomestic(s));
    if (needsFetch.length > 0 && !isRefreshing) {
      fetchAndSave(needsFetch, stocks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount]);

  return {
    accounts,
    currentAccount,
    stocks,
    lastUpdated,
    isRefreshing,
    refreshProgress,
    switchAccount,
    addAccount,
    removeAccount,
    addStock,
    removeStock,
    updateStock,
    importStocks,
    refreshPrices,
    toggleCheck,
    toggleExclude,
    toggleLion,
    toggleDefensive,
    bulkAddByCode,
  };
}
