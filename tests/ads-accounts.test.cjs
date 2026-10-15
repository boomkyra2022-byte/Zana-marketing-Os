// Pure-logic tests for the ads accounts panel + ads-sync parsing. No network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, file) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText,
    file
  );
const sync = require('../supabase/functions/ads-sync/parse.ts');
const ui = require('../lib/ads/status.ts');

const metaMsg = (code, message, sub) =>
  `Meta API error 403 on GET /act_1/insights: ${JSON.stringify({ error: { message, type: 'OAuthException', code, ...(sub ? { error_subcode: sub } : {}), fbtrace_id: 'x' } })}`;

test('parseMetaError reads Meta code/subcode (not the HTTP status) and strips URLs', () => {
  const p = sync.parseMetaError(
    metaMsg(200, '(#200) Ad account owner has NOT grant ads_management or ads_read permission, refer to https://developers.facebook.com/docs/x for details.', 1815)
  );
  assert.equal(p.code, 200);
  assert.equal(p.subcode, 1815);
  assert.ok(!p.text.includes('http'));
  assert.match(p.text, /ads_read/);
  assert.equal(sync.parseMetaError(metaMsg(190, 'Invalid OAuth access token')).code, 190);
});

test('parseMetaError survives non-JSON messages and caps length', () => {
  const plain = sync.parseMetaError('resolveTokenForAccount act_1: no secret named x in Vault');
  assert.equal(plain.code, null);
  assert.match(plain.text, /no secret named/);
  assert.equal(sync.parseMetaError('Meta API error 500 on GET /x: {not json').code, null);
  assert.ok(sync.parseMetaError('x'.repeat(2000)).text.length <= 300);
});

test('normalizeActId accepts act_ ids and bare numbers only', () => {
  for (const [input, out] of [['act_12345678', 'act_12345678'], [' 12345678 ', 'act_12345678'], ['ACT_99999', 'act_99999']]) {
    assert.equal(sync.normalizeActId(input), out);
    assert.equal(ui.normalizeActId(input), out);
  }
  for (const bad of ['', 'act_', 'abc', '1234', 'act_12 34', "act_1'; drop table x;--", 'https://x/act_123456']) {
    assert.equal(sync.normalizeActId(bad), null, bad);
    assert.equal(ui.normalizeActId(bad), null, bad);
  }
});

test('toDiscovered shapes /me/adaccounts rows and rejects unusable ones', () => {
  assert.deepEqual(
    sync.toDiscovered({ id: 'act_123456', name: ' Shopky05 ', account_status: 1, currency: 'THB', timezone_name: 'Asia/Bangkok', business: { id: '11', name: 'Zana Dynasty Gorup 01' } }),
    { id: 'act_123456', name: 'Shopky05', account_status: 1, currency: 'THB', timezone_name: 'Asia/Bangkok', business_id: '11', business_name: 'Zana Dynasty Gorup 01' }
  );
  const bare = sync.toDiscovered({ id: '987654321' });
  assert.equal(bare.id, 'act_987654321');
  assert.deepEqual([bare.name, bare.account_status, bare.business_id], [null, null, null]);
  assert.equal(sync.toDiscovered({ id: 'act_1', account_status: '1' }), null); // id too short
  for (const bad of [null, undefined, 'x', 5, {}, { id: 5 }, { id: 'nope' }]) assert.equal(sync.toDiscovered(bad), null);
  assert.equal(sync.toDiscovered({ id: 'act_123456', account_status: '3' }).account_status, null);
});

test('Meta account status codes map to labels and tones', () => {
  assert.deepEqual(ui.metaStatusInfo(1), { label: 'Active', tone: 'ok' });
  assert.equal(ui.metaStatusInfo(3).tone, 'warn');
  assert.match(ui.metaStatusInfo(3).label, /ค้างชำระ/);
  assert.equal(ui.metaStatusInfo(101).tone, 'bad');
  assert.equal(ui.metaStatusInfo(2).tone, 'bad');
  assert.equal(ui.metaStatusInfo(null).tone, 'muted');
  assert.equal(ui.metaStatusInfo(undefined).tone, 'muted');
  assert.equal(ui.metaStatusInfo(999).tone, 'muted');
});

test('connectionState: off / not synced / connected / stale / permission / token / error', () => {
  const now = Date.parse('2026-10-15T10:00:00Z');
  const base = { status: 'active', last_sync_ok: true, last_error_code: null, last_sync_at: '2026-10-15T09:50:00Z' };
  assert.equal(ui.connectionState({ ...base, status: 'paused' }, now), 'off');
  assert.equal(ui.connectionState({ ...base, status: 'disabled' }, now), 'off');
  assert.equal(ui.connectionState({ ...base, last_sync_ok: null, last_sync_at: null }, now), 'not_synced');
  assert.equal(ui.connectionState(base, now), 'connected');
  assert.equal(ui.connectionState({ ...base, last_sync_at: '2026-10-15T09:00:00Z' }, now), 'stale');
  assert.equal(ui.connectionState({ ...base, last_sync_ok: false, last_error_code: 200 }, now), 'needs_permission');
  assert.equal(ui.connectionState({ ...base, last_sync_ok: false, last_error_code: 10 }, now), 'needs_permission');
  assert.equal(ui.connectionState({ ...base, last_sync_ok: false, last_error_code: 190 }, now), 'token_invalid');
  assert.equal(ui.connectionState({ ...base, last_sync_ok: false, last_error_code: 17 }, now), 'error');
  assert.equal(ui.connectionState({ ...base, last_sync_ok: false, last_error_code: null }, now), 'error');
  // a paused account never reports a stale error as its state
  assert.equal(ui.connectionState({ ...base, status: 'paused', last_sync_ok: false, last_error_code: 200 }, now), 'off');
});

test('errorAdvice gives actionable Thai text and distinguishes own-token accounts', () => {
  assert.match(ui.errorAdvice(200, false), /portfolio กลาง/);
  assert.match(ui.errorAdvice(200, true), /System User/);
  assert.notEqual(ui.errorAdvice(200, true), ui.errorAdvice(200, false));
  assert.match(ui.errorAdvice(190, false), /token/i);
  assert.match(ui.errorAdvice(17, false), /รอ/);
  assert.match(ui.errorAdvice(100, false), /ID/);
  assert.match(ui.errorAdvice(2500, false), /2500/);
  assert.equal(ui.errorAdvice(null, false), null);
  for (const state of Object.keys(ui.CONNECTION_LABEL)) assert.ok(ui.CONNECTION_LABEL[state].label, state);
});
