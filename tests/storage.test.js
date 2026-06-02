import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadTransactions,
  parseImportedTransactions,
  saveTransactions,
  STORAGE_KEY,
} from '../src/storage.js';
import { buildTransaction } from '../src/transactions.js';

test('saveTransactions and loadTransactions round-trip normalized transactions', () => {
  const storage = createMemoryStorage();
  const transaction = buildTransaction({
    merchant: 'Bookstore',
    amount: 19.99,
    card: 'Family Visa',
    category: 'Books',
    date: '2026-06-02',
  });

  saveTransactions([transaction], storage);
  const loaded = loadTransactions(storage);

  assert.equal(storage.getItem(STORAGE_KEY).includes('Bookstore'), true);
  assert.deepEqual(loaded, [transaction]);
});

test('loadTransactions returns an empty list for missing or malformed storage', () => {
  const storage = createMemoryStorage();

  assert.deepEqual(loadTransactions(storage), []);

  storage.setItem(STORAGE_KEY, '{not-json');

  assert.deepEqual(loadTransactions(storage), []);
});

test('parseImportedTransactions accepts arrays or wrapped transaction exports', () => {
  const input = {
    transactions: [
      {
        merchant: 'Grocery',
        amount: '31.2',
        card: 'Dad Amex',
        category: 'Food',
        date: '2026-06-02',
      },
    ],
  };

  const imported = parseImportedTransactions(JSON.stringify(input));

  assert.equal(imported.length, 1);
  assert.equal(imported[0].merchant, 'Grocery');
  assert.equal(imported[0].amount, 31.2);
});

test('parseImportedTransactions rejects JSON without a transaction array', () => {
  assert.throws(
    () => parseImportedTransactions('{"hello":"world"}'),
    /Import file must contain a transaction array/,
  );
});

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}
