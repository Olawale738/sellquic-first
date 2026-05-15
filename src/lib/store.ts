
'use client';

/**
 * Extracts the store identifier from the URL.
 * In development, it uses the path-based identifier.
 * In production, it will be adapted to use the subdomain.
 *
 * @param storeIdFromPath - The storeId from the URL path, e.g., /store/[storeId]
 * @returns The store identifier.
 */
export function getStoreIdentifier(storeIdFromPath: string): string | null {
  // This function is designed to be environment-aware.
  // For now, it primarily relies on the path.
  // It will be expanded to handle subdomains in production.

  if (typeof window === 'undefined') {
    // Server-side rendering
    return storeIdFromPath;
  }

  // Client-side rendering
  const host = window.location.hostname;
  const pathParts = window.location.pathname.split('/');

  // NOTE: This will be where subdomain logic is added for production
  // For example:
  // if (process.env.NODE_ENV === 'production' && host.split('.').length > 2) {
  //   return host.split('.')[0];
  // }
  
  if (pathParts[1] === 'store' && pathParts[2]) {
    return pathParts[2];
  }
  
  // Fallback to the path-based storeId if available
  if(storeIdFromPath) {
    return storeIdFromPath;
  }

  return null;
}
