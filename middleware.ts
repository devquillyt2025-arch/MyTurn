import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  try {
    // Fail-open: if env vars aren't set (e.g. not yet configured in Vercel),
    // let the request through rather than 500-ing every page.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.next();
    }

    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    // Refreshes the session if expired — must come before any redirects
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // Protect /dashboard — redirect unauthenticated visitors to login
    if (pathname.startsWith('/dashboard') && !user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/auth/login';
      return NextResponse.redirect(loginUrl);
    }

    // Redirect logged-in users away from auth pages to the dashboard
    if ((pathname === '/auth/login' || pathname === '/auth/register') && user) {
      const dashUrl = request.nextUrl.clone();
      dashUrl.pathname = '/dashboard';
      return NextResponse.redirect(dashUrl);
    }

    return supabaseResponse;
  } catch (err) {
    // Log the real error to Vercel Functions logs, then fail-open so the
    // app stays accessible even if session refresh fails.
    console.error('[middleware]', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and images so the session cookie
     * is refreshed on every navigation.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
