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
  // ZANA Framework (see supabase/migrations/0019_zana_framework.sql).
  // 'STANDARD' (default) | 'ZANA'. funnel_stage above always stays a
  // canonical stage regardless of framework — this is the separate marker.
  framework?: string | null;
  agitate?: string | null;
  bridge?: string | null;
  product_reason?: string | null;
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
  // ZANA Framework fields (see supabase/migrations/0019_zana_framework.sql).
  // Populated when framework === 'ZANA'; belief/story/turning_point/offer
  // above are populated instead when framework === 'STANDARD'. hook, proof,
  // cta, caption, hashtags are shared by both frameworks.
  framework?: string | null;
  problem?: string | null;
  agitate?: string | null;
  bridge?: string | null;
  solution?: string | null;
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

// ============================================================
// Ads Automation Bot — Phase 1 (see supabase/migrations/0014_ads_automation_phase1.sql)
// ============================================================

export type AdAccountStatus = 'active' | 'paused' | 'disabled';

export interface AdAccount {
  id: string;
  meta_account_id: string;
  name: string;
  currency: string | null;
  timezone_name: string | null;
  business_id: string | null;
  status: AdAccountStatus;
  // Name of the Vault secret holding this account's Business Manager token.
  // NULL falls back to the single META_SYSTEM_USER_TOKEN Edge Function secret.
  meta_token_secret_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdCampaign {
  id: string;
  ad_account_id: string;
  meta_campaign_id: string;
  name: string;
  objective: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdSet {
  id: string;
  campaign_id: string;
  ad_account_id: string;
  meta_adset_id: string;
  name: string;
  status: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  bid_strategy: string | null;
  optimization_goal: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdSetInsightSnapshot {
  id: string;
  ad_account_id: string;
  campaign_id: string;
  ad_set_id: string;
  captured_at: string;
  date_start: string | null;
  date_stop: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  frequency: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  purchases: number | null;
  purchase_value: number | null;
  roas: number | null;
  cpa: number | null;
  result_type: string | null;
  results: number | null;
  raw: unknown;
  created_at: string;
}

export type AdSyncRunStatus = 'running' | 'success' | 'partial' | 'failed';

export interface AdSyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: AdSyncRunStatus;
  accounts_synced: number;
  ad_sets_synced: number;
  error_message: string | null;
  created_at: string;
}

// ============================================================
// Ads Automation Bot — Phase 2 (see supabase/migrations/0017_ads_rules_engine.sql)
// ============================================================

export type AdRuleMetric = 'roas' | 'cpa' | 'spend' | 'frequency' | 'ctr' | 'cpc';
export type AdRuleOperator = '<' | '<=' | '>' | '>=' | '=';
export type AdRuleAction = 'pause' | 'activate' | 'scale_budget';

export interface AdAutomationRule {
  id: string;
  name: string;
  // Scope: narrowest non-null wins. All null = applies to every ad set.
  ad_account_id: string | null;
  campaign_id: string | null;
  ad_set_id: string | null;
  metric: AdRuleMetric;
  operator: AdRuleOperator;
  threshold: number;
  time_window_minutes: number;
  action: AdRuleAction;
  budget_change_percent: number | null; // required when action='scale_budget', capped ±20
  cooldown_hours: number;
  enabled: boolean;
  priority: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdRuleExecution {
  id: string;
  rule_id: string;
  ad_set_id: string;
  triggered_at: string;
  metric_value: number | null;
  dry_run: boolean;
  action_taken: string;
  budget_before: number | null;
  budget_after: number | null;
  status_before: string | null;
  status_after: string | null;
  success: boolean | null; // null when dry_run
  error_message: string | null;
  reasoning: string;
  created_at: string;
}
