'use client';

import { useState } from 'react';
import type { Idea, Script, Storyboard } from '@/types/database';

type ProductOption = { id: string; product_name: string; brand: string };
type PersonaOption = { id: string; name: string };

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export function CreativeGenerator({ products, personas }: { products: ProductOption[]; personas: PersonaOption[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [personaId, setPersonaId] = useState<string>('');
  const [ideaQty, setIdeaQty] = useState(10);
  const [objective, setObjective] = useState('');

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<Set<string>>(new Set());
  const [scriptQty, setScriptQty] = useState(5);

  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScriptIds, setSelectedScriptIds] = useState<Set<string>>(new Set());
  const [storyboardQty, setStoryboardQty] = useState(3);

  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);

  const [loading, setLoading] = useState<'ideas' | 'scripts' | 'storyboards' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateIdeas() {
    setError(null);
    setLoading('ideas');
    try {
      const json = await postJSON('/api/ideas/generate', {
        product_id: productId,
        persona_id: personaId || null,
        quantity: ideaQty,
        objective: objective || undefined
      });
      setIdeas(json.ideas);
      setSelectedIdeaIds(new Set());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  function toggleIdea(id: string) {
    setSelectedIdeaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectTopIdeas(n: number) {
    const sorted = [...ideas].sort((a, b) => (b.potential_score ?? 0) - (a.potential_score ?? 0));
    setSelectedIdeaIds(new Set(sorted.slice(0, n).map((i) => i.id)));
  }

  async function handleGenerateScripts() {
    if (selectedIdeaIds.size === 0) {
      setError('เลือก Idea อย่างน้อย 1 อันก่อน');
      return;
    }
    setError(null);
    setLoading('scripts');
    try {
      const json = await postJSON('/api/scripts/generate', { idea_ids: Array.from(selectedIdeaIds) });
      setScripts(json.scripts);
      setSelectedScriptIds(new Set());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  function toggleScript(id: string) {
    setSelectedScriptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectTopScripts(n: number) {
    const sorted = [...scripts].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    setSelectedScriptIds(new Set(sorted.slice(0, n).map((s) => s.id)));
  }

  async function handleGenerateStoryboards() {
    if (selectedScriptIds.size === 0) {
      setError('เลือก Script อย่างน้อย 1 อันก่อน');
      return;
    }
    setError(null);
    setLoading('storyboards');
    try {
      const json = await postJSON('/api/storyboards/generate', { script_ids: Array.from(selectedScriptIds) });
      setStoryboards(json.storyboards);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-accentRed/50 bg-accentRed/10 px-3 py-2 text-sm text-accentRed">{error}</div>
      )}

      {/* Step 1: Ideas */}
      <div className="card p-5">
        <h2 className="font-semibold mb-4">1. Generate Idea</h2>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label>Product</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} — {p.product_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Persona (ไม่บังคับ)</label>
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
            <label>จำนวน Idea</label>
            <input type="number" min={1} max={100} value={ideaQty} onChange={(e) => setIdeaQty(Number(e.target.value))} />
          </div>
          <div>
            <label>Objective (ไม่บังคับ)</label>
            <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="เช่น เพิ่มยอดขาย, สร้าง awareness" />
          </div>
        </div>
        <button className="btn-primary" onClick={handleGenerateIdeas} disabled={!productId || loading === 'ideas'}>
          {loading === 'ideas' ? 'กำลังสร้าง...' : `Generate ${ideaQty} Ideas`}
        </button>

        {ideas.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3 text-sm text-gray-400">
              <span>เลือกแล้ว {selectedIdeaIds.size}/{ideas.length}</span>
              <button className="btn-secondary text-xs py-1" onClick={() => selectTopIdeas(Math.min(scriptQty, ideas.length))}>
                เลือก Top {scriptQty} อัตโนมัติ (ตาม potential_score)
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {ideas.map((idea) => (
                <label
                  key={idea.id}
                  className={`card p-3 flex items-start gap-3 cursor-pointer ${selectedIdeaIds.has(idea.id) ? 'border-accentTeal' : ''}`}
                >
                  <input type="checkbox" checked={selectedIdeaIds.has(idea.id)} onChange={() => toggleIdea(idea.id)} className="mt-1" />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-medium">{idea.title}</span>
                      <span className="text-accentTeal text-sm">{idea.potential_score}</span>
                    </div>
                    <div className="text-xs text-gray-500">{idea.angle} · {idea.creative_id}</div>
                    <div className="text-sm text-gray-400 mt-1">Hook: {idea.hook}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Scripts */}
      {ideas.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold mb-4">2. Generate Script</h2>
          <button className="btn-primary" onClick={handleGenerateScripts} disabled={loading === 'scripts'}>
            {loading === 'scripts' ? 'กำลังสร้าง...' : `Generate Script จาก ${selectedIdeaIds.size} Idea ที่เลือก`}
          </button>

          {scripts.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-3 text-sm text-gray-400">
                <span>เลือกแล้ว {selectedScriptIds.size}/{scripts.length}</span>
                <input
                  type="number"
                  min={1}
                  className="w-20"
                  value={storyboardQty}
                  onChange={(e) => setStoryboardQty(Number(e.target.value))}
                />
                <button className="btn-secondary text-xs py-1" onClick={() => selectTopScripts(storyboardQty)}>
                  เลือก Top ตามคะแนนอัตโนมัติ
                </button>
              </div>
              <div className="space-y-3 max-h-[32rem] overflow-y-auto">
                {scripts.map((script) => (
                  <label
                    key={script.id}
                    className={`card p-3 flex items-start gap-3 cursor-pointer block ${selectedScriptIds.has(script.id) ? 'border-accentTeal' : ''}`}
                  >
                    <input type="checkbox" checked={selectedScriptIds.has(script.id)} onChange={() => toggleScript(script.id)} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-medium">Hook: {script.hook}</span>
                        <span className="text-accentTeal text-sm">score {script.score}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Belief: {script.belief}</div>
                      <div className="text-xs text-gray-500">Offer: {script.offer} · CTA: {script.cta}</div>
                      <details className="mt-2 text-sm text-gray-400">
                        <summary className="cursor-pointer text-accentTeal">ดู Full Script + Timed Segments</summary>
                        <p className="mt-2 whitespace-pre-wrap">{script.full_script}</p>
                        {script.timed_script && (
                          <div className="mt-2 grid grid-cols-1 gap-1">
                            {Object.entries(script.timed_script).map(([range, text]) => (
                              <div key={range}>
                                <span className="text-gray-500">{range}:</span> {text}
                              </div>
                            ))}
                          </div>
                        )}
                        {script.caption && <div className="mt-2">Caption: {script.caption}</div>}
                        {script.hashtags?.length > 0 && (
                          <div className="mt-1 text-accentTeal">{script.hashtags.map((h) => `#${h}`).join(' ')}</div>
                        )}
                      </details>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Storyboards */}
      {scripts.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold mb-4">3. Generate Video Storyboard</h2>
          <button className="btn-primary" onClick={handleGenerateStoryboards} disabled={loading === 'storyboards'}>
            {loading === 'storyboards' ? 'กำลังสร้าง...' : `Generate Storyboard จาก ${selectedScriptIds.size} Script ที่เลือก`}
          </button>

          {storyboards.length > 0 && (
            <div className="mt-5 space-y-6">
              {storyboards.map((sb) => (
                <div key={sb.id} className="card p-4">
                  <div className="flex justify-between mb-2">
                    <h3 className="font-semibold">{sb.title || sb.creative_id}</h3>
                    <span className="text-xs text-gray-500">{sb.total_duration_sec}s · {sb.tone_mood}</span>
                  </div>
                  {sb.key_message && <p className="text-sm text-gray-400 mb-3">Key message: {sb.key_message}</p>}
                  <table className="w-full text-sm">
                    <thead className="text-gray-500 text-left">
                      <tr>
                        <th className="pr-2 py-1">#</th>
                        <th className="pr-2 py-1">เวลา</th>
                        <th className="pr-2 py-1">AI/Footage</th>
                        <th className="pr-2 py-1">Camera</th>
                        <th className="pr-2 py-1">Visual</th>
                        <th className="pr-2 py-1">Voice Over</th>
                        <th className="pr-2 py-1">Sound</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sb.scenes.map((scene) => (
                        <tr key={scene.scene_number} className="border-t border-white/5 align-top">
                          <td className="pr-2 py-2">{scene.scene_number}</td>
                          <td className="pr-2 py-2">{scene.time_range}</td>
                          <td className="pr-2 py-2">
                            <span className={scene.source_type === 'AI' ? 'text-accentTeal' : 'text-accentRed'}>
                              {scene.source_type}
                            </span>
                          </td>
                          <td className="pr-2 py-2">{scene.camera_movement}</td>
                          <td className="pr-2 py-2">{scene.visual_description}</td>
                          <td className="pr-2 py-2">{scene.voice_over}</td>
                          <td className="pr-2 py-2">{scene.sound_music}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
