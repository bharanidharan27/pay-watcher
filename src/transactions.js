const FALLBACK_CARD = 'Family card';
const FALLBACK_CATEGORY = 'Uncategorized';

export function buildTransaction(input) {
  const merchant = cleanText(input.merchant);
  if (!merchant) {
    throw new Error('Merchant is required');
  }

  const amount = roundMoney(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  return {
    id: cleanText(input.id) || createId(),
    merchant,
    amount,
    card: cleanText(input.card) || FALLBACK_CARD,
    category: cleanText(input.category) || FALLBACK_CATEGORY,
    date: cleanDate(input.date),
    note: cleanText(input.note),
    createdAt: cleanText(input.createdAt) || new Date().toISOString(),
  };
}

export function filterTransactions(transactions, filters = {}) {
  const query = cleanText(filters.query).toLowerCase();
  const card = cleanText(filters.card);
  const category = cleanText(filters.category);
  const from = cleanText(filters.from);
  const to = cleanText(filters.to);

  return transactions.filter((txn) => {
    const haystack = [
      txn.merchant,
      txn.card,
      txn.category,
      txn.note,
      txn.amount.toFixed(2),
      txn.date,
    ].join(' ').toLowerCase();

    return (
      (!query || haystack.includes(query)) &&
      (!card || txn.card === card) &&
      (!category || txn.category === category) &&
      (!from || txn.date >= from) &&
      (!to || txn.date <= to)
    );
  });
}

export function summarizeTransactions(transactions) {
  const summary = {
    count: transactions.length,
    total: 0,
    byCard: {},
    byCategory: {},
  };

  for (const txn of transactions) {
    summary.total = roundMoney(summary.total + txn.amount);
    summary.byCard[txn.card] = roundMoney((summary.byCard[txn.card] || 0) + txn.amount);
    summary.byCategory[txn.category] = roundMoney(
      (summary.byCategory[txn.category] || 0) + txn.amount,
    );
  }

  return summary;
}

export function transactionsToCsv(transactions) {
  const header = ['Date', 'Merchant', 'Amount', 'Card', 'Category', 'Note', 'Logged At', 'Id'];
  const rows = transactions.map((txn) => [
    txn.date,
    txn.merchant,
    txn.amount.toFixed(2),
    txn.card,
    txn.category,
    txn.note,
    txn.createdAt,
    txn.id,
  ]);

  return [header, ...rows].map((row) => row.map(formatCsvCell).join(',')).join('\n');
}

export function mergeTransactions(existingTransactions, incomingTransactions) {
  const byId = new Map();
  for (const txn of existingTransactions) {
    const normalized = buildTransaction(txn);
    byId.set(normalized.id, normalized);
  }
  for (const txn of incomingTransactions) {
    const normalized = buildTransaction(txn);
    byId.set(normalized.id, normalized);
  }
  return sortTransactions([...byId.values()]);
}

export function sortTransactions(transactions) {
  return [...transactions].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function cleanDate(value) {
  const text = cleanText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  return new Date().toISOString().slice(0, 10);
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function createId() {
  const random =
    globalThis.crypto?.randomUUID?.() ||
    Math.random().toString(36).slice(2, 10);
  return `txn-${random}`;
}
