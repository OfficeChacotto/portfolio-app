import { useState } from 'react';

interface Props {
  accountCount: number;
  onMigrate: () => Promise<void>;
  onSkip: () => void;
}

export default function MigrationDialog({ accountCount, onMigrate, onSkip }: Props) {
  const [migrating, setMigrating] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleMigrate = async () => {
    setMigrating(true);
    setError('');
    try {
      await onMigrate();
      setDone(true);
    } catch {
      setError('移行中にエラーが発生しました。もう一度お試しください。');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 w-full max-w-md">
        {done ? (
          <>
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">✅</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                移行完了
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                ポートフォリオデータをクラウドに移行しました。
              </p>
            </div>
            <button
              onClick={onSkip}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              閉じる
            </button>
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">📦</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                既存データの移行
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                このデバイスに保存されているポートフォリオデータ（{accountCount}件）が見つかりました。
                クラウドに移行しますか？
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                移行後もローカルデータはそのまま残ります。
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={handleMigrate}
                disabled={migrating}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {migrating ? '移行中...' : 'クラウドに移行する'}
              </button>
              <button
                onClick={onSkip}
                disabled={migrating}
                className="w-full py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                スキップ（新規で始める）
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
