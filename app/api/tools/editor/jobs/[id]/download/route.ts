import { createClient } from '@/lib/supabase/server';
import { resignEditedClip } from '@/lib/supabase/storage';

// The signed URL handed back at job completion expires after 24h. This
// route re-signs it on demand so old results in the job history stay
// downloadable without re-running the (billed) Tamsub operation.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: job, error } = await supabase
    .from('editor_jobs')
    .select('id, result_path, result_kind, srt_text')
    .eq('id', params.id)
    .single();

  if (error || !job) return Response.json({ error: 'ไม่พบงานนี้' }, { status: 404 });

  if (job.result_kind === 'SRT') {
    return Response.json({ kind: 'SRT', srt_text: job.srt_text });
  }
  if (!job.result_path) return Response.json({ error: 'งานนี้ยังไม่มีผลลัพธ์' }, { status: 400 });

  try {
    const signedUrl = await resignEditedClip(job.result_path);
    return Response.json({ kind: 'VIDEO', signed_url: signedUrl });
  } catch (err: any) {
    return Response.json({ error: err?.message || 'สร้างลิงก์ดาวน์โหลดไม่สำเร็จ' }, { status: 500 });
  }
}
