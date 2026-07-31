import { createClient } from '@/lib/supabase/server';
import { saveAiSettings, saveScoringSettings } from './actions';

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: settingsRows } = await supabase.from('settings').select('*').in('key', ['ai', 'scoring']);

  const ai = (settingsRows?.find((r) => r.key === 'ai')?.value ?? {}) as any;
  const scoring = (settingsRows?.find((r) => r.key === 'scoring')?.value ?? {}) as any;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500">ตั้งค่า AI provider, ขีดจำกัดการ generate, และ threshold ของ Creative Score</p>
      </div>

      <form action={saveAiSettings} className="card p-5 space-y-4">
        <h2 className="text-lg font-semibold">AI</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Provider</label>
            <input name="provider" defaultValue={ai.provider ?? 'openai'} />
          </div>
          <div>
            <label className="field-label">Model</label>
            <input name="model" defaultValue={ai.model ?? ''} placeholder="gpt-4o-mini" />
          </div>
          <div>
            <label className="field-label">Temperature</label>
            <input name="temperature" type="number" step="0.1" min={0} max={2} defaultValue={ai.temperature ?? 0.7} />
          </div>
          <div>
            <label className="field-label">Transcription Model</label>
            <input name="transcription_model" defaultValue={ai.transcription_model ?? ''} placeholder="whisper-1" />
          </div>
          <div>
            <label className="field-label">Max Ideas per generate</label>
            <input name="max_ideas" type="number" defaultValue={ai.max_ideas ?? 20} />
          </div>
          <div>
            <label className="field-label">Max Scripts per generate</label>
            <input name="max_scripts" type="number" defaultValue={ai.max_scripts ?? 5} />
          </div>
          <div>
            <label className="field-label">Max Storyboards per generate</label>
            <input name="max_storyboards" type="number" defaultValue={ai.max_storyboards ?? 3} />
          </div>
          <div>
            <label className="field-label">Max Scenes per storyboard</label>
            <input name="max_scenes" type="number" defaultValue={ai.max_scenes ?? 8} />
          </div>
          <div>
            <label className="field-label">Max Frames (video analysis)</label>
            <input name="max_frames" type="number" defaultValue={ai.max_frames ?? 40} />
          </div>
          <div>
            <label className="field-label">Max Video Duration (sec)</label>
            <input name="max_duration_sec" type="number" defaultValue={ai.max_duration_sec ?? 60} />
          </div>
          <div>
            <label className="field-label">Prompt Version</label>
            <input name="prompt_version" defaultValue={ai.prompt_version ?? 'v1'} />
          </div>
        </div>
        <button type="submit" className="btn-primary">บันทึก AI Settings</button>
      </form>

      <form action={saveScoringSettings} className="card p-5 space-y-4">
        <h2 className="text-lg font-semibold">Creative Score Thresholds</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="field-label">REJECT below</label>
            <input name="reject_below" type="number" defaultValue={scoring.reject_below ?? 60} />
          </div>
          <div>
            <label className="field-label">REVISE below</label>
            <input name="revise_below" type="number" defaultValue={scoring.revise_below ?? 75} />
          </div>
          <div>
            <label className="field-label">PRIORITY TEST above</label>
            <input name="priority_test_above" type="number" defaultValue={scoring.priority_test_above ?? 85} />
          </div>
        </div>
        <button type="submit" className="btn-primary">บันทึก Scoring Settings</button>
      </form>

      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-2">Google Drive</h2>
        <p className="text-gray-500">V1 รองรับ public/shared link เท่านั้น — Google OAuth reserved สำหรับ phase ถัดไป</p>
      </div>
    </div>
  );
}
