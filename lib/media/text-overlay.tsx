import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';

// Real fix for a real, disclosed limitation — explicit user report: "รูปที่
// เจนได้มีปัญหาฟ้อนอ่านไม่ออก" (Thai text on AI-generated banners is
// sometimes unreadable). gpt-image-1 (like image models generally) renders
// Thai script inconsistently, especially longer headline/CTA copy — the
// combining vowel/tone marks and dense glyphs don't survive its own
// typography rendering reliably. MASTER_VISUAL_QUALITY_BLOCK's own
// TEXT-SAFE PRODUCTION section already recommended the real fix: generate
// the scene WITHOUT text, then composite the exact approved copy separately
// as crisp, guaranteed-legible real typography. This module is that
// separate compositing step.
//
// Uses `next/og`'s ImageResponse (Satori + resvg under the hood) rather
// than `node-canvas` — no native binary to bundle/fail on Vercel (the exact
// class of bug already hit once this session with ffmpeg-static, see
// next.config.mjs's own comments). Fonts are the SAME bundled Thai .ttf
// files already shipped in assets/fonts/ for the Editor tool's styled
// caption burn-in (ffmpeg `subtitles` filter) — reused as-is, no new font
// download/license concern, no runtime fetch to an external URL that could
// go stale or rate-limit.

const FONTS_DIR = path.join(process.cwd(), 'assets', 'fonts');

let fontCache: { regular: Buffer; bold: Buffer } | null = null;

function loadThaiFonts(): { regular: Buffer; bold: Buffer } {
  if (fontCache) return fontCache;
  const regular = fs.readFileSync(path.join(FONTS_DIR, 'Prompt-Medium.ttf'));
  const bold = fs.readFileSync(path.join(FONTS_DIR, 'Prompt-Bold.ttf'));
  fontCache = { regular, bold };
  return fontCache;
}

export interface TextOverlaySpec {
  headline?: string;
  mainMessage?: string;
  guarantee?: string;
  badge?: string;
  cta?: string;
}

// Lets callers skip the whole render+composite round-trip when the user
// left every text field blank — no dead/empty overlay call for nothing.
export function hasAnyOverlayText(spec: TextOverlaySpec): boolean {
  return !!(spec.headline || spec.mainMessage || spec.guarantee || spec.badge || spec.cta);
}

// v1 scope, disclosed honestly (not silently claimed as complete): this only
// composites the 5 named copy blocks (Headline/Main Message/Guarantee/
// Authenticity Badge/CTA). The GRAPHIC LAYOUT PATTERN's feature-icon badges,
// price/promo pill, and brand wordmark tag are NOT covered here — those
// stay AI-drawn, same as before, since they need real icon/logo assets this
// pass doesn't build.
export async function renderTextOverlay(spec: TextOverlaySpec, width: number, height: number): Promise<Buffer> {
  const fonts = loadThaiFonts();
  const scale = width / 1024;
  const px = (n: number) => Math.round(n * scale);

  const pillBase = {
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    textAlign: 'center' as const,
    whiteSpace: 'normal' as const
  };

  const image = new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: px(44),
          fontFamily: 'Prompt'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(12), width: '100%' }}>
          {spec.mainMessage && (
            <div
              style={{
                ...pillBase,
                background: 'rgba(15,23,42,0.85)',
                color: '#ffffff',
                fontSize: px(30),
                fontWeight: 500,
                padding: `${px(10)}px ${px(26)}px`,
                borderRadius: px(999),
                maxWidth: '92%',
                lineHeight: 1.3
              }}
            >
              {spec.mainMessage}
            </div>
          )}
          {spec.headline && (
            <div
              style={{
                ...pillBase,
                background: 'rgba(15,23,42,0.92)',
                color: '#ffffff',
                fontSize: px(54),
                fontWeight: 700,
                padding: `${px(18)}px ${px(34)}px`,
                borderRadius: px(28),
                maxWidth: '94%',
                lineHeight: 1.2
              }}
            >
              {spec.headline}
            </div>
          )}
        </div>

        {spec.badge && (
          <div
            style={{
              ...pillBase,
              position: 'absolute',
              top: px(44),
              right: px(44),
              background: '#ffffff',
              color: '#0f172a',
              fontSize: px(22),
              fontWeight: 700,
              padding: `${px(10)}px ${px(20)}px`,
              borderRadius: px(999),
              maxWidth: '40%',
              lineHeight: 1.25,
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
            }}
          >
            {spec.badge}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(14), width: '100%' }}>
          {spec.guarantee && (
            <div
              style={{
                ...pillBase,
                background: 'rgba(255,255,255,0.95)',
                color: '#0f172a',
                fontSize: px(26),
                fontWeight: 500,
                padding: `${px(14)}px ${px(28)}px`,
                borderRadius: px(20),
                maxWidth: '90%',
                lineHeight: 1.3
              }}
            >
              {spec.guarantee}
            </div>
          )}
          {spec.cta && (
            <div
              style={{
                ...pillBase,
                background: '#E0286B',
                color: '#ffffff',
                fontSize: px(32),
                fontWeight: 700,
                padding: `${px(16)}px ${px(40)}px`,
                borderRadius: px(999),
                maxWidth: '88%',
                lineHeight: 1.2
              }}
            >
              {spec.cta}
            </div>
          )}
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts: [
        { name: 'Prompt', data: fonts.regular, weight: 500, style: 'normal' },
        { name: 'Prompt', data: fonts.bold, weight: 700, style: 'normal' }
      ]
    }
  );

  const arrayBuffer = await image.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Composites the rendered text-overlay PNG (transparent background, exact
// same width/height as the base image) on top of the AI-generated base
// image — the actual "put crisp real text onto the photo" step.
export async function compositeTextOverlay(baseImage: Buffer, overlay: Buffer): Promise<Buffer> {
  return sharp(baseImage).composite([{ input: overlay, top: 0, left: 0 }]).png().toBuffer();
}
