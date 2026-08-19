import { createClient } from '@/lib/supabase/server';
import FlowPromptDirectorClient from '@/components/flow-prompt-director-client';
import type { Idea, Script, Storyboard, StoryboardScene } from '@/types/database';

interface PageProps {
  searchParams: { source?: string; source_id?: string };
}

function buildContentInputFromIdea(idea: Idea): string {
  return [
    idea.title ? `หัวข้อ: ${idea.title}` : '',
    idea.hook ? `Hook: ${idea.hook}` : '',
    idea.pain_point ? `Pain point: ${idea.pain_point}` : '',
    idea.visual_concept ? `Visual concept: ${idea.visual_concept}` : '',
    idea.mood_tone ? `Mood/Tone: ${idea.mood_tone}` : '',
    idea.cta ? `CTA: ${idea.cta}` : '',
    idea.angle ? `Angle: ${idea.angle}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function buildContentInputFromScript(script: Script): string {
  return [
    script.title ? `หัวข้อ: ${script.title}` : '',
    script.hook ? `Hook: ${script.hook}` : '',
    script.full_script ? `\nสคริปต์เต็ม:\n${script.full_script}` : '',
    script.cta ? `\nCTA: ${script.cta}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function buildContentInputFromStoryboard(storyboard: Storyboard): string {
  const scenesText = (storyboard.scenes as StoryboardScene[])
    .map((sc) => `Scene ${sc.scene_number} [${sc.time_range}] — ${sc.visual_description}${sc.voice_over ? ` | VO: ${sc.voice_over}` : ''}`)
    .join('\n');
  return [
    storyboard.title ? `หัวข้อ: ${storyboard.title}` : '',
    storyboard.key_message ? `Key message: ${storyboard.key_message}` : '',
    storyboard.tone_mood ? `Tone/Mood: ${storyboard.tone_mood}` : '',
    scenesText ? `\nStoryboard scenes:\n${scenesText}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

export default async function FlowPromptPage({ searchParams }: PageProps) {
  const supabase = createClient();
  const [{ data: products }, { data: personas }, { data: ideas }, { data: scripts }, { data: storyboards }, { data: recentProjects }] =
    await Promise.all([
      supabase.from('products').select('id, product_name, brand, usp, allowed_claims, banned_claims').order('created_at', { ascending: false }),
      supabase.from('personas').select('id, name').order('created_at', { ascending: false }),
      supabase.from('ideas').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('scripts').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('storyboards').select('*').order('created_at', { ascending: false }).limit(30),
      supabase
        .from('flow_prompts')
        .select('id, project_name, content_input, duration_sec, prompt_count, platform, status, updated_at, created_at')
        .order('created_at', { ascending: false })
        .limit(15)
    ]);

  let initialSource: { sourceType: string; contentInput: string; productId: string | null; existingScript: string | null } | null = null;

  if (searchParams.source && searchParams.source_id) {
    if (searchParams.source === 'IDEA') {
      const idea = (ideas ?? []).find((i) => i.id === searchParams.source_id) as Idea | undefined;
      if (idea) initialSource = { sourceType: 'IDEA', contentInput: buildContentInputFromIdea(idea), productId: idea.product_id, existingScript: null };
    } else if (searchParams.source === 'SCRIPT') {
      const script = (scripts ?? []).find((s) => s.id === searchParams.source_id) as Script | undefined;
      if (script) {
        const parentIdea = script.idea_id ? (ideas ?? []).find((i) => i.id === script.idea_id) : null;
        initialSource = {
          sourceType: 'SCRIPT',
          contentInput: buildContentInputFromScript(script),
          productId: parentIdea?.product_id ?? null,
          existingScript: script.full_script
        };
      }
    } else if (searchParams.source === 'STORYBOARD') {
      const storyboard = (storyboards ?? []).find((s) => s.id === searchParams.source_id) as Storyboard | undefined;
      if (storyboard) {
        initialSource = { sourceType: 'STORYBOARD', contentInput: buildContentInputFromStoryboard(storyboard), productId: null, existingScript: null };
      }
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Flow Prompt Director</h1>
        <p className="text-gray-500">
          วิเคราะห์เนื้อหา → ออกแบบ Story Flow + Hook → แบ่งวิดีโอเป็น PART ละ 10 วินาที → สร้าง Google Flow Master Prompt ที่พร้อม copy ไปใช้ได้ทันที
          ต่อจาก Idea / Script / Storyboard ใน Creative Generator หรือเริ่มเขียนใหม่ก็ได้
        </p>
      </div>
      <FlowPromptDirectorClient
        products={products ?? []}
        personas={personas ?? []}
        ideas={(ideas ?? []) as Idea[]}
        scripts={(scripts ?? []) as Script[]}
        storyboards={(storyboards ?? []) as Storyboard[]}
        recentProjects={recentProjects ?? []}
        initialSource={initialSource}
      />
    </div>
  );
}
