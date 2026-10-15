// TikTok share link -> direct, watermark-free MP4 URL (HD when available).
//
// Why a resolver service instead of reading TikTok's own page: TikTok sits
// behind a WAF that answers plain HTTP clients with a JavaScript challenge
// page (checked 2026-10-14: ~1.4KB "SlardarWAF" HTML, no video JSON), so a
// server-side fetch of the share page cannot see the video data. The
// no-watermark stream therefore comes from a third-party resolver. That
// service is UNOFFICIAL: it has no SLA, may rate-limit or disappear, and it
// receives the pasted link. Providers are pluggable (TIKTOK_RESOLVERS) so a
// paid/self-hosted one can be added or swapped in without touching callers.
//
// This file deliberately imports nothing from the app (only zod) so it can
// be unit-tested in isolation.

import { z } from 'zod';

export class TikTokError extends Error {
  stage: string;
  constructor(message: string, stage = 'tiktok') {
    super(message);
    this.stage = stage;
  }
}

export interface TikTokVideo {
  id: string;
  author: string | null;
  title: string;
  durationSec: number | null;
  cover: string | null;
  videoUrl: string;
  quality: 'HD' | 'SD';
  bytes: number | null;
  provider: string;
}

// ---- Link validation -------------------------------------------------------

const TIKTOK_PAGE_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'vn.tiktok.com']);

// Users paste whole share messages ("ดูคลิปนี้ https://vt.tiktok.com/ZS…/"),
// so pull the first URL out of the text, then validate it strictly.
export function extractTikTokUrl(input: string): string | null {
  const match = input.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  const raw = match[0].replace(/[)\].,!?;:，。]+$/u, '');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null; // blocks https://tiktok.com@evil.com/
  if (url.port && url.port !== '443' && url.port !== '80') return null;
  // Exact host match only — `tiktok.com.evil.com` and `eviltiktok.com` must not pass.
  if (!TIKTOK_PAGE_HOSTS.has(url.hostname.toLowerCase())) return null;
  url.protocol = 'https:';
  url.port = '';
  return url.toString();
}

export function isTikTokUrl(input: string): boolean {
  return extractTikTokUrl(input) !== null;
}

// Media must come from TikTok's CDNs (or the resolver's own host). Anything
// else returned by a resolver is rejected rather than fetched.
const MEDIA_HOST_SUFFIXES = [
  'tiktok.com',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokv.com',
  'tiktokv.us',
  'byteoversea.com',
  'ibytedtos.com',
  'muscdn.com',
  'tikwm.com'
];

export function isAllowedMediaUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return MEDIA_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith('.' + suffix));
}

// ---- Provider: tikwm.com (unofficial) --------------------------------------

const TIKWM_ORIGIN = 'https://www.tikwm.com';

const tikwmSchema = z.object({
  code: z.number(),
  msg: z.string().optional(),
  data: z
    .object({
      id: z.union([z.string(), z.number()]).transform(String),
      title: z.string().optional().default(''),
      duration: z.number().optional(),
      cover: z.string().optional(),
      play: z.string().optional(),
      hdplay: z.string().optional(),
      size: z.number().optional(),
      hd_size: z.number().optional(),
      author: z.object({ unique_id: z.string().optional(), nickname: z.string().optional() }).partial().optional()
    })
    .optional()
});

function absolutize(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value, TIKWM_ORIGIN).toString();
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ResolveOptions {
  /** Wait before the single retry when the free resolver says "too fast". */
  retryDelayMs?: number;
  timeoutMs?: number;
  /**
   * 'hd' (default): sharpest stream. Measured on a real clip, HD is HEVC
   * 720x1280 which some PCs cannot play without an HEVC codec pack.
   * 'compat': the standard stream, H.264 576x1024, plays everywhere.
   * Falls back to whichever stream exists.
   */
  prefer?: 'hd' | 'compat';
}

async function resolveViaTikwm(pageUrl: string, opts: ResolveOptions): Promise<TikTokVideo> {
  const endpoint = `${TIKWM_ORIGIN}/api/?url=${encodeURIComponent(pageUrl)}&hd=1`;
  const call = async () => {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; ZanaMarketingOS/1.0)' },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 20000)
      });
    } catch {
      throw new TikTokError('เชื่อมต่อตัวช่วยแปลงลิงก์ TikTok ไม่สำเร็จ — ลองใหม่อีกครั้งในอีกสักครู่', 'resolver_unreachable');
    }
    if (!res.ok) {
      throw new TikTokError(`ตัวช่วยแปลงลิงก์ TikTok ตอบกลับผิดปกติ (HTTP ${res.status})`, 'resolver_http');
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new TikTokError('ตัวช่วยแปลงลิงก์ TikTok ส่งข้อมูลที่อ่านไม่ได้', 'resolver_invalid');
    }
    const parsed = tikwmSchema.safeParse(json);
    if (!parsed.success) {
      throw new TikTokError('รูปแบบข้อมูลจากตัวช่วยแปลงลิงก์เปลี่ยนไป — ต้องอัปเดตตัวเชื่อมต่อ', 'resolver_invalid');
    }
    return parsed.data;
  };

  let body = await call();
  if (body.code !== 0 && /limit|too fast|1 request/i.test(body.msg ?? '')) {
    await sleep(opts.retryDelayMs ?? 1300);
    body = await call();
  }
  if (body.code !== 0 || !body.data) {
    if (/limit|too fast|1 request/i.test(body.msg ?? '')) {
      throw new TikTokError('มีคนใช้งานพร้อมกันมาก — รอสักครู่แล้วลองใหม่', 'rate_limited');
    }
    throw new TikTokError('ไม่พบวิดีโอนี้ — อาจเป็นคลิปส่วนตัว ถูกลบ หรือลิงก์ไม่ถูกต้อง', 'not_found');
  }

  const d = body.data;
  const hd = absolutize(d.hdplay);
  const sd = absolutize(d.play);
  const useHd = opts.prefer === 'compat' ? !sd && !!hd : !!hd;
  const chosen = useHd ? hd : sd;
  if (!chosen) throw new TikTokError('ไม่พบไฟล์วิดีโอที่ดาวน์โหลดได้จากลิงก์นี้', 'not_found');
  if (!isAllowedMediaUrl(chosen)) {
    throw new TikTokError('ลิงก์ไฟล์วิดีโอที่ได้มาไม่อยู่ในรายการโฮสต์ที่อนุญาต จึงไม่ดาวน์โหลดเพื่อความปลอดภัย', 'unsafe_media_host');
  }

  const cover = absolutize(d.cover);
  return {
    id: d.id,
    author: d.author?.unique_id ?? d.author?.nickname ?? null,
    title: d.title,
    durationSec: typeof d.duration === 'number' ? d.duration : null,
    cover: cover && isAllowedMediaUrl(cover) ? cover : null,
    videoUrl: chosen,
    quality: useHd ? 'HD' : 'SD',
    bytes: (useHd ? d.hd_size : d.size) || null,
    provider: 'tikwm'
  };
}

const PROVIDERS: Record<string, (pageUrl: string, opts: ResolveOptions) => Promise<TikTokVideo>> = {
  tikwm: resolveViaTikwm
};

function configuredProviders(): string[] {
  const names = (process.env.TIKTOK_RESOLVERS || 'tikwm')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s in PROVIDERS);
  return names.length ? names : ['tikwm'];
}

// Tries each configured provider in order; permanent answers ("video not
// found") stop the chain, transient ones fall through to the next provider.
export async function resolveTikTokVideo(input: string, opts: ResolveOptions = {}): Promise<TikTokVideo> {
  const pageUrl = extractTikTokUrl(input);
  if (!pageUrl) {
    throw new TikTokError('ลิงก์ไม่ถูกต้อง — ต้องเป็นลิงก์จาก tiktok.com (เช่น https://www.tiktok.com/@user/video/123 หรือ https://vt.tiktok.com/xxxx)', 'invalid_link');
  }
  let lastError: unknown;
  for (const name of configuredProviders()) {
    try {
      return await PROVIDERS[name](pageUrl, opts);
    } catch (err) {
      lastError = err;
      if (err instanceof TikTokError && (err.stage === 'not_found' || err.stage === 'invalid_link')) throw err;
    }
  }
  throw lastError instanceof TikTokError ? lastError : new TikTokError('แปลงลิงก์ TikTok ไม่สำเร็จ', 'resolver_failed');
}

export function tiktokDownloadHeaders(): Record<string, string> {
  return { Referer: 'https://www.tiktok.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' };
}
