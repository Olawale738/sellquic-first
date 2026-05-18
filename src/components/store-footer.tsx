
'use client';

import { useStore } from "@/context/store-context";
import Image from "next/image";
import Link from "next/link";
import { Instagram, Facebook } from "lucide-react";
import { getStoreBasePath } from "@/lib/url";

const TikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.04-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

export function StoreFooter() {
  const { store, isDemo } = useStore();
  const currentYear = new Date().getFullYear();

  if (!store) return null;

  const instagram = typeof store.instagram === 'object' && store.instagram !== null
    ? store.instagram.username
    : (store.instagram || store.socials?.instagram);

  const facebook = typeof store.facebook === 'object' && store.facebook !== null
    ? store.facebook.username
    : (store.facebook || store.socials?.facebook);

  const tiktok = typeof store.tiktok === 'object' && store.tiktok !== null
    ? store.tiktok.username
    : (store.tiktok || store.socials?.tiktok);

  const basePath = isDemo ? `/demo/${store.slug}` : getStoreBasePath(store.subdomain);
  const hasSocials = instagram || facebook || tiktok;
  const deliveryPolicyText = store.deliveryNotice || store.themeConfig?.deliveryInfo;

  const navLinks: { label: string; href: string }[] = [
    { label: 'All Products', href: `${basePath}/catalog` },
    ...(store.categories?.slice(0, 4).map((cat: any) => ({
      label: cat.name,
      href: `${basePath}/category/${cat.name.toLowerCase().replace(/\s+/g, '-')}`,
    })) ?? []),
    ...(store.isAboutUsActive ? [{ label: 'About Us', href: `${basePath}/about` }] : []),
    ...(deliveryPolicyText ? [{ label: 'Shipping Policy', href: `${basePath}/shipping-policy` }] : []),
    ...(store.isReturnPolicyActive ? [{ label: 'Return Policy', href: `${basePath}/return-policy` }] : []),
  ];

  return (
    <footer className="bg-black text-white">
      <div className="container mx-auto px-4 md:px-6 py-5">

        {/* Single horizontal row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

          {/* Logo + name */}
          <Link href={basePath || '/'} className="flex items-center gap-2 shrink-0">
            {store.logoUrl && (
              <Image
                src={store.logoUrl}
                alt={`${store.name} logo`}
                width={26}
                height={26}
                className="rounded-full"
              />
            )}
            <span className="font-bold text-sm text-white">{store.name}</span>
          </Link>

          {/* Nav links inline */}
          {navLinks.length > 0 && (
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs text-white/60 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Social icons */}
          {hasSocials && (
            <div className="flex items-center gap-3 shrink-0">
              {instagram && (
                <Link href={`https://instagram.com/${instagram}`} target="_blank" aria-label="Instagram">
                  <Instagram className="h-4 w-4 text-white/60 hover:text-white transition-colors" />
                </Link>
              )}
              {facebook && (
                <Link href={facebook} target="_blank" aria-label="Facebook">
                  <Facebook className="h-4 w-4 text-white/60 hover:text-white transition-colors" />
                </Link>
              )}
              {tiktok && (
                <Link href={`https://tiktok.com/@${tiktok}`} target="_blank" aria-label="TikTok">
                  <TikTokIcon className="h-4 w-4 text-white/60 hover:text-white transition-colors" />
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Copyright line */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-1 text-[11px] text-white/30">
          <p>&copy; {currentYear} {store.name}. All Rights Reserved.</p>
          <p>Powered by <Link href="https://sellquic.com/signup" className="font-semibold text-white/60 hover:text-white transition-colors">SellQuic</Link></p>
        </div>

      </div>
    </footer>
  );
}
