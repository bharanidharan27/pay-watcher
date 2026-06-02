import { buildTransaction, sortTransactions } from './transactions.js';

export const STORAGE_KEY = 'pay-watcher:transactions:v1';

export function loadTransactions(storage = getBrowserStorage()) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return parseTransactionPayload(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveTransactions(transactions, storage = getBrowserStorage()) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(payload, null, 2));
}

export function parseImportedTransactions(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Import file must contain valid JSON');
  }

  return parseTransactionPayload(parsed, true);
}

function parseTransactionPayload(payload, shouldThrow = false) {
  const transactions = Array.isArray(payload) ? payload : payload?.transactions;
  if (!Array.isArray(transactions)) {
    if (shouldThrow) {
      throw new Error('Import file must contain a transaction array');
    }
    return [];
  }

  return sortTransactions(transactions.map((txn) => buildTransaction(txn)));
}

function getBrowserStorage() {
  if (!globalThis.localStorage) {
    throw new Error('localStorage is not available');
  }
  return globalThis.localStorage;
}
