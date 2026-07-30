import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Persona } from '@/types/database';

export default async function PersonasPage() {
  const supabase = createClient();
  const { data: personas, error } = await supabase
    .from('personas')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">กลุ่มเป้าหมาย</h1>
          <p className="text-gray-400 text-sm">ฐานข้อมูล Persona จริงจาก Supabase</p>
        </div>
        <Link href="/personas/new" className="btn-primary">
          + เพิ่ม Persona
        </Link>
      </div>

      {error && (
        <div className="card p-4 mb-4 border-accentRed/50 text-accentRed text-sm">
          โหลดข้อมูลไม่สำเร็จ: {error.message}
        </div>
      )}

      {!error && (personas?.length ?? 0) === 0 && (
        <div className="card p-8 text-center text-gray-400">
          ยังไม่มี Persona ในระบบ — กด &quot;+ เพิ่ม Persona&quot; เพื่อเริ่มต้น
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {(personas as Persona[] | null)?.map((p) => (
          <Link href={`/personas/${p.id}`} key={p.id} className="card p-5 block hover:border-accentTeal/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{p.name}</h3>
              <span className="text-xs text-gray-500">{p.age_range}</span>
            </div>
            <p className="text-sm text-gray-400 mb-2">{p.life_stage}</p>
            {p.pains?.length > 0 && (
              <p className="text-xs text-gray-500">Pains: {p.pains.join(', ')}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
