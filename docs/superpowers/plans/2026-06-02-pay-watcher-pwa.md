# Pay Watcher PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-free PWA that lets an iPhone user manually log Apple Pay/family-card transactions into a durable local table.

**Architecture:** The app is a static HTML/CSS/JS site with pure transaction utilities in `src/transactions.js`, browser storage in `src/storage.js`, and UI composition in `src/app.js`. Data persists in `localStorage`, can be imported/exported as JSON, and can be exported as CSV for backup.

**Tech Stack:** HTML, CSS, modern JavaScript modules, Web App Manifest, Service Worker, Node built-in test runner.

---

### Task 1: Transaction Model

**Files:**
- Create: `src/transactions.js`
- Create: `tests/transactions.test.js`
- Create: `package.json`

- [x] **Step 1: Write failing tests for transaction behavior**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTransaction,
  filterTransactions,
  summarizeTransactions,
  transactionsToCsv,
} from '../src/transactions.js';

test('buildTransaction trims text, normalizes amount, and requires merchant and amount', () => {
  assert.throws(() => buildTransaction({ merchant: '', amount: '12' }), /Merchant is required/);
  assert.throws(() => buildTransaction({ merchant: 'Cafe', amount: 'abc' }), /Amount must be a positive number/);

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
});
```

- [x] **Step 2: Run tests and verify they fail because the module is missing**

Run: `node --test tests/transactions.test.js`
Expected: `ERR_MODULE_NOT_FOUND` for `src/transactions.js`.

- [x] **Step 3: Implement the transaction utilities**

Create pure functions for building, filtering, summarizing, and CSV formatting transactions.

- [x] **Step 4: Run tests and verify they pass**

Run: `node --test tests/transactions.test.js`
Expected: all tests pass.

### Task 2: Static PWA Shell

**Files:**
- Create: `index.html`
- Create: `src/styles.css`
- Create: `manifest.webmanifest`
- Create: `sw.js`
- Create: `assets/icon.svg`

- [x] **Step 1: Build the app shell**

Use semantic HTML for the header, quick-add form, summaries, filters, transaction table/list, and backup controls.

- [x] **Step 2: Add visual styling**

Use a compact true-white finance-tool interface with ink text, mint action accents, coral delete/warning accents, 8px or smaller radii, fixed toolbar/control dimensions, responsive table/list behavior, and no nested cards.

- [x] **Step 3: Add manifest and service worker**

Make the app installable when served over HTTP/HTTPS and cache the shell assets for offline use.

### Task 3: Browser App Logic

**Files:**
- Create: `src/storage.js`
- Create: `src/app.js`

- [x] **Step 1: Implement storage helpers**

Use `localStorage` with a single namespaced key and safe JSON parsing.

- [x] **Step 2: Wire UI state**

Load saved transactions, add/edit/delete entries, filter/search, import/export JSON, export CSV, and show summary totals.

- [x] **Step 3: Verify in browser**

Serve the folder locally and test the core workflow at desktop and mobile widths.
