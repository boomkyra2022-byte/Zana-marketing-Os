import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// "Duplicate Preset" — explicit spec requirement. Copies every field except
// identity (new row, new id), appends " (Copy)" to the name so it's never
// confused with the original in a picker list.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: source, error: fetchError } = await supabase.from('model_presets').select('*').eq('id', params.id).single();
  if (fetchError || !source) return NextResponse.json({ error: fetchError?.message || 'ไม่พบ Model Preset นี้' }, { status: 404 });

  const { data, error } = await supabase
    .from('model_presets')
    .insert({
      name: `${source.name} (Copy)`,
      type: source.type,
      master_reference: source.master_reference,
      reference_images: source.reference_images,
      locked_features: source.locked_features,
      editable_features: source.editable_features,
      identity_lock: source.identity_lock,
      identity_prompt: source.identity_prompt,
      negative_prompt: source.negative_prompt,
      thumbnail: source.thumbnail,
      active: true,
      created_by: user.id
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'model_preset_duplicate',
    entity_type: 'model_preset',
    entity_id: data.id,
    new_value: { source_id: params.id, name: data.name },
    reason: `ทำสำเนา Model Preset จาก: ${source.name}`
  });

  return NextResponse.json({ model: data });
}
