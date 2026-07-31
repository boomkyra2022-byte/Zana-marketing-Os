import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KnowledgeForm } from '@/components/knowledge-form';
import { updateKnowledgeItem, deleteKnowledgeItem } from '../actions';

export default async function EditKnowledgePage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const { data: item } = await supabase.from('knowledge_items').select('*').eq('id', params.id).single();
  if (!item) notFound();

  const boundUpdate = updateKnowledgeItem.bind(null, params.id);
  const boundDelete = deleteKnowledgeItem.bind(null, params.id);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">แก้ไข: {item.title}</h1>
        <form action={boundDelete}>
          <button type="submit" className="btn-secondary text-red-600 border-red-300">ลบ</button>
        </form>
      </div>
      <KnowledgeForm item={item} action={boundUpdate} error={searchParams.error} submitLabel="บันทึกการแก้ไข" />
    </div>
  );
}
