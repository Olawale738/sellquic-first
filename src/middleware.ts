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

  if (isMainSite) {
    return NextResponse.next();
  }
  
  // 4. Handle all chat subdomains (e.g., chat.mystore.com or chat.mystore.sellquic.com)
  if (cleanHostname.startsWith('chat.')) {
    const mainDomainForStore = cleanHostname.replace('chat.', '');
    // Only serve the chat page at the root. Redirect any other path to the main store domain.
    if (pathname !== '/' && pathname !== '') {
        return NextResponse.redirect(new URL(`https://${mainDomainForStore}${pathname}`, request.url));
    }
    // Rewrite to the dedicated chat page for the store
    return NextResponse.rewrite(new URL(`/store/${mainDomainForStore}/chat`, request.url));
  }
  
  // 5. Handle standard store subdomains and custom domains
  if(cleanHostname.endsWith(`.${mainDomain}`)) {
    const subdomain = cleanHostname.replace(`.${mainDomain}`, '');
    return NextResponse.rewrite(new URL(`/store/${subdomain}${pathname}`, request.url));
  }

  // 6. Fallback for custom domains not caught above
  return NextResponse.rewrite(new URL(`/store/${cleanHostname}${pathname}`, request.url));
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|images|favicon.ico|manifest.json).*)'],
};