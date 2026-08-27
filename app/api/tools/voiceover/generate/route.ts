import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { generateSpeech, TTS_VOICES, AIProviderError, type TtsVoice } from '@/lib/ai/openai';
import { generateSpeechElevenLabs } from '@/lib/ai/elevenlabs';
import { generateSpeechMinimax } from '@/lib/ai/minimax';
import { uploadEditedClip, resignEditedClip } from '@/lib/supabase/storage';

// Standalone Voiceover (text-to-speech) tool — see 0012_voiceover_jobs.sql
// for the full "why". Single file, one Serverless Function slot (this
// project's deployment sits at Vercel Hobby's 12-function cap — see the
// dead-file note in app/api/tools/flow-prompt/[id]/route.ts for how the
// slot for this route was freed up).
//
// Multi-provider (0014_voiceover_multi_provider.sql, explicit user
// request): OpenAI's preset voices remain the default/only-validated-list
// provider; ElevenLabs and MiniMax are for the user's own voice CLONES —
// for those, `voice` is whatever raw voice_id the user pasted from their
// own ElevenLabs/MiniMax dashboard, not a fixed enum, since we have no way
// to know their clone IDs in advance and they may add more later.
export const runtime = 'nodejs';
export const maxDuration = 60;

const requestSchema = z
  .object({
    text: z.string().min(1, 'กรุณาใส่ข้อความ').max(4000, 'ข้อความยาวเกินไป (สูงสุด 4000 ตัวอักษรต่อครั้ง)'),
    provider: z.enum(['openai', 'elevenlabs', 'minimax']).default('openai'),
    voice: z.string().min(1, 'กรุณาเลือก/ระบุเสียง'),
    voice_label: z.string().max(100).optional(),
    instructions: z.string().max(500).optional(),
    // Preview clicks (auditioning a voice) return audio inline as base64 and
    // are never saved to history — only a real "generate" click persists a
    // row, so the history list stays meaningful instead of filling up with
    // 13 audition clicks per session.
    is_preview: z.boolean().optional()
  })
  .superRefine((data, ctx) => {
    // OpenAI voices are a fixed, known-good list — keep validating strictly.
    // ElevenLabs/MiniMax voice IDs are opaque strings from the user's own
    // account, so all we can check is "non-empty" (already covered by
    // z.string().min(1) above).
    if (data.provider === 'openai' && !(TTS_VOICES as readonly string[]).includes(data.voice)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'เสียง OpenAI ไม่ถูกต้อง', path: ['voice'] });
    }
  });

// Re-signs an expired history result URL (signed URLs are 24h TTL — see
// lib/supabase/storage.ts) without needing a separate route file, same
// query-param-dispatch trick used to fold the old flow-prompt/[id] GET into
// its sibling POST route. GET /api/tools/voiceover/generate?resign=<job_id>
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const jobId = new URL(request.url).searchParams.get('resign');
  if (!jobId) return NextResponse.json({ error: 'Missing resign id' }, { status: 400 });

  const { data, error } = await supabase.from('voiceover_jobs').select('result_path').eq('id', jobId).single();
  if (error || !data?.result_path) return NextResponse.json({ error: 'ไม่พบไฟล์เสียงนี้' }, { status: 404 });

  try {
    const signedUrl = await resignEditedClip(data.result_path);
    return NextResponse.json({ signed_url: signedUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'สร้างลิงก์ใหม่ไม่สำเร็จ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const { buffer, contentType } =
      input.provider === 'elevenlabs'
        ? await generateSpeechElevenLabs({ text: input.text, voiceId: input.voice })
        : input.provider === 'minimax'
          ? await generateSpeechMinimax({ text: input.text, voiceId: input.voice })
          : await generateSpeech({ text: input.text, voice: input.voice as TtsVoice, instructions: input.instructions });

    if (input.is_preview) {
      return NextResponse.json({
        audio_base64: buffer.toString('base64'),
        content_type: contentType
      });
    }

    const { path, signedUrl } = await uploadEditedClip(buffer, `voiceover_${randomUUID()}.mp3`, contentType);

    const { data: saved, error: insertError } = await supabase
      .from('voiceover_jobs')
      .insert({
        input_text: input.text,
        voice: input.voice,
        provider: input.provider,
        voice_label: input.voice_label || null,
        instructions: input.instructions || null,
        result_path: path,
        char_count: input.text.length,
        creator_id: user.id
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      // The audio itself was generated successfully — don't fail the whole
      // request over a history-logging error, just return the result
      // without a job id (won't show up in history, but the user still
      // gets their audio).
      return NextResponse.json({ signed_url: signedUrl, job_id: null, warning: 'สร้างเสียงสำเร็จ แต่บันทึกประวัติไม่สำเร็จ' });
    }

    return NextResponse.json({ signed_url: signedUrl, job_id: saved.id, created_at: saved.created_at });
  } catch (err: any) {
    if (err instanceof AIProviderError) {
      return NextResponse.json({ error: err.message }, { status: err.status >= 400 && err.status < 600 ? err.status : 502 });
    }
    return NextResponse.json({ error: err?.message || 'สร้างเสียงพากย์ไม่สำเร็จ' }, { status: 500 });
  }
}
