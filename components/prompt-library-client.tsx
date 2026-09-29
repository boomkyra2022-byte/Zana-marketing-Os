'use client';

import { useMemo, useState } from 'react';
import type { PromptLibraryItem } from '@/types/database';

interface Props {
  initialPrompts: PromptLibraryItem[];
}

const PLACEHOLDER_RE = /\[([^\[\]]+)\]/g;

// Extracts unique [BRACKET] tokens in first-appearance order — these become
// the fill-in form fields. A prompt with no brackets (e.g. the character-
// sheet/shot examples from the source Notion page, which are worked
// examples rather than [ ]-templated) simply gets no fields, just a copy
// button for the text as-is.
function extractPlaceholders(template: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE);
  while ((m = re.exec(template))) {
    const label = m[1].trim();
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (full, label) => {
    const v = values[label.trim()];
    return v && v.trim() ? v.trim() : full;
  });
}

interface NewPromptForm {
  group_name: string;
  title: string;
  use_case: string;
  tool_name: string;
  aspect_ratio: string;
  prompt_template: string;
  notes: string;
  source_url: string;
}

const EMPTY_FORM: NewPromptForm = {
  group_name: '',
  title: '',
  use_case: '',
  tool_name: '',
  aspect_ratio: '',
  prompt_template: '',
  notes: '',
  source_url: ''
};

export default function PromptLibraryClient({ initialPrompts }: Props) {
  const [prompts, setPrompts] = useState<PromptLibraryItem[]>(initialPrompts);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<NewPromptForm>(EMPTY_FORM);
  const [addState, setAddState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [addError, setAddError] = useState('');

  const groups = useMemo(() => {
    const existingGroups = Array.from(new Set(prompts.map((p) => p.group_name)));
    const q = search.trim().toLowerCase();
    const filtered = q
      ? prompts.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            (p.use_case ?? '').toLowerCase().includes(q) ||
            (p.tool_name ?? '').toLowerCase().includes(q) ||
            p.group_name.toLowerCase().includes(q) ||
            p.prompt_template.toLowerCase().includes(q)
        )
      : prompts;
    const map = new Map<string, PromptLibraryItem[]>();
    for (const p of filtered) {
      if (!map.has(p.group_name)) map.set(p.group_name, []);
      map.get(p.group_name)!.push(p);
    }
    return { entries: Array.from(map.entries()), existingGroups };
  }, [prompts, search]);

  async function handleAddSubmit() {
    if (!addForm.group_name.trim() || !addForm.title.trim() || !addForm.prompt_template.trim()) {
      setAddState('error');
      setAddError('กรุณากรอกอย่างน้อย: กลุ่ม, ชื่อ, และเนื้อ Prompt');
      return;
    }
    setAddState('saving');
    setAddError('');
    try {
      const res = await fetch('/api/prompt-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_name: addForm.group_name.trim(),
          title: addForm.title.trim(),
          use_case: addForm.use_case.trim() || undefined,
          tool_name: addForm.tool_name.trim() || undefined,
          aspect_ratio: addForm.aspect_ratio.trim() || undefined,
          prompt_template: addForm.prompt_template.trim(),
          notes: addForm.notes.trim() || undefined,
          source_url: addForm.source_url.trim() || undefined,
          sort_order: prompts.filter((p) => p.group_name === addForm.group_name.trim()).length + 1
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ');
      setPrompts((prev) => [...prev, json.prompt]);
      setAddForm(EMPTY_FORM);
      setShowAddForm(false);
      setAddState('idle');
    } catch (err: any) {
      setAddState('error');
      setAddError(err.message || 'บันทึกไม่สำเร็จ');
    }
  }

  function handleDeleted(id: string) {
    setPrompts((prev) => prev.filter((p) => p.id !== id));
  }

  function handleUpdated(updated: PromptLibraryItem) {
    setPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleDuplicated(newItem: PromptLibraryItem) {
    setPrompts((prev) => [...prev, newItem]);
  }

  return (
    <div className="space-y-6">
      <div className="card p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหา prompt, กลุ่ม, เครื่องมือ..."
          className="sm:max-w-sm"
        />
        <button type="button" className="btn-primary whitespace-nowrap" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? 'ปิดฟอร์ม' : '+ เพิ่ม Prompt ใหม่'}
        </button>
      </div>

      {showAddForm && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold">เพิ่ม Prompt ใหม่</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">กลุ่ม *</label>
              <input
                list="prompt-library-groups"
                value={addForm.group_name}
                onChange={(e) => setAddForm({ ...addForm, group_name: e.target.value })}
                placeholder="เช่น Prompt วิดีโอ AI ของฉัน"
              />
              <datalist id="prompt-library-groups">
                {groups.existingGroups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="field-label">ชื่อ Prompt *</label>
              <input value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })} placeholder="เช่น เปลี่ยนฉากหลังคาเฟ่" />
            </div>
            <div>
              <label className="field-label">ใช้ตอน (ไม่บังคับ)</label>
              <input value={addForm.use_case} onChange={(e) => setAddForm({ ...addForm, use_case: e.target.value })} placeholder="ใช้ตอน: ..." />
            </div>
            <div>
              <label className="field-label">เครื่องมือ (ไม่บังคับ)</label>
              <input value={addForm.tool_name} onChange={(e) => setAddForm({ ...addForm, tool_name: e.target.value })} placeholder="เช่น Gemini, Seedance 2.5" />
            </div>
            <div>
              <label className="field-label">อัตราส่วน/สเปค (ไม่บังคับ)</label>
              <input value={addForm.aspect_ratio} onChange={(e) => setAddForm({ ...addForm, aspect_ratio: e.target.value })} placeholder="เช่น 9:16 · 30s" />
            </div>
            <div>
              <label className="field-label">ที่มา / ลิงก์ต้นทาง (ไม่บังคับ)</label>
              <input value={addForm.source_url} onChange={(e) => setAddForm({ ...addForm, source_url: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className="field-label">เนื้อ Prompt * — ใส่ [ ] รอบคำที่ต้องการให้กรอกทีหลังได้</label>
            <textarea
              value={addForm.prompt_template}
              onChange={(e) => setAddForm({ ...addForm, prompt_template: e.target.value })}
              rows={6}
              className="font-mono text-sm"
              placeholder="Edit this video... [DETAIL]..."
            />
          </div>
          <div>
            <label className="field-label">โน้ต/เคล็ดลับ (ไม่บังคับ)</label>
            <textarea value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} rows={2} />
          </div>
          {addState === 'error' && <p className="text-xs text-red-600">{addError}</p>}
          <button type="button" className="btn-primary" disabled={addState === 'saving'} onClick={handleAddSubmit}>
            {addState === 'saving' ? 'กำลังบันทึก...' : 'บันทึก Prompt'}
          </button>
        </div>
      )}

      {groups.entries.length === 0 && (
        <div className="card p-8 text-center text-gray-500">
          {search ? 'ไม่พบ prompt ที่ตรงกับคำค้นหา' : 'ยังไม่มี prompt ในคลัง — กด "+ เพิ่ม Prompt ใหม่" เพื่อเริ่มต้น'}
        </div>
      )}

      {groups.entries.map(([groupName, items]) => (
        <div key={groupName}>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">{groupName}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-2">
            {items.map((item) => (
              <PromptCard key={item.id} item={item} onDeleted={handleDeleted} onUpdated={handleUpdated} onDuplicated={handleDuplicated} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PromptCard({
  item,
  onDeleted,
  onUpdated,
  onDuplicated
}: {
  item: PromptLibraryItem;
  onDeleted: (id: string) => void;
  onUpdated: (item: PromptLibraryItem) => void;
  onDuplicated: (item: PromptLibraryItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [editDraft, setEditDraft] = useState({
    title: item.title,
    use_case: item.use_case ?? '',
    tool_name: item.tool_name ?? '',
    aspect_ratio: item.aspect_ratio ?? '',
    prompt_template: item.prompt_template,
    notes: item.notes ?? ''
  });

  const placeholders = useMemo(() => extractPlaceholders(item.prompt_template), [item.prompt_template]);
  const filledText = useMemo(() => fillTemplate(item.prompt_template, values), [item.prompt_template, values]);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(filledText);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setError('คัดลอกไม่สำเร็จ — ลองเลือกข้อความแล้วคัดลอกเองด้วย Ctrl+C');
    }
  }

  async function saveEdit() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/prompt-library/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editDraft.title,
          use_case: editDraft.use_case || null,
          tool_name: editDraft.tool_name || null,
          aspect_ratio: editDraft.aspect_ratio || null,
          prompt_template: editDraft.prompt_template,
          notes: editDraft.notes || null
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ');
      onUpdated(json.prompt);
      setEditMode(false);
    } catch (err: any) {
      setError(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/prompt-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_name: item.group_name,
          title: `${item.title} (สำเนา)`,
          use_case: item.use_case,
          tool_name: item.tool_name,
          aspect_ratio: item.aspect_ratio,
          prompt_template: item.prompt_template,
          notes: item.notes,
          source_url: item.source_url,
          sort_order: item.sort_order
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ทำสำเนาไม่สำเร็จ');
      onDuplicated(json.prompt);
    } catch (err: any) {
      setError(err.message || 'ทำสำเนาไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`ลบ Prompt "${item.title}" ถาวร?`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/prompt-library/${item.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ลบไม่สำเร็จ');
      onDeleted(item.id);
    } catch (err: any) {
      setError(err.message || 'ลบไม่สำเร็จ');
      setBusy(false);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{item.title}</div>
          {item.use_case && <div className="text-xs text-gray-500 mt-0.5">{item.use_case}</div>}
        </div>
        <button type="button" className="text-accentBlue text-xs whitespace-nowrap" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'ย่อ ▲' : 'ขยาย ▼'}
        </button>
      </div>

      <div className="flex gap-2 flex-wrap text-xs">
        {item.tool_name && <span className="px-2 py-0.5 rounded-full bg-surface border border-border text-gray-600">{item.tool_name}</span>}
        {item.aspect_ratio && <span className="px-2 py-0.5 rounded-full bg-surface border border-border text-gray-600">{item.aspect_ratio}</span>}
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-border pt-3">
          {!editMode ? (
            <>
              {placeholders.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {placeholders.map((p) => (
                    <div key={p}>
                      <label className="field-label text-xs">{p}</label>
                      <input
                        value={values[p] ?? ''}
                        onChange={(e) => setValues((prev) => ({ ...prev, [p]: e.target.value }))}
                        placeholder={p}
                      />
                    </div>
                  ))}
                </div>
              )}

              <textarea readOnly value={filledText} rows={8} className="w-full font-mono text-xs bg-surface" />

              {item.notes && <p className="text-xs text-gray-500">💡 {item.notes}</p>}

              <div className="flex gap-2 flex-wrap">
                <button type="button" className="btn-primary text-xs" onClick={copyToClipboard}>
                  {copyState === 'copied' ? '✓ คัดลอกแล้ว' : 'คัดลอก Prompt'}
                </button>
                <button type="button" className="btn-secondary text-xs" onClick={() => setEditMode(true)}>
                  แก้ไข
                </button>
                <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={duplicate}>
                  ทำสำเนา
                </button>
                <button type="button" className="text-red-600 text-xs" disabled={busy} onClick={remove}>
                  ลบ
                </button>
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noreferrer" className="text-xs text-gray-400 self-center ml-auto">
                    ที่มา ↗
                  </a>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="field-label text-xs">ชื่อ</label>
                  <input value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
                </div>
                <div>
                  <label className="field-label text-xs">ใช้ตอน</label>
                  <input value={editDraft.use_case} onChange={(e) => setEditDraft({ ...editDraft, use_case: e.target.value })} />
                </div>
                <div>
                  <label className="field-label text-xs">เครื่องมือ</label>
                  <input value={editDraft.tool_name} onChange={(e) => setEditDraft({ ...editDraft, tool_name: e.target.value })} />
                </div>
                <div>
                  <label className="field-label text-xs">อัตราส่วน/สเปค</label>
                  <input value={editDraft.aspect_ratio} onChange={(e) => setEditDraft({ ...editDraft, aspect_ratio: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="field-label text-xs">เนื้อ Prompt</label>
                <textarea
                  value={editDraft.prompt_template}
                  onChange={(e) => setEditDraft({ ...editDraft, prompt_template: e.target.value })}
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="field-label text-xs">โน้ต</label>
                <textarea value={editDraft.notes} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} rows={2} />
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-primary text-xs" disabled={busy} onClick={saveEdit}>
                  {busy ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button type="button" className="btn-secondary text-xs" onClick={() => setEditMode(false)}>
                  ยกเลิก
                </button>
              </div>
            </>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
