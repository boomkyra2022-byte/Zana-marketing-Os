import type { Persona } from '@/types/database';

function arrToCsv(arr?: string[] | null) {
  return arr && arr.length ? arr.join(', ') : '';
}

export function PersonaForm({
  persona,
  action,
  error,
  submitLabel
}: {
  persona?: Partial<Persona>;
  action: (formData: FormData) => void;
  error?: string;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-6 max-w-3xl">
      {error && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="name">Name *</label>
          <input id="name" name="name" defaultValue={persona?.name ?? ''} required />
        </div>
        <div>
          <label className="field-label" htmlFor="age_range">Age Range</label>
          <input id="age_range" name="age_range" placeholder="25-34" defaultValue={persona?.age_range ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="life_stage">Life Stage</label>
          <input id="life_stage" name="life_stage" defaultValue={persona?.life_stage ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="preferred_language">Language Style</label>
          <input id="preferred_language" name="preferred_language" defaultValue={persona?.preferred_language ?? ''} />
        </div>
      </div>

      <p className="text-sm text-gray-500">ฟิลด์ด้านล่างคั่นด้วย comma (,)</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="pains">Pain Points</label>
          <textarea id="pains" name="pains" rows={2} defaultValue={arrToCsv(persona?.pains)} />
        </div>
        <div>
          <label className="field-label" htmlFor="desires">Desires</label>
          <textarea id="desires" name="desires" rows={2} defaultValue={arrToCsv(persona?.desires)} />
        </div>
        <div>
          <label className="field-label" htmlFor="objections">Objections</label>
          <textarea id="objections" name="objections" rows={2} defaultValue={arrToCsv(persona?.objections)} />
        </div>
        <div>
          <label className="field-label" htmlFor="triggers">Buying Triggers</label>
          <textarea id="triggers" name="triggers" rows={2} defaultValue={arrToCsv(persona?.triggers)} />
        </div>
        <div className="col-span-2">
          <label className="field-label" htmlFor="content_formats">Content Preferences</label>
          <input id="content_formats" name="content_formats" defaultValue={arrToCsv(persona?.content_formats)} />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="funnel_notes">Funnel Notes</label>
        <textarea id="funnel_notes" name="funnel_notes" rows={3} defaultValue={persona?.funnel_notes ?? ''} />
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        <a href="/personas" className="btn-secondary">ยกเลิก</a>
      </div>
    </form>
  );
}
