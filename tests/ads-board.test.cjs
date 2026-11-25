// Run: node --test tests/ads-board.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const src = fs.readFileSync(path.join(__dirname, '../lib/meta/ads-board-shared.ts'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', ts.transpileModule(src, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText)(mod, mod.exports);
const { rangeForPreset, bangkokToday, boardTotals, boardRates, resultLabel, accountDisplayName } = mod.exports;

const row = (o) => ({
  spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, contacts: 0, conversations: 0, purchases: 0, purchaseValue: 0,
  resultType: null, results: null, costPerResult: null, ...o
});

test('date presets match Ads Manager (last N days end yesterday)', () => {
  assert.deepEqual(rangeForPreset('today', '2026-11-23'), { since: '2026-11-23', until: '2026-11-23' });
  assert.deepEqual(rangeForPreset('yesterday', '2026-11-01'), { since: '2026-10-31', until: '2026-10-31' });
  assert.deepEqual(rangeForPreset('last_7d', '2026-11-23'), { since: '2026-11-16', until: '2026-11-22' });
  assert.deepEqual(rangeForPreset('this_month', '2026-11-23'), { since: '2026-11-01', until: '2026-11-23' });
  assert.deepEqual(rangeForPreset('last_month', '2026-03-15'), { since: '2026-02-01', until: '2026-02-28' });
  assert.deepEqual(rangeForPreset('last_month', '2026-01-05'), { since: '2025-12-01', until: '2025-12-31' });
});

test('today is Thailand time, not UTC', () => {
  assert.equal(bangkokToday(Date.parse('2026-11-22T17:30:00Z')), '2026-11-23');
  assert.equal(bangkokToday(Date.parse('2026-11-22T16:30:00Z')), '2026-11-22');
});

test('totals reproduce Meta for a real day (2 ad sets)', () => {
  const t = boardTotals(
    [
      row({ spend: 887.65, impressions: 12640, reach: 11713, clicks: 371, contacts: 59, purchases: 9, purchaseValue: 2800, resultType: 'p', results: 9 }),
      row({ spend: 907.03, impressions: 11922, reach: 11217, clicks: 455, contacts: 66, purchases: 10, purchaseValue: 2800, resultType: 'p', results: 10 })
    ],
    21074
  );
  const r = boardRates(t);
  assert.equal(t.spend.toFixed(2), '1794.68');
  assert.equal(t.results, 19);
  assert.equal(t.contacts, 125);
  assert.equal(t.reach, 21074); // Meta's unique reach, not 11713 + 11217
  assert.equal(r.cpc.toFixed(2), '2.17');
  assert.equal((r.ctr * 100).toFixed(2), '3.36');
  assert.equal(r.cpm.toFixed(2), '73.07');
});

test('results are not added up across different result types', () => {
  const t = boardTotals([row({ spend: 1, resultType: 'a', results: 1 }), row({ spend: 1, resultType: 'b', results: 5 })], null);
  assert.equal(t.results, null);
  assert.equal(t.costPerResult, null);
});

test('reach results are never summed', () => {
  const t = boardTotals([row({ spend: 5, resultType: 'reach', results: 100 }), row({ spend: 5, resultType: 'reach', results: 100 })], null);
  assert.equal(t.results, null);
});

test('zero denominators give blanks, never 0 or Infinity', () => {
  const r = boardRates(row({}));
  for (const v of Object.values(r)) assert.equal(v, null);
});

test('labels', () => {
  assert.equal(resultLabel('actions:onsite_conversion.purchase'), 'การซื้อบน Meta');
  assert.equal(resultLabel('actions:onsite_conversion.messaging_conversation_started_7d'), 'เริ่มการสนทนา');
  assert.equal(accountDisplayName({ name: 'TEST2', meta_name: 'Kid - 02' }), 'Kid - 02');
  assert.equal(accountDisplayName({ name: 'TEST2', meta_name: null }), 'TEST2');
});
