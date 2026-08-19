import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';
import { TopNav } from '@/components/top-nav';

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
    <div className="min-h-screen flex flex-col">
      <header className="bg-navy text-white px-4 py-3 md:px-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 md:gap-6 min-w-0">
          <div className="shrink-0">
            <div className="font-bold leading-tight text-sm md:text-base">ZANA Marketing OS</div>
            <div className="text-xs text-gray-400 leading-tight hidden sm:block">V2 — Creative Generator</div>
          </div>
          <TopNav />
        </div>
        <div className="flex items-center justify-between gap-3 md:justify-end shrink-0">
          <div className="text-right text-sm min-w-0">
            <div className="truncate max-w-[45vw] md:max-w-none">{profile?.full_name || user?.email}</div>
            <div className="text-xs text-gray-400">{profile?.role || 'viewer'}</div>
          </div>
          <form action={signOut}>
            <button type="submit" className="btn-secondary text-sm py-1.5 shrink-0">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6 max-w-[1400px] w-full mx-auto">{children}</main>
    </div>
  );
}
