// Hand-written types matching supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types typescript` once the project is linked, if preferred.

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

export type KnowledgeType =
  | 'PRODUCT'
  | 'PERSONA'
  | 'BRAND'
  | 'OFFER'
  | 'CREATIVE_PATTERN'
  | 'WINNER_LEARNING'
  | 'LOSER_LEARNING'
  | 'COMPLIANCE'
  | 'FAQ'
  | 'CAMPAIGN'
  | 'MARKET_INSIGHT';

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
  full_script: string | null;
  shot_list: any;
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
  created_at: string;
}

export interface StoryboardScene {
  scene_number: number;
  time_range: string;
  source_type: 'AI' | 'FOOTAGE';
  camera_movement: string | null;
  visual_description: string;
  voice_over: string | null;
  sound_music: string | null;
  notes: string | null;
}

export interface Storyboard {
  id: string;
  script_id: string | null;
  creative_id: string | null;
  title: string | null;
  total_duration_sec: number | null;
  tone_mood: string | null;
  key_message: string | null;
  scenes: StoryboardScene[];
  music_plan: any;
  status: string;
  created_at: string;
}
