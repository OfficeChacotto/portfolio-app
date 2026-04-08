import type { Stock } from '../types/stock';

// ---------------------------------------------------------------------------
// 通貨エイリアス（参考為替レートの日本語名 ↔ 通貨コード）
// ---------------------------------------------------------------------------
const CURRENCY_ALIASES: Record<string, string[]> = {
  USD: ['米ドル', 'ドル'],
  EUR: ['ユーロ'],
  GBP: ['英ポンド', 'ポンド'],
  AUD: ['オーストラリアドル', '豪ドル'],
  CAD: ['カナダドル'],
  CHF: ['スイスフラン'],
  CNY: ['中国元', '人民元'],
  SGD: ['シンガポールドル'],
  HKD: ['香港ドル'],
  NZD: ['ニュージーランドドル', 'NZドル'],
  KRW: ['韓国ウォン', 'ウォン'],
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$',
  CHF: 'CHF', CNY: '¥', SGD: 'S$', HKD: 'HK$', NZD: 'NZ$', KRW: '₩',
};

function normalizeCurrencyKey(key: string): string {
  const k = key.trim();
  if (CURRENCY_SYMBOLS[k]) return k; // Already a code
  for (const [code, aliases] of Object.entries(CURRENCY_ALIASES)) {
    if (aliases.includes(k)) return code;
  }
  return k;
}

function getFxRate(rates: Map<string, number>, key: string): number {
  const normalized = normalizeCurrencyKey(key);
  if (rates.has(key)) return rates.get(key)!;
  if (rates.has(normalized)) return rates.get(normalized)!;
  // Try aliases
  const aliases = CURRENCY_ALIASES[normalized] ?? [];
  for (const alias of aliases) {
    if (rates.has(alias)) return rates.get(alias)!;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// ■参考為替レート セクションのパース
// ---------------------------------------------------------------------------
function parseFxRates(lines: string[]): Map<string, number> {
  const rates = new Map<string, number>();
  let inSection = false;
  let currIdx = -1;
  let rateIdx = -1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inSection) {
      if (trimmed.includes('参考為替レート')) { inSection = true; }
      continue;
    }
    if (trimmed.startsWith('■') && !trimmed.includes('参考為替レート')) break;
    if (!trimmed) continue;

    const cols = parseCsvLine(line);
    if (cols.length < 2) continue;

    if (currIdx === -1) {
      const ci = cols.findIndex(c => ['通貨', '通貨名'].includes(c.replace(/"/g, '').trim()));
      if (ci !== -1) {
        // ヘッダー行あり: 列インデックスを確定してこの行はスキップ
        currIdx = ci;
        rateIdx = cols.findIndex(c =>
          ['レート', '為替レート', '参考為替レート'].includes(c.replace(/"/g, '').trim()),
        );
        if (rateIdx === -1) rateIdx = ci + 1;
        continue;
      }
      // ヘッダーなしフォーマット（例: 直接「米ドル, 158.36, 円/USD, ...」）:
      // col0=通貨名, col1=レート として扱い、この行もデータとして処理する
      currIdx = 0;
      rateIdx = 1;
    }

    if (currIdx !== -1 && rateIdx !== -1) {
      const currency = cols[currIdx]?.replace(/"/g, '').trim() ?? '';
      const rateRaw = cols[rateIdx]?.replace(/[",]/g, '').trim() ?? '';
      const rate = parseFloat(rateRaw);
      if (currency && !isNaN(rate) && rate > 0) {
        rates.set(currency, rate);
        // Also store normalized code
        const code = normalizeCurrencyKey(currency);
        if (code !== currency) rates.set(code, rate);
      }
    }
  }
  return rates;
}

// ---------------------------------------------------------------------------
// 列インデックスマップ生成
// ---------------------------------------------------------------------------
function buildColIdx(headers: string[]) {
  return {
    code:           findColIdx(headers, ['銘柄コード・ティッカー', '銘柄コード', 'コード']),
    name:           findColIdx(headers, ['銘柄', '銘柄名']),
    // 投資信託は「保有口数」、国内株式は「保有数量」
    shares:         findColIdx(headers, ['保有数量', '数量', '外貨金額', '保有口数']),
    avgCost:        findColIdx(headers, ['平均取得価額', '取得単価', '平均取得価額[円換算]', '平均取得価額（円換算）', '平均取得単価']),
    costJpy:        findColIdx(headers, ['取得金額', '取得金額[円]', '取得金額（円）', '買付金額']),
    type:           findColIdx(headers, ['種別', '商品種別']),
    marketValueJpy: findColIdx(headers, ['時価評価額[円]', '評価額[円]', '時価評価額（円）', '評価額（円）']),
    // 「時価評価額[外貨]」はCSVフォーマットによって列名が異なる
    marketValueFx:  findColIdx(headers, ['時価評価額[USD]', '時価評価額(USD)', '評価額[USD]', '評価額(USD)', '時価評価額[外貨]', '評価額[外貨]']),
  };
}

/** ヘッダー行かどうか（銘柄コード または 種別 を含む行） */
function isHeaderLine(line: string): boolean {
  return (line.includes('銘柄コード') || line.includes('銘柄コード・ティッカー'));
}

// ---------------------------------------------------------------------------
// メイン CSV パーサー → Stock[] を返す（全資産クラス対応）
// ---------------------------------------------------------------------------
/**
 * 楽天証券「保有商品の評価額合計」CSV をパースしてすべての資産クラスを Stock[] として返す
 *
 * 楽天証券のCSVは ■国内株式, ■投資信託, ■米国株式 などのセクションに分かれており、
 * 各セクションが独自のヘッダー行・列構造を持つ。本関数は全セクションを独立してパースする。
 */
export function parseRakutenCsv(csvText: string): Stock[] {
  const lines = csvText.split(/\r?\n/);

  // Step 1: 参考為替レートをパース
  const fxRates = parseFxRates(lines);

  // Step 2: ■ セクション境界を収集（■参考為替レートは除外）
  const sectionStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('■') && !t.includes('参考為替レート')) {
      sectionStarts.push(i);
    }
  }

  // セクション境界 [start, end) の配列を構築
  // セクションが見つからない場合はファイル全体を 1 セクションとして扱う（後方互換）
  const sections: Array<{ start: number; end: number }> =
    sectionStarts.length > 0
      ? sectionStarts.map((start, si) => ({
          start,
          end: si + 1 < sectionStarts.length ? sectionStarts[si + 1] : lines.length,
        }))
      : [{ start: 0, end: lines.length }];

  const allStocks: Stock[] = [];
  const now = new Date().toISOString();

  // Step 3: 各セクションを独立してパース
  for (const { start, end } of sections) {
    // セクション内のヘッダー行を探す（■ 行の直後数行以内）
    let headerIdx = -1;
    for (let i = start; i < end; i++) {
      const l = lines[i];
      if (isHeaderLine(l) && l.includes('種別')) { headerIdx = i; break; }
    }
    if (headerIdx === -1) {
      for (let i = start; i < end; i++) {
        if (isHeaderLine(lines[i])) { headerIdx = i; break; }
      }
    }
    if (headerIdx === -1) continue; // このセクションにはヘッダーがない → スキップ

    const headers = parseCsvLine(lines[headerIdx]);
    const idx = buildColIdx(headers);

    // データ行を処理
    for (let i = headerIdx + 1; i < end; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;
      // セクション内の小計行（合計行）はスキップ
      if (isHeaderLine(trimmed)) continue;

      const cols = parseCsvLine(line);
      if (cols.length < 2) continue;

      const typeVal = idx.type !== -1 ? (cols[idx.type]?.trim() ?? '') : '';

    // ---- 国内株式 ----
    if (typeVal.includes('国内株式')) {
      const code = (cols[idx.code]?.trim().replace(/"/g, '') ?? '').replace(/\s/g, '');
      if (!code || !/^\d{4}$/.test(code)) continue;

      const name = clean(cols[idx.name]);
      const shares = parseNum(cols[idx.shares]);
      const avgCostRaw = idx.avgCost !== -1 ? cols[idx.avgCost]?.replace(/,/g, '').trim() : '';
      const avgCost = avgCostRaw && avgCostRaw !== '-' ? parseFloat(avgCostRaw) : null;

      allStocks.push({
        code, name, sector: '',
        shares: isNaN(shares) ? 0 : shares,
        avgCost: avgCost !== null && !isNaN(avgCost) ? avgCost : null,
        latestPrice: null,
        dividendPerShare: null,
        lastUpdated: now,
        // assetClass: undefined = domestic (backward compat)
      });

    // ---- 米国株式 ----
    } else if (typeVal.includes('米国株式')) {
      const code = clean(cols[idx.code]);
      if (!code) continue;
      const name = clean(cols[idx.name]);
      const jpyTotal = parseJpy(cols, idx.marketValueJpy);
      const fxTotal = parseJpy(cols, idx.marketValueFx);
      const sharesRaw = parseNum(cols[idx.shares]);
      const shares = sharesRaw > 0 ? sharesRaw : 1;
      const latestPriceJpy = jpyTotal > 0 ? jpyTotal / shares : null;

      // 平均取得価額はUSD建て → ■参考為替レートのUSDJPYで円換算
      const avgCostRaw = idx.avgCost !== -1 ? cols[idx.avgCost]?.replace(/,/g, '').trim() : '';
      const avgCostUsd = avgCostRaw && avgCostRaw !== '-' ? parseFloat(avgCostRaw) : null;
      const usdJpy = getFxRate(fxRates, 'USD') || getFxRate(fxRates, '米ドル') || getFxRate(fxRates, 'ドル');
      // USD建てをJPY換算。為替レートが取得できない場合はnullにして損益計算を回避
      const avgCostJpy =
        avgCostUsd !== null && !isNaN(avgCostUsd) && usdJpy > 0
          ? Math.round(avgCostUsd * usdJpy)
          : null;

      allStocks.push({
        code, name,
        sector: '米国株式',
        shares,
        latestPrice: latestPriceJpy,
        avgCost: avgCostJpy,
        dividendPerShare: null,
        lastUpdated: now,
        assetClass: 'us',
        foreignCurrency: 'USD',
        foreignAmount: fxTotal > 0 ? fxTotal : undefined,
      });

    // ---- 投資信託 ----
    } else if (typeVal.includes('投資信託')) {
      const rawCode = clean(cols[idx.code]);
      const name = clean(cols[idx.name]);
      if (!name && !rawCode) continue;
      const jpyTotal = parseJpy(cols, idx.marketValueJpy);
      const costTotal = parseJpy(cols, idx.costJpy);
      // sharesRaw = 口数（非常に大きい場合あり）。shares=1 として評価額を price に入れる
      // コードがない場合は銘柄名から生成。スペース除去後24文字使用して衝突を防ぐ
      // （例: "eMAXIS Slim 米国株式" と "eMAXIS Slim 全世界株式" が同コードにならないよう）
      const code = rawCode || name.replace(/[\s\u3000]/g, '').slice(0, 24) || 'TRUST';

      allStocks.push({
        code, name,
        sector: '投資信託',
        shares: 1,
        latestPrice: jpyTotal > 0 ? jpyTotal : null,
        avgCost: costTotal > 0 ? costTotal : null,
        dividendPerShare: null,
        lastUpdated: now,
        assetClass: 'trust',
      });

    // ---- 外貨預り金 ----
    } else if (typeVal.includes('外貨預り金')) {
      const rawCode = clean(cols[idx.code]);
      const rawName = clean(cols[idx.name]);
      const currencyKey = rawCode || rawName;
      const currencyCode = normalizeCurrencyKey(currencyKey);
      const foreignAmt = parseNum(cols[idx.shares]);

      let jpyPerUnit = getFxRate(fxRates, currencyKey);
      const jpyTotal = parseJpy(cols, idx.marketValueJpy);
      if (jpyTotal > 0 && foreignAmt > 0) {
        jpyPerUnit = jpyTotal / foreignAmt; // derive from CSV if available
      } else if (jpyTotal > 0 && foreignAmt === 0) {
        // No foreign amount - use total as latestPrice with shares=1
        allStocks.push({
          code: currencyCode || 'FX',
          name: rawName || currencyCode,
          sector: '外貨預り金',
          shares: 1,
          latestPrice: jpyTotal,
          avgCost: null,
          dividendPerShare: null,
          lastUpdated: now,
          assetClass: 'foreignCash',
          foreignCurrency: currencyCode || undefined,
        });
        continue;
      }

      if (!currencyCode && foreignAmt === 0 && jpyTotal === 0) continue;

      allStocks.push({
        code: currencyCode || 'FX',
        name: rawName || currencyCode || '外貨',
        sector: '外貨預り金',
        shares: foreignAmt > 0 ? foreignAmt : 1,
        latestPrice: jpyPerUnit > 0 ? jpyPerUnit : jpyTotal || null,
        avgCost: null,
        dividendPerShare: null,
        lastUpdated: now,
        assetClass: 'foreignCash',
        foreignCurrency: currencyCode || undefined,
        foreignAmount: foreignAmt > 0 ? foreignAmt : undefined,
      });

    // ---- 金・プラチナ ----
    } else if (typeVal.includes('金') || typeVal.includes('プラチナ')) {
      const name = clean(cols[idx.name]) || typeVal;
      const jpyTotal = parseJpy(cols, idx.marketValueJpy);
      const costTotal = parseJpy(cols, idx.costJpy);
      const code = name.includes('プラチナ') ? 'PLAT'
        : name.includes('金') ? 'GOLD'
        : 'PRECIOUS';

      if (jpyTotal === 0) continue;

      allStocks.push({
        code, name,
        sector: '金・プラチナ',
        shares: 1,
        latestPrice: jpyTotal,
        avgCost: costTotal > 0 ? costTotal : null,
        dividendPerShare: null,
        lastUpdated: now,
        assetClass: 'goldPlatinum',
      });
    }
    } // end data row loop
  } // end section loop

  // Step 4: 国内株式の重複コードは保有数を合算、非国内は後勝ち
  const map = new Map<string, Stock>();
  for (const s of allStocks) {
    if (map.has(s.code)) {
      const existing = map.get(s.code)!;
      if (!s.assetClass || s.assetClass === 'domestic') {
        // 国内株式: 口座が分かれている場合は保有数を合算
        existing.shares += s.shares;
      } else {
        // 非国内: 同じコードが複数あれば後で上書き
        map.set(s.code, s);
      }
    } else {
      map.set(s.code, s);
    }
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
function clean(cell: string | undefined): string {
  return (cell ?? '').replace(/^"|"$/g, '').trim();
}

function parseJpy(cols: string[], jpyIdx: number): number {
  if (jpyIdx === -1) return 0;
  const raw = cols[jpyIdx]?.replace(/[,"]/g, '').trim() ?? '';
  if (!raw || raw === '-') return 0;
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : n;
}

function parseNum(cell: string | undefined): number {
  const raw = (cell ?? '').replace(/,/g, '').trim();
  if (!raw || raw === '-') return 0;
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : n;
}

function findColIdx(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex(h => h.replace(/"/g, '').trim() === c);
    if (i !== -1) return i;
  }
  return -1;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
