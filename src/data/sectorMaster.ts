/**
 * 東証33業種 マスターテーブル
 * Yahoo Finance の industry 文字列 → 東証33業種 日本語名 変換に使用
 */

export interface TseSector {
  no: number;
  ja: string;
  en: string;
  topix17: string;
}

/** 東証33業種 正式名称（日本語・英語・TOPIX-17 対応表） */
export const TSE_33_SECTORS: TseSector[] = [
  { no:  1, ja: '水産・農林業',         en: 'Fishery, Agriculture & Forestry', topix17: '食品' },
  { no:  2, ja: '食料品',               en: 'Foods',                            topix17: '食品' },
  { no:  3, ja: '鉱業',                 en: 'Mining',                           topix17: 'エネルギー資源' },
  { no:  4, ja: '石油・石炭製品',       en: 'Oil & Coal Products',              topix17: 'エネルギー資源' },
  { no:  5, ja: '建設業',               en: 'Construction',                     topix17: '建設・資材' },
  { no:  6, ja: '金属製品',             en: 'Metal Products',                   topix17: '建設・資材' },
  { no:  7, ja: 'ガラス・土石製品',     en: 'Glass & Ceramics Products',        topix17: '建設・資材' },
  { no:  8, ja: '繊維製品',             en: 'Textiles & Apparels',              topix17: '素材・化学' },
  { no:  9, ja: 'パルプ・紙',           en: 'Pulp & Paper',                     topix17: '素材・化学' },
  { no: 10, ja: '化学',                 en: 'Chemicals',                        topix17: '素材・化学' },
  { no: 11, ja: '医薬品',               en: 'Pharmaceutical',                   topix17: '医薬品' },
  { no: 12, ja: 'ゴム製品',             en: 'Rubber Products',                  topix17: '自動車・輸送機' },
  { no: 13, ja: '輸送用機器',           en: 'Transportation Equipment',         topix17: '自動車・輸送機' },
  { no: 14, ja: '鉄鋼',                 en: 'Iron & Steel',                     topix17: '鉄鋼・非鉄' },
  { no: 15, ja: '非鉄金属',             en: 'Nonferrous Metals',                topix17: '鉄鋼・非鉄' },
  { no: 16, ja: '機械',                 en: 'Machinery',                        topix17: '機械' },
  { no: 17, ja: '電気機器',             en: 'Electric Appliances',              topix17: '電機・精密' },
  { no: 18, ja: '精密機器',             en: 'Precision Instruments',            topix17: '電機・精密' },
  { no: 19, ja: 'その他製品',           en: 'Other Products',                   topix17: '情報通信・サービスその他' },
  { no: 20, ja: '情報・通信業',         en: 'Information & Communication',      topix17: '情報通信・サービスその他' },
  { no: 21, ja: 'サービス業',           en: 'Services',                         topix17: '情報通信・サービスその他' },
  { no: 22, ja: '電気・ガス業',         en: 'Electric Power & Gas',             topix17: '電気・ガス' },
  { no: 23, ja: '陸運業',               en: 'Land Transportation',              topix17: '運輸・物流' },
  { no: 24, ja: '海運業',               en: 'Marine Transportation',            topix17: '運輸・物流' },
  { no: 25, ja: '空運業',               en: 'Air Transportation',               topix17: '運輸・物流' },
  { no: 26, ja: '倉庫・運輸関連業',     en: 'Warehousing & Transportation Related', topix17: '運輸・物流' },
  { no: 27, ja: '卸売業',               en: 'Wholesale Trade',                  topix17: '商社・卸売' },
  { no: 28, ja: '小売業',               en: 'Retail Trade',                     topix17: '小売' },
  { no: 29, ja: '銀行業',               en: 'Banks',                            topix17: '銀行' },
  { no: 30, ja: '証券、商品先物取引業', en: 'Securities & Commodity Futures',   topix17: '金融（除く銀行）' },
  { no: 31, ja: '保険業',               en: 'Insurance',                        topix17: '金融（除く銀行）' },
  { no: 32, ja: 'その他金融業',         en: 'Other Financing Business',         topix17: '金融（除く銀行）' },
  { no: 33, ja: '不動産業',             en: 'Real Estate',                      topix17: '不動産' },
];

/**
 * Yahoo Finance industry 文字列 → 東証33業種 日本語名
 * Yahoo Finance は em ダッシュ (—) と半角ハイフン (-) が混在するため両方収録
 */
const INDUSTRY_TO_TSE33: Record<string, string> = {
  // ── 水産・農林業 ─────────────────────────────────────
  'Farm Products':                            '水産・農林業',
  'Agricultural Inputs':                      '水産・農林業',
  'Fishing':                                  '水産・農林業',
  'Lumber & Wood Production':                 '水産・農林業',
  'Forest Products':                          '水産・農林業',

  // ── 食料品 ───────────────────────────────────────────
  'Beverages—Brewers':                        '食料品',
  'Beverages—Non-Alcoholic':                  '食料品',
  'Beverages—Wineries & Distilleries':        '食料品',
  'Beverages - Brewers':                      '食料品',
  'Beverages - Non-Alcoholic':                '食料品',
  'Beverages - Wineries & Distilleries':      '食料品',
  'Confectioners':                            '食料品',
  'Packaged Foods':                           '食料品',
  'Tobacco':                                  '食料品',

  // ── 鉱業 ─────────────────────────────────────────────
  'Coal':                                     '鉱業',
  'Coking Coal':                              '鉱業',
  'Thermal Coal':                             '鉱業',
  'Other Industrial Metals & Mining':         '鉱業',
  'Uranium':                                  '鉱業',
  'Oil & Gas Drilling':                       '鉱業',
  'Oil & Gas E&P':                            '鉱業',
  'Oil & Gas Equipment & Services':           '鉱業',

  // ── 石油・石炭製品 ───────────────────────────────────
  'Oil & Gas Refining & Marketing':           '石油・石炭製品',
  'Oil & Gas Integrated':                     '石油・石炭製品',
  'Oil & Gas Midstream':                      '石油・石炭製品',

  // ── 建設業 ───────────────────────────────────────────
  'Engineering & Construction':               '建設業',
  'Infrastructure Operations':                '建設業',
  'Residential Construction':                 '建設業',

  // ── 金属製品 ─────────────────────────────────────────
  'Metal Fabrication':                        '金属製品',
  'Tools & Accessories':                      '金属製品',
  'Metal Products':                           '金属製品',

  // ── ガラス・土石製品 ─────────────────────────────────
  'Building Materials':                       'ガラス・土石製品',
  'Ceramic & Glass Products':                 'ガラス・土石製品',
  'Glass & Ceramics Products':                'ガラス・土石製品',
  'Stone & Ceramics':                         'ガラス・土石製品',
  'Building Products & Equipment':            'ガラス・土石製品',
  'Plumbing':                                 'ガラス・土石製品',
  'Floor & Wall Coverings':                   'ガラス・土石製品',

  // ── 繊維製品 ─────────────────────────────────────────
  'Apparel Manufacturing':                    '繊維製品',
  'Textile Manufacturing':                    '繊維製品',
  'Footwear & Accessories':                   '繊維製品',

  // ── パルプ・紙 ───────────────────────────────────────
  'Paper & Paper Products':                   'パルプ・紙',
  'Packaging & Containers':                   'パルプ・紙',

  // ── 化学 ─────────────────────────────────────────────
  'Specialty Chemicals':                      '化学',
  'Agricultural Chemicals':                   '化学',
  'Chemicals':                                '化学',

  // ── 医薬品 ───────────────────────────────────────────
  'Drug Manufacturers—General':               '医薬品',
  'Drug Manufacturers—Specialty & Generic':   '医薬品',
  'Drug Manufacturers - General':             '医薬品',
  'Drug Manufacturers - Specialty & Generic': '医薬品',
  'Biotechnology':                            '医薬品',
  'Health Information Services':              '医薬品',
  'Healthcare Plans':                         '医薬品',
  'Medical Care Facilities':                  '医薬品',

  // ── ゴム製品 ─────────────────────────────────────────
  'Rubber & Plastics':                        'ゴム製品',

  // ── 輸送用機器 ───────────────────────────────────────
  'Auto Manufacturers':                       '輸送用機器',
  'Auto Parts':                               '輸送用機器',
  'Recreational Vehicles':                    '輸送用機器',
  'Aerospace & Defense':                      '輸送用機器',

  // ── 鉄鋼 ─────────────────────────────────────────────
  'Steel':                                    '鉄鋼',

  // ── 非鉄金属 ─────────────────────────────────────────
  'Aluminum':                                 '非鉄金属',
  'Copper':                                   '非鉄金属',
  'Gold':                                     '非鉄金属',
  'Silver':                                   '非鉄金属',
  'Other Precious Metals & Mining':           '非鉄金属',

  // ── 機械 ─────────────────────────────────────────────
  'Specialty Industrial Machinery':           '機械',
  'Farm & Heavy Construction Machinery':      '機械',
  'General Industrial Machinery':             '機械',
  'Pollution & Treatment Controls':           '機械',
  'Pumps & Valves':                           '機械',
  'Industrial Machinery':                     '機械',
  'Diversified Industrials':                  '機械',

  // ── 電気機器 ─────────────────────────────────────────
  'Electronic Components':                    '電気機器',
  'Semiconductors':                           '電気機器',
  'Consumer Electronics':                     '電気機器',
  'Electrical Equipment & Parts':             '電気機器',
  'Semiconductor Equipment & Materials':      '電気機器',
  'Computer Hardware':                        '電気機器',

  // ── 精密機器 ─────────────────────────────────────────
  'Scientific & Technical Instruments':       '精密機器',
  'Medical Devices':                          '精密機器',
  'Medical Instruments & Supplies':           '精密機器',
  'Diagnostics & Research':                   '精密機器',
  'Optical & Photo Equipment':                '精密機器',

  // ── その他製品 ───────────────────────────────────────
  'Electronic Gaming & Multimedia':           'その他製品',
  'Leisure':                                  'その他製品',
  'Home Furnishings & Fixtures':              'その他製品',
  'Recreational Goods':                       'その他製品',
  'Publishing':                               'その他製品',
  'Toys & Hobby Goods':                       'その他製品',
  'Sporting Goods':                           'その他製品',
  'Personal Products':                        'その他製品',
  'Household & Personal Products':            'その他製品',
  'Household Appliances':                     'その他製品',
  'Wood Products':                            'その他製品',
  'Furnishings, Fixtures & Appliances':       'その他製品',

  // ── 情報・通信業 ─────────────────────────────────────
  'Telecom Services':                         '情報・通信業',
  'Internet Content & Information':           '情報・通信業',
  'Software—Application':                     '情報・通信業',
  'Software—Infrastructure':                  '情報・通信業',
  'Software - Application':                   '情報・通信業',
  'Software - Infrastructure':                '情報・通信業',
  'Communication Equipment':                  '情報・通信業',
  'Information Technology Services':          '情報・通信業',
  'Broadcasting':                             '情報・通信業',
  'Media—Broadcasting & Radio':               '情報・通信業',
  'Media - Broadcasting & Radio':             '情報・通信業',
  'Internet Service Providers':               '情報・通信業',

  // ── サービス業 ───────────────────────────────────────
  'Staffing & Employment Services':           'サービス業',
  'Printing Services':                        'サービス業',
  'Commercial Printing':                      'サービス業',
  'Business Services':                        'サービス業',
  'Outsourcing & IT Consulting':              'サービス業',
  'Specialty Business Services':              'サービス業',
  'Waste Management':                         'サービス業',
  'Security & Protection Services':           'サービス業',
  'Education & Training Services':            'サービス業',
  'Personal Services':                        'サービス業',
  'Research & Consulting Services':           'サービス業',
  'Rental & Leasing Services':                'サービス業',
  'Entertainment':                            'サービス業',
  'Media—Diversified':                        'サービス業',
  'Media - Diversified':                      'サービス業',
  'Gambling':                                 'サービス業',
  'Travel & Leisure':                         'サービス業',
  'Hotels & Resorts':                         'サービス業',
  'Advertising Agencies':                     'サービス業',
  'Auto Services':                            'サービス業',
  'Health & Wellness Services':               'サービス業',
  'Funeral Services':                         'サービス業',

  // ── 電気・ガス業 ─────────────────────────────────────
  'Utilities—Regulated Electric':             '電気・ガス業',
  'Utilities—Regulated Gas':                  '電気・ガス業',
  'Utilities—Diversified':                    '電気・ガス業',
  'Utilities - Regulated Electric':           '電気・ガス業',
  'Utilities - Regulated Gas':                '電気・ガス業',
  'Utilities - Diversified':                  '電気・ガス業',
  'Utilities - Independent Power Producers':  '電気・ガス業',
  'Utilities - Renewable':                    '電気・ガス業',
  'Utilities—Renewable':                      '電気・ガス業',
  'Utilities—Independent Power Producers':    '電気・ガス業',

  // ── 陸運業 ───────────────────────────────────────────
  'Trucking':                                 '陸運業',
  'Railroads':                                '陸運業',
  'Ground Transportation':                    '陸運業',

  // ── 海運業 ───────────────────────────────────────────
  'Marine Shipping':                          '海運業',

  // ── 空運業 ───────────────────────────────────────────
  'Airlines':                                 '空運業',
  'Airports & Air Services':                  '空運業',

  // ── 倉庫・運輸関連業 ─────────────────────────────────
  'Integrated Freight & Logistics':           '倉庫・運輸関連業',
  'Air Freight & Logistics':                  '倉庫・運輸関連業',
  'Warehousing & Ports':                      '倉庫・運輸関連業',
  'Courier Services':                         '倉庫・運輸関連業',
  'Shipping & Ports':                         '倉庫・運輸関連業',
  'Marine Ports & Services':                  '倉庫・運輸関連業',

  // ── 卸売業 ───────────────────────────────────────────
  'Electronics & Computer Distribution':      '卸売業',
  'Business Equipment & Supplies':            '卸売業',
  'Food Distribution':                        '卸売業',
  'Industrial Distribution':                  '卸売業',
  'Wholesale':                                '卸売業',
  // 総合商社・コングロマリット → 卸売業
  'Conglomerates':                            '卸売業',
  'Industrial Conglomerates':                 '卸売業',
  'Trading Companies & Distributors':         '卸売業',

  // ── 小売業 ───────────────────────────────────────────
  'Department Stores':                        '小売業',
  'Grocery Stores':                           '小売業',
  'Home Improvement Retail':                  '小売業',
  'Specialty Retail':                         '小売業',
  'Internet Retail':                          '小売業',
  'Discount Stores':                          '小売業',
  'Pharmaceutical Retailers':                 '小売業',
  'Apparel Retail':                           '小売業',
  'Luxury Goods':                             '小売業',
  'Restaurants':                              '小売業',
  'Retail—Apparel & Specialty':               '小売業',
  'Retail - Apparel & Specialty':             '小売業',
  'Auto & Truck Dealerships':                 '小売業',

  // ── 銀行業 ───────────────────────────────────────────
  'Banks—Regional':                           '銀行業',
  'Banks—Diversified':                        '銀行業',
  'Banks - Regional':                         '銀行業',
  'Banks - Diversified':                      '銀行業',
  'Mortgage Finance':                         '銀行業',

  // ── 証券、商品先物取引業 ─────────────────────────────
  'Capital Markets':                          '証券、商品先物取引業',
  'Financial Data & Stock Exchanges':         '証券、商品先物取引業',
  'Asset Management':                         '証券、商品先物取引業',

  // ── 保険業 ───────────────────────────────────────────
  'Insurance—Life':                           '保険業',
  'Insurance—Diversified':                    '保険業',
  'Insurance—Property & Casualty':            '保険業',
  'Insurance—Reinsurance':                    '保険業',
  'Insurance—Specialty':                      '保険業',
  'Insurance - Life':                         '保険業',
  'Insurance - Diversified':                  '保険業',
  'Insurance - Property & Casualty':          '保険業',
  'Insurance - Reinsurance':                  '保険業',
  'Insurance - Specialty':                    '保険業',

  // ── その他金融業 ─────────────────────────────────────
  'Credit Services':                          'その他金融業',
  'Financial—Conglomerates':                  'その他金融業',
  'Financial - Conglomerates':                'その他金融業',
  'Financial Conglomerates':                  'その他金融業',
  'Specialty Finance':                        'その他金融業',
  'Diversified Financial Services':           'その他金融業',
  'Consumer Finance':                         'その他金融業',
  'Financial Services':                       'その他金融業',

  // ── 不動産業 ─────────────────────────────────────────
  'Real Estate—General':                      '不動産業',
  'Real Estate—Development':                  '不動産業',
  'Real Estate - General':                    '不動産業',
  'Real Estate - Development':               '不動産業',
  'Real Estate Services':                     '不動産業',
  'Real Estate - Diversified':                '不動産業',
  'REIT—Diversified':                         '不動産業',
  'REIT—Industrial':                          '不動産業',
  'REIT—Office':                              '不動産業',
  'REIT—Residential':                         '不動産業',
  'REIT—Retail':                              '不動産業',
  'REIT—Hotel & Motel':                       '不動産業',
  'REIT—Specialty':                           '不動産業',
  'REIT—Healthcare Facilities':               '不動産業',
  'REIT—Mortgage':                            '不動産業',
  'REIT - Diversified':                       '不動産業',
  'REIT - Industrial':                        '不動産業',
  'REIT - Office':                            '不動産業',
  'REIT - Residential':                       '不動産業',
  'REIT - Retail':                            '不動産業',
  'REIT - Hotel & Motel':                     '不動産業',
  'REIT - Specialty':                         '不動産業',
  'REIT - Healthcare Facilities':             '不動産業',
  'REIT - Mortgage':                          '不動産業',
  'Real Estate—Diversified':                  '不動産業',
};

/**
 * Yahoo Finance の industry 分類が東証33業種と合わない銘柄を
 * 銘柄コード（数字4桁）で直接上書きするテーブル
 *
 * Yahoo Finance が "Conglomerates" 等の広義カテゴリに入れてしまう
 * 製造業・化学系銘柄などを正しい業種に修正する
 */
const TICKER_SECTOR_OVERRIDE: Record<string, string> = {
  // ── 化学 ──────────────────────────────────────────────
  '4204': '化学',   // 積水化学工業（Yahoo: Conglomerates）
  '4005': '化学',   // 住友化学
  '4183': '化学',   // 三井化学
  '4188': '化学',   // 三菱ケミカルグループ
  // ── 機械 ──────────────────────────────────────────────
  '6302': '機械',   // 住友重機械工業
  // ── 建設業 ────────────────────────────────────────────
  '1925': '建設業', // 大和ハウス工業（Yahoo: Conglomerates）
  '1928': '建設業', // 積水ハウス（Yahoo: Conglomerates）
};

/**
 * Yahoo Finance の industry / quoteType から東証33業種（日本語）を返す
 * マスターに存在しない industry は「その他」を返す
 *
 * @param industry   Yahoo Finance v1/search の industry フィールド
 * @param quoteType  Yahoo Finance v1/search の quoteType フィールド（'ETF' 等）
 * @param name       IR Bank 取得の日本語銘柄名（ETF の J-REIT 判別に使用）
 * @param ticker     銘柄コード（4桁）— override テーブルの照合に使用
 */
export function getSectorJa(
  industry: string | null | undefined,
  quoteType: string | null | undefined,
  name?: string | null,
  ticker?: string | null,
): string {
  // 銘柄コード override（Yahoo Finance 分類が東証と異なるケース）
  if (ticker) {
    const code = ticker.replace(/\.T$/i, ''); // "4204.T" → "4204"
    if (TICKER_SECTOR_OVERRIDE[code]) return TICKER_SECTOR_OVERRIDE[code];
  }

  if (quoteType === 'ETF') {
    // ASCII "REIT" またはカタカナ「リート」を含む場合は J-REIT
    if (name && (/REIT/i.test(name) || name.includes('リート'))) return 'J-REIT';
    return 'ETF';
  }
  if (!industry) return 'その他';
  return INDUSTRY_TO_TSE33[industry] ?? 'その他';
}
