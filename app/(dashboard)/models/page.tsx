import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signLibraryPaths } from '@/lib/supabase/storage';
import type { ModelPreset } from '@/types/database';

export default async function ModelsPage() {
  const supabase = createClient();
  const { data: models, error } = await supabase.from('model_presets').select('*').order('active', { ascending: false }).order('created_at', { ascending: false });

  const thumbPaths = (models ?? []).map((m) => m.thumbnail).filter((p): p is string => !!p);
  const signed = await signLibraryPaths(thumbPaths);

  const active = (models as ModelPreset[] | null)?.filter((m) => m.active) ?? [];
  const archived = (models as ModelPreset[] | null)?.filter((m) => !m.active) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Model Library</h1>
          <p className="text-gray-500">คลังนางแบบ/สปีคเพอร์สัน ใช้ร่วมกับสินค้าได้หลายชิ้น ไม่ผูกตายตัว</p>
        </div>
        <Link href="/models/new" className="btn-primary">+ เพิ่ม Model</Link>
      </div>

      {error && <div className="card p-4 mb-4 border-red-300 text-red-700 text-sm">โหลดข้อมูลไม่สำเร็จ: {error.message}</div>}

      {!error && active.length === 0 && archived.length === 0 && (
        <div className="card p-8 text-center text-gray-500">ยังไม่มี Model ในระบบ — กด &quot;+ เพิ่ม Model&quot; เพื่อเริ่มต้น</div>
      )}

      {active.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {active.map((m) => (
            <ModelCard key={m.id} model={m} thumbUrl={m.thumbnail ? signed[m.thumbnail] : undefined} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">เก็บเข้าคลังแล้ว (Archived)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 opacity-60">
            {archived.map((m) => (
              <ModelCard key={m.id} model={m} thumbUrl={m.thumbnail ? signed[m.thumbnail] : undefined} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ModelCard({ model, thumbUrl }: { model: ModelPreset; thumbUrl?: string }) {
  return (
    <Link href={`/models/${model.id}`} className="card p-4 flex gap-3 hover:border-accentBlue transition-colors">
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">
        {/* eslint-disable-next-line @next/next/no-img-element -- Storage-signed URL, not a static asset */}
        {thumbUrl ? <img src={thumbUrl} alt="" className="w-full h-full object-cover" /> : 'ไม่มีรูป'}
      </div>
      <div className="min-w-0">
        <div className="font-semibold truncate">{model.name}</div>
        <div className="text-xs text-gray-500">
          {model.type === 'founder' ? 'Founder' : model.type === 'ai_model' ? 'AI Model' : 'Custom'}
          {model.identity_lock && ' · 🔒 Identity Lock'}
        </div>
      </div>
    </Link>
  );
}
