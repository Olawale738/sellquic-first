export function getStoreBasePath(subdomain: string) {
  if (!subdomain) return '';

  // Client-side check
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;

    // Mimic the logic from middleware.ts to determine if we are on a "main" site
    // where paths are prefixed with /store/[storeId]
    const isMainSite =
      host === 'sellquic.com' ||
      host === 'www.sellquic.com' ||
      host.includes('localhost') ||
      host.endsWith('.vercel.app') ||
      host.endsWith('.cloudworkstations.dev');

    // If we are NOT on a main site, it means we're on a custom domain or subdomain.
    // In that case, the path should be at the root (e.g., /products/...).
    if (!isMainSite) {
      return '';
    }
  }

  // On the server, or on a "main" site, we must prefix paths with /store/[storeId].
  return `/store/${subdomain}`;
}
