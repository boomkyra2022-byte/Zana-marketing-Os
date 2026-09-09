import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';

// Landing page for a logged-in user whose profiles.status isn't 'approved'
// yet — middleware.ts redirects everyone in this state here and blocks
// every other route. Explicit user request: owner-approval gate on top of
// the signup access code, so a self-signed-up account can't touch any real
// data until an admin/owner approves it from /settings/team.
export default async function PendingApprovalPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('status, full_name').eq('id', user.id).single();

  // Approved users shouldn't normally land here (middleware bounces them
  // onward), but handle it gracefully rather than showing a stale message
  // if this ever renders before the redirect takes effect.
  if (profile?.status === 'approved') redirect('/dashboard');

  const isRejected = profile?.status === 'rejected';

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-navy">
      <div className="card w-full max-w-md p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold">ZANA Marketing OS V2</h1>

        {isRejected ? (
          <>
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              บัญชีนี้ยังไม่ได้รับอนุมัติให้เข้าใช้งาน
            </div>
            <p className="text-sm text-gray-500">
              ติดต่อเจ้าของระบบถ้าคิดว่านี่เป็นความผิดพลาด
            </p>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              บัญชี{profile?.full_name ? ` ของ ${profile.full_name}` : ''} สมัครสำเร็จแล้ว — รอเจ้าของระบบอนุมัติสิทธิ์เข้าใช้งาน
            </div>
            <p className="text-sm text-gray-500">
              เจ้าของระบบจะเห็นคำขอนี้ที่หน้า &ldquo;จัดการทีม&rdquo; — เมื่ออนุมัติแล้ว ลองเข้าสู่ระบบใหม่อีกครั้งได้เลย
            </p>
          </>
        )}

        <form action={signOut}>
          <button type="submit" className="btn-secondary w-full">
            ออกจากระบบ
          </button>
        </form>
      </div>
    </main>
  );
}
