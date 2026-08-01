import { redirect } from 'next/navigation';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import TeamManagementClient from '@/components/team-management-client';

export default async function TeamPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = !!myProfile && ['admin', 'owner'].includes(myProfile.role);

  if (!isAdmin) {
    return <div className="card p-8 text-center text-gray-500">หน้านี้สำหรับแอดมินเท่านั้น</div>;
  }

  const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });

  let members = (profiles ?? []).map((p) => ({ ...p, email: '—' }));
  let serviceKeyMissing = false;
  try {
    const serviceClient = createServiceRoleClient();
    const { data: usersData } = await serviceClient.auth.admin.listUsers({ perPage: 200 });
    const emailById = new Map((usersData?.users ?? []).map((u: any) => [u.id, u.email as string]));
    members = (profiles ?? []).map((p) => ({ ...p, email: emailById.get(p.id) ?? '—' }));
  } catch {
    serviceKeyMissing = true;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">จัดการทีม</h1>
        <p className="text-gray-500">สร้าง account ให้พนักงาน และกำหนดสิทธิ์การใช้งานแต่ละคน</p>
      </div>

      {serviceKeyMissing && (
        <div className="card p-4 mb-4 border-orange-300 text-orange-700 text-sm">
          ยังไม่ได้ตั้งค่า <code>SUPABASE_SERVICE_ROLE_KEY</code> ใน <code>.env.local</code> — จะเห็นรายชื่อได้แต่ไม่เห็นอีเมล และสร้าง/ลบ account ใหม่จากหน้านี้ยังไม่ได้จนกว่าจะใส่ค่านี้
        </div>
      )}

      <TeamManagementClient members={members} currentUserId={user.id} />
    </div>
  );
}
