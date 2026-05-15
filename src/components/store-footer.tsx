
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
    
    // Unify access to social links
    // Unify access to social links (Safe parser for new Instagram object)
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

    const hasInfoPages = store.isAboutUsActive || store.isReturnPolicyActive || deliveryPolicyText;
    
    return (
        <footer className="bg-background border-t">
            <div className="container mx-auto px-4 md:px-6 py-8">
                 <div className="grid md:grid-cols-4 gap-8">
                     <div className="flex flex-col items-center md:items-start text-center md:text-left">
                        {store.logoUrl && (
                            <Image src={store.logoUrl} alt={`${store.name} logo`} width={40} height={40} className="rounded-full mb-2"/>
                        )}
                        <p className="font-bold text-lg">{store.name}</p>
                        <p className="text-sm text-muted-foreground">{store.tagline}</p>
                    </div>
                    

                    {hasInfoPages && (
                        <div className="flex flex-col items-center md:items-start text-center md:text-left">
                            <h3 className="font-semibold mb-2">Information</h3>
                            <div className="flex flex-col gap-1">
                                {store.isAboutUsActive && <Link href={`${basePath}/about`} className="text-sm text-muted-foreground hover:text-primary">About Us</Link>}
                                {deliveryPolicyText && <Link href={`${basePath}/shipping-policy`} className="text-sm text-muted-foreground hover:text-primary">Shipping Policy</Link>}
                                {store.isReturnPolicyActive && <Link href={`${basePath}/return-policy`} className="text-sm text-muted-foreground hover:text-primary">Return Policy</Link>}
                            </div>
                        </div>
                    )}

                    {hasSocials && (
                        <div className="flex flex-col items-center md:items-start text-center md:text-left">
                            <h3 className="font-semibold mb-2">Follow Us</h3>
                            <div className="flex items-center gap-4">
                                {instagram && <Link href={`https://instagram.com/${instagram}`} target="_blank" aria-label="Instagram"><Instagram className="h-5 w-5 text-muted-foreground hover:text-primary"/></Link>}
                                {facebook && <Link href={facebook} target="_blank" aria-label="Facebook"><Facebook className="h-5 w-5 text-muted-foreground hover:text-primary"/></Link>}
                                {tiktok && <Link href={`https://tiktok.com/@${tiktok}`} target="_blank" aria-label="TikTok"><TikTokIcon className="h-5 w-5 text-muted-foreground hover:text-primary"/></Link>}
                            </div>
                        </div>
                    )}
                </div>
                <div className="mt-8 pt-8 border-t flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground">
                    <p>&copy; {currentYear} {store.name}. All Rights Reserved.</p>
                     <p className="mt-2 md:mt-0">Powered by <Link href="https://sellquic.com/signup" className="font-semibold text-primary hover:underline">SellQuic</Link></p>
                </div>
            </div>
        </footer>
    );
}
