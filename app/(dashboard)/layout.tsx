import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';
import { SidebarNav } from '@/components/sidebar-nav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let profile: { full_name: string | null; role: string } | null = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single();
    profile = data;
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-white/10 p-4 flex flex-col justify-between">
        <div>
          <div className="mb-6 px-2">
            <h1 className="text-lg font-bold">ZANA Marketing OS</h1>
            <p className="text-xs text-gray-500">Creative Factory & Winner Engine</p>
          </div>
          <SidebarNav />
        </div>
        <div className="px-2">
          <div className="text-sm text-gray-300">{profile?.full_name || user?.email}</div>
          <div className="text-xs text-gray-500 mb-3">{profile?.role || 'viewer'}</div>
          <form action={signOut}>
            <button type="submit" className="btn-secondary w-full text-sm">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
