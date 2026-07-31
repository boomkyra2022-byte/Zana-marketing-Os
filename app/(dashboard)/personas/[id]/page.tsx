import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PersonaForm } from '@/components/persona-form';
import { updatePersona, deletePersona } from '../actions';

export default async function EditPersonaPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const { data: persona } = await supabase.from('personas').select('*').eq('id', params.id).single();
  if (!persona) notFound();

  const boundUpdate = updatePersona.bind(null, params.id);
  const boundDelete = deletePersona.bind(null, params.id);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">แก้ไข Persona: {persona.name}</h1>
        <form action={boundDelete}>
          <button type="submit" className="btn-secondary text-red-600 border-red-300">ลบ Persona</button>
        </form>
      </div>
      <PersonaForm persona={persona} action={boundUpdate} error={searchParams.error} submitLabel="บันทึกการแก้ไข" />
    </div>
  );
}
