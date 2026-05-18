'use client';

import { useEffect, useState, useTransition } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  Circle,
  Copy,
  ExternalLink,
  Megaphone,
  Search,
  Package,
  BarChart3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  MessageSquare,
  HelpCircle,
  AlertTriangle,
  Info,
  Sparkles,
  Users,
  Truck,
  CreditCard,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { regenerateStoreConfigAction } from '@/lib/actions';
import type { AutoStoreConfig } from '@/types/auto-store-config';

// ─── Shared UI primitives ────────────────────────────────────────────────────

function CopyBlock({ label, value }: { label: string; value: string }) {
  const { toast } = useToast();
  if (!value) return null;
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

function BulletList({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LaunchKitPage({ params }: { params: { storeId: string } }) {
  const { activeStore } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [config, setConfig] = useState<AutoStoreConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const storeId = params.storeId || activeStore?.id;

  function handleRegenerate() {
    if (!storeId) return;
    startTransition(async () => {
      const result = await regenerateStoreConfigAction(storeId);
      if (result.success) {
        toast({ title: 'Store config regenerated!', description: 'Refreshing Launch Kit…' });
        setLoading(true);
        getDoc(doc(firestore!, 'stores', storeId)).then((snap) => {
          if (snap.exists()) setConfig(snap.data()?.autoStoreConfig ?? null);
        }).finally(() => setLoading(false));
      } else {
        toast({ title: 'Regeneration failed', description: result.message, variant: 'destructive' });
      }
    });
  }

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

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
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

  // ── Derived values ─────────────────────────────────────────────────────────
  const marketing      = config.marketing      || ({} as AutoStoreConfig['marketing']);
  const seo            = config.seo            || ({} as AutoStoreConfig['seo']);
  const checklist      = config.vendor_dashboard?.onboarding_checklist     || [];
  const nextActions    = config.vendor_dashboard?.recommended_next_actions  || [];
  const readiness      = config.publish_readiness || ({} as AutoStoreConfig['publish_readiness']);
  const score          = config.vendor_dashboard?.store_completion_score    || 0;
  const identity       = config.business_identity || ({} as AutoStoreConfig['business_identity']);
  const writeups       = config.vendor_writeups   || ({} as AutoStoreConfig['vendor_writeups']);
  const comms          = config.customer_communication || ({} as AutoStoreConfig['customer_communication']);
  const support        = config.support           || ({} as AutoStoreConfig['support']);
  const policy         = config.policy_safety     || ({} as AutoStoreConfig['policy_safety']);
  const adminReview    = config.admin_review_summary || ({} as AutoStoreConfig['admin_review_summary']);
  const finalResponse  = config.final_response    || ({} as AutoStoreConfig['final_response']);

  const readinessColor =
    readiness.status === 'ready_to_publish'   ? 'bg-green-500'  :
    readiness.status === 'needs_vendor_input' ? 'bg-amber-500'  :
    readiness.status === 'blocked_for_review' ? 'bg-red-500'    : 'bg-slate-500';

  const policyBadgeClass =
    policy.status === 'passed'       ? 'bg-green-500 text-white' :
    policy.status === 'warning'      ? 'bg-amber-500 text-white' :
    policy.status === 'blocked'      ? 'bg-red-500   text-white' :
    policy.status === 'needs_review' ? 'bg-blue-500  text-white' : 'bg-slate-500 text-white';

  return (
    <div className="space-y-8 max-w-4xl">

      {/* ── 1. Header row ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Launch Kit</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI-generated store content, marketing copy, SEO metadata, and readiness report.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={isPending}
          className="shrink-0"
        >
          {isPending
            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            : <RefreshCw className="h-4 w-4 mr-2" />}
          Regenerate
        </Button>
      </div>

      {/* ── 2. Final Response banner ────────────────────────────────────────── */}
      {finalResponse.summary && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4 space-y-2">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold text-sm">
            <Info className="h-4 w-4 flex-shrink-0" />
            AI Summary
          </div>
          <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">{finalResponse.summary}</p>
          {finalResponse.next_best_action && (
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300 pt-1">
              Next step: {finalResponse.next_best_action}
            </p>
          )}
          {finalResponse.actions_completed?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {finalResponse.actions_completed.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── 3. Store Readiness ───────────────────────────────────────────────── */}
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

      {/* ── 4. Policy Safety ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Policy Safety
            </CardTitle>
            <Badge className={policyBadgeClass}>
              {(policy.status || 'unknown').replace(/_/g, ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {policy.flags?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Flags</p>
              {policy.flags.map((flag, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {flag}
                </div>
              ))}
            </div>
          )}
          {policy.safe_edit_suggestions?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Safe Edit Suggestions</p>
              {policy.safe_edit_suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {s}
                </div>
              ))}
            </div>
          )}
          {!policy.flags?.length && !policy.safe_edit_suggestions?.length && (
            <p className="text-sm text-muted-foreground">No issues detected. Your store content looks good.</p>
          )}
        </CardContent>
      </Card>

      {/* ── 5. Setup Checklist ───────────────────────────────────────────────── */}
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

      {/* ── 6. Brand Identity ────────────────────────────────────────────────── */}
      {(identity.store_tagline || identity.short_description) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Brand Identity
            </CardTitle>
            {identity.brand_voice && (
              <CardDescription>Brand voice: <em>{identity.brand_voice}</em></CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {identity.store_tagline      && <CopyBlock label="Tagline"              value={identity.store_tagline} />}
            {identity.short_description  && <CopyBlock label="Short Description"    value={identity.short_description} />}
            {identity.trust_message      && <CopyBlock label="Trust Message"        value={identity.trust_message} />}
            {identity.customer_promise   && <CopyBlock label="Customer Promise"     value={identity.customer_promise} />}
            {identity.about_section      && <CopyBlock label="About Section"        value={identity.about_section} />}
            {identity.recommended_logo_style  && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended Logo Style</span>
                <Badge variant="secondary">{identity.recommended_logo_style}</Badge>
              </div>
            )}
            {identity.recommended_color_mood && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended Color Mood</span>
                <Badge variant="secondary">{identity.recommended_color_mood}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 7. Vendor Write-ups ──────────────────────────────────────────────── */}
      {(writeups.homepage_intro || writeups.about_us) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Vendor Write-ups
            </CardTitle>
            <CardDescription>
              AI-generated store copy. Review and personalise before publishing.
              {writeups.placeholder_note && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400">{writeups.placeholder_note}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {writeups.homepage_intro          && <CopyBlock label="Homepage Intro"            value={writeups.homepage_intro} />}
              {writeups.about_us                && <CopyBlock label="About Us"                  value={writeups.about_us} />}
              {writeups.our_story               && <CopyBlock label="Our Story"                 value={writeups.our_story} />}
              {writeups.brand_mission           && <CopyBlock label="Brand Mission"             value={writeups.brand_mission} />}
              {writeups.our_promise             && <CopyBlock label="Our Promise"               value={writeups.our_promise} />}
              {writeups.customer_welcome_message && <CopyBlock label="Customer Welcome Message" value={writeups.customer_welcome_message} />}
              {writeups.trust_message           && <CopyBlock label="Trust Message"             value={writeups.trust_message} />}
              {writeups.quality_message         && <CopyBlock label="Quality Message"           value={writeups.quality_message} />}
              {writeups.delivery_message        && <CopyBlock label="Delivery Message"          value={writeups.delivery_message} />}
              {writeups.payment_assurance_message && <CopyBlock label="Payment Assurance"       value={writeups.payment_assurance_message} />}
              {writeups.customer_support_message  && <CopyBlock label="Customer Support Message" value={writeups.customer_support_message} />}
              {writeups.thank_you_message       && <CopyBlock label="Thank You Message"         value={writeups.thank_you_message} />}
              {writeups.short_store_bio         && <CopyBlock label="Short Store Bio"           value={writeups.short_store_bio} />}
              {writeups.footer_description      && <CopyBlock label="Footer Description"        value={writeups.footer_description} />}
            </div>

            {/* Full-width bullet list sections */}
            <div className="mt-5 space-y-5">
              {writeups.brand_values?.length > 0 && (
                <BulletList label="Brand Values" items={writeups.brand_values} />
              )}
              {writeups.why_shop_with_us?.length > 0 && (
                <BulletList label="Why Shop With Us" items={writeups.why_shop_with_us} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 8. Customer Communication ────────────────────────────────────────── */}
      {(comms.order_confirmation || comms.payment_instruction || comms.whatsapp_templates?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Customer Communication
            </CardTitle>
            <CardDescription>Pre-written messages for every customer touchpoint.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {comms.order_confirmation    && <CopyBlock label="Order Confirmation"     value={comms.order_confirmation} />}
            {comms.payment_instruction   && <CopyBlock label="Payment Instruction"    value={comms.payment_instruction} />}
            {comms.delivery_update       && <CopyBlock label="Delivery Update"        value={comms.delivery_update} />}
            {comms.product_inquiry_reply && <CopyBlock label="Product Inquiry Reply"  value={comms.product_inquiry_reply} />}
            {comms.support_reply         && <CopyBlock label="Support Reply"          value={comms.support_reply} />}
            {comms.whatsapp_templates?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">WhatsApp Templates</p>
                <div className="space-y-3">
                  {comms.whatsapp_templates.map((tpl, i) => (
                    <CopyBlock key={i} label={`Template ${i + 1}`} value={tpl} />
                  ))}
                </div>
              </div>
            )}
            {comms.email_templates?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Templates</p>
                <div className="space-y-3">
                  {comms.email_templates.map((tpl, i) => (
                    <CopyBlock key={i} label={`Email ${i + 1}`} value={tpl} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 9. Marketing Launch Kit ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Marketing Launch Kit
          </CardTitle>
          <CardDescription>Ready-to-use copy for your launch. Click the copy icon to grab any section.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {marketing.launch_announcement    && <CopyBlock label="Launch Announcement"    value={marketing.launch_announcement} />}
          {marketing.whatsapp_broadcast     && <CopyBlock label="WhatsApp Broadcast"     value={marketing.whatsapp_broadcast} />}
          {marketing.instagram_caption      && <CopyBlock label="Instagram Caption"      value={marketing.instagram_caption} />}
          {marketing.facebook_caption       && <CopyBlock label="Facebook Caption"       value={marketing.facebook_caption} />}
          {marketing.promo_banner_text      && <CopyBlock label="Promo Banner Text"      value={marketing.promo_banner_text} />}
          {marketing.customer_review_request && <CopyBlock label="Review Request Message" value={marketing.customer_review_request} />}
          {marketing.featured_product_message && <CopyBlock label="Featured Product Message" value={marketing.featured_product_message} />}
          {marketing.first_week_sales_ideas?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">First Week Sales Ideas</p>
              <ul className="space-y-1.5">
                {marketing.first_week_sales_ideas.map((tip: string, i: number) => (
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

      {/* ── 10. SEO Metadata ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            SEO Metadata
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {seo.homepage_title            && <CopyBlock label="Page Title"              value={seo.homepage_title} />}
          {seo.homepage_meta_description && <CopyBlock label="Meta Description"        value={seo.homepage_meta_description} />}
          {seo.social_share_title        && <CopyBlock label="Social Share Title"      value={seo.social_share_title} />}
          {seo.social_share_description  && <CopyBlock label="Social Share Description" value={seo.social_share_description} />}
          {seo.local_seo_text            && <CopyBlock label="Local SEO Text"          value={seo.local_seo_text} />}
          {(seo.category_keywords?.length > 0 || seo.product_keywords?.length > 0) && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Keywords</p>
              <div className="flex flex-wrap gap-2">
                {[...(seo.category_keywords || []), ...(seo.product_keywords || [])].slice(0, 30).map((kw: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 11. FAQ ──────────────────────────────────────────────────────────── */}
      {support.faq?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              FAQ
            </CardTitle>
            <CardDescription>Frequently asked questions — ready for your store.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {support.faq.map((item, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-1.5">
                <p className="font-medium text-sm">Q: {item.question}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">A: {item.answer}</p>
              </div>
            ))}
            {support.support_policy && (
              <div className="pt-2">
                <CopyBlock label="Support Policy" value={support.support_policy} />
              </div>
            )}
            {support.escalation_note && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {support.escalation_note}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 12. Admin Review (only when review_required) ─────────────────────── */}
      {adminReview.review_required && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Admin Review Required
            </CardTitle>
            {adminReview.reason && (
              <CardDescription>{adminReview.reason}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {adminReview.risk_flags?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Risk Flags</p>
                {adminReview.risk_flags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {flag}
                  </div>
                ))}
              </div>
            )}
            {adminReview.recommended_admin_action && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
                <strong>Recommended action:</strong> {adminReview.recommended_admin_action}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 13. View Store / Copy Link ────────────────────────────────────────── */}
      {storeUrl && (
        <div className="flex gap-3 pt-2">
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
