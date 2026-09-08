import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signLibraryPaths } from '@/lib/supabase/storage';
import { ModelForm } from '@/components/model-form';
import type { ModelPreset } from '@/types/database';

export default async function EditModelPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: model } = await supabase.from('model_presets').select('*').eq('id', params.id).single();
  if (!model) notFound();

  const signed = await signLibraryPaths((model as ModelPreset).reference_images ?? []);
  const initialImages = (model as ModelPreset).reference_images.map((path) => ({ path, signedUrl: signed[path] || '' })).filter((img) => img.signedUrl);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">แก้ไข Model: {model.name}</h1>
      <ModelForm model={model as ModelPreset} initialImages={initialImages} />
    </div>
  );
}
