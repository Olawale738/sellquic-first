'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getAuth } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, CheckCircle2, Copy } from 'lucide-react';
import type { StorefrontConfig, VendorSignupData } from '@/types/storefront-config';

export default function StorefrontBuilderPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<StorefrontConfig | null>(null);

  const [form, setForm] = useState<VendorSignupData>({
    vendor_name: '',
    business_category: '',
    subcategory: '',
    products: '',
    location: '',
    email: '',
    phone: '',
    business_description: '',
    target_customers: '',
    price_range: '',
    preferences: '',
  });

  const handleChange = (field: keyof VendorSignupData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!form.vendor_name || !form.business_category) {
      toast({ title: 'Missing fields', description: 'Store name and business category are required.', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    setGeneratedConfig(null);

    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/ai/generate-storefront', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeId,
          vendorData: form,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      const { config } = await res.json();
      setGeneratedConfig(config);
      toast({ title: 'Storefront Generated!', description: 'Your storefront configuration has been created and saved.' });
    } catch (err: any) {
      toast({ title: 'Generation Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          AI Storefront Builder
        </h1>
        <p className="text-muted-foreground mt-1">
          Fill in your business details and let AI generate a complete, beautiful storefront for you instantly.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Business Information</CardTitle>
          <CardDescription>The more detail you provide, the better your storefront will be.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Store / Vendor Name *" value={form.vendor_name} onChange={(v) => handleChange('vendor_name', v)} placeholder="e.g. Adwoa's Boutique" />
            <Field label="Business Category *" value={form.business_category} onChange={(v) => handleChange('business_category', v)} placeholder="e.g. Fashion, Food, Beauty, Electronics" />
            <Field label="Subcategory / Niche" value={form.subcategory || ''} onChange={(v) => handleChange('subcategory', v)} placeholder="e.g. Women's Fashion, Afro Food, Skincare" />
            <Field label="Price Range" value={form.price_range || ''} onChange={(v) => handleChange('price_range', v)} placeholder="e.g. GHS 50 – 500" />
            <Field label="Location" value={form.location || ''} onChange={(v) => handleChange('location', v)} placeholder="e.g. Accra, Ghana" />
            <Field label="Contact Email" value={form.email || ''} onChange={(v) => handleChange('email', v)} placeholder="hello@yourbusiness.com" />
            <Field label="Phone / WhatsApp" value={form.phone || ''} onChange={(v) => handleChange('phone', v)} placeholder="+233 24 000 0000" />
            <Field label="Target Customers" value={form.target_customers || ''} onChange={(v) => handleChange('target_customers', v)} placeholder="e.g. Young women aged 18–35" />

            <div className="sm:col-span-2">
              <Label className="text-sm font-medium mb-1.5 block">Products or Services</Label>
              <Textarea
                rows={3}
                value={form.products || ''}
                onChange={(e) => handleChange('products', e.target.value)}
                placeholder="List your main products or services, e.g. Dresses, Tops, Skirts, Accessories"
                className="resize-none"
              />
            </div>

            <div className="sm:col-span-2">
              <Label className="text-sm font-medium mb-1.5 block">Brand Description</Label>
              <Textarea
                rows={4}
                value={form.business_description || ''}
                onChange={(e) => handleChange('business_description', e.target.value)}
                placeholder="Describe your brand, its story, and what makes it unique…"
                className="resize-none"
              />
            </div>

            <div className="sm:col-span-2">
              <Label className="text-sm font-medium mb-1.5 block">Design Preferences (optional)</Label>
              <Input
                value={form.preferences || ''}
                onChange={(e) => handleChange('preferences', e.target.value)}
                placeholder="e.g. Minimalist, bold colors, feminine, dark theme…"
              />
            </div>
          </div>

          <div className="mt-8">
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full sm:w-auto gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Storefront…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate My Storefront
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {generatedConfig && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              Storefront Generated
            </CardTitle>
            <CardDescription>
              Your storefront config has been saved. Here's a preview of what was created.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ConfigRow label="Theme" value={`${generatedConfig.theme_name} (${generatedConfig.theme_category})`} />
            <ConfigRow label="Headline" value={generatedConfig.hero.headline} />
            <ConfigRow label="Subheadline" value={generatedConfig.hero.subheadline} />
            <ConfigRow label="CTA" value={generatedConfig.hero.primary_cta} />
            <ConfigRow label="Categories" value={generatedConfig.categories.map((c) => c.name).join(', ')} />
            <ConfigRow label="SEO Title" value={generatedConfig.seo.page_title} />
            <ConfigRow label="Meta Description" value={generatedConfig.seo.meta_description} />

            <div className="pt-4 border-t flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(generatedConfig, null, 2));
                  toast({ title: 'Copied!', description: 'Storefront JSON copied to clipboard.' });
                }}
              >
                <Copy className="h-4 w-4" />
                Copy JSON
              </Button>
              <Button onClick={() => router.push(`/dashboard`)}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-sm font-medium mb-1.5 block">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="font-medium text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
