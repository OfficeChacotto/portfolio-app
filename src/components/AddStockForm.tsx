import { useState, useRef } from 'react';
import type { Stock, ASSET_CLASS_LABELS } from '../types/stock';
import { parseRakutenCsv } from '../utils/csvParser';

// Helper to get label for asset class
const ACL = { domestic: '国内株式', us: '米国株式', trust: '投資信託', foreignCash: '外貨預り金', goldPlatinum: '金・プラチナ' } as typeof ASSET_CLASS_LABELS;

interface Props {
  onAdd: (stock: Stock) => Promise<void>;
  onImport: (stocks: Stock[]) => Promise<void>;
  onBulkAdd: (
    codes: string[],
    onProgress: (done: number, total: number) => void,
  ) => Promise<string[]>;
}

export default function AddStockForm({ onAdd, onImport, onBulkAdd }: Props) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const bulkFileRef = useRef<HTMLInputElement>(null);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkFailed, setBulkFailed] = useState<string[]>([]);

  const handleAdd = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!/^\d{4}$/.test(trimmed)) {
      setError('4桁の証券コードを入力してください');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const stock: Stock = {
        code: trimmed,
        name: trimmed,
        sector: '',
        shares: 0,
        avgCost: null,
        latestPrice: null,
        dividendPerShare: null,
        lastUpdated: new Date().toISOString(),
        watchlist: true,
      };
      await onAdd(stock);
      setCode('');
    } catch {
      setError('銘柄データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 楽天証券CSV インポート（全資産クラス対応）
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    try {
      const buffer = await file.arrayBuffer();
      let text: string;
      try {
        const decoder = new TextDecoder('shift-jis');
        text = decoder.decode(buffer);
        if (!text.includes('銘柄') && !text.includes('コード')) {
          text = new TextDecoder('utf-8').decode(buffer);
        }
      } catch {
        text = new TextDecoder('utf-8').decode(buffer);
      }

      const stocks = parseRakutenCsv(text);
      if (stocks.length === 0) {
        setError('取り込める銘柄・資産が見つかりませんでした。CSVフォーマットを確認してください。');
        return;
      }

      await onImport(stocks);

      // インポート結果サマリーを生成
      const classCounts: Partial<Record<string, number>> = {};
      for (const s of stocks) {
        const cls = s.assetClass ?? 'domestic';
        classCounts[cls] = (classCounts[cls] ?? 0) + 1;
      }
      const parts = Object.entries(classCounts).map(
        ([cls, count]) => `${ACL[cls as keyof typeof ACL] ?? cls} ${count}件`,
      );
      const domesticCount = classCounts['domestic'] ?? 0;
      alert(`インポート完了: ${parts.join('・')}${domesticCount > 0 ? '\n（国内株式は株価を取得中です）' : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSVの読み込みに失敗しました');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // コードのみCSV 一括追加
  const handleBulkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setBulkFailed([]);

    let text: string;
    try {
      text = await file.text();
    } catch {
      setError('ファイルの読み込みに失敗しました');
      if (bulkFileRef.current) bulkFileRef.current.value = '';
      return;
    }

    const codes = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^\d{4}$/.test(l));

    const uniqueCodes = [...new Set(codes)];

    if (uniqueCodes.length === 0) {
      setError('有効な4桁の証券コードが見つかりませんでした');
      if (bulkFileRef.current) bulkFileRef.current.value = '';
      return;
    }

    setIsBulkAdding(true);
    setBulkProgress({ done: 0, total: uniqueCodes.length });

    try {
      const failed = await onBulkAdd(uniqueCodes, (done, total) => {
        setBulkProgress({ done, total });
      });
      setBulkFailed(failed);
      if (failed.length === 0) {
        alert(`${uniqueCodes.length}銘柄を追加しました`);
      }
    } catch {
      setError('一括追加中にエラーが発生しました');
    } finally {
      setIsBulkAdding(false);
      setBulkProgress({ done: 0, total: 0 });
      if (bulkFileRef.current) bulkFileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* コード手入力追加 */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="証券コード (例: 1234)"
            maxLength={4}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm w-40 bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            disabled={isLoading || isBulkAdding}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '取得中...' : '銘柄追加'}
          </button>
        </div>

        {/* 楽天証券CSVインポート */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isBulkAdding}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            CSV インポート
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
          <span className="text-xs text-gray-500 dark:text-gray-400">楽天証券フォーマット</span>
        </div>

        {/* コードのみCSV 一括追加 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => bulkFileRef.current?.click()}
            disabled={isBulkAdding || isLoading}
            className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isBulkAdding
              ? `${bulkProgress.done} / ${bulkProgress.total} 件取得中...`
              : 'CSVで一括追加'}
          </button>
          <input ref={bulkFileRef} type="file" accept=".csv,.txt" onChange={handleBulkFileChange} className="hidden" />
          <span className="text-xs text-gray-500 dark:text-gray-400">1行1コード形式</span>
        </div>
      </div>

      {/* プログレスバー */}
      {isBulkAdding && bulkProgress.total > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-violet-600 h-2 rounded-full transition-all"
              style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {bulkProgress.done} / {bulkProgress.total}
          </span>
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {bulkFailed.length > 0 && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
          <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
            以下の{bulkFailed.length}銘柄のデータ取得に失敗しました（手動で確認してください）:
          </p>
          <p className="text-sm text-red-600 dark:text-red-300 font-mono">
            {bulkFailed.join('、')}
          </p>
        </div>
      )}
    </div>
  );
}
