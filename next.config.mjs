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
    outputFileTracingIncludes: {
      '/api/creative/videos/import/**': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**'],
      '/api/**': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**']
    }
  }
};

export default nextConfig;
