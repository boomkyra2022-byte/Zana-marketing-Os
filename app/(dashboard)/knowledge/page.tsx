import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { KnowledgeItem } from '@/types/database';

export default async function KnowledgePage() {
  const supabase = createClient();
  const { data: items, error } = await supabase.from('knowledge_items').select('*').order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-gray-500">AI generation ทุกครั้งต้อง query ที่นี่ก่อน</p>
        </div>
        <Link href="/knowledge/new" className="btn-primary">+ เพิ่ม Knowledge</Link>
      </div>

      {error && <div className="card p-4 mb-4 border-red-300 text-red-700 text-sm">โหลดข้อมูลไม่สำเร็จ: {error.message}</div>}

      {!error && (items?.length ?? 0) === 0 && (
        <div className="card p-8 text-center text-gray-500">ยังไม่มี Knowledge Item</div>
      )}

      <div className="space-y-3">
        {(items as KnowledgeItem[] | null)?.map((k) => (
          <Link href={`/knowledge/${k.id}`} key={k.id} className="card p-4 flex items-start justify-between gap-4 hover:border-accentBlue transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase tracking-wide bg-surface px-2 py-0.5 rounded">{k.type}</span>
                {k.status !== 'active' && <span className="text-xs uppercase tracking-wide bg-red-100 text-red-700 px-2 py-0.5 rounded">{k.status}</span>}
              </div>
              <h3 className="font-semibold text-lg">{k.title}</h3>
              <p className="text-gray-500 line-clamp-2">{k.content}</p>
            </div>
            {k.confidence != null && <div className="text-right text-sm text-gray-500 shrink-0">confidence {k.confidence}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
