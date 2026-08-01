'use client';

import { useRef, useState } from 'react';
import type { StoryboardScene } from '@/types/database';

interface Props {
  products: { id: string; product_name: string; brand: string }[];
  personas: { id: string; name: string }[];
  ideas: { id: string; title: string }[];
  scripts: { id: string; title: string | null }[];
  storyboards: { id: string; title: string | null }[];
}

const PLATFORM_OPTIONS = ['TikTok', 'Facebook Reels', 'Instagram Reels', 'Marketplace'];

const STATUS_LABELS: Record<string, string> = {
  DOWNLOADING: 'กำลังดาวน์โหลดวิดีโอจาก Google Drive...',
  EXTRACTING: 'กำลังอ่านข้อมูลวิดีโอ + แยกเสียง + สุ่มเฟรมภาพ...',
  TRANSCRIBING: 'กำลังถอดเสียงเป็นข้อความ...',
  ANALYZING: 'AI กำลังดูวิดีโอและวิเคราะห์...',
  SCORING: 'กำลังคำนวณ Creative Score...',
  DONE: 'เสร็จสิ้น',
  FAILED: 'ล้มเหลว'
};

const VERDICT_STYLES: Record<string, string> = {
  REJECT: 'bg-red-50 text-red-700 border-red-200',
  REVISE: 'bg-orange-50 text-orange-700 border-orange-200',
  'READY TO TEST': 'bg-blue-50 text-blue-700 border-blue-200',
  'PRIORITY TEST': 'bg-green-50 text-green-700 border-green-200'
};

const TIMELINE_STYLES: Record<string, string> = {
  KEEP: 'bg-green-50 text-green-700 border-green-200',
  FIX: 'bg-red-50 text-red-700 border-red-200',
  IMPROVE: 'bg-orange-50 text-orange-700 border-orange-200'
};

const COMPARISON_STYLES: Record<string, string> = {
  Followed: 'bg-green-50 text-green-700 border-green-200',
  Changed: 'bg-orange-50 text-orange-700 border-orange-200',
  Missing: 'bg-red-50 text-red-700 border-red-200'
};

function extractDriveFileIdClient(url: string): string | null {
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export default function VideoAnalyzerClient({ products, personas, ideas, scripts, storyboards }: Props) {
  const [driveUrl, setDriveUrl] = useState('');
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [personaId, setPersonaId] = useState('');
  const [objective, setObjective] = useState('');
  const [platform, setPlatform] = useState('TikTok');
  const [ideaId, setIdeaId] = useState('');
  const [scriptId, setScriptId] = useState('');
  const [storyboardId, setStoryboardId] = useState('');

  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progressStatus, setProgressStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [video, setVideo] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  const [revising, setRevising] = useState(false);
  const [reviseError, setReviseError] = useState('');

  const [sbSceneCount, setSbSceneCount] = useState(6);
  const [sbDuration, setSbDuration] = useState(30);
  const [sbStyle, setSbStyle] = useState('UGC สมจริง มือถือ');
  const [sbMix, setSbMix] = useState('40% AI Generated / 60% Real Footage');
  const [v2Storyboard, setV2Storyboard] = useState<any>(null);
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);
  const [storyboardError, setStoryboardError] = useState('');

  const abortRef = useRef<AbortController | null>(null);

  async function handleAnalyze() {
    setPhase('running');
    setErrorMsg('');
    setAnalysis(null);
    setVideo(null);
    setV2Storyboard(null);
    setProgressStatus('กำลังเริ่มต้น...');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/creative/videos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drive_url: driveUrl,
          product_id: productId,
          persona_id: personaId || null,
          objective: objective || undefined,
          platform: platform || undefined,
          idea_id: ideaId || null,
          script_id: scriptId || null,
          storyboard_id: storyboardId || null
        }),
        signal: controller.signal
      });

      if (!res.body) throw new Error('ไม่ได้รับข้อมูลตอบกลับจากเซิร์ฟเวอร์');
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `เกิดข้อผิดพลาด (HTTP ${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === 'video_created') {
            setVideo(event.video);
          } else if (event.type === 'status') {
            setProgressStatus(STATUS_LABELS[event.status] ?? event.status);
          } else if (event.type === 'done') {
            setVideo(event.video);
            setAnalysis(event.analysis);
            setPhase('done');
          } else if (event.type === 'error') {
            setErrorMsg(event.error);
            setPhase('error');
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMsg(err.message || 'เกิดข้อผิดพลาดระหว่างวิเคราะห์วิดีโอ');
        setPhase('error');
      }
    }
  }

  async function handleRevise() {
    if (!video?.id) return;
    setRevising(true);
    setReviseError('');
    try {
      const res = await fetch(`/api/creative/videos/${video.id}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_id: personaId || null })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้างคำแนะนำ V2 ไม่สำเร็จ');
      setAnalysis((prev: any) => ({ ...prev, ...json.analysis }));
    } catch (err: any) {
      setReviseError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setRevising(false);
    }
  }

  async function handleGenerateV2Storyboard() {
    const revisedScriptId = analysis?.revised_script?.script_id;
    if (!revisedScriptId) return;
    setGeneratingStoryboard(true);
    setStoryboardError('');
    try {
      const res = await fetch('/api/creative/storyboards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script_ids: [revisedScriptId],
          scene_count: sbSceneCount,
          duration_target_sec: sbDuration,
          video_style: sbStyle,
          ai_footage_mix: sbMix
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้าง Storyboard ไม่สำเร็จ');
      setV2Storyboard(json.storyboards?.[0] ?? null);
    } catch (err: any) {
      setStoryboardError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setGeneratingStoryboard(false);
    }
  }

  const fileId = driveUrl ? extractDriveFileIdClient(driveUrl) : null;
  const dimensionEntries: [string, any][] = analysis?.score_breakdown ? Object.entries(analysis.score_breakdown) : [];

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">วิเคราะห์วิดีโอ</h2>
        <div>
          <label className="field-label">Google Drive Link (แชร์แบบ &quot;Anyone with the link&quot;) *</label>
          <input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/file/d/..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">สินค้า *</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} — {p.product_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Persona (ไม่บังคับ)</label>
            <select value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
              <option value="">— ไม่ระบุ —</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Objective</label>
            <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="เช่น ทดสอบ hook ใหม่" />
          </div>
          <div>
            <label className="field-label">Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Original Idea (ไม่บังคับ)</label>
            <select value={ideaId} onChange={(e) => setIdeaId(e.target.value)}>
              <option value="">— ไม่ระบุ —</option>
              {ideas.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Original Script (ไม่บังคับ)</label>
            <select value={scriptId} onChange={(e) => setScriptId(e.target.value)}>
              <option value="">— ไม่ระบุ —</option>
              {scripts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || '(ไม่มีชื่อ)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Original Storyboard (ไม่บังคับ — เทียบแผนกับของจริง)</label>
            <select value={storyboardId} onChange={(e) => setStoryboardId(e.target.value)}>
              <option value="">— ไม่ระบุ —</option>
              {storyboards.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || '(ไม่มีชื่อ)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button className="btn-primary" disabled={!driveUrl || !productId || phase === 'running'} onClick={handleAnalyze}>
          {phase === 'running' ? 'กำลังวิเคราะห์...' : 'Analyze Video'}
        </button>

        {phase === 'running' && (
          <div className="card p-4 bg-surface text-sm flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-accentBlue animate-pulse" />
            {progressStatus}
          </div>
        )}
        {phase === 'error' && <div className="text-red-600 text-sm">{errorMsg}</div>}
      </div>

      {fileId && (phase === 'running' || phase === 'done') && (
        <div className="card p-4">
          <iframe src={`https://drive.google.com/file/d/${fileId}/preview`} className="w-full aspect-video rounded-lg" allow="autoplay" />
        </div>
      )}

      {phase === 'done' && analysis && (
        <>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold">{analysis.score_total}<span className="text-lg text-gray-400">/100</span></div>
              <span className={`px-3 py-1 rounded-full border text-sm font-semibold ${VERDICT_STYLES[analysis.verdict] ?? ''}`}>{analysis.verdict}</span>
            </div>
            {analysis.risk_flags?.length > 0 && (
              <div className="mt-3 text-sm text-red-600">
                ⚠ Risk flags: {analysis.risk_flags.join(', ')}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {dimensionEntries.map(([key, d]: [string, any]) => (
              <div key={key} className="card p-4 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-accentGreen font-semibold">{d.score}</span>
                </div>
                {d.what_works && <div className="text-gray-600 mb-1">✅ {d.what_works}</div>}
                {d.what_hurts && <div className="text-red-500 mb-1">⚠ {d.what_hurts}</div>}
                {d.recommendation && <div className="text-accentBlue">→ {d.recommendation}</div>}
              </div>
            ))}
          </div>

          <div className="card p-4 overflow-x-auto">
            <h3 className="font-semibold mb-3">Timeline Fix Recommendations</h3>
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-gray-500">
                <tr>
                  <th className="px-2 py-2">เวลา</th>
                  <th className="px-2 py-2">สถานะ</th>
                  <th className="px-2 py-2">สิ่งที่พบ</th>
                  <th className="px-2 py-2">คำแนะนำ</th>
                </tr>
              </thead>
              <tbody>
                {(analysis.timeline_findings ?? []).map((f: any, i: number) => (
                  <tr key={i} className="border-t border-border align-top">
                    <td className="px-2 py-2 whitespace-nowrap">{f.start_time}–{f.end_time}</td>
                    <td className="px-2 py-2">
                      <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${TIMELINE_STYLES[f.status] ?? ''}`}>{f.status}</span>
                    </td>
                    <td className="px-2 py-2">{f.finding}</td>
                    <td className="px-2 py-2">{f.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {analysis.storyboard_comparison && (
            <div className="card p-4 overflow-x-auto">
              <h3 className="font-semibold mb-3">Storyboard vs Final Comparison</h3>
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-gray-500">
                  <tr>
                    <th className="px-2 py-2">หัวข้อ</th>
                    <th className="px-2 py-2">แผน</th>
                    <th className="px-2 py-2">ของจริง</th>
                    <th className="px-2 py-2">สถานะ</th>
                    <th className="px-2 py-2">ผล / คำแนะนำ</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.storyboard_comparison.map((c: any, i: number) => (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="px-2 py-2 font-medium">{c.aspect}</td>
                      <td className="px-2 py-2">{c.planned ?? '—'}</td>
                      <td className="px-2 py-2">{c.actual ?? '—'}</td>
                      <td className="px-2 py-2">
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${COMPARISON_STYLES[c.status] ?? ''}`}>{c.status}</span>
                      </td>
                      <td className="px-2 py-2">{c.result}{c.recommendation ? ` — ${c.recommendation}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Revised V2 Recommendation</h3>
              {!analysis.priority_fixes && (
                <button className="btn-primary" disabled={revising} onClick={handleRevise}>
                  {revising ? 'กำลังสร้างคำแนะนำ...' : 'สร้าง Priority Fixes + Revised Script V2'}
                </button>
              )}
            </div>
            {reviseError && <div className="text-red-600 text-sm">{reviseError}</div>}

            {analysis.priority_fixes && (
              <>
                <div>
                  <div className="field-label m-0 mb-1">Priority Fixes</div>
                  <ol className="list-decimal list-inside text-sm space-y-1">
                    {analysis.priority_fixes.map((f: string, i: number) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ol>
                </div>

                {analysis.revised_script && (
                  <div className="card p-4 text-sm bg-surface">
                    <div className="font-semibold mb-1">{analysis.revised_script.title}</div>
                    <div className="whitespace-pre-wrap text-gray-700">{analysis.revised_script.full_script}</div>
                  </div>
                )}

                {analysis.revised_edit_plan && (
                  <div>
                    <div className="field-label m-0 mb-1">Revised Edit Plan</div>
                    <div className="text-sm whitespace-pre-wrap">{analysis.revised_edit_plan}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                  <div>
                    <label className="field-label">จำนวน Scene</label>
                    <input type="number" min={3} max={30} value={sbSceneCount} onChange={(e) => setSbSceneCount(parseInt(e.target.value, 10) || 6)} />
                  </div>
                  <div>
                    <label className="field-label">ความยาวเป้าหมาย (วินาที)</label>
                    <input type="number" min={5} max={300} value={sbDuration} onChange={(e) => setSbDuration(parseInt(e.target.value, 10) || 30)} />
                  </div>
                  <div>
                    <label className="field-label">Video Style</label>
                    <input value={sbStyle} onChange={(e) => setSbStyle(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">AI / Real Footage Mix</label>
                    <input value={sbMix} onChange={(e) => setSbMix(e.target.value)} />
                  </div>
                </div>
                {storyboardError && <div className="text-red-600 text-sm">{storyboardError}</div>}
                <button className="btn-primary" disabled={generatingStoryboard} onClick={handleGenerateV2Storyboard}>
                  {generatingStoryboard ? 'กำลังสร้าง Storyboard...' : 'Generate V2 Storyboard'}
                </button>
              </>
            )}
          </div>

          {v2Storyboard && (
            <div className="card p-4 overflow-x-auto">
              <div className="mb-3">
                <span className="font-semibold">V2 Storyboard: {v2Storyboard.title}</span>
                <span className="text-gray-500 text-sm ml-2">
                  {v2Storyboard.total_duration_sec}s · {v2Storyboard.scene_count} scenes
                </span>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-surface text-left text-gray-500">
                  <tr>
                    <th className="px-2 py-2">Scene</th>
                    <th className="px-2 py-2">Time</th>
                    <th className="px-2 py-2">Visual</th>
                    <th className="px-2 py-2">Source</th>
                    <th className="px-2 py-2">Camera</th>
                    <th className="px-2 py-2">VO</th>
                    <th className="px-2 py-2">Text</th>
                    <th className="px-2 py-2">Sound</th>
                    <th className="px-2 py-2">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {(v2Storyboard.scenes as StoryboardScene[]).map((sc) => (
                    <tr key={sc.scene_number} className="border-t border-border align-top">
                      <td className="px-2 py-2">{sc.scene_number}</td>
                      <td className="px-2 py-2">{sc.time_range}</td>
                      <td className="px-2 py-2 max-w-xs">{sc.visual_description}</td>
                      <td className="px-2 py-2">{sc.source_type}</td>
                      <td className="px-2 py-2">
                        {sc.camera_shot}
                        {sc.camera_movement ? ` / ${sc.camera_movement}` : ''}
                      </td>
                      <td className="px-2 py-2 max-w-xs">{sc.voice_over}</td>
                      <td className="px-2 py-2">{sc.on_screen_text}</td>
                      <td className="px-2 py-2">{sc.sound_cue}</td>
                      <td className="px-2 py-2 max-w-xs">{sc.editing_note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
