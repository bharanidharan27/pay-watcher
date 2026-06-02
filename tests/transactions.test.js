import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTransaction,
  filterTransactions,
  mergeTransactions,
  sortTransactions,
  summarizeTransactions,
  transactionsToCsv,
} from '../src/transactions.js';

test('buildTransaction trims text, normalizes amount, and requires merchant and amount', () => {
  assert.throws(
    () => buildTransaction({ merchant: '', amount: '12' }),
    /Merchant is required/,
  );
  assert.throws(
    () => buildTransaction({ merchant: 'Cafe', amount: 'abc' }),
    /Amount must be a positive number/,
  );
  assert.throws(
    () => buildTransaction({ merchant: 'Cafe', amount: '-5' }),
    /Amount must be a positive number/,
  );

  const txn = buildTransaction({
    merchant: '  Cafe  ',
    amount: '12.345',
    card: '  Mom Visa ',
    category: ' Food ',
    date: '2026-06-02',
    note: ' Latte ',
  });

  assert.equal(txn.merchant, 'Cafe');
  assert.equal(txn.amount, 12.35);
  assert.equal(txn.card, 'Mom Visa');
  assert.equal(txn.category, 'Food');
  assert.equal(txn.date, '2026-06-02');
  assert.equal(txn.note, 'Latte');
  assert.match(txn.id, /^txn-/);
  assert.match(txn.createdAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('filterTransactions matches text, card, category, and date range', () => {
  const transactions = [
    buildTransaction({
      merchant: 'Target',
      amount: 45,
      card: 'Dad Amex',
      category: 'Household',
      date: '2026-06-01',
    }),
    buildTransaction({
      merchant: 'Metro',
      amount: 8.5,
      card: 'Mom Visa',
      category: 'Transit',
      date: '2026-06-02',
    }),
    buildTransaction({
      merchant: 'Coffee Bar',
      amount: 5.75,
      card: 'Mom Visa',
      category: 'Food',
      date: '2026-06-03',
    }),
  ];

  const result = filterTransactions(transactions, {
    query: 'mom',
    card: 'Mom Visa',
    category: 'Transit',
    from: '2026-06-01',
    to: '2026-06-02',
  });

  assert.deepEqual(
    result.map((txn) => txn.merchant),
    ['Metro'],
  );
});

test('summarizeTransactions returns totals, counts, and grouped amounts', () => {
  const transactions = [
    buildTransaction({ merchant: 'A', amount: 10, card: 'Dad Amex', category: 'Food', date: '2026-06-01' }),
    buildTransaction({ merchant: 'B', amount: 20.25, card: 'Mom Visa', category: 'Fuel', date: '2026-06-02' }),
    buildTransaction({ merchant: 'C', amount: 4.25, card: 'Dad Amex', category: 'Food', date: '2026-06-02' }),
  ];

  const summary = summarizeTransactions(transactions);

  assert.equal(summary.total, 34.5);
  assert.equal(summary.count, 3);
  assert.equal(summary.byCard['Dad Amex'], 14.25);
  assert.equal(summary.byCard['Mom Visa'], 20.25);
  assert.equal(summary.byCategory.Food, 14.25);
  assert.equal(summary.byCategory.Fuel, 20.25);
});

test('transactionsToCsv escapes values and keeps stable column order', () => {
  const transactions = [
    buildTransaction({
      merchant: 'Corner "Market"',
      amount: 3.5,
      card: 'Shared Visa',
      category: 'Food, drinks',
      date: '2026-06-02',
      note: 'receipt saved',
    }),
  ];

  const csv = transactionsToCsv(transactions);

  assert.equal(
    csv,
    [
      'Date,Merchant,Amount,Card,Category,Note,Logged At,Id',
      '2026-06-02,"Corner ""Market""",3.50,Shared Visa,"Food, drinks",receipt saved',
    ].join('\n') + `,${transactions[0].createdAt},${transactions[0].id}`,
  );
});

test('sortTransactions returns newest dates first without mutating the source list', () => {
  const oldest = buildTransaction({
    merchant: 'Old',
    amount: 2,
    date: '2026-06-01',
    createdAt: '2026-06-01T10:00:00.000Z',
  });
  const newest = buildTransaction({
    merchant: 'New',
    amount: 3,
    date: '2026-06-03',
    createdAt: '2026-06-03T10:00:00.000Z',
  });
  const sameDayLater = buildTransaction({
    merchant: 'Later',
    amount: 4,
    date: '2026-06-01',
    createdAt: '2026-06-01T12:00:00.000Z',
  });
  const source = [oldest, newest, sameDayLater];

  const sorted = sortTransactions(source);

  assert.deepEqual(
    sorted.map((txn) => txn.merchant),
    ['New', 'Later', 'Old'],
  );
  assert.deepEqual(
    source.map((txn) => txn.merchant),
    ['Old', 'New', 'Later'],
  );
});

test('mergeTransactions dedupes by id and lets imported entries update existing ones', () => {
  const existing = buildTransaction({
    id: 'txn-shared',
    merchant: 'Old Name',
    amount: 12,
    date: '2026-06-01',
  });
  const imported = buildTransaction({
    id: 'txn-shared',
    merchant: 'Updated Name',
    amount: 12,
    date: '2026-06-01',
  });
  const extra = buildTransaction({
    id: 'txn-extra',
    merchant: 'Extra',
    amount: 2,
    date: '2026-06-03',
  });

  const merged = mergeTransactions([existing], [imported, extra]);

  assert.equal(merged.length, 2);
  assert.deepEqual(
    merged.map((txn) => txn.merchant),
    ['Extra', 'Updated Name'],
  );
});
