import { PersonaForm } from '@/components/persona-form';
import { createPersona } from '../actions';

export default function NewPersonaPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">เพิ่ม Persona ใหม่</h1>
      <PersonaForm action={createPersona} error={searchParams.error} submitLabel="บันทึก Persona" />
    </div>
  );
}
