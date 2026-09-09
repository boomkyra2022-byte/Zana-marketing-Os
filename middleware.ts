import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/auth/callback'];
// Reachable while logged in even if not yet approved — everything else
// requires profiles.status === 'approved' (see migration
// 0022_signup_approval_gate.sql + the explicit user request for an
// owner-approval gate on top of the signup access code).
const PENDING_APPROVAL_PATH = '/pending-approval';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Owner-approval gate — explicit user request: "ต้องการตั้งรหัสเจ้าของ...
  // หรืออนุมัติให้เข้าใช้งานได้" (chose both). A logged-in user whose
  // profiles.status isn't 'approved' yet (fresh self-signup, or an admin
  // rejected them) can reach ONLY /pending-approval — every other route,
  // including /dashboard and every API route, is blocked here before any
  // page/route code runs. Runs after the /login redirect check above so an
  // unapproved user landing on /login after signup still sees the "check
  // your email" message rather than being bounced again.
  if (user && !isPublic && request.nextUrl.pathname !== PENDING_APPROVAL_PATH) {
    const { data: profile } = await supabase.from('profiles').select('status').eq('id', user.id).single();
    if (profile && profile.status !== 'approved') {
      return NextResponse.redirect(new URL(PENDING_APPROVAL_PATH, request.url));
    }
  }

  // Already-approved user landing back on /pending-approval (e.g. an old
  // bookmark/tab from before an admin approved them) — send them onward
  // instead of showing a stale "waiting" screen.
  if (user && request.nextUrl.pathname === PENDING_APPROVAL_PATH) {
    const { data: profile } = await supabase.from('profiles').select('status').eq('id', user.id).single();
    if (profile?.status === 'approved') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/public).*)']
};
