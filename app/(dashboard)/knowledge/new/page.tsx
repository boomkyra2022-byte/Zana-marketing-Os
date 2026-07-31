import { KnowledgeForm } from '@/components/knowledge-form';
import { createKnowledgeItem } from '../actions';

export default function NewKnowledgePage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">เพิ่ม Knowledge Item</h1>
      <KnowledgeForm action={createKnowledgeItem} error={searchParams.error} submitLabel="บันทึก" />
    </div>
  );
}
