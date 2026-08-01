/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    },
    // ffmpeg-static / ffprobe-static ship a binary that's spawned via a
    // runtime fs path (child_process.execFile), not require()'d — Vercel's
    // file tracer can't see that reference statically, so without this the
    // binary silently gets left out of the deployed function bundle and
    // fails at runtime with `spawn .../ffprobe ENOENT`.
    // Trying several key formats at once (exact route, route+suffix, glob) —
    // Next's internal route-key matching for this option isn't consistent
    // across versions/docs examples, and there's no way to verify locally
    // in this environment, so include every plausible variant. Unmatched
    // keys are simply ignored, so this is safe even if some don't apply.
    outputFileTracingIncludes: {
      '/api/creative/videos/import': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**'],
      '/api/creative/videos/import/route': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**'],
      '/api/creative/videos/import/**/*': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**'],
      '/api/**/*': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**']
    }
  }
};

export default nextConfig;
