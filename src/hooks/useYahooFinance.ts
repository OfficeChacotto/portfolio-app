import type { Stock } from '../types/stock';
import { getSectorJa } from '../data/sectorMaster';

// jpxSectorMap は初回レンダリング不要のため遅延読み込み（273KB 削減）
let _jpxMap: Record<string, { name: string; sector: string }> | null = null;
async function getJpxMap(): Promise<Record<string, { name: string; sector: string }>> {
  if (!_jpxMap) {
    const mod = await import('../data/jpxSectorMap');
    _jpxMap = mod.JPX_MAP;
  }
  return _jpxMap;
}

// 開発環境: Vite proxy (/yahoo-api, /irbank-proxy)
// 本番環境: corsproxy.io 経由で直接アクセス
const isProd = import.meta.env.PROD;
const YAHOO_BASE = isProd
  ? 'https://corsproxy.io/?https://query2.finance.yahoo.com'
  : '/yahoo-api';
const IRBANK_BASE = isProd
  ? 'https://corsproxy.io/?https://irbank.net'
  : '/irbank-proxy';

interface YahooQuoteResponse {
  quoteResponse: {
    result: Array<{
      symbol: string;
      regularMarketPrice?: number;
    }> | null;
    error?: unknown;
  };
}

interface YahooChartResult {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        shortName?: string;
        longName?: string;
      };
      events?: {
        dividends?: Record<string, { amount: number; date: number }>;
      };
    }> | null;
    error?: unknown;
  };
}

interface YahooSearchResult {
  quotes: Array<{
    symbol: string;
    quoteType?: string;
    sector?: string;
    industry?: string;
  }> | null;
}

interface BreadcrumbItem {
  '@type': string;
  position: number;
  name: string;
  item?: string;
}

/** 429 Too Many Requests を受けたら指数バックオフでリトライする fetch */
async function apiFetch<T>(url: string, maxRetries = 4): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (res.status === 429) {
      // レート制限: 2秒 → 4秒 → 8秒 → 16秒 と待機してリトライ
      const waitMs = 2000 * Math.pow(2, attempt);
      console.warn(`429 rate limit, waiting ${waitMs}ms before retry (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, waitMs));
      lastError = new Error('HTTP 429');
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }
  throw lastError;
}

/** 過去12ヶ月の配当を合算して年間配当単価を計算 */
function calcAnnualDividend(
  dividends: Record<string, { amount: number; date: number }> | undefined
): number | null {
  if (!dividends) return null;
  const oneYearAgo = Date.now() / 1000 - 365 * 24 * 3600;
  const total = Object.values(dividends)
    .filter((d) => d.date >= oneYearAgo)
    .reduce((sum, d) => sum + d.amount, 0);
  return total > 0 ? total : null;
}

/** Yahoo Finance v8 chart から価格・配当を取得 */
async function fetchYahooChart(ticker: string): Promise<{
  price: number | null;
  dividend: number | null;
}> {
  try {
    const url = `${YAHOO_BASE}/v8/finance/chart/${ticker}?interval=1d&range=2y&events=div`;
    const data = await apiFetch<YahooChartResult>(url);
    const result = data?.chart?.result?.[0];
    return {
      price: result?.meta?.regularMarketPrice ?? null,
      dividend: calcAnnualDividend(result?.events?.dividends),
    };
  } catch (e) {
    console.warn(`Yahoo Finance chart fetch failed for ${ticker}:`, e);
    return { price: null, dividend: null };
  }
}

/**
 * Yahoo Finance v1/search から quoteType と industry を取得
 * 業種は getSectorJa() で東証33業種（日本語）に変換する
 */
async function fetchYahooSearch(ticker: string): Promise<{
  quoteType: string | null;
  industry: string | null;
}> {
  try {
    const url = `${YAHOO_BASE}/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=1&newsCount=0&enableFuzzyQuery=false`;
    const data = await apiFetch<YahooSearchResult>(url);
    const quote = data?.quotes?.[0];
    const industry = quote?.industry ?? null;
    return {
      quoteType: quote?.quoteType ?? null,
      industry,
    };
  } catch (e) {
    console.warn(`Yahoo Finance search failed for ${ticker}:`, e);
    return { quoteType: null, industry: null };
  }
}

/**
 * IR Bank から日本語銘柄名のみ取得
 * BreadcrumbList の構造:
 *   通常株: position2=業種, position3=銘柄名
 *   ETF/ファンド: position2=銘柄名, position3="株式情報"
 */
async function fetchIRBankName(code: string): Promise<string | null> {
  try {
    const res = await fetch(`${IRBANK_BASE}/${code}`, {
      headers: { 'Accept': 'text/html,application/xhtml+xml' },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
    let match;
    while ((match = re.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]) as {
          '@type': string;
          itemListElement?: BreadcrumbItem[];
        };
        if (data['@type'] === 'BreadcrumbList' && Array.isArray(data.itemListElement)) {
          const items = data.itemListElement;
          const pos2 = items.find((i) => i.position === 2)?.name ?? null;
          const pos3 = items.find((i) => i.position === 3)?.name ?? null;

          // ETF/ファンド: position3 = "株式情報" → position2 が銘柄名
          // 通常株: position3 が銘柄名
          const rawName = pos3 === '株式情報' ? pos2 : pos3;

          // 末尾の利回り表記 "(2.4%)" 等を除去
          return rawName ? rawName.replace(/\s*\(\d+(?:\.\d+)?%\)\s*$/, '').trim() : null;
        }
      } catch {
        // JSON parse 失敗はスキップ
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** USD/JPY レートを Yahoo Finance から取得 */
async function fetchUsdJpy(): Promise<number | null> {
  try {
    const data = await apiFetch<YahooChartResult>(
      `${YAHOO_BASE}/v8/finance/chart/USDJPY%3DX?interval=1d&range=5d`
    );
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

/**
 * 複数の国内銘柄の株価を一括取得（v7/finance/quote バッチAPI）
 * 1リクエストで最大50銘柄を取得できるため、個別取得より大幅に高速
 * 配当データは含まれないため株価のみの更新に使用する
 */
export async function fetchBatchPrices(
  codes: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, number | null>> {
  const QUOTE_BATCH = 50;
  const result = new Map<string, number | null>();
  for (let i = 0; i < codes.length; i += QUOTE_BATCH) {
    const batch = codes.slice(i, i + QUOTE_BATCH);
    const tickers = batch.map((c) => `${c}.T`).join(',');
    try {
      const url = `${YAHOO_BASE}/v7/finance/quote?symbols=${encodeURIComponent(tickers)}&fields=regularMarketPrice`;
      const data = await apiFetch<YahooQuoteResponse>(url);
      for (const q of data?.quoteResponse?.result ?? []) {
        result.set(q.symbol.replace(/\.T$/i, ''), q.regularMarketPrice ?? null);
      }
    } catch (e) {
      console.warn(`Batch quote failed (offset ${i}):`, e);
      for (const code of batch) result.set(code, null);
    }
    const done = Math.min(i + QUOTE_BATCH, codes.length);
    onProgress?.(done, codes.length);
    if (i + QUOTE_BATCH < codes.length) await new Promise((r) => setTimeout(r, 600));
  }
  return result;
}

/**
 * 米国株式の配当を Yahoo Finance から取得し、JPY 換算して返す
 * ticker はサフィックスなし（例: "VYM", "AAPL"）
 */
export async function fetchUsStockData(ticker: string): Promise<{
  dividendUsd: number | null;
  dividendJpy: number | null;
}> {
  const [chart, usdJpy] = await Promise.all([
    fetchYahooChart(ticker),
    fetchUsdJpy(),
  ]);
  const dividendUsd = chart.dividend;
  const dividendJpy =
    dividendUsd !== null && usdJpy !== null ? dividendUsd * usdJpy : null;
  return { dividendUsd, dividendJpy };
}

export async function fetchStockData(code: string): Promise<{
  price: number | null;
  name: string | null;
  dividend: number | null;
  sector: string | null;
}> {
  const ticker = `${code}.T`;

  // JPXマップに銘柄名があればIRBankへのアクセスを省略（リクエスト削減）
  const jpxMap = await getJpxMap();
  const jpxEntry = jpxMap[code];
  const jpxName = jpxEntry?.name ?? null;

  // 価格・配当は Yahoo Finance chart から取得
  const chart = await fetchYahooChart(ticker);

  // 業種決定: JPXマップ優先、なければ Yahoo Finance search のフォールバック
  let sector: string;
  if (jpxEntry) {
    sector = jpxEntry.sector;
  } else {
    const search = await fetchYahooSearch(ticker);
    const irName = await fetchIRBankName(code);
    sector = getSectorJa(search.industry, search.quoteType, irName);
  }

  // 銘柄名: JPXマップ優先、なければ IRBank から取得
  const name = jpxName ?? await fetchIRBankName(code);

  return {
    price: chart.price,
    name,
    dividend: chart.dividend,
    sector,
  };
}

export async function refreshAllStocks(
  stocks: Stock[],
  onProgress?: (done: number, total: number) => void
): Promise<Stock[]> {
  const updated: Stock[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < stocks.length; i++) {
    const stock = stocks[i];
    const data = await fetchStockData(stock.code);

    updated.push({
      ...stock,
      latestPrice: data.price ?? stock.latestPrice,
      name: data.name ?? stock.name,
      sector: data.sector ?? stock.sector,
      dividendPerShare: stock.dividendManuallySet
        ? stock.dividendPerShare
        : (data.dividend ?? stock.dividendPerShare),
      lastUpdated: now,
    });

    onProgress?.(i + 1, stocks.length);
    if (i < stocks.length - 1) await new Promise((r) => setTimeout(r, 400));
  }

  return updated;
}
