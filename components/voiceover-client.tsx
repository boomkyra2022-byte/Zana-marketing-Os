'use client';

import { useEffect, useRef, useState } from 'react';

// Standalone Voiceover (text-to-speech) tool — explicit user request:
// "เพิ่มโปรแกรมพากย์เสียงอัตโนมัติ... เลือกเสียงได้ ผู้ชาย ผู้หญิง กำหนด
// โทนเสียงได้ มีตัวอย่างให้ฟัง คล้ายๆ Text to speech Google AI studio".
// Default engine is OpenAI's gpt-4o-mini-tts (see lib/ai/openai.ts) — chosen
// over Google Gemini TTS / ElevenLabs per explicit original user decision
// (fastest to ship, zero new API key/billing setup, already used everywhere
// else in this app).
//
// Multi-provider (explicit follow-up user request — "ฉันสร้างเสียงโคลน
// ตัวเองไว้ใน Elevenlab และ Minimax ต้องการเชื่อมต่อเข้าโปรแกรม"):
// ElevenLabs and MiniMax are added as alternate engines specifically for the
// user's own voice clones (lib/ai/elevenlabs.ts, lib/ai/minimax.ts). We have
// no way to know the user's specific clone voice_id(s) in advance (and they
// may create more later), so instead of a hardcoded picker like the OpenAI
// one below, these two providers take a raw Voice ID pasted from the user's
// own ElevenLabs/MiniMax dashboard, plus an optional label for their own
// reference. Successfully-used clone voices are remembered in this browser
// (localStorage only — never sent anywhere but this device) as quick-pick
// chips so the user doesn't have to re-paste the same ID every time.

type TtsVoice = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'fable' | 'nova' | 'onyx' | 'sage' | 'shimmer' | 'verse' | 'marin' | 'cedar';
type Provider = 'openai' | 'elevenlabs' | 'minimax';

// OpenAI does not officially assign a gender to these voices — this
// grouping is our own best-effort categorization based on how each voice
// commonly sounds, purely to make the picker easier to scan. Always let the
// user preview before deciding; the caveat is shown directly in the UI too.
const VOICE_GROUPS: { label: string; voices: { value: TtsVoice; label: string; desc: string }[] }[] = [
  {
    label: 'แนวเสียงผู้ชาย',
    voices: [
      { value: 'onyx', label: 'Onyx', desc: 'ทุ้มลึก น่าเชื่อถือ' },
      { value: 'echo', label: 'Echo', desc: 'ชัดเจน กังวาน' },
      { value: 'ash', label: 'Ash', desc: 'ชัดถ้อยชัดคำ' },
      { value: 'fable', label: 'Fable', desc: 'อบอุ่น มีสำเนียง' },
      { value: 'verse', label: 'Verse', desc: 'มีจังหวะ อารมณ์ชัด' },
      { value: 'cedar', label: 'Cedar', desc: 'อบอุ่น หนักแน่น (คุณภาพสูงสุด)' }
    ]
  },
  {
    label: 'แนวเสียงผู้หญิง',
    voices: [
      { value: 'nova', label: 'Nova', desc: 'สดใส กระตือรือร้น' },
      { value: 'shimmer', label: 'Shimmer', desc: 'สดใส ร่าเริง' },
      { value: 'coral', label: 'Coral', desc: 'อบอุ่น มีชีวิตชีวา' },
      { value: 'sage', label: 'Sage', desc: 'นิ่ง หนักแน่น' },
      { value: 'marin', label: 'Marin', desc: 'สดชื่น เป็นธรรมชาติ (คุณภาพสูงสุด)' }
    ]
  },
  {
    label: 'เสียงกลาง',
    voices: [
      { value: 'alloy', label: 'Alloy', desc: 'กลาง สมดุล' },
      { value: 'ballad', label: 'Ballad', desc: 'นุ่มนวล ไพเราะ' }
    ]
  }
];

const PROVIDER_TABS: { value: Provider; label: string }[] = [
  { value: 'openai', label: 'เสียงสำเร็จรูป (OpenAI)' },
  { value: 'elevenlabs', label: 'เสียงโคลนของฉัน (ElevenLabs)' },
  { value: 'minimax', label: 'เสียงโคลนของฉัน (MiniMax)' }
];

const DEMO_TEXT = 'นี่คือตัวอย่างเสียงพากย์จากระบบของเรา ลองฟังโทนเสียงและจังหวะการพูดดูนะ';
const MAX_CHARS = 4000;

interface SavedCloneVoice {
  voiceId: string;
  label: string;
}

function cloneVoicesStorageKey(provider: Provider) {
  return `zana_voiceover_clones_${provider}`;
}

function loadSavedCloneVoices(provider: Provider): SavedCloneVoice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(cloneVoicesStorageKey(provider));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCloneVoice(provider: Provider, voiceId: string, label: string) {
  if (typeof window === 'undefined' || !voiceId.trim()) return;
  const existing = loadSavedCloneVoices(provider).filter((v) => v.voiceId !== voiceId.trim());
  const next = [{ voiceId: voiceId.trim(), label: label.trim() || voiceId.trim() }, ...existing].slice(0, 8);
  window.localStorage.setItem(cloneVoicesStorageKey(provider), JSON.stringify(next));
}

interface HistoryItem {
  id: string;
  input_text: string;
  voice: string;
  provider?: string | null;
  voice_label?: string | null;
  instructions: string | null;
  char_count: number;
  created_at: string;
}

interface Props {
  history: HistoryItem[];
}

export default function VoiceoverClient({ history: initialHistory }: Props) {
  const [text, setText] = useState('');
  const [provider, setProvider] = useState<Provider>('openai');
  const [voice, setVoice] = useState<TtsVoice>('coral');
  const [cloneVoiceId, setCloneVoiceId] = useState('');
  const [cloneVoiceLabel, setCloneVoiceLabel] = useState('');
  const [savedClones, setSavedClones] = useState<SavedCloneVoice[]>([]);
  const [instructions, setInstructions] = useState('');
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ signedUrl: string; jobId: string | null } | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const [historyPlaying, setHistoryPlaying] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (provider === 'openai') return;
    setSavedClones(loadSavedCloneVoices(provider));
  }, [provider]);

  async function playPreview(v: TtsVoice) {
    setError('');
    setPreviewingVoice(v);
    try {
      const res = await fetch('/api/tools/voiceover/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: (text.trim() || DEMO_TEXT).slice(0, 200),
          provider: 'openai',
          voice: v,
          instructions: instructions.trim() || undefined,
          is_preview: true
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ฟังตัวอย่างไม่สำเร็จ');

      const audio = new Audio(`data:${json.content_type};base64,${json.audio_base64}`);
      previewAudioRef.current = audio;
      await audio.play();
    } catch (err: any) {
      setError(err?.message || 'ฟังตัวอย่างไม่สำเร็จ');
    } finally {
      setPreviewingVoice(null);
    }
  }

  async function playClonePreview(voiceId: string) {
    if (!voiceId.trim()) {
      setError('กรุณาใส่ Voice ID ก่อน');
      return;
    }
    setError('');
    setPreviewingVoice(voiceId);
    try {
      const res = await fetch('/api/tools/voiceover/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: (text.trim() || DEMO_TEXT).slice(0, 200),
          provider,
          voice: voiceId.trim(),
          is_preview: true
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ฟังตัวอย่างไม่สำเร็จ');

      const audio = new Audio(`data:${json.content_type};base64,${json.audio_base64}`);
      previewAudioRef.current = audio;
      await audio.play();
    } catch (err: any) {
      setError(err?.message || 'ฟังตัวอย่างไม่สำเร็จ');
    } finally {
      setPreviewingVoice(null);
    }
  }

  async function generateVoiceover() {
    if (!text.trim()) {
      setError('กรุณาใส่ข้อความก่อน');
      return;
    }
    const voiceValue = provider === 'openai' ? voice : cloneVoiceId.trim();
    if (provider !== 'openai' && !voiceValue) {
      setError('กรุณาใส่ Voice ID ของเสียงโคลนก่อน');
      return;
    }
    setError('');
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/tools/voiceover/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          provider,
          voice: voiceValue,
          voice_label: provider !== 'openai' ? cloneVoiceLabel.trim() || undefined : undefined,
          instructions: provider === 'openai' ? instructions.trim() || undefined : undefined
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้างเสียงพากย์ไม่สำเร็จ');

      setResult({ signedUrl: json.signed_url, jobId: json.job_id });
      if (json.job_id) {
        setHistory((prev) => [
          {
            id: json.job_id,
            input_text: text.trim(),
            voice: voiceValue,
            provider,
            voice_label: provider !== 'openai' ? cloneVoiceLabel.trim() || null : null,
            instructions: instructions.trim() || null,
            char_count: text.trim().length,
            created_at: json.created_at || new Date().toISOString()
          },
          ...prev
        ]);
      }
      if (provider !== 'openai') {
        saveCloneVoice(provider, voiceValue, cloneVoiceLabel);
        setSavedClones(loadSavedCloneVoices(provider));
      }
    } catch (err: any) {
      setError(err?.message || 'สร้างเสียงพากย์ไม่สำเร็จ');
    } finally {
      setGenerating(false);
    }
  }

  async function playHistoryItem(id: string) {
    setHistoryPlaying(id);
    setError('');
    try {
      const res = await fetch(`/api/tools/voiceover/generate?resign=${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'เปิดไฟล์เสียงไม่สำเร็จ');
      const audio = new Audio(json.signed_url);
      await audio.play();
    } catch (err: any) {
      setError(err?.message || 'เปิดไฟล์เสียงไม่สำเร็จ');
    } finally {
      setHistoryPlaying(null);
    }
  }

  async function saveAudioToDevice() {
    if (!result?.signedUrl) return;
    try {
      const res = await fetch(result.signedUrl);
      const blob = await res.blob();
      const filename = `zana-voiceover-${Date.now()}.mp3`;
      const file = new File([blob], filename, { type: blob.type || 'audio/mpeg' });

      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err?.message || 'ดาวน์โหลดไม่สำเร็จ');
    }
  }

  function providerBadge(p?: string | null) {
    if (p === 'elevenlabs') return 'ElevenLabs';
    if (p === 'minimax') return 'MiniMax';
    return 'OpenAI';
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <div>
          <label className="field-label">ข้อความที่จะพากย์ *</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            rows={6}
            placeholder="วางสคริปต์หรือพิมพ์ข้อความที่ต้องการให้พากย์เสียง..."
          />
          <p className="text-xs text-gray-500 mt-1">{text.length} / {MAX_CHARS} ตัวอักษร</p>
        </div>

        <div>
          <label className="field-label">แหล่งเสียง</label>
          <div className="flex flex-wrap gap-2">
            {PROVIDER_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={`btn-secondary text-sm ${provider === tab.value ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setProvider(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {provider === 'openai' && (
          <div>
            <label className="field-label">กำหนดโทน/สไตล์การพูด (ไม่บังคับ)</label>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder='เช่น "พูดร่าเริง กระตือรือร้น เหมือนพรีเซนเตอร์ขายของ" หรือ "พูดช้าๆ นุ่มนวล เหมือนเล่านิทาน"'
            />
          </div>
        )}

        {provider === 'openai' ? (
          <div>
            <label className="field-label">เลือกเสียง *</label>
            <p className="text-xs text-gray-500 mb-2">
              OpenAI ไม่ได้ระบุเพศเสียงอย่างเป็นทางการ — การจัดกลุ่มนี้เป็นการประมาณจากลักษณะเสียงเพื่อให้เลือกง่ายขึ้น ลองกดฟังตัวอย่างก่อนตัดสินใจ
            </p>
            <div className="space-y-4">
              {VOICE_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-sm font-medium text-gray-700 mb-2">{group.label}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {group.voices.map((v) => (
                      <div
                        key={v.value}
                        className={`card p-3 flex items-center justify-between gap-2 cursor-pointer ${voice === v.value ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={() => setVoice(v.value)}
                      >
                        <div>
                          <p className="text-sm font-medium">{v.label}</p>
                          <p className="text-xs text-gray-500">{v.desc}</p>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary text-xs px-2 py-1"
                          disabled={previewingVoice === v.value}
                          onClick={(e) => {
                            e.stopPropagation();
                            playPreview(v.value);
                          }}
                        >
                          {previewingVoice === v.value ? '...' : '▶ ฟัง'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              ใส่ Voice ID ของเสียงโคลนที่สร้างไว้ใน {provider === 'elevenlabs' ? 'ElevenLabs' : 'MiniMax'} เอง (คัดลอกมาจากหน้า Voices ในบัญชีของคุณ) —
              ต้องตั้งค่า {provider === 'elevenlabs' ? 'ELEVENLABS_API_KEY' : 'MINIMAX_API_KEY'} ใน Vercel ไว้ก่อนถึงจะใช้งานได้
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="field-label">Voice ID *</label>
                <input type="text" value={cloneVoiceId} onChange={(e) => setCloneVoiceId(e.target.value)} placeholder="วาง Voice ID ที่นี่" />
              </div>
              <div>
                <label className="field-label">ชื่อเรียก (ไม่บังคับ)</label>
                <input type="text" value={cloneVoiceLabel} onChange={(e) => setCloneVoiceLabel(e.target.value)} placeholder="เช่น เสียงฉัน (โทนขาย)" />
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary text-xs px-2 py-1"
              disabled={!cloneVoiceId.trim() || previewingVoice === cloneVoiceId.trim()}
              onClick={() => playClonePreview(cloneVoiceId)}
            >
              {previewingVoice === cloneVoiceId.trim() ? '...' : '▶ ฟังตัวอย่างเสียงนี้'}
            </button>

            {savedClones.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">เสียงที่เคยใช้ (บันทึกไว้ในเบราว์เซอร์นี้เท่านั้น)</p>
                <div className="flex flex-wrap gap-2">
                  {savedClones.map((sv) => (
                    <button
                      key={sv.voiceId}
                      type="button"
                      className={`btn-secondary text-xs px-2 py-1 ${cloneVoiceId === sv.voiceId ? 'ring-2 ring-blue-500' : ''}`}
                      onClick={() => {
                        setCloneVoiceId(sv.voiceId);
                        setCloneVoiceLabel(sv.label);
                      }}
                    >
                      {sv.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="button" className="btn-primary" disabled={generating || !text.trim()} onClick={generateVoiceover}>
          {generating ? 'กำลังสร้างเสียงพากย์...' : 'สร้างเสียงพากย์'}
        </button>
        <p className="text-xs text-gray-500">
          {provider === 'openai'
            ? 'ใช้ OpenAI TTS (gpt-4o-mini-tts) — API เดียวกับที่ระบบใช้อยู่แล้ว มีค่าใช้จ่ายตามการใช้งานจริงของ OpenAI ไม่มี rate limit จากเราเอง'
            : `ใช้ ${provider === 'elevenlabs' ? 'ElevenLabs' : 'MiniMax'} กับเสียงโคลนของคุณเอง มีค่าใช้จ่ายตามแผนของบัญชี ${provider === 'elevenlabs' ? 'ElevenLabs' : 'MiniMax'} ที่คุณสมัครไว้`}
        </p>
      </div>

      {result && (
        <div className="card p-6 space-y-3">
          <label className="field-label">ผลลัพธ์</label>
          <audio controls src={result.signedUrl} className="w-full" />
          <div className="flex flex-wrap gap-3">
            <button className="btn-secondary" onClick={saveAudioToDevice}>บันทึกลงเครื่อง</button>
            <a href={result.signedUrl} target="_blank" rel="noreferrer" className="btn-secondary">เปิดในแท็บใหม่</a>
          </div>
        </div>
      )}

      <div className="card p-4">
        <label className="field-label">ประวัติงานล่าสุด</label>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีประวัติ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[560px] w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-4">ข้อความ</th>
                  <th className="py-2 pr-4">แหล่งเสียง</th>
                  <th className="py-2 pr-4">เสียง</th>
                  <th className="py-2 pr-4">เวลา</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="py-2 pr-4 max-w-xs truncate">{h.input_text}</td>
                    <td className="py-2 pr-4">{providerBadge(h.provider)}</td>
                    <td className="py-2 pr-4">{h.voice_label || h.voice}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(h.created_at).toLocaleString('th-TH')}</td>
                    <td className="py-2">
                      <button type="button" className="btn-secondary text-xs px-2 py-1" disabled={historyPlaying === h.id} onClick={() => playHistoryItem(h.id)}>
                        {historyPlaying === h.id ? '...' : '▶ ฟัง'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
