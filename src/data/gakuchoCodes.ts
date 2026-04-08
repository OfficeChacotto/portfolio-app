import type { Stock } from '../types/stock';

export type StockType = 'defensive' | 'cyclical' | 'unknown';

/**
 * 学長高配当マガジン掲載銘柄リスト（景気敏感／ディフェンシブ区分付き）
 */
export const GAKUCHO_LIST: { code: string; type: StockType }[] = [
  { code: '9069', type: 'defensive' },
  { code: '5011', type: 'cyclical' },
  { code: '4832', type: 'cyclical' },
  { code: '4008', type: 'cyclical' },
  { code: '4641', type: 'cyclical' },
  { code: '1951', type: 'defensive' },
  { code: '1723', type: 'defensive' },
  { code: '9769', type: 'defensive' },
  { code: '9368', type: 'defensive' },
  { code: '3834', type: 'defensive' },
  { code: '4042', type: 'cyclical' },
  { code: '6745', type: 'defensive' },
  { code: '6322', type: 'cyclical' },
  { code: '6454', type: 'cyclical' },
  { code: '9882', type: 'cyclical' },
  { code: '4743', type: 'defensive' },
  { code: '9986', type: 'cyclical' },
  { code: '4041', type: 'cyclical' },
  { code: '7931', type: 'cyclical' },
  { code: '4220', type: 'cyclical' },
  { code: '3076', type: 'cyclical' },
  { code: '7820', type: 'cyclical' },
  { code: '7921', type: 'defensive' },
  { code: '208A', type: 'cyclical' },
  { code: '9795', type: 'defensive' },
  { code: '8130', type: 'cyclical' },
  { code: '9303', type: 'defensive' },
  { code: '6539', type: 'unknown' },
  { code: '9960', type: 'cyclical' },
  { code: '5464', type: 'cyclical' },
  { code: '6957', type: 'cyclical' },
  { code: '1928', type: 'cyclical' },
  { code: '6345', type: 'cyclical' },
  { code: '6652', type: 'cyclical' },
  { code: '5388', type: 'defensive' },
  { code: '2169', type: 'defensive' },
  { code: '3817', type: 'cyclical' },
  { code: '2391', type: 'defensive' },
  { code: '2317', type: 'defensive' },
  { code: '6678', type: 'defensive' },
  { code: '7817', type: 'defensive' },
  { code: '9233', type: 'cyclical' },
  { code: '6381', type: 'cyclical' },
  { code: '7994', type: 'defensive' },
  { code: '3231', type: 'cyclical' },
  { code: '1980', type: 'cyclical' },
  { code: '7438', type: 'defensive' },
  { code: '7292', type: 'defensive' },
  { code: '5186', type: 'cyclical' },
  { code: '1976', type: 'defensive' },
  { code: '4752', type: 'cyclical' },
  { code: '2185', type: 'defensive' },
  { code: '7483', type: 'defensive' },
  { code: '9057', type: 'defensive' },
  { code: '6432', type: 'cyclical' },
  { code: '2374', type: 'defensive' },
  { code: '3771', type: 'defensive' },
  { code: '4401', type: 'cyclical' },
  { code: '6458', type: 'defensive' },
  { code: '9304', type: 'cyclical' },
  { code: '4345', type: 'cyclical' },
  { code: '7989', type: 'cyclical' },
  { code: '4540', type: 'defensive' },
  { code: '3333', type: 'defensive' },
  { code: '7749', type: 'defensive' },
  { code: '7723', type: 'defensive' },
  { code: '9381', type: 'defensive' },
  { code: '9687', type: 'defensive' },
  { code: '1414', type: 'cyclical' },
  { code: '2269', type: 'defensive' },
  { code: '2659', type: 'defensive' },
  { code: '6785', type: 'cyclical' },
  { code: '4097', type: 'cyclical' },
  { code: '9364', type: 'defensive' },
  { code: '9757', type: 'cyclical' },
  { code: '3901', type: 'defensive' },
  { code: '4205', type: 'cyclical' },
  { code: '4674', type: 'defensive' },
];

/** O(1) ルックアップ用マップ */
const GAKUCHO_MAP = new Map<string, StockType>(
  GAKUCHO_LIST.map(({ code, type }) => [code, type]),
);

/** コードセット（後方互換・存在チェック用） */
export const GAKUCHO_CODES = new Set<string>(GAKUCHO_LIST.map(({ code }) => code));

/**
 * 銘柄に🦁・🛡️マークを自動付与する。
 *
 * - 🦁: リストに含まれ、かつ lionManuallySet が true でない場合のみ lion: true にする
 * - 🛡️: type === "defensive" で、かつ defensiveManuallySet が true でない場合のみ defensive: true にする
 * - 手動でOFFにした銘柄（ManuallySet: true）は変更しない
 */
export function applyGakuchoMark(stock: Stock): Stock {
  const type = GAKUCHO_MAP.get(stock.code);
  if (type === undefined) return stock; // リスト外の銘柄は変更しない

  let result: Stock = stock;

  // 🦁自動付与
  if (!stock.lionManuallySet) {
    result = { ...result, lion: true };
  }

  // 🛡️自動付与（defensiveのみ）
  if (type === 'defensive' && !stock.defensiveManuallySet) {
    result = { ...result, defensive: true };
  }

  return result;
}
