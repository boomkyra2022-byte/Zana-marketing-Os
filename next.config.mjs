/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
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
    serverComponentsExternalPackages: ['ffmpeg-static', 'ffprobe-static'],
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
      '/api/tools/editor/transcribe/**/*': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**', './node_modules/wordcut/**']
    }
  }
};

export default nextConfig;
