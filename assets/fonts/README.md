# Fonts for styled caption burn-in

The "burn styled captions into video" option in the Editor tool (Punchy SRT
→ Style panel) uses ffmpeg's `subtitles` filter to render captions, which
needs a real font FILE on disk for each font family offered in the UI —
Vercel's serverless functions have no system/Thai fonts installed.

## ⚠️ Files must sit directly in this folder — not in per-font subfolders

Downloading each font from Google Fonts and unzipping normally creates a
subfolder per family (e.g. `assets/fonts/Prompt/Prompt-Regular.ttf`). **Move
the `.ttf` files OUT of those subfolders so they sit directly in
`assets/fonts/`** — the same flat layout `Kanit-Regular.ttf` /
`Kanit-Bold.ttf` already use. The font-lookup mechanism ffmpeg uses on
Vercel (no system fontconfig available, same reason `fontsdir` was needed
at all) is not confirmed to search subfolders recursively, and there's no
way to test this without a live deploy — flattening removes all doubt,
since it exactly matches the one layout already confirmed working (Kanit).
The subfolders themselves can be deleted afterward (harmless to leave them
empty too, just extra clutter).

## Fonts wired into the UI (19 total)

Every font below is already in the Style panel's dropdown
(`components/editor-client.tsx: FONT_OPTIONS`). Browser live-preview works
immediately for all of them (loads from Google Fonts CDN). **Actual
burned-video export only works for a font once its `.ttf` file is sitting
flat in this folder** — until then, burn-in with that font will fail.

| Font (UI value — must match exactly) | Google Fonts page |
| --- | --- |
| `Kanit` — done, files already flat here | https://fonts.google.com/specimen/Kanit |
| `Prompt` | https://fonts.google.com/specimen/Prompt |
| `Mitr` | https://fonts.google.com/specimen/Mitr |
| `Bai Jamjuree` | https://fonts.google.com/specimen/Bai+Jamjuree |
| `Chonburi` | https://fonts.google.com/specimen/Chonburi |
| `Pattaya` | https://fonts.google.com/specimen/Pattaya |
| `Charmonman` | https://fonts.google.com/specimen/Charmonman |
| `Taviraj` | https://fonts.google.com/specimen/Taviraj |
| `Anuphan` | https://fonts.google.com/specimen/Anuphan |
| `Athiti` | https://fonts.google.com/specimen/Athiti |
| `IBM Plex Sans Thai` | https://fonts.google.com/specimen/IBM+Plex+Sans+Thai |
| `IBM Plex Sans Thai Looped` | https://fonts.google.com/specimen/IBM+Plex+Sans+Thai+Looped |
| `Itim` | https://fonts.google.com/specimen/Itim |
| `K2D` | https://fonts.google.com/specimen/K2D |
| `Mali` | https://fonts.google.com/specimen/Mali |
| `Noto Sans Thai` | https://fonts.google.com/specimen/Noto+Sans+Thai |
| `Noto Sans Thai Looped` | https://fonts.google.com/specimen/Noto+Sans+Thai+Looped |
| `Playpen Sans Thai` | https://fonts.google.com/specimen/Playpen+Sans+Thai |
| `Sriracha` | https://fonts.google.com/specimen/Sriracha |

All are Google Fonts under the SIL Open Font License 1.1 — free to bundle
and redistribute with the app. `next.config.mjs` already ships this whole
folder (`./assets/fonts/**`) with the `/api/tools/editor/run` function, so
no config changes are needed no matter how many fonts end up here.

## Why these fonts, not CapCut's actual font list

CapCut's built-in fonts are proprietary/licensed to them, so we can't
literally reuse their font files. This set covers a similar *range* of
caption styles (bold modern, rounded/friendly, tech/business, vintage-bold,
playful script, handwriting, classic serif) while guaranteeing full Thai
glyph coverage — non-negotiable for this app's primary use case, since a
Latin-only font would silently render Thai captions as tofu boxes.
