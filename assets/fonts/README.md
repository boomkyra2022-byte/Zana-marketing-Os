# Fonts for styled caption burn-in

The "burn styled captions into video" option in the Editor tool (Punchy SRT
→ Style panel) uses ffmpeg's `subtitles` filter to render captions, which
needs a real font FILE on disk — Vercel's serverless functions have no
system/Thai fonts installed, so without a file here Thai captions would
render as tofu boxes.

**This folder needs 2 files added manually before the burn-in feature will
work** (Claude's sandbox couldn't download them this session — no shell
access to fetch binaries):

1. Go to https://fonts.google.com/specimen/Kanit
2. Click "Get font" → "Download all"
3. Unzip, and copy these two files into this folder (`assets/fonts/`):
   - `Kanit-Regular.ttf`
   - `Kanit-Bold.ttf`
4. Commit + push as normal — `next.config.mjs` is already configured to
   ship this folder with the `/api/tools/editor/run` function.

Kanit is a Google Font under the SIL Open Font License 1.1 — free to bundle
and redistribute with the app.

To add more font choices later (matching the "font select" dropdown in the
Style panel), download the same way and drop the `.ttf`/`.otf` files in
here — the family name embedded in the font file is what must match the
`font_name` value sent from the UI.
