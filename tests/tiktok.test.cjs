// Runs with the existing TypeScript dependency; no extra packages.
// Network is fully mocked — these tests never contact TikTok or the resolver.
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
const tk = require('../lib/media/tiktok.ts');

const realFetch = global.fetch;
test.afterEach(() => {
  global.fetch = realFetch;
  delete process.env.TIKTOK_RESOLVERS;
});

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const okBody = (data = {}) => ({
  code: 0,
  msg: 'success',
  data: {
    id: '6718335390845095173',
    title: 'hello #tag',
    duration: 10,
    cover: 'https://p16-common-sign.tiktokcdn-us.com/c.jpg',
    play: 'https://v16m.tiktokcdn-us.com/sd.mp4',
    hdplay: 'https://v16-notes.tiktokcdn-us.com/hd.mp4',
    size: 2953029,
    hd_size: 2004627,
    author: { unique_id: 'scout2015', nickname: 'Scout' },
    ...data
  }
});
const mockFetch = (handler) => {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push(String(url));
    return handler(String(url), init, calls.length);
  };
  return calls;
};
const rejects = (promise, stage) =>
  assert.rejects(promise, (err) => err instanceof tk.TikTokError && err.stage === stage, `expected TikTokError stage=${stage}`);

test('extracts the link from a pasted share message and normalizes to https', () => {
  assert.equal(
    tk.extractTikTokUrl('ดูคลิปนี้สิ http://vt.tiktok.com/ZSabc123/ สนุกมาก'),
    'https://vt.tiktok.com/ZSabc123/'
  );
  assert.equal(
    tk.extractTikTokUrl('(https://www.tiktok.com/@scout2015/video/6718335390845095173).'),
    'https://www.tiktok.com/@scout2015/video/6718335390845095173'
  );
  assert.equal(tk.isTikTokUrl('https://m.tiktok.com/v/123.html'), true);
});

test('rejects lookalike hosts, credentials, odd ports, other schemes and non-TikTok first links', () => {
  for (const bad of [
    'https://tiktok.com.evil.com/@a/video/1',
    'https://eviltiktok.com/@a/video/1',
    'https://nottiktok.com/x',
    'https://tiktok.com@evil.com/video/1',
    'https://user:pw@www.tiktok.com/@a/video/1',
    'https://www.tiktok.com:8443/@a/video/1',
    'ftp://www.tiktok.com/@a/video/1',
    'https://evil.com/?next=https://www.tiktok.com/@a/video/1',
    'https://drive.google.com/file/d/abc/view',
    'no link here at all',
    ''
  ]) {
    assert.equal(tk.extractTikTokUrl(bad), null, bad);
  }
});

test('media host allowlist accepts TikTok CDNs only, over https, without credentials', () => {
  assert.equal(tk.isAllowedMediaUrl('https://v16-notes.tiktokcdn-us.com/a.mp4'), true);
  assert.equal(tk.isAllowedMediaUrl('https://www.tikwm.com/video/media/play/1.mp4'), true);
  for (const bad of [
    'http://v16.tiktokcdn.com/a.mp4',
    'https://tiktokcdn.com.evil.com/a.mp4',
    'https://evil.com/a.mp4',
    'https://user:pw@v16.tiktokcdn.com/a.mp4',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/a.mp4',
    'not a url'
  ]) {
    assert.equal(tk.isAllowedMediaUrl(bad), false, bad);
  }
});

test('prefers HD, reports its size, and builds metadata', async () => {
  const calls = mockFetch(() => json(okBody()));
  const video = await tk.resolveTikTokVideo('https://www.tiktok.com/@scout2015/video/6718335390845095173');
  assert.equal(video.quality, 'HD');
  assert.equal(video.videoUrl, 'https://v16-notes.tiktokcdn-us.com/hd.mp4');
  assert.equal(video.bytes, 2004627);
  assert.equal(video.author, 'scout2015');
  assert.equal(video.id, '6718335390845095173');
  assert.equal(video.durationSec, 10);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^https:\/\/www\.tikwm\.com\/api\/\?url=https%3A%2F%2Fwww\.tiktok\.com%2F/);
});

test("prefer 'compat' picks the standard H.264 stream, and falls back to HD when only HD exists", async () => {
  mockFetch(() => json(okBody()));
  const compat = await tk.resolveTikTokVideo('https://vt.tiktok.com/ZSabc/', { prefer: 'compat' });
  assert.equal(compat.quality, 'SD');
  assert.equal(compat.videoUrl, 'https://v16m.tiktokcdn-us.com/sd.mp4');
  assert.equal(compat.bytes, 2953029);

  mockFetch(() => json(okBody({ play: '', size: 0 })));
  const onlyHd = await tk.resolveTikTokVideo('https://vt.tiktok.com/ZSabc/', { prefer: 'compat' });
  assert.equal(onlyHd.quality, 'HD');
  assert.equal(onlyHd.videoUrl, 'https://v16-notes.tiktokcdn-us.com/hd.mp4');
});

test('falls back to SD when no HD stream exists', async () => {
  mockFetch(() => json(okBody({ hdplay: '', hd_size: 0 })));
  const video = await tk.resolveTikTokVideo('https://vt.tiktok.com/ZSabc/');
  assert.equal(video.quality, 'SD');
  assert.equal(video.videoUrl, 'https://v16m.tiktokcdn-us.com/sd.mp4');
  assert.equal(video.bytes, 2953029);
});

test('resolves relative resolver paths against the resolver origin', async () => {
  mockFetch(() => json(okBody({ hdplay: '/video/media/hdplay/1.mp4' })));
  const video = await tk.resolveTikTokVideo('https://vt.tiktok.com/ZSabc/');
  assert.equal(video.videoUrl, 'https://www.tikwm.com/video/media/hdplay/1.mp4');
});

test('refuses a media URL on a host outside the allowlist', async () => {
  mockFetch(() => json(okBody({ hdplay: 'https://evil.example.com/steal.mp4', play: '' })));
  await rejects(tk.resolveTikTokVideo('https://vt.tiktok.com/ZSabc/'), 'unsafe_media_host');
});

test('unknown video -> not_found, and it is not retried', async () => {
  const calls = mockFetch(() => json({ code: -1, msg: 'Url parsing is failed! Please check url.' }));
  await rejects(tk.resolveTikTokVideo('https://vt.tiktok.com/ZSabc/'), 'not_found');
  assert.equal(calls.length, 1);
});

test('free-tier rate limit is retried once and then succeeds', async () => {
  const calls = mockFetch((_u, _i, n) => (n === 1 ? json({ code: -1, msg: 'Free Api Limit: 1 request/second.' }) : json(okBody())));
  const video = await tk.resolveTikTokVideo('https://vt.tiktok.com/ZSabc/', { retryDelayMs: 1 });
  assert.equal(video.quality, 'HD');
  assert.equal(calls.length, 2);
});

test('persistent rate limit -> rate_limited after exactly one retry', async () => {
  const calls = mockFetch(() => json({ code: -1, msg: 'Free Api Limit: 1 request/second.' }));
  await rejects(tk.resolveTikTokVideo('https://vt.tiktok.com/ZSabc/', { retryDelayMs: 1 }), 'rate_limited');
  assert.equal(calls.length, 2);
});

test('resolver outage, bad HTTP status and changed schema give distinct errors', async () => {
  mockFetch(() => {
    throw new Error('ECONNRESET');
  });
  await rejects(tk.resolveTikTokVideo('https://vt.tiktok.com/ZSabc/'), 'resolver_unreachable');

  mockFetch(() => new Response('oops', { status: 503 }));
  await rejects(tk.resolveTikTokVideo('https://vt.tiktok.com/ZSabc/'), 'resolver_http');

  mockFetch(() => json({ unexpected: true }));
  await rejects(tk.resolveTikTokVideo('https://vt.tiktok.com/ZSabc/'), 'resolver_invalid');

  mockFetch(() => new Response('<html>not json</html>', { status: 200 }));
  await rejects(tk.resolveTikTokVideo('https://vt.tiktok.com/ZSabc/'), 'resolver_invalid');
});

test('an invalid link never reaches the network', async () => {
  const calls = mockFetch(() => json(okBody()));
  await rejects(tk.resolveTikTokVideo('https://evil.com/@a/video/1'), 'invalid_link');
  assert.equal(calls.length, 0);
});

test('TIKTOK_RESOLVERS ignores unknown names and falls back to the default provider', async () => {
  process.env.TIKTOK_RESOLVERS = 'does-not-exist';
  const calls = mockFetch(() => json(okBody()));
  const video = await tk.resolveTikTokVideo('https://vt.tiktok.com/ZSabc/');
  assert.equal(video.provider, 'tikwm');
  assert.equal(calls.length, 1);
});
