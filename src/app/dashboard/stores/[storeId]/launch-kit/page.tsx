'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, Copy, ExternalLink, Megaphone, Search, Package, BarChart3, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

function CopyBlock({ label, value }: { label: string; value: string }) {
  const { toast } = useToast();
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="relative rounded-lg border bg-muted/40 p-3 pr-10 text-sm leading-relaxed whitespace-pre-wrap">
        {value}
        <button
          onClick={() => { navigator.clipboard.writeText(value); toast({ title: 'Copied!' }); }}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Copy"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ChecklistItem({ done, text }: { done: boolean; text: string }) {
  return (
    <div className="flex items-start gap-3">
      {done
        ? <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
        : <Circle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />}
      <span className={done ? 'line-through text-muted-foreground text-sm' : 'text-sm'}>{text}</span>
    </div>
  );
}

export default function LaunchKitPage({ params }: { params: { storeId: string } }) {
  const { activeStore } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const storeId = params.storeId || activeStore?.id;

  useEffect(() => {
    if (!storeId || !firestore) return;
    getDoc(doc(firestore, 'stores', storeId)).then(snap => {
      if (snap.exists()) setConfig(snap.data()?.autoStoreConfig || null);
    }).finally(() => setLoading(false));
  }, [storeId, firestore]);

  const storeUrl = activeStore?.customDomain
    ? `https://${activeStore.customDomain}`
    : activeStore?.subdomain
    ? `https://${activeStore.subdomain}.sellquic.com`
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-bold">Launch Kit</h1>
        <p className="text-muted-foreground">
          No AI store config found for this store. This is generated automatically at signup.
          If you signed up before this feature was added, you can regenerate it from the Storefront settings.
        </p>
        <Button asChild variant="outline">
          <Link href={`/dashboard/stores/${storeId}/storefront`}>Go to Storefront Settings</Link>
        </Button>
      </div>
    );
  }

  const marketing = config.marketing || {};
  const seo = config.seo || {};
  const checklist = config.vendor_dashboard?.onboarding_checklist || [];
  const nextActions = config.vendor_dashboard?.recommended_next_actions || [];
  const readiness = config.publish_readiness || {};
  const score = config.vendor_dashboard?.store_completion_score || 0;
  const identity = config.business_identity || {};

  const readinessColor =
    readiness.status === 'ready_to_publish' ? 'bg-green-500' :
    readiness.status === 'needs_vendor_input' ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Launch Kit</h1>
        <p className="text-muted-foreground text-sm mt-1">
          AI-generated marketing content, SEO, checklist, and readiness report for your store.
        </p>
      </div>

      {/* Store Readiness */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Store Readiness
            </CardTitle>
            <Badge className={`${readinessColor} text-white capitalize`}>
              {(readiness.status || 'draft').replace(/_/g, ' ')}
            </Badge>
          </div>
          <CardDescription>
            Completion score: <strong>{score}%</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${score}%` }} />
          </div>
          {readiness.required_vendor_inputs?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Still needed from you</p>
              <div className="flex flex-wrap gap-2">
                {readiness.required_vendor_inputs.map((item: string) => (
                  <Badge key={item} variant="outline" className="capitalize text-xs">{item.replace(/_/g, ' ')}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Onboarding Checklist */}
      {checklist.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Setup Checklist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.map((item: string, i: number) => (
              <ChecklistItem key={i} done={false} text={item} />
            ))}
            {nextActions.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">Recommended next actions</p>
                {nextActions.map((action: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary">→</span>
                    <span>{action}</span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Brand Identity */}
      {identity.tagline && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Brand Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {identity.tagline && <CopyBlock label="Tagline" value={identity.tagline} />}
            {identity.short_description && <CopyBlock label="Short Description" value={identity.short_description} />}
            {identity.trust_message && <CopyBlock label="Trust Message" value={identity.trust_message} />}
            {identity.customer_promise && <CopyBlock label="Customer Promise" value={identity.customer_promise} />}
          </CardContent>
        </Card>
      )}

      {/* Marketing Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Marketing Launch Kit
          </CardTitle>
          <CardDescription>Ready-to-use copy for your launch. Click the copy icon to grab any section.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {marketing.launch_announcement && <CopyBlock label="Launch Announcement" value={marketing.launch_announcement} />}
          {marketing.whatsapp_broadcast && <CopyBlock label="WhatsApp Broadcast" value={marketing.whatsapp_broadcast} />}
          {marketing.instagram_caption && <CopyBlock label="Instagram Caption" value={marketing.instagram_caption} />}
          {marketing.facebook_caption && <CopyBlock label="Facebook Caption" value={marketing.facebook_caption} />}
          {marketing.promo_banner_text && <CopyBlock label="Promo Banner Text" value={marketing.promo_banner_text} />}
          {marketing.customer_review_request && <CopyBlock label="Review Request Message" value={marketing.customer_review_request} />}
          {marketing.first_week_growth_suggestions?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">First Week Growth Tips</p>
              <ul className="space-y-1.5">
                {marketing.first_week_growth_suggestions.map((tip: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary font-bold">{i + 1}.</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            SEO Metadata
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {seo.page_title && <CopyBlock label="Page Title" value={seo.page_title} />}
          {seo.meta_description && <CopyBlock label="Meta Description" value={seo.meta_description} />}
          {seo.social_share_title && <CopyBlock label="Social Share Title" value={seo.social_share_title} />}
          {seo.social_share_description && <CopyBlock label="Social Share Description" value={seo.social_share_description} />}
          {seo.category_keywords?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Keywords</p>
              <div className="flex flex-wrap gap-2">
                {[...(seo.category_keywords || []), ...(seo.product_keywords || [])].slice(0, 20).map((kw: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {storeUrl && (
        <div className="flex gap-3">
          <Button asChild>
            <a href={storeUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Your Store
            </a>
          </Button>
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(storeUrl); toast({ title: 'Store link copied!' }); }}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Store Link
          </Button>
        </div>
      )}
    </div>
  );
}
