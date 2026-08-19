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
      '/api/tools/editor/run': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**', './assets/fonts/**'],
      '/api/tools/editor/run/route': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**', './assets/fonts/**'],
      '/api/tools/editor/run/**/*': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**', './assets/fonts/**']
    }
  }
};

export default nextConfig;
