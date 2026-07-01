import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Paths a PROJECT_VIEWER may reach as pages (everything else in the dashboard
// is redirected to /projects).
function isViewerAllowedPage(pathname: string): boolean {
  return (
    pathname === '/projects' ||
    pathname.startsWith('/projects/') ||
    pathname === '/about' ||
    pathname === '/privacy-policy'
  );
}

// API endpoints a PROJECT_VIEWER may call. Read/list are GET; document exports
// (pdf/docx) are POST. Everything else — including create/edit/delete — is denied.
// Per-project ownership (which project) is enforced in the route handlers.
function isViewerAllowedApi(method: string, pathname: string): boolean {
  const getOk = [
    /^\/api\/projects\/\d+$/,                       // project detail
    /^\/api\/projects\/\d+\/proposals$/,            // list proposals
    /^\/api\/projects\/\d+\/proposals\/\d+$/,       // one proposal
    /^\/api\/projects\/\d+\/invoices$/,             // list invoices
    /^\/api\/projects\/\d+\/invoices\/\d+$/,        // one invoice
    /^\/api\/projects\/\d+\/location-labels$/,      // labels docx
  ];
  const postOk = [
    /^\/api\/projects\/\d+\/proposals\/\d+\/(pdf|docx)$/,
    /^\/api\/projects\/\d+\/invoices\/\d+\/(pdf|docx)$/,
  ];
  if (method === 'GET') return getOk.some(re => re.test(pathname));
  if (method === 'POST') return postOk.some(re => re.test(pathname));
  return false;
}

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const method = req.method;
    const role = (req.nextauth.token as { role?: string } | null)?.role;

    // Admin API — ADMIN only.
    if (pathname.startsWith('/api/admin/')) {
      if (role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Restricted project viewers: locked to the Projects subsystem.
    if (role === 'PROJECT_VIEWER') {
      if (pathname.startsWith('/api/')) {
        if (!isViewerAllowedApi(method, pathname)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } else if (!isViewerAllowedPage(pathname)) {
        const url = req.nextUrl.clone();
        url.pathname = '/projects';
        url.search = '';
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  // Run on all routes except Next internals, static assets, the login page,
  // and NextAuth's own endpoints.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|api/auth|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf)$).*)',
  ],
};
