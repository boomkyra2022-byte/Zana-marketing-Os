import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';
import { SideNav } from '@/components/side-nav';

// Sidebar shell — replaces the old top-nav header bar (explicit user
// request, see components/side-nav.tsx for the full history). Auth check
// and profile fetch are unchanged; the signOut server action is now passed
// into SideNav as children (a server-rendered <form> element), which is the
// standard Next.js pattern for keeping a server action inside a client
// component's markup without making the action itself client-side.
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
    <div className="app-shell">
      <SideNav
        brandTitle="ZANA Marketing OS"
        brandSubtitle="V2 — Creative Generator"
        userLabel={profile?.full_name || user?.email || ''}
        roleLabel={profile?.role || 'viewer'}
      >
        <form action={signOut}>
          <button type="submit" className="btn-secondary text-sm py-1.5 w-full">
            ออกจากระบบ
          </button>
        </form>
      </SideNav>
      <main className="app-main p-4 md:p-6 max-w-[1400px] w-full mx-auto">{children}</main>
    </div>
  );
}
