// Hand-written types matching supabase/migrations/0001-0003.
// Regenerate with `supabase gen types typescript` once linked, if preferred.

export type UserRole =
  | 'admin'
  | 'owner'
  | 'content_lead'
  | 'creator'
  | 'editor'
  | 'media_buyer'
  | 'viewer';

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface Product {
  id: string;
  brand: string;
  sku: string | null;
  product_name: string;
  category: string | null;
  status: string;
  selling_price: number | null;
  promotion_price: number | null;
  cogs: number | null;
  commission_rate: number | null;
  shipping_subsidy: number | null;
  usp: string | null;
  ingredients: string | null;
  benefits: string | null;
  usage: string | null;
  customer_objections: string | null;
  allowed_claims: string | null;
  banned_claims: string | null;
  compliance_notes: string | null;
  stock: number | null;
  is_hero: boolean;
  created_at: string;
  updated_at: string;
}

export interface Persona {
  id: string;
  name: string;
  age_range: string | null;
  life_stage: string | null;
  pains: string[];
  desires: string[];
  objections: string[];
  triggers: string[];
  preferred_language: string | null;
  content_formats: string[];
  funnel_notes: string | null;
  created_at: string;
}

export type KnowledgeType = 'PRODUCT' | 'PERSONA' | 'BRAND' | 'CONTENT_RULES' | 'WINNING_CREATIVE' | 'LEARNINGS';

export interface KnowledgeItem {
  id: string;
  title: string;
  type: KnowledgeType;
  content: string;
  tags: string[];
  product_ids: string[];
  persona_ids: string[];
  source: string | null;
  confidence: number | null;
  effective_from: string | null;
  effective_to: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type FunnelStage = 'Awareness' | 'Consideration' | 'Conversion' | 'Retention';
export type Platform = 'TikTok' | 'Facebook Reels' | 'Instagram Reels' | 'Marketplace';

export interface Idea {
  id: string;
  creative_id: string | null;
  title: string;
  product_id: string | null;
  persona_id: string | null;
  funnel_stage: string | null;
  creative_format: string | null;
  pain_point: string | null;
  emotional_trigger: string | null;
  hook: string | null;
  visual_concept: string | null;
  product_placement: string | null;
  mood_tone: string | null;
  cta: string | null;
  organic_or_ads: string | null;
  potential_score: number | null;
  stop_scroll_reason: string | null;
  risks: string | null;
  status: string;
  owner_id: string | null;
  parent_winner_id: string | null;
  source_type?: string | null;
  angle?: string | null;
  created_at: string;
}

export interface Script {
  id: string;
  idea_id: string | null;
  title: string | null;
  full_script: string | null;
  shot_list: string[] | null;
  voice_over: string | null;
  on_screen_text: string | null;
  cta: string | null;
  estimated_duration_sec: number | null;
  production_notes: string | null;
  score: number | null;
  status: string;
  hook: string | null;
  belief: string | null;
  story: string | null;
  proof: string | null;
  turning_point: string | null;
  offer: string | null;
  timed_script: Record<string, string> | null;
  caption: string | null;
  hashtags: string[];
  thumbnail_text: string | null;
  risks: string | null;
  created_at: string;
}

export type SceneSourceType = 'AI Generated' | 'Real Footage' | 'Product Footage' | 'B-roll';

export interface StoryboardScene {
  scene_number: number;
  time_range: string;
  scene_objective: string | null;
  visual_description: string;
  source_type: SceneSourceType;
  subject_action: string | null;
  camera_shot: string | null;
  camera_movement: string | null;
  voice_over: string | null;
  dialogue: string | null;
  on_screen_text: string | null;
  sound_cue: string | null;
  music_cue: string | null;
  transition: string | null;
  product_placement: string | null;
  editing_note: string | null;
  ai_video_prompt: string | null;
}

export interface Storyboard {
  id: string;
  script_id: string | null;
  creative_id: string | null;
  title: string | null;
  total_duration_sec: number | null;
  scene_count: number | null;
  style: string | null;
  tone_mood: string | null;
  key_message: string | null;
  scenes: StoryboardScene[];
  music_plan: any;
  status: string;
  created_at: string;
}

export interface Video {
  id: string;
  creative_id: string | null;
  script_id: string | null;
  storyboard_id: string | null;
  product_id: string | null;
  storage_path: string | null;
  source_url: string | null;
  mime_type: string | null;
  duration_sec: number | null;
  status: string;
  creator_id: string | null;
  editor_id: string | null;
  created_at: string;
}

export interface TimelineFinding {
  start_time: string;
  end_time: string;
  status: 'KEEP' | 'FIX' | 'IMPROVE';
  finding: string;
  recommendation: string;
}

export interface VideoAnalysis {
  id: string;
  video_id: string;
  transcript: string | null;
  metadata: any;
  frames: any;
  timeline_findings: TimelineFinding[] | null;
  product_appearance: any;
  offer_detection: any;
  cta_detection: any;
  risk_flags: any;
  raw_ai_response: any;
  provider: string | null;
  model: string | null;
  prompt_version: string | null;
  score_total: number | null;
  score_breakdown: Record<string, { score: number; what_works: string; what_hurts: string; recommendation: string }> | null;
  verdict: string | null;
  storyboard_comparison: any;
  priority_fixes: string[] | null;
  revised_script: any;
  revised_edit_plan: any;
  created_at: string;
}

export interface Winner {
  id: string;
  video_id: string | null;
  product_id: string | null;
  persona_id: string | null;
  hook: string | null;
  creative_format: string | null;
  funnel_stage: string | null;
  score: number | null;
  why_it_won: string | null;
  replicable_pattern: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}
