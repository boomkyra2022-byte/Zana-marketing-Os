import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { signSourceUpload } from '@/lib/supabase/storage';

// Tiny JSON in/out — the browser already uploaded the raw file straight to
// Supabase Storage (see components/editor-client.tsx), this just hands back
// a short-lived signed URL for the object it uploaded so the run route can
// download it like any other source_url. Never touches the file bytes.
const bodySchema = z.object({ path: z.string().min(1) });

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const signedUrl = await signSourceUpload(user.id, parsed.data.path);
    return Response.json({ signed_url: signedUrl });
  } catch (err: any) {
    return Response.json({ error: err?.message || 'สร้างลิงก์ไม่สำเร็จ' }, { status: 400 });
  }
}
