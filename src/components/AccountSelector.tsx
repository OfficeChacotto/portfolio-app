import { useState } from 'react';
import {
  hasAccountPassword,
  setAccountPassword,
  verifyAccountPassword,
  removeAccountPassword,
} from '../utils/localStorage';

interface Props {
  accounts: string[];
  currentAccount: string;
  onSwitch: (name: string) => void;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  /** Firebase 認証使用時は true を渡すと🔒パスワード機能を非表示にする */
  hidePasswordFeature?: boolean;
}

type PasswordStep = 'menu' | 'set' | 'verify-change' | 'change' | 'verify-remove' | 'done';

export default function AccountSelector({ accounts, currentAccount, onSwitch, onAdd, onRemove, hidePasswordFeature = false }: Props) {
  const [newName, setNewName] = useState('');
  const [showInput, setShowInput] = useState(false);

  // Password management state
  const [managingAccount, setManagingAccount] = useState<string | null>(null);
  const [passwordStep, setPasswordStep] = useState<PasswordStep>('menu');
  const [passwordInput, setPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd(newName.trim());
    onSwitch(newName.trim());
    setNewName('');
    setShowInput(false);
  };

  const openPasswordManager = (acc: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setManagingAccount(acc);
    setPasswordStep('menu');
    setPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setPasswordError('');
    setPasswordSuccess('');
  };

  const closePasswordManager = () => {
    setManagingAccount(null);
    setPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setPasswordError('');
    setPasswordSuccess('');
  };

  const handleSetPassword = async () => {
    if (!managingAccount) return;
    if (!newPasswordInput) {
      setPasswordError('パスワードを入力してください');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError('パスワードが一致しません');
      return;
    }
    await setAccountPassword(managingAccount, newPasswordInput);
    setPasswordSuccess('パスワードを設定しました');
    setPasswordError('');
    setPasswordStep('done');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
  };

  const handleVerifyForChange = async () => {
    if (!managingAccount) return;
    const ok = await verifyAccountPassword(managingAccount, passwordInput);
    if (!ok) {
      setPasswordError('パスワードが違います');
      return;
    }
    setPasswordError('');
    setPasswordInput('');
    setPasswordStep('change');
  };

  const handleChangePassword = async () => {
    if (!managingAccount) return;
    if (!newPasswordInput) {
      setPasswordError('新しいパスワードを入力してください');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError('パスワードが一致しません');
      return;
    }
    await setAccountPassword(managingAccount, newPasswordInput);
    setPasswordSuccess('パスワードを変更しました');
    setPasswordError('');
    setPasswordStep('done');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
  };

  const handleVerifyForRemove = async () => {
    if (!managingAccount) return;
    const ok = await verifyAccountPassword(managingAccount, passwordInput);
    if (!ok) {
      setPasswordError('パスワードが違います');
      return;
    }
    removeAccountPassword(managingAccount);
    setPasswordSuccess('パスワードを削除しました');
    setPasswordError('');
    setPasswordStep('done');
    setPasswordInput('');
  };

  const renderPasswordManager = () => {
    if (!managingAccount) return null;
    const hasPw = hasAccountPassword(managingAccount);

    return (
      <div
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
        onClick={closePasswordManager}
      >
        <div
          className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              🔒 「{managingAccount}」のパスワード設定
            </h3>
            <button
              onClick={closePasswordManager}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          {passwordError && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400 mb-3">{passwordSuccess}</p>
          )}

          {passwordStep === 'menu' && (
            <div className="space-y-2">
              {!hasPw ? (
                <button
                  onClick={() => { setPasswordStep('set'); setPasswordError(''); setPasswordSuccess(''); }}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700"
                >
                  パスワードを設定する
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setPasswordStep('verify-change'); setPasswordError(''); setPasswordSuccess(''); }}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700"
                  >
                    パスワードを変更する
                  </button>
                  <button
                    onClick={() => { setPasswordStep('verify-remove'); setPasswordError(''); setPasswordSuccess(''); }}
                    className="w-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 py-2 rounded-lg text-sm hover:bg-red-200 dark:hover:bg-red-900/50"
                  >
                    パスワードを削除する
                  </button>
                </>
              )}
              <button
                onClick={closePasswordManager}
                className="w-full py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                キャンセル
              </button>
            </div>
          )}

          {passwordStep === 'set' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">新しいパスワード</label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="パスワード"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">確認</label>
                <input
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="パスワード（確認）"
                />
              </div>
              <button
                onClick={handleSetPassword}
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                設定する
              </button>
              <button
                onClick={() => { setPasswordStep('menu'); setPasswordError(''); }}
                className="w-full py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                戻る
              </button>
            </div>
          )}

          {passwordStep === 'verify-change' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">現在のパスワード</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyForChange()}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="現在のパスワード"
                  autoFocus
                />
              </div>
              <button
                onClick={handleVerifyForChange}
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                確認する
              </button>
              <button
                onClick={() => { setPasswordStep('menu'); setPasswordError(''); }}
                className="w-full py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                戻る
              </button>
            </div>
          )}

          {passwordStep === 'change' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">新しいパスワード</label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="新しいパスワード"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">確認</label>
                <input
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="確認"
                />
              </div>
              <button
                onClick={handleChangePassword}
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                変更する
              </button>
              <button
                onClick={() => { setPasswordStep('menu'); setPasswordError(''); }}
                className="w-full py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                戻る
              </button>
            </div>
          )}

          {passwordStep === 'verify-remove' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">パスワードを確認してから削除します</p>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">現在のパスワード</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyForRemove()}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="現在のパスワード"
                  autoFocus
                />
              </div>
              <button
                onClick={handleVerifyForRemove}
                className="w-full bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700"
              >
                削除する
              </button>
              <button
                onClick={() => { setPasswordStep('menu'); setPasswordError(''); }}
                className="w-full py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                戻る
              </button>
            </div>
          )}

          {passwordStep === 'done' && (
            <div className="space-y-3">
              <button
                onClick={closePasswordManager}
                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                閉じる
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">アカウント:</span>
        {accounts.map((acc) => {
          const hasPw = !hidePasswordFeature && hasAccountPassword(acc);
          return (
            <div key={acc} className="flex items-center gap-1">
              <button
                onClick={() => onSwitch(acc)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  acc === currentAccount
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {acc}
              </button>
              {/* Lock icon for password management（Firebase 認証時は非表示） */}
              {!hidePasswordFeature && (
                <button
                  onClick={(e) => openPasswordManager(acc, e)}
                  className={`text-sm leading-none transition-colors ${
                    hasPw
                      ? 'text-orange-500 hover:text-orange-600'
                      : 'text-gray-300 hover:text-gray-500 dark:hover:text-gray-400'
                  }`}
                  title={hasPw ? 'パスワード設定済み' : 'パスワードを設定する'}
                >
                  🔒
                </button>
              )}
              {accounts.length > 1 && (
                <button
                  onClick={() => {
                    if (confirm(`「${acc}」を削除しますか？`)) onRemove(acc);
                  }}
                  className="text-gray-400 hover:text-red-500 text-xs"
                  title="削除"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        {showInput ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="アカウント名"
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-32 bg-white dark:bg-gray-800 dark:text-white"
              autoFocus
            />
            <button
              onClick={handleAdd}
              className="bg-blue-600 text-white px-2 py-1 rounded text-sm hover:bg-blue-700"
            >
              追加
            </button>
            <button
              onClick={() => { setShowInput(false); setNewName(''); }}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              キャンセル
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            className="px-3 py-1 rounded-full text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 border border-dashed border-gray-400"
          >
            + 新規
          </button>
        )}
      </div>

      {renderPasswordManager()}
    </>
  );
}
