import { createClient } from '@/lib/supabase/server';
import VoiceoverClient from '@/components/voiceover-client';

export default async function VoiceoverPage() {
  const supabase = createClient();
  const { data: history } = await supabase
    .from('voiceover_jobs')
    .select('id, input_text, voice, instructions, char_count, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">พากย์เสียง (Voiceover)</h1>
        <p className="text-gray-500">
          พิมพ์หรือวางสคริปต์ เลือกเสียง กำหนดโทน/สไตล์การพูด แล้วฟังตัวอย่างก่อนสร้างไฟล์เสียงจริง — ใช้ OpenAI TTS
          (gpt-4o-mini-tts) เครื่องมือเดี่ยวสำหรับสร้างไฟล์เสียงพากย์ ยังไม่รวมเข้ากับ Editor เพื่อแทนเสียงในวิดีโอโดยตรง
        </p>
      </div>
      <VoiceoverClient history={history ?? []} />
    </div>
  );
}
