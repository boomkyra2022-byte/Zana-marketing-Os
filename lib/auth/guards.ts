// Real bug found via live user testing: app/api/models/route.ts (POST),
// app/api/models/[id]/route.ts (PATCH), and app/api/models/[id]/duplicate/
// route.ts all ran their insert/update `.select('*').single()` without
// checking the caller's role first. The `model_presets_write`/
// `model_presets_update` RLS policies (`current_role() <> 'viewer'`, see
// 0001_init.sql) correctly block a 'viewer' role from writing — but RLS
// blocking a write just makes the UPDATE/INSERT...RETURNING affect 0 rows,
// and PostgREST's `.single()` then throws a raw, meaningless-to-the-user
// error: "Cannot coerce the result to a single JSON object". This helper
// checks the role explicitly BEFORE attempting the write, so the route can
// return a clear Thai message instead of leaking that Postgres/PostgREST
// internal error straight to the UI.
export async function requireNonViewer(
  supabase: any,
  userId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
  if (!profile) {
    return { ok: false, message: 'ไม่พบข้อมูลผู้ใช้ — ลอง login ใหม่อีกครั้ง' };
  }
  if (profile.role === 'viewer') {
    return {
      ok: false,
      message: `บัญชีนี้มีสิทธิ์ระดับ Viewer (ดูอย่างเดียว) — แก้ไขข้อมูลไม่ได้ ให้แอดมิน/เจ้าของระบบเปลี่ยนสิทธิ์ให้ที่หน้า "จัดการทีม" (/settings/team) ก่อน`
    };
  }
  return { ok: true };
}
