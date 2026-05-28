import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import type { User } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { db } from './firebase/config';
import { useAuth } from './contexts/AuthContext';
import { useFirestorePortfolio } from './hooks/useFirestorePortfolio';
import AccountSelector from './components/AccountSelector';
import AddStockForm from './components/AddStockForm';
import StockTable from './components/StockTable';
import SummaryCards from './components/SummaryCards';
const PortfolioChart = lazy(() => import('./components/PortfolioChart'));
import AuthPage from './pages/AuthPage';
import MigrationDialog from './components/MigrationDialog';
import { getAccounts, getPortfolio, getLastUpdated } from './utils/localStorage';

type Tab = 'table' | 'chart';

// ─── ローカルデータを Firestore に移行 ────────────────────────────────────────
async function migrateLocalToFirestore(uid: string): Promise<void> {
  const localAccounts = getAccounts();
  for (const name of localAccounts) {
    const stocks = getPortfolio(name);
    const lastUpdated = getLastUpdated(name);
    await setDoc(
      doc(db, 'users', uid, 'portfolios', name),
      { name, stocks, lastUpdated: lastUpdated ?? null },
      { merge: true },
    );
  }
}

// ─── 認証済みユーザー用メインアプリ ──────────────────────────────────────────
function AppMain({ user }: { user: User }) {
  const {
    accounts,
    currentAccount,
    stocks,
    lastUpdated,
    isRefreshing,
    refreshProgress,
    loading,
    switchAccount,
    addAccount,
    removeAccount,
    addStock,
    removeStock,
    updateStock,
    importStocks,
    quickRefreshPrices,
    refreshPrices,
    toggleCheck,
    toggleExclude,
    toggleLion,
    toggleDefensive,
    bulkAddByCode,
  } = useFirestorePortfolio(user.uid);

  const [activeTab, setActiveTab] = useState<Tab>('table');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [showMigration, setShowMigration] = useState(false);

  // ダークモード
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  // Firestore にデータが無く、ローカルにある場合のみ移行ダイアログを表示
  useEffect(() => {
    if (loading) return;
    if (accounts.length === 0 && getAccounts().length > 0) {
      setShowMigration(true);
    }
  }, [loading, accounts.length]);

  // 初回ログイン（Firestoreにも何もない場合）: デフォルトアカウントを自動作成
  const handleSetupDefault = useCallback(async () => {
    await addAccount('マイポートフォリオ');
    await switchAccount('マイポートフォリオ');
  }, [addAccount, switchAccount]);

  useEffect(() => {
    if (loading) return;
    if (accounts.length === 0 && getAccounts().length === 0) {
      handleSetupDefault();
    }
  }, [loading, accounts.length, handleSetupDefault]);

  const handleMigrate = useCallback(async () => {
    await migrateLocalToFirestore(user.uid);
    // ページをリロードして Firestore データを再取得
    window.location.reload();
  }, [user.uid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* ヘッダー */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white whitespace-nowrap">
                高配当株ポートフォリオ
              </h1>
              <AccountSelector
                accounts={accounts}
                currentAccount={currentAccount}
                onSwitch={switchAccount}
                onAdd={addAccount}
                onRemove={removeAccount}
                hidePasswordFeature={true}
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {lastUpdated && (
                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  最終更新: {lastUpdated}
                </span>
              )}
              {/* 株価のみ高速更新 */}
              <button
                onClick={quickRefreshPrices}
                disabled={isRefreshing || stocks.length === 0}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="株価のみ高速更新（配当は更新しません）"
              >
                {isRefreshing ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {refreshProgress.total > 0
                      ? `${refreshProgress.done}/${refreshProgress.total}`
                      : '更新中...'}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    株価更新
                  </>
                )}
              </button>

              {/* フル更新（株価＋配当） */}
              <button
                onClick={refreshPrices}
                disabled={isRefreshing || stocks.length === 0}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="株価と配当を両方更新します（時間がかかります）"
              >
                {isRefreshing ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {refreshProgress.total > 0
                      ? `${refreshProgress.done}/${refreshProgress.total}`
                      : '更新中...'}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    フル更新
                  </>
                )}
              </button>

              {/* ダークモード切替 */}
              <button
                onClick={() => setDarkMode((d) => !d)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title={darkMode ? 'ライトモード' : 'ダークモード'}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>

              {/* ユーザー情報＆ログアウト */}
              <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block max-w-[140px] truncate">
                  {user.email}
                </span>
                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        {/* サマリーカード */}
        <SummaryCards stocks={stocks} />

        {/* 銘柄追加・CSVインポート */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <AddStockForm onAdd={addStock} onImport={importStocks} onBulkAdd={bulkAddByCode} />
        </div>

        {/* タブ切り替え */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
          {(['table', 'chart'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'table' ? '銘柄一覧' : 'グラフ分析'}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        {activeTab === 'table' ? (
          <StockTable
            stocks={stocks}
            onUpdateStock={updateStock}
            onRemoveStock={removeStock}
            onToggleCheck={toggleCheck}
            onToggleExclude={toggleExclude}
            onToggleLion={toggleLion}
            onToggleDefensive={toggleDefensive}
          />
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <Suspense fallback={<div className="text-center py-12 text-gray-400">読み込み中...</div>}>
              <PortfolioChart stocks={stocks} />
            </Suspense>
          </div>
        )}
      </main>

      {/* リフレッシュオーバーレイ */}
      {isRefreshing && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/40 flex items-end justify-center pb-8 z-50 pointer-events-none">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl px-6 py-4 flex items-center gap-3">
            <svg className="animate-spin w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Yahoo! ファイナンスから価格を取得中...
              {refreshProgress.total > 0 && (
                <span className="ml-2 font-medium">
                  {refreshProgress.done} / {refreshProgress.total}
                </span>
              )}
            </span>
            <div className="w-40 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{
                  width: refreshProgress.total > 0
                    ? `${(refreshProgress.done / refreshProgress.total) * 100}%`
                    : '0%',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* データ移行ダイアログ */}
      {showMigration && (
        <MigrationDialog
          accountCount={getAccounts().length}
          onMigrate={handleMigrate}
          onSkip={() => setShowMigration(false)}
        />
      )}
    </div>
  );
}

// ─── ログアウトボタン ─────────────────────────────────────────────────────────
function LogoutButton() {
  const { logOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try { await logOut(); } finally { setLoading(false); }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
      title="ログアウト"
    >
      {loading ? '...' : 'ログアウト'}
    </button>
  );
}

// ─── 認証ゲート ───────────────────────────────────────────────────────────────
export default function App() {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <svg className="animate-spin w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <AppMain user={user} />;
}
