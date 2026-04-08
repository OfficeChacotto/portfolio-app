import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'login' | 'register' | 'reset';

function getFirebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'メールアドレスまたはパスワードが正しくありません';
    case 'auth/email-already-in-use':
      return 'このメールアドレスはすでに使用されています';
    case 'auth/weak-password':
      return 'パスワードは6文字以上にしてください';
    case 'auth/invalid-email':
      return 'メールアドレスの形式が正しくありません';
    case 'auth/too-many-requests':
      return 'ログイン試行が多すぎます。しばらく待ってから再試行してください';
    default:
      return 'エラーが発生しました。もう一度お試しください';
  }
}

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const reset = (next: Mode) => {
    setMode(next);
    setError('');
    setPassword('');
    setConfirmPassword('');
    setResetSent(false);
  };

  const handleLogin = async () => {
    if (!email || !password) { setError('メールアドレスとパスワードを入力してください'); return; }
    setLoading(true); setError('');
    try {
      await signIn(email, password);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      setError(getFirebaseErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password) { setError('メールアドレスとパスワードを入力してください'); return; }
    if (password !== confirmPassword) { setError('パスワードが一致しません'); return; }
    if (password.length < 6) { setError('パスワードは6文字以上にしてください'); return; }
    setLoading(true); setError('');
    try {
      await signUp(email, password);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      setError(getFirebaseErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { setError('メールアドレスを入力してください'); return; }
    setLoading(true); setError('');
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      setError(getFirebaseErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    if (mode === 'login') handleLogin();
    else if (mode === 'register') handleRegister();
    else handleReset();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* タイトル */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 text-center">
          高配当株ポートフォリオ
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
          {mode === 'login' && 'ログイン'}
          {mode === 'register' && '新規アカウント登録'}
          {mode === 'reset' && 'パスワードリセット'}
        </p>

        {/* エラー */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* リセット送信完了 */}
        {resetSent && (
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 text-sm rounded-lg px-4 py-3 mb-4">
            パスワードリセットメールを送信しました。メールをご確認ください。
          </div>
        )}

        {/* フォーム */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="example@email.com"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              autoFocus
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === 'register' ? '6文字以上' : 'パスワード'}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                パスワード（確認）
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="パスワードを再入力"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          )}

          {/* メインボタン */}
          <button
            onClick={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleReset}
            disabled={loading || resetSent}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm mt-1"
          >
            {loading ? '処理中...' : mode === 'login' ? 'ログイン' : mode === 'register' ? '登録する' : 'リセットメールを送信'}
          </button>
        </div>

        {/* モード切り替えリンク */}
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2 text-center text-sm">
          {mode === 'login' && (
            <>
              <p className="text-gray-500 dark:text-gray-400">
                アカウントをお持ちでない方は{' '}
                <button onClick={() => reset('register')} className="text-blue-600 hover:underline font-medium">
                  新規登録
                </button>
              </p>
              <p>
                <button onClick={() => reset('reset')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs">
                  パスワードをお忘れの方
                </button>
              </p>
            </>
          )}
          {mode === 'register' && (
            <p className="text-gray-500 dark:text-gray-400">
              すでにアカウントをお持ちの方は{' '}
              <button onClick={() => reset('login')} className="text-blue-600 hover:underline font-medium">
                ログイン
              </button>
            </p>
          )}
          {mode === 'reset' && (
            <p>
              <button onClick={() => reset('login')} className="text-blue-600 hover:underline font-medium text-xs">
                ← ログインに戻る
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
