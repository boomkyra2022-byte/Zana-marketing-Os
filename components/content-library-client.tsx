'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Idea, Script, Storyboard, StoryboardScene } from '@/types/database';

interface ProductOption {
  id: string;
  product_name: string;
  brand: string;
}

interface Props {
  products: ProductOption[];
  ideas: Idea[];
  scripts: Script[];
  storyboards: Storyboard[];
}

type LibTab = 'ideas' | 'scripts' | 'storyboards';
type FrameworkFilter = 'ALL' | 'STANDARD' | 'ZANA';

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ContentLibraryClient({ products, ideas, scripts, storyboards }: Props) {
  const [tab, setTab] = useState<LibTab>('ideas');
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [framework, setFramework] = useState<FrameworkFilter>('ALL');
  const [expandedStoryboardId, setExpandedStoryboardId] = useState<string | null>(null);

  function productLabel(id: string | null | undefined) {
    const p = products.find((pr) => pr.id === id);
    return p ? `${p.brand} — ${p.product_name}` : null;
  }

  const filteredIdeas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ideas.filter((idea) => {
      if (productId && idea.product_id !== productId) return false;
      if (framework !== 'ALL' && (idea.framework ?? 'STANDARD') !== framework) return false;
      if (!q) return true;
      return (idea.title ?? '').toLowerCase().includes(q) || (idea.hook ?? '').toLowerCase().includes(q) || (idea.pain_point ?? '').toLowerCase().includes(q);
    });
  }, [ideas, search, productId, framework]);

  const filteredScripts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scripts.filter((s) => {
      if (framework !== 'ALL' && (s.framework ?? 'STANDARD') !== framework) return false;
      if (!q) return true;
      return (s.title ?? '').toLowerCase().includes(q) || (s.full_script ?? '').toLowerCase().includes(q) || (s.caption ?? '').toLowerCase().includes(q);
    });
  }, [scripts, search, framework]);

  const filteredStoryboards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return storyboards;
    return storyboards.filter((sb) => (sb.title ?? '').toLowerCase().includes(q) || (sb.key_message ?? '').toLowerCase().includes(q));
  }, [storyboards, search]);

  function exportStoryboardText(sb: Storyboard): string {
    let out = `=== ${sb.title ?? '(no title)'} (${sb.total_duration_sec}s, ${sb.scene_count} scenes) ===\n`;
    out += `Tone/Mood: ${sb.tone_mood ?? '-'}\nKey Message: ${sb.key_message ?? '-'}\n\n`;
    (sb.scenes as StoryboardScene[]).forEach((sc) => {
      out += `Scene ${sc.scene_number} [${sc.time_range}]\n  Visual: ${sc.visual_description}\n  VO: ${sc.voice_over ?? '-'}\n  Text: ${sc.on_screen_text ?? '-'}\n\n`;
    });
    return out;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`btn-secondary ${tab === 'ideas' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setTab('ideas')}>
          Idea ({ideas.length})
        </button>
        <button type="button" className={`btn-secondary ${tab === 'scripts' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setTab('scripts')}>
          Script ({scripts.length})
        </button>
        <button type="button" className={`btn-secondary ${tab === 'storyboards' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setTab('storyboards')}>
          Storyboard ({storyboards.length})
        </button>
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="field-label">ค้นหา</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาจาก title / hook / เนื้อหา..." />
        </div>
        {tab === 'ideas' && (
          <div className="min-w-[220px]">
            <label className="field-label">สินค้า</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">— ทุกสินค้า —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} — {p.product_name}
                </option>
              ))}
            </select>
          </div>
        )}
        {(tab === 'ideas' || tab === 'scripts') && (
          <div className="min-w-[180px]">
            <label className="field-label">Framework</label>
            <select value={framework} onChange={(e) => setFramework(e.target.value as FrameworkFilter)}>
              <option value="ALL">— ทั้งหมด —</option>
              <option value="STANDARD">Standard</option>
              <option value="ZANA">ZANA Framework</option>
            </select>
          </div>
        )}
      </div>

      {tab === 'ideas' && (
        <div className="space-y-2">
          {filteredIdeas.length === 0 && <div className="card p-6 text-center text-gray-500 text-sm">ไม่พบ Idea ที่ตรงกับตัวกรอง</div>}
          {filteredIdeas.map((idea) => (
            <div key={idea.id} className="card p-3 flex gap-3 items-start">
              <div className="flex-1 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{idea.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border">{idea.funnel_stage}</span>
                  {idea.framework === 'ZANA' && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--accent-strategy-tint)', color: 'var(--accent-strategy)' }}>
                      ZANA Framework
                    </span>
                  )}
                  <span className="text-xs text-accentGreen font-semibold">score {idea.potential_score}/10</span>
                </div>
                <div className="text-gray-600 mt-1">Hook: {idea.hook}</div>
                <div className="text-gray-400 text-xs mt-1">
                  {productLabel(idea.product_id) ?? 'ไม่ทราบสินค้า'} · {new Date(idea.created_at).toLocaleString('th-TH')}
                </div>
              </div>
              <Link href={`/creative-generator?load_idea=${idea.id}`} className="btn-primary !px-2 !py-1 !text-xs whitespace-nowrap">
                ↩ ใช้ต่อ
              </Link>
            </div>
          ))}
        </div>
      )}

      {tab === 'scripts' && (
        <div className="space-y-2">
          {filteredScripts.length === 0 && <div className="card p-6 text-center text-gray-500 text-sm">ไม่พบ Script ที่ตรงกับตัวกรอง</div>}
          {filteredScripts.map((s) => (
            <div key={s.id} className="card p-3">
              <div className="flex gap-3 items-start">
                <div className="flex-1 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{s.title}</span>
                    {s.framework === 'ZANA' && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--accent-strategy-tint)', color: 'var(--accent-strategy)' }}>
                        ZANA Framework
                      </span>
                    )}
                    <span className="text-xs text-accentGreen font-semibold">score {s.score}/100</span>
                  </div>
                  <div className="text-gray-600 mt-1 line-clamp-2">{s.full_script}</div>
                  <div className="text-gray-400 text-xs mt-1">{new Date(s.created_at).toLocaleString('th-TH')}</div>
                </div>
                <Link href={`/creative-generator?load_script=${s.id}`} className="btn-primary !px-2 !py-1 !text-xs whitespace-nowrap">
                  ↩ ใช้ต่อ
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'storyboards' && (
        <div className="space-y-2">
          {filteredStoryboards.length === 0 && <div className="card p-6 text-center text-gray-500 text-sm">ไม่พบ Storyboard ที่ตรงกับตัวกรอง</div>}
          {filteredStoryboards.map((sb) => {
            const isOpen = expandedStoryboardId === sb.id;
            return (
              <div key={sb.id} className="card p-3">
                <div className="flex gap-3 items-start">
                  <div className="flex-1 text-sm">
                    <span className="font-semibold">{sb.title ?? '(no title)'}</span>
                    <span className="text-gray-500 text-xs ml-2">
                      {sb.total_duration_sec}s · {sb.scene_count} scenes · {sb.tone_mood}
                    </span>
                    <div className="text-gray-400 text-xs mt-1">{new Date(sb.created_at).toLocaleString('th-TH')}</div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary !px-2 !py-1 !text-xs whitespace-nowrap" onClick={() => setExpandedStoryboardId(isOpen ? null : sb.id)}>
                      {isOpen ? 'ซ่อน' : 'ดูรายละเอียด'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary !px-2 !py-1 !text-xs whitespace-nowrap"
                      onClick={() => downloadFile(`${sb.title || 'storyboard'}.txt`, exportStoryboardText(sb), 'text/plain')}
                    >
                      Export TXT
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <table className="w-full text-xs mt-3 overflow-x-auto">
                    <thead className="bg-surface text-left text-gray-500">
                      <tr>
                        <th className="px-2 py-2">Scene</th>
                        <th className="px-2 py-2">Time</th>
                        <th className="px-2 py-2">Visual</th>
                        <th className="px-2 py-2">VO</th>
                        <th className="px-2 py-2">Text</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sb.scenes as StoryboardScene[]).map((sc) => (
                        <tr key={sc.scene_number} className="border-t border-border align-top">
                          <td className="px-2 py-2">{sc.scene_number}</td>
                          <td className="px-2 py-2">{sc.time_range}</td>
                          <td className="px-2 py-2 max-w-xs">{sc.visual_description}</td>
                          <td className="px-2 py-2 max-w-xs">{sc.voice_over}</td>
                          <td className="px-2 py-2">{sc.on_screen_text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
