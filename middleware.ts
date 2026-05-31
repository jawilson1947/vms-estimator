import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = (req.nextauth.token as any)?.role as string | undefined;

    // Protect all /api/admin/* routes — only ADMIN role allowed
    if (pathname.startsWith('/api/admin/')) {
      if (role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Only run middleware for authenticated requests (token must exist)
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ['/api/admin/:path*'],
};
