import type { KnowledgeItem } from '@/types/database';

const KNOWLEDGE_TYPES = [
  'PRODUCT','PERSONA','BRAND','OFFER','CREATIVE_PATTERN','WINNER_LEARNING',
  'LOSER_LEARNING','COMPLIANCE','FAQ','CAMPAIGN','MARKET_INSIGHT'
];

export function KnowledgeForm({
  item,
  action,
  error,
  submitLabel
}: {
  item?: Partial<KnowledgeItem>;
  action: (formData: FormData) => void;
  error?: string;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-6 max-w-3xl">
      {error && (
        <div className="rounded-lg border border-accentRed/50 bg-accentRed/10 px-3 py-2 text-sm text-accentRed">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="title">Title *</label>
          <input id="title" name="title" defaultValue={item?.title ?? ''} required />
        </div>
        <div>
          <label className="field-label" htmlFor="type">Type *</label>
          <select id="type" name="type" defaultValue={item?.type ?? 'FAQ'}>
            {KNOWLEDGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="content">Content *</label>
        <textarea id="content" name="content" rows={6} defaultValue={item?.content ?? ''} required />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="field-label" htmlFor="tags">Tags (comma separated)</label>
          <input id="tags" name="tags" defaultValue={item?.tags?.length ? item.tags.join(', ') : ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="source">Source</label>
          <input id="source" name="source" defaultValue={item?.source ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="confidence">Confidence (0-100)</label>
          <input id="confidence" name="confidence" type="number" min={0} max={100} defaultValue={item?.confidence ?? ''} />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={item?.status ?? 'active'}>
          <option value="active">active</option>
          <option value="deprecated">deprecated</option>
          <option value="draft">draft</option>
        </select>
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
        <a href="/knowledge" className="btn-secondary">
          ยกเลิก
        </a>
      </div>
    </form>
  );
}
