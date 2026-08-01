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
    outputFileTracingIncludes: {
      '/api/creative/videos/import': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**'],
      '/api/creative/videos/import/route': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**'],
      '/api/creative/videos/import/**/*': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**'],
      '/api/**/*': ['./node_modules/ffmpeg-static/**', './node_modules/ffprobe-static/**']
    }
  }
};

export default nextConfig;
