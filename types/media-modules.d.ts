// Ambient module declarations for media binary packages (no bundled @types).
declare module 'ffmpeg-static' {
  const ffmpegPath: string | null;
  export default ffmpegPath;
}

declare module 'ffprobe-static' {
  interface FfprobeStatic {
    path: string;
  }
  const ffprobeStatic: FfprobeStatic;
  export default ffprobeStatic;
}
