import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  // 1. Ignore Static
  if (pathname.startsWith('/_next') || pathname.startsWith('/static') || /^\/.*?\.(ico|png|svg|jpg|jpeg|xml|webmanifest)$/.test(pathname)) {
    return NextResponse.next();
  }

  const cleanHostname = hostname.replace(/:\d+$/, '').toLowerCase();

  if (
    cleanHostname.startsWith('www.') &&
    cleanHostname !== 'www.sellquic.com'
  ) {
    const bareDomain = cleanHostname.replace(/^www\./, '');
    return NextResponse.redirect(
      new URL(`https://${bareDomain}${pathname}`, request.url),
      308
    );
  }
// 🔥 Normalize www
const normalizedHostname = cleanHostname.startsWith('www.')
  ? cleanHostname.replace(/^www\./, '')
  : cleanHostname;
  const mainDomain = 'sellquic.com';
  
  // 2. Affiliate Subdomain
  if (cleanHostname === 'affiliate.sellquic.com') {
      // Allow affiliate policy to pass through without rewrite
      if (pathname === '/affiliate-policy') {
        return NextResponse.next();
      }
      // Path is already correct, do nothing.
      if (pathname.startsWith('/affiliates')) {
        return NextResponse.next();
      }
      // Path is the old incorrect `/affiliate`, rewrite it.
      if (pathname.startsWith('/affiliate')) {
          const newPath = pathname.replace('/affiliate', '/affiliates');
          return NextResponse.rewrite(new URL(newPath, request.url));
      }
      // For any other path like `/` or `/login`, prepend `/affiliates`
      return NextResponse.rewrite(new URL(`/affiliates${pathname}`, request.url));
  }

  // 2.5. Affiliate Routes on Preview/Main Site
  if (pathname.startsWith('/affiliate')) {
    const newPath = pathname.replace('/affiliate', '/affiliates');
    return NextResponse.rewrite(new URL(newPath, request.url));
  }

  // 3. Main Site
  const isMainSite = 
    normalizedHostname === mainDomain || 
    cleanHostname === `www.${mainDomain}` || 
    cleanHostname === 'localhost' ||
    cleanHostname === '127.0.0.1' ||
    cleanHostname.endsWith('.vercel.app') ||
    cleanHostname.endsWith('.cloudworkstations.dev');

  // Handle /chat on main site
  if (isMainSite && pathname.startsWith('/chat')) {
    return NextResponse.rewrite(new URL(`/first.com${pathname}`, request.url));
  }

  if (isMainSite) {
    return NextResponse.next();
  }
  
  // 4. Handle standard store subdomains and custom domains
  const storeIdentifier = normalizedHostname.endsWith(`.${mainDomain}`) 
  ? normalizedHostname.replace(`.${mainDomain}`, '')
  : normalizedHostname;
  
  // 5. Rewrite to the correct store path
  return NextResponse.rewrite(new URL(`/store/${storeIdentifier}${pathname}`, request.url));
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|images|favicon.ico|manifest.json).*)'],
};