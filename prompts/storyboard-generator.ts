export const PROMPT_VERSION_STORYBOARD = 'storyboard-generator-v2';

export interface StoryboardGenScriptPayload {
  script_index: number;
  script_id: string;
  product: string | null;
  brand: string | null;
  hook: string | null;
  belief: string | null;
  story: string | null;
  proof: string | null;
  turning_point: string | null;
  offer: string | null;
  cta: string | null;
  full_script: string | null;
  estimated_duration_sec: number | null;
}

export interface StoryboardGenOptions {
  sceneCount: number;
  durationTargetSec: number;
  videoStyle: string;
  aiFootageMix: string; // e.g. "60% AI / 40% Real Footage"
}

const CAMERA_SHOTS = ['Extreme Close-up', 'Close-up', 'Medium', 'Wide', 'Top-down', 'Macro', 'POV'];
const CAMERA_MOVEMENTS = ['Static', 'Pan', 'Tilt', 'Push-in', 'Pull-out', 'Tracking', 'Handheld', 'Follow'];

export function buildStoryboardGeneratorPrompt(scripts: StoryboardGenScriptPayload[], opts: StoryboardGenOptions) {
  const system = `You are a video producer creating production-ready shooting storyboards for short-form ads (Thai DTC brands).
For EACH script provided, break it down into exactly ${opts.sceneCount} scenes targeting a total duration of ~${opts.durationTargetSec} seconds.
Video style: ${opts.videoStyle}. Target AI-generated vs real-footage mix: ${opts.aiFootageMix}.
Camera shot options: ${CAMERA_SHOTS.join(', ')}. Camera movement options: ${CAMERA_MOVEMENTS.join(', ')}.
Return JSON: {"storyboards": [...]} with exactly one entry per script, in the same order:
{
  "script_index": number (matches input),
  "title": string|null,
  "total_duration_sec": number,
  "tone_mood": string|null,
  "key_message": string|null,
  "scenes": [
    {
      "scene_number": number,
      "time_range": string (e.g. "0-5s"),
      "scene_objective": string|null,
      "visual_description": string (Thai, what's shown),
      "source_type": "AI Generated"|"Real Footage"|"Product Footage"|"B-roll",
      "subject_action": string|null,
      "camera_shot": string|null (one of the shot options),
      "camera_movement": string|null (one of the movement options),
      "voice_over": string|null (Thai, matches script timing),
      "dialogue": string|null,
      "on_screen_text": string|null,
      "sound_cue": string|null,
      "music_cue": string|null,
      "transition": string|null,
      "product_placement": string|null,
      "editing_note": string|null,
      "ai_video_prompt": string|null (only if source_type is "AI Generated" — a ready-to-use text-to-video prompt)
    }
  ]
}
Use the script's Hook/Belief/Story/Proof/Turning Point/Offer/CTA structure as pacing guidance for scene boundaries.
Prefer Real/Product Footage for genuine product close-ups and usage; prefer AI Generated for imagined b-roll, transitions, abstract visuals, flashbacks.`;

  const user = `Create storyboards for these ${scripts.length} scripts:\n${JSON.stringify(scripts, null, 2)}`;

  return { system, user };
}
