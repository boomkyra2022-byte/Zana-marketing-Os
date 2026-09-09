import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Real root cause of the Windows "glob error ... EPERM ... scandir
// '...\AppData\Local\Temp\WinSAT'" build failure: `next build` runs
// TypeScript checking in a forked child process (fork-ts-checker-webpack-
// plugin), which on startup globs the OS temp directory (os.tmpdir()) to
// clean up stale lock files from previous/crashed builds. On this machine
// that temp dir has a WinSAT subfolder written by a SYSTEM-level Windows
// process with ACLs that block even this user account from listing it —
// so the glob throws EPERM and the whole build aborts. outputFileTracingRoot
// (below) does NOT touch this; it only affects Next's own output tracing,
// a separate step. The actual fix is to stop anything from ever touching
// the real OS temp dir during the build: point TEMP/TMP/TMPDIR at a clean,
// project-local folder before Next.js (and anything it forks) reads them.
// child_process.fork() inherits the parent's process.env by default, so
// setting this here — before webpack/fork-ts-checker ever starts — covers
// the forked type-checker too. Harmless on Vercel's Linux builds (which
// never hit this bug in the first place; TMPDIR there is already clean).
const localTmpDir = path.join(__dirname, '.next-tmp');
if (!fs.existsSync(localTmpDir)) fs.mkdirSync(localTmpDir, { recursive: true });
process.env.TEMP = localTmpDir;
process.env.TMP = localTmpDir;
process.env.TMPDIR = localTmpDir;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Without this, Next.js infers the file-tracing root by walking up from
  // this folder looking for a workspace root (lockfile, etc.) — on Windows
  // that can climb all the way to the user profile, and the build then
  // tries to scandir every folder under it, including OS-protected ones
  // like AppData\Local\Temp\WinSAT (Windows System Assessment Tool — even
  // admin-owned Node can't list it, hence "EPERM: operation not permitted,
  // scandir ...WinSAT"). Pinning the root to this project folder stops
  // tracing from ever leaving it. Local/Windows-only issue — Vercel's Linux
  // build environment was never affected, so no prior deploy hit this.
  // NOTE: this project is on Next.js 14.2.15, where outputFileTracingRoot is
  // still an `experimental` key (it only moved to top-level/stable in
  // Next 15) — placing it at the config root instead triggers Next's "Invalid
  // next.config.mjs options detected: Unrecognized key(s)" warning and gets
  // silently dropped, which is why the first attempt at this fix had no effect.
  experimental: {
    outputFileTracingRoot: __dirname,
    serverActions: {
      bodySizeLimit: '2mb'
    },
    // ffmpeg-static / ffprobe-static ship a native binary that's spawned via
    // a runtime fs path, not require()'d. Two earlier attempts at
    // outputFileTracingIncludes (different key formats) did not fix
    // `spawn .../ffprobe ENOENT` on Vercel, so switching to the standard fix
    // for native-binary npm packages on Vercel: mark them "external" so
    // webpack doesn't try to bundle/tree-shake them at all, and Vercel copies
    // their entire package folder (binary included) into the function as-is.
    // 'sharp' added for the new Thai text-overlay compositing feature
    // (lib/media/text-overlay.tsx) — same reasoning as ffmpeg-static below:
    // it ships prebuilt native .node binaries that webpack should not try to
    // bundle/tree-shake. This is also literally Next.js's own documented
    // recommendation for using sharp in a Route Handler.
    serverComponentsExternalPackages: ['ffmpeg-static', 'ffprobe-static', 'sharp'],
    // Narrowed to only the 2 routes that actually call ffmpeg/ffprobe
    // (lib/media/ffmpeg.ts). The previous blanket '/api/**/*' entry forced
    // these large native binaries into EVERY API route's bundle — including
    // pure-JSON routes like Ideas/Scripts/flow-prompt that never touch
    // ffmpeg — which pushed most function bundles well past the 50MB
    // threshold Next.js needs to merge routes into shared Serverless
    // Functions. That's what caused deployments to hit Vercel Hobby's
    // "no more than 12 Serverless Functions" limit even with a modest
    // number of route.ts files: oversized bundles can't be merged, so
    // Next.js/Vercel ends up creating far more distinct functions than the
    // file count alone would suggest. Narrowing this list is the real fix,
    // not reducing the number of route.ts files.
    outputFileTracingIncludes: {
      '/api/creative/videos/import': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**'],
      '/api/creative/videos/import/route': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**'],
      '/api/creative/videos/import/**/*': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**'],
      // Also ship the bundled Thai font files (assets/fonts/) with this
      // function — needed by ffmpeg's `subtitles` filter (see
      // lib/media/ffmpeg.ts: burnAssSubtitles) for the styled-caption
      // burn-in feature. Without these, libass has no Thai-capable font to
      // render with and text comes out as tofu/boxes.
      '/api/tools/editor/run': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**', './assets/fonts/**', './node_modules/wordcut/**'],
      '/api/tools/editor/run/route': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**', './assets/fonts/**', './node_modules/wordcut/**'],
      '/api/tools/editor/run/**/*': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**', './assets/fonts/**', './node_modules/wordcut/**'],
      // Live Editor transcribe-only step (added for the Tamsub-style
      // timeline + live preview) — calls probeMetadata/extractAudio too, so
      // needs the same ffmpeg/ffprobe binaries. No font file needed here
      // (it never burns anything onto the video, just extracts audio).
      // `wordcut` (Thai word segmentation, see lib/media/word-segment.ts)
      // loads its dictionary via fs.readFileSync + a glob() pattern
      // (node_modules/wordcut/data/tdict-*.txt) — Next.js's file tracer
      // cannot follow dynamic glob-resolved paths, so without this explicit
      // include the dictionary silently gets left out of the deployed
      // function and every call falls back to the (worse) Unicode-rule
      // repair. Same class of bug as the ffmpeg-static binary above.
      '/api/tools/editor/transcribe': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**', './node_modules/wordcut/**'],
      '/api/tools/editor/transcribe/route': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**', './node_modules/wordcut/**'],
      '/api/tools/editor/transcribe/**/*': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**', './node_modules/wordcut/**'],
      // Thai text-overlay compositing (lib/media/text-overlay.tsx) reads
      // assets/fonts/Prompt-*.ttf via fs.readFileSync at runtime — same
      // "file tracer can't follow a dynamic runtime fs path" issue already
      // solved for the Editor tool's font files above, so this route needs
      // the exact same explicit include.
      '/api/tools/banner-generator/generate': ['./assets/fonts/**'],
      '/api/tools/banner-generator/generate/route': ['./assets/fonts/**'],
      '/api/tools/banner-generator/generate/**/*': ['./assets/fonts/**']
    }
  }
};

export default nextConfig;
