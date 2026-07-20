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

  const { data: { user } } = await supabase.auth.getUser();
  const isLoginPage = request.nextUrl.pathname === '/admin/login';

  // A `profiles` row exists for every auth.users signup, including mobile
  // app customers, and its legacy `role` text column defaults to
  // 'moderator' for all of them — checking that text value (as this used
  // to) meant every signed-up customer passed as staff. `role_id` is the
  // one field nothing defaults to; it has to be explicitly granted. Admin
  // pages are client components that query Supabase directly on mount, so
  // this check has to happen here (the one place with the request path)
  // rather than relying on individual pages to self-guard.
  let isStaff = false;
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role_id').eq('id', user.id).single();
    isStaff = !!profile?.role_id;
  }

  if (!isStaff && !isLoginPage) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }
  if (isStaff && isLoginPage) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
