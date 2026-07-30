import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { KnowledgeItem } from '@/types/database';

export default async function KnowledgePage() {
  const supabase = createClient();
  const { data: items, error } = await supabase
    .from('knowledge_items')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">ฐานความรู้</h1>
          <p className="text-gray-400 text-sm">Business truth ที่ AI generation ทุกครั้งต้อง query ก่อน</p>
        </div>
        <Link href="/knowledge/new" className="btn-primary">
          + เพิ่ม Knowledge
        </Link>
      </div>

      {error && (
        <div className="card p-4 mb-4 border-accentRed/50 text-accentRed text-sm">
          โหลดข้อมูลไม่สำเร็จ: {error.message}
        </div>
      )}

      {!error && (items?.length ?? 0) === 0 && (
        <div className="card p-8 text-center text-gray-400">
          ยังไม่มี Knowledge Item — กด &quot;+ เพิ่ม Knowledge&quot; เพื่อเริ่มต้น
        </div>
      )}

      <div className="space-y-3">
        {(items as KnowledgeItem[] | null)?.map((k) => (
          <Link
            href={`/knowledge/${k.id}`}
            key={k.id}
            className="card p-4 flex items-start justify-between gap-4 hover:border-accentTeal/50 transition-colors"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase tracking-wide bg-white/10 px-2 py-0.5 rounded">{k.type}</span>
                {k.status !== 'active' && (
                  <span className="text-xs uppercase tracking-wide bg-accentRed/20 text-accentRed px-2 py-0.5 rounded">
                    {k.status}
                  </span>
                )}
              </div>
              <h3 className="font-semibold">{k.title}</h3>
              <p className="text-sm text-gray-400 line-clamp-2">{k.content}</p>
            </div>
            {k.confidence != null && (
              <div className="text-right text-sm text-gray-500 shrink-0">confidence {k.confidence}</div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
