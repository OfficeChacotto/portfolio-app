import { useState, useCallback, useEffect, startTransition } from 'react';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Stock } from '../types/stock';
import { fetchStockData, fetchUsStockData } from './useYahooFinance';
import { applyGakuchoMark } from '../data/gakuchoCodes';

function isDomestic(s: Stock): boolean {
  return !s.assetClass || s.assetClass === 'domestic';
}

function portfolioRef(uid: string, accountName: string) {
  return doc(db, 'users', uid, 'portfolios', accountName);
}

export function useFirestorePortfolio(uid: string) {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [currentAccount, setCurrentAccount] = useState('');
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ done: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  // ─── 初回ロード ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const colRef = collection(db, 'users', uid, 'portfolios');
    getDocs(colRef)
      .then((snap) => {
        if (cancelled) return;
        const sorted = snap.docs.sort((a, b) => a.id.localeCompare(b.id));
        const names = sorted.map((d) => d.id);
        setAccounts(names);
        if (names.length > 0) {
          const data = sorted[0].data();
          const raw: Stock[] = Array.isArray(data.stocks) ? data.stocks : [];
          setCurrentAccount(names[0]);
          setStocks(raw.map(applyGakuchoMark));
          setLastUpdated(data.lastUpdated ?? null);
        }
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid]);

  // ─── Firestore 保存（fire-and-forget） ───────────────────────────────────
  const saveToFirestore = useCallback(
    (accountName: string, stockList: Stock[], upd?: string | null) => {
      if (!uid || !accountName) return;
      setDoc(
        portfolioRef(uid, accountName),
        { name: accountName, stocks: stockList, lastUpdated: upd !== undefined ? upd : null },
        { merge: true },
      ).catch(console.error);
    },
    [uid],
  );

  // ─── アカウント切り替え ───────────────────────────────────────────────────
  const switchAccount = useCallback(
    async (name: string) => {
      setCurrentAccount(name);
      const snap = await getDoc(portfolioRef(uid, name));
      if (snap.exists()) {
        const data = snap.data();
        const raw: Stock[] = Array.isArray(data.stocks) ? data.stocks : [];
        setStocks(raw.map(applyGakuchoMark));
        setLastUpdated(data.lastUpdated ?? null);
      } else {
        setStocks([]);
        setLastUpdated(null);
      }
    },
    [uid],
  );

  // ─── アカウント追加 ───────────────────────────────────────────────────────
  const addAccount = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setAccounts((prev) => {
        if (prev.includes(trimmed)) return prev;
        return [...prev, trimmed];
      });
      await setDoc(portfolioRef(uid, trimmed), { name: trimmed, stocks: [], lastUpdated: null });
      if (!currentAccount) setCurrentAccount(trimmed);
    },
    [uid, currentAccount],
  );

  // ─── アカウント削除 ───────────────────────────────────────────────────────
  const removeAccount = useCallback(
    async (name: string) => {
      await deleteDoc(portfolioRef(uid, name));
      setAccounts((prev) => {
        const next = prev.filter((a) => a !== name);
        if (currentAccount === name) {
          const nextAcc = next[0] ?? '';
          setCurrentAccount(nextAcc);
          if (nextAcc) {
            switchAccount(nextAcc);
          } else {
            setStocks([]);
            setLastUpdated(null);
          }
        }
        return next;
      });
    },
    [uid, currentAccount, switchAccount],
  );

  // ─── 銘柄削除 ────────────────────────────────────────────────────────────
  const removeStock = useCallback(
    (code: string) => {
      if (!currentAccount) return;
      setStocks((prev) => {
        const next = prev.filter((s) => s.code !== code);
        saveToFirestore(currentAccount, next);
        return next;
      });
    },
    [currentAccount, saveToFirestore],
  );

  // ─── 銘柄更新 ────────────────────────────────────────────────────────────
  const updateStock = useCallback(
    (code: string, changes: Partial<Stock>) => {
      if (!currentAccount) return;
      setStocks((prev) => {
        const next = prev.map((s) => (s.code === code ? { ...s, ...changes } : s));
        saveToFirestore(currentAccount, next);
        return next;
      });
    },
    [currentAccount, saveToFirestore],
  );

  // ─── Yahoo Finance フェッチ（国内株式） ───────────────────────────────────
  const fetchAndSave = useCallback(
    async (targetStocks: Stock[], allStocks: Stock[]) => {
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
          // 5件ごと または 最後のみ UI を更新（再描画回数を削減）
          // startTransition で低優先度にしてマウス操作をブロックしない
          if ((i + 1) % 5 === 0 || i === targetStocks.length - 1) {
            const current = Array.from(map.values());
            startTransition(() => setStocks(current));
          }
          setRefreshProgress({ done: i + 1, total: targetStocks.length });
          if (i < targetStocks.length - 1) await new Promise((r) => setTimeout(r, 300));
        }
        const displayNow = new Date().toLocaleString('ja-JP');
        saveToFirestore(currentAccount, Array.from(map.values()), displayNow);
        setLastUpdated(displayNow);
      } finally {
        setIsRefreshing(false);
        setRefreshProgress({ done: 0, total: 0 });
      }
    },
    [currentAccount, saveToFirestore],
  );

  // ─── 銘柄追加（国内株式） ─────────────────────────────────────────────────
  const addStock = useCallback(
    async (stock: Stock) => {
      if (!currentAccount) return;
      const exists = stocks.find((s) => s.code === stock.code);
      const processed = exists ? stock : applyGakuchoMark(stock);
      const next = exists
        ? stocks.map((s) => (s.code === processed.code ? { ...s, ...processed } : s))
        : [...stocks, processed];
      setStocks(next);
      saveToFirestore(currentAccount, next);
      await fetchAndSave([processed], next);
    },
    [currentAccount, stocks, fetchAndSave, saveToFirestore],
  );

  // ─── CSV インポート ───────────────────────────────────────────────────────
  const importStocks = useCallback(
    async (imported: Stock[]) => {
      if (!currentAccount) return;
      const map = new Map(stocks.map((s) => [s.code, s]));
      for (const s of imported) {
        if (map.has(s.code)) {
          const existing = map.get(s.code)!;
          if (isDomestic(s)) {
            map.set(s.code, { ...existing, shares: s.shares, avgCost: s.avgCost, name: s.name || existing.name });
          } else {
            map.set(s.code, {
              ...s,
              lion: existing.lion, lionManuallySet: existing.lionManuallySet,
              defensive: existing.defensive, defensiveManuallySet: existing.defensiveManuallySet,
              checked: existing.checked, excluded: existing.excluded,
            });
          }
        } else {
          map.set(s.code, applyGakuchoMark(s));
        }
      }
      const merged = Array.from(map.values());
      setStocks(merged);
      saveToFirestore(currentAccount, merged);
      const needsFetch = merged.filter((s) => s.latestPrice === null && isDomestic(s));
      await fetchAndSave(needsFetch, merged);
    },
    [currentAccount, stocks, fetchAndSave, saveToFirestore],
  );

  // ─── 価格一括更新（国内＋米国） ───────────────────────────────────────────
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
        done++;
        // 5件ごと または 最後のみ UI 更新（startTransition で低優先度化）
        if (done % 5 === 0 || done === totalCount) {
          const current = Array.from(map.values());
          startTransition(() => setStocks(current));
        }
        setRefreshProgress({ done, total: totalCount });
        if (done < totalCount) await new Promise((r) => setTimeout(r, 300));
      }
      for (const stock of usStocks) {
        if (!stock.dividendManuallySet) {
          const data = await fetchUsStockData(stock.code);
          if (data.dividendJpy !== null) {
            const updated: Stock = { ...stock, dividendPerShare: data.dividendJpy, lastUpdated: now };
            map.set(updated.code, updated);
          }
        }
        done++;
        if (done % 5 === 0 || done === totalCount) {
          const current = Array.from(map.values());
          startTransition(() => setStocks(current));
        }
        setRefreshProgress({ done, total: totalCount });
        if (done < totalCount) await new Promise((r) => setTimeout(r, 300));
      }
      const displayNow = new Date().toLocaleString('ja-JP');
      saveToFirestore(currentAccount, Array.from(map.values()), displayNow);
      setLastUpdated(displayNow);
    } finally {
      setIsRefreshing(false);
      setRefreshProgress({ done: 0, total: 0 });
    }
  }, [currentAccount, stocks, saveToFirestore]);

  // ─── フラグ切り替え ───────────────────────────────────────────────────────
  const toggleCheck = useCallback((code: string) => {
    if (!currentAccount) return;
    setStocks((prev) => {
      const next = prev.map((s) => (s.code === code ? { ...s, checked: !s.checked } : s));
      saveToFirestore(currentAccount, next);
      return next;
    });
  }, [currentAccount, saveToFirestore]);

  const toggleLion = useCallback((code: string) => {
    if (!currentAccount) return;
    setStocks((prev) => {
      const next = prev.map((s) =>
        s.code === code ? { ...s, lion: !s.lion, lionManuallySet: true } : s,
      );
      saveToFirestore(currentAccount, next);
      return next;
    });
  }, [currentAccount, saveToFirestore]);

  const toggleDefensive = useCallback((code: string) => {
    if (!currentAccount) return;
    setStocks((prev) => {
      const next = prev.map((s) =>
        s.code === code ? { ...s, defensive: !s.defensive, defensiveManuallySet: true } : s,
      );
      saveToFirestore(currentAccount, next);
      return next;
    });
  }, [currentAccount, saveToFirestore]);

  const toggleExclude = useCallback((code: string) => {
    if (!currentAccount) return;
    setStocks((prev) => {
      const next = prev.map((s) => (s.code === code ? { ...s, excluded: !s.excluded } : s));
      saveToFirestore(currentAccount, next);
      return next;
    });
  }, [currentAccount, saveToFirestore]);

  // ─── コード一括追加 ───────────────────────────────────────────────────────
  const bulkAddByCode = useCallback(
    async (codes: string[], onProgress?: (done: number, total: number) => void): Promise<string[]> => {
      if (!currentAccount || codes.length === 0) return [];
      const currentMap = new Map(stocks.map((s) => [s.code, s]));
      for (const code of codes) {
        if (!currentMap.has(code)) {
          const bare: Stock = {
            code, name: code, sector: '', shares: 0,
            avgCost: null, latestPrice: null, dividendPerShare: null,
            lastUpdated: new Date().toISOString(),
          };
          currentMap.set(code, applyGakuchoMark(bare));
        }
      }
      const merged = Array.from(currentMap.values());
      setStocks(merged);
      saveToFirestore(currentAccount, merged);
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
        } catch { failed.push(code); }
        if ((i + 1) % 5 === 0 || i === codes.length - 1) {
          const current = Array.from(workMap.values());
          startTransition(() => setStocks(current));
        }
        onProgress?.(i + 1, codes.length);
        if (i < codes.length - 1) await new Promise((r) => setTimeout(r, 300));
      }
      const displayNow = new Date().toLocaleString('ja-JP');
      saveToFirestore(currentAccount, Array.from(workMap.values()), displayNow);
      setLastUpdated(displayNow);
      return failed;
    },
    [currentAccount, stocks, saveToFirestore],
  );

  // ─── 初回ロード時・アカウント切替時に価格未取得の国内株を自動フェッチ ────
  useEffect(() => {
    const needsFetch = stocks.filter((s) => s.latestPrice === null && isDomestic(s));
    if (needsFetch.length > 0 && !isRefreshing && currentAccount) {
      fetchAndSave(needsFetch, stocks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount]);

  return {
    accounts, currentAccount, stocks, lastUpdated,
    isRefreshing, refreshProgress, loading,
    switchAccount, addAccount, removeAccount,
    addStock, removeStock, updateStock,
    importStocks, refreshPrices,
    toggleCheck, toggleExclude, toggleLion, toggleDefensive,
    bulkAddByCode,
  };
}
