import type { Stock } from '../types/stock';

const ACCOUNTS_KEY = 'portfolio_accounts';

export function getAccounts(): string[] {
  try {
    const data = localStorage.getItem(ACCOUNTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveAccounts(accounts: string[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getPortfolio(accountName: string): Stock[] {
  try {
    const data = localStorage.getItem(`portfolio_${accountName}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function savePortfolio(accountName: string, stocks: Stock[]): void {
  localStorage.setItem(`portfolio_${accountName}`, JSON.stringify(stocks));
}

export function getLastUpdated(accountName: string): string | null {
  return localStorage.getItem(`portfolio_${accountName}_lastUpdated`);
}

export function saveLastUpdated(accountName: string, dateStr: string): void {
  localStorage.setItem(`portfolio_${accountName}_lastUpdated`, dateStr);
}

export function deleteAccount(accountName: string): void {
  localStorage.removeItem(`portfolio_${accountName}`);
  localStorage.removeItem(`portfolio_${accountName}_lastUpdated`);
  localStorage.removeItem(`portfolio_${accountName}_passwordHash`);
  localStorage.removeItem(`portfolio_${accountName}_assetSummary`); // legacy cleanup
}

// --- Password functions using Web Crypto SHA-256 ---

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hasAccountPassword(accountName: string): boolean {
  return localStorage.getItem(`portfolio_${accountName}_passwordHash`) !== null;
}

export function getAccountPasswordHash(accountName: string): string | null {
  return localStorage.getItem(`portfolio_${accountName}_passwordHash`);
}

export async function verifyAccountPassword(accountName: string, password: string): Promise<boolean> {
  const stored = getAccountPasswordHash(accountName);
  if (!stored) return true;
  const hash = await hashPassword(password);
  return hash === stored;
}

export async function setAccountPassword(accountName: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  localStorage.setItem(`portfolio_${accountName}_passwordHash`, hash);
}

export function removeAccountPassword(accountName: string): void {
  localStorage.removeItem(`portfolio_${accountName}_passwordHash`);
}
