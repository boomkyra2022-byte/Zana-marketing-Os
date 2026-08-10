// Small standalone fs helper shared by media pipelines. Deliberately has no
// import of ffmpeg-static/ffprobe-static so routes that don't touch ffmpeg
// (e.g. the Tamsub-backed Editor tool) don't pull those native-binary
// packages into their function bundle just for a temp-file cleanup call.

import fs from 'node:fs';

export function cleanupFiles(paths: string[]) {
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      /* best-effort cleanup */
    }
  }
}
