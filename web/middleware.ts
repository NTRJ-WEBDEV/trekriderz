import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options as any);
          });
        },
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const isLoginPage = request.nextUrl.pathname === '/admin/login';

  // TEMP DIAGNOSTIC — remove once the production login-redirect issue is
  // confirmed fixed. Logs shape/existence only, never tokens or cookies.
  console.log('[admin-auth-debug] middleware', {
    path: request.nextUrl.pathname,
    hasUser: !!user,
    userId: user?.id ?? null,
    userError: userError?.message ?? null,
  });

  // A `profiles` row exists for every auth.users signup, including mobile
  // app customers, and its legacy `role` text column defaults to
  // 'moderator' for all of them — checking that text value (as this used
  // to) meant every signed-up customer passed as staff. `role_id` is the
  // one field nothing defaults to; it has to be explicitly granted. Admin
  // pages are client components that query Supabase directly on mount, so
  // this check has to happen here (the one place with the request path)
  // rather than relying on individual pages to self-guard.
  let isStaff = false;
  let profileError: string | null = null;
  if (user) {
    const { data: profile, error } = await supabase.from('profiles').select('role_id').eq('id', user.id).single();
    isStaff = !!profile?.role_id;
    profileError = error?.message ?? null;
    console.log('[admin-auth-debug] profile lookup', {
      hasProfile: !!profile,
      roleId: profile?.role_id ?? null,
      profileError,
    });
  }

  // Redirects build a fresh NextResponse, which does NOT inherit any
  // refreshed session cookies `setAll` already wrote onto `response` —
  // a well-documented Supabase SSR gotcha. Copying them over ensures a
  // token refresh that happens to land on a redirect isn't silently
  // dropped, which would otherwise look like an intermittent forced
  // logout on the next request.
  const redirectWithCookies = (url: string) => {
    const redirectResponse = NextResponse.redirect(new URL(url, request.url));
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  };

  if (!isStaff && !isLoginPage) {
    // Authenticated but no staff role vs. not authenticated at all get
    // different messaging on the login page — see login/page.tsx.
    const reason = user ? 'no_access' : null;
    const dest = reason ? `/admin/login?error=${reason}` : '/admin/login';
    console.log('[admin-auth-debug] redirect', { to: dest, hasUser: !!user, isStaff, profileError });
    return redirectWithCookies(dest);
  }
  if (isStaff && isLoginPage) {
    console.log('[admin-auth-debug] redirect', { to: '/admin', hasUser: !!user, isStaff });
    return redirectWithCookies('/admin');
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
