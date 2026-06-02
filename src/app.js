import {
  buildTransaction,
  filterTransactions,
  mergeTransactions,
  sortTransactions,
  summarizeTransactions,
  transactionsToCsv,
} from './transactions.js';
import {
  loadTransactions,
  parseImportedTransactions,
  saveTransactions,
} from './storage.js';

const DEFAULT_CARDS = ['Family card', 'Mom Visa', 'Dad Amex', 'Shared Visa'];
const DEFAULT_CATEGORIES = ['Food', 'Fuel', 'Transit', 'Household', 'Health', 'School'];

const elements = {
  form: document.querySelector('#transactionForm'),
  transactionId: document.querySelector('#transactionId'),
  transactionCreatedAt: document.querySelector('#transactionCreatedAt'),
  dateInput: document.querySelector('#dateInput'),
  submitLabel: document.querySelector('#submitLabel'),
  cancelEditButton: document.querySelector('#cancelEditButton'),
  cardOptions: document.querySelector('#cardOptions'),
  categoryOptions: document.querySelector('#categoryOptions'),
  cardFilter: document.querySelector('#cardFilter'),
  categoryFilter: document.querySelector('#categoryFilter'),
  fromFilter: document.querySelector('#fromFilter'),
  toFilter: document.querySelector('#toFilter'),
  searchInput: document.querySelector('#searchInput'),
  clearFiltersButton: document.querySelector('#clearFiltersButton'),
  totalAmount: document.querySelector('#totalAmount'),
  entryCount: document.querySelector('#entryCount'),
  topCard: document.querySelector('#topCard'),
  filterCount: document.querySelector('#filterCount'),
  transactionList: document.querySelector('#transactionList'),
  exportCsvButton: document.querySelector('#exportCsvButton'),
  exportJsonButton: document.querySelector('#exportJsonButton'),
  importButton: document.querySelector('#importButton'),
  importFile: document.querySelector('#importFile'),
  toast: document.querySelector('#toast'),
};

const money = new Intl.NumberFormat(navigator.language || 'en-US', {
  style: 'currency',
  currency: 'USD',
});

const state = {
  transactions: sortTransactions(loadTransactions()),
  filters: {
    query: '',
    card: '',
    category: '',
    from: '',
    to: '',
  },
  editingId: '',
};

init();

function init() {
  elements.dateInput.value = todayInputValue();
  bindEvents();
  applyShortcutParams();
  render();
  registerServiceWorker();
}

function bindEvents() {
  elements.form.addEventListener('submit', handleSubmit);
  elements.cancelEditButton.addEventListener('click', clearEditMode);
  elements.searchInput.addEventListener('input', () => updateFilter('query', elements.searchInput.value));
  elements.cardFilter.addEventListener('change', () => updateFilter('card', elements.cardFilter.value));
  elements.categoryFilter.addEventListener('change', () => updateFilter('category', elements.categoryFilter.value));
  elements.fromFilter.addEventListener('change', () => updateFilter('from', elements.fromFilter.value));
  elements.toFilter.addEventListener('change', () => updateFilter('to', elements.toFilter.value));
  elements.clearFiltersButton.addEventListener('click', clearFilters);
  elements.transactionList.addEventListener('click', handleRowAction);
  elements.exportCsvButton.addEventListener('click', exportCsv);
  elements.exportJsonButton.addEventListener('click', exportJson);
  elements.importButton.addEventListener('click', () => elements.importFile.click());
  elements.importFile.addEventListener('change', importJson);
}

function handleSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(elements.form));

  try {
    const transaction = buildTransaction(data);
    const wasEditing = Boolean(state.editingId);
    if (state.editingId) {
      state.transactions = state.transactions.map((txn) =>
        txn.id === state.editingId ? transaction : txn,
      );
    } else {
      state.transactions = [transaction, ...state.transactions];
    }

    state.transactions = sortTransactions(state.transactions);
    persist();
    resetForm();
    clearEditMode();
    render();
    showToast(wasEditing ? 'Saved' : 'Added');
  } catch (error) {
    showToast(error.message, true);
  }
}

function handleRowAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const transaction = state.transactions.find((txn) => txn.id === button.dataset.id);
  if (!transaction) return;

  if (button.dataset.action === 'edit') {
    enterEditMode(transaction);
  }

  if (button.dataset.action === 'delete' && confirm('Delete this transaction?')) {
    state.transactions = state.transactions.filter((txn) => txn.id !== transaction.id);
    persist();
    render();
    showToast('Deleted');
  }
}

function enterEditMode(transaction) {
  state.editingId = transaction.id;
  elements.transactionId.value = transaction.id;
  elements.transactionCreatedAt.value = transaction.createdAt;
  elements.form.elements.merchant.value = transaction.merchant;
  elements.form.elements.amount.value = transaction.amount.toFixed(2);
  elements.form.elements.card.value = transaction.card;
  elements.form.elements.category.value = transaction.category;
  elements.form.elements.date.value = transaction.date;
  elements.form.elements.note.value = transaction.note;
  elements.submitLabel.textContent = 'Save';
  elements.cancelEditButton.classList.remove('is-hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearEditMode() {
  state.editingId = '';
  elements.transactionId.value = '';
  elements.transactionCreatedAt.value = '';
  elements.submitLabel.textContent = 'Add';
  elements.cancelEditButton.classList.add('is-hidden');
}

function resetForm() {
  elements.form.reset();
  elements.dateInput.value = todayInputValue();
}

function updateFilter(key, value) {
  state.filters[key] = value;
  render();
}

function clearFilters() {
  state.filters = { query: '', card: '', category: '', from: '', to: '' };
  elements.searchInput.value = '';
  elements.cardFilter.value = '';
  elements.categoryFilter.value = '';
  elements.fromFilter.value = '';
  elements.toFilter.value = '';
  render();
}

function render() {
  const filtered = filterTransactions(sortTransactions(state.transactions), state.filters);
  renderFilterOptions();
  renderSummary(filtered);
  renderTransactions(filtered);
}

function renderFilterOptions() {
  const cards = uniqueValues(state.transactions.map((txn) => txn.card), DEFAULT_CARDS);
  const categories = uniqueValues(state.transactions.map((txn) => txn.category), DEFAULT_CATEGORIES);
  renderDatalist(elements.cardOptions, cards);
  renderDatalist(elements.categoryOptions, categories);
  renderSelect(elements.cardFilter, 'All cards', cards, state.filters.card);
  renderSelect(elements.categoryFilter, 'All categories', categories, state.filters.category);
}

function renderSummary(transactions) {
  const summary = summarizeTransactions(transactions);
  elements.totalAmount.textContent = money.format(summary.total);
  elements.entryCount.textContent = String(summary.count);
  elements.topCard.textContent = topGroupLabel(summary.byCard);
  elements.filterCount.textContent =
    summary.count === 1 ? '1 transaction' : `${summary.count} transactions`;
}

function renderTransactions(transactions) {
  elements.transactionList.textContent = '';

  if (!transactions.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No transactions logged';
    elements.transactionList.append(empty);
    return;
  }

  for (const transaction of transactions) {
    elements.transactionList.append(createTransactionRow(transaction));
  }
}

function createTransactionRow(transaction) {
  const row = document.createElement('article');
  row.className = 'transaction-row';
  row.setAttribute('role', 'row');

  const date = document.createElement('time');
  date.dateTime = transaction.date;
  date.textContent = formatDate(transaction.date);

  const merchant = document.createElement('strong');
  merchant.className = 'merchant';
  merchant.textContent = transaction.merchant;

  const amount = document.createElement('span');
  amount.className = 'amount';
  amount.textContent = money.format(transaction.amount);

  const card = document.createElement('span');
  card.className = 'card';
  card.textContent = transaction.card;

  const category = document.createElement('span');
  category.className = 'category';
  category.textContent = transaction.category;

  const note = document.createElement('span');
  note.className = 'note';
  note.textContent = transaction.note || '-';

  const actions = document.createElement('div');
  actions.className = 'row-actions';
  actions.append(
    createIconButton('edit', transaction.id, 'Edit transaction'),
    createIconButton('delete', transaction.id, 'Delete transaction'),
  );

  row.append(date, merchant, amount, card, category, note, actions);
  return row;
}

function createIconButton(action, id, label) {
  const button = document.createElement('button');
  button.className = action === 'delete' ? 'icon-button danger' : 'icon-button';
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.id = id;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = `<svg><use href="#icon-${action === 'delete' ? 'trash' : 'edit'}"></use></svg>`;
  return button;
}

function exportCsv() {
  downloadFile(`pay-watcher-${todayInputValue()}.csv`, transactionsToCsv(state.transactions), 'text/csv');
}

function exportJson() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: state.transactions,
  };
  downloadFile(
    `pay-watcher-${todayInputValue()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  );
}

async function importJson() {
  const [file] = elements.importFile.files;
  elements.importFile.value = '';
  if (!file) return;

  try {
    const imported = parseImportedTransactions(await file.text());
    state.transactions = mergeTransactions(state.transactions, imported);
    persist();
    render();
    showToast(`Imported ${imported.length}`);
  } catch (error) {
    showToast(error.message, true);
  }
}

function applyShortcutParams() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('merchant') || !params.has('amount')) return;

  try {
    const transaction = buildTransaction({
      id: params.get('id') || undefined,
      merchant: params.get('merchant'),
      amount: params.get('amount'),
      card: params.get('card') || undefined,
      category: params.get('category') || undefined,
      date: params.get('date') || undefined,
      note: params.get('note') || undefined,
    });
    state.transactions = mergeTransactions(state.transactions, [transaction]);
    persist();
    window.history.replaceState({}, document.title, window.location.pathname);
    showToast('Added from URL');
  } catch (error) {
    showToast(error.message, true);
  }
}

function persist() {
  saveTransactions(state.transactions);
}

function downloadFile(filename, contents, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderDatalist(list, values) {
  list.textContent = '';
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    list.append(option);
  }
}

function renderSelect(select, firstLabel, values, selectedValue) {
  select.textContent = '';
  const all = document.createElement('option');
  all.value = '';
  all.textContent = firstLabel;
  select.append(all);

  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  }

  select.value = selectedValue;
}

function uniqueValues(values, defaults = []) {
  return [...new Set([...defaults, ...values].filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function topGroupLabel(groups) {
  const [top] = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  return top ? top[0] : 'None';
}

function formatDate(value) {
  return new Intl.DateTimeFormat(navigator.language || 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function todayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle('is-error', isError);
  elements.toast.classList.add('is-visible');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.classList.remove('is-visible');
  }, 2200);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
