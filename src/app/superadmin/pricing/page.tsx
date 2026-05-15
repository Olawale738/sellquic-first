'use client';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { updatePlatformSettings } from '@/app/actions/admin';
import { Loader2, Save } from 'lucide-react';
import { useRequireSuperAdmin } from '@/hooks/use-auth';

export default function AdminPricingPage() {
  useRequireSuperAdmin();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  // Load current settings
  useEffect(() => {
    async function fetchSettings() {
      const res = await fetch('/api/admin/pricing');
      const json = await res.json();
      
      // Merge with default freeTrial state to prevent undefined errors if it's a new database
      if (json.success) {
        setSettings({
          ...json.data,
          trial: {
            active: json.data?.trial?.active || false,
            durationDays: json.data?.trial?.durationDays || 7,
            aiCredits: json.data?.trial?.aiCredits || 500,
          }
        });
      }
      setLoading(false);
    }
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const result = await updatePlatformSettings(settings);
    if (result.success) {
      toast({ title: "Updated!", description: result.message });
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading || !settings) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Platform Settings 🇬🇭</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      {/* 1. FREE TRIAL SETTINGS (Matches the verifyOtpAction exactly) */}
      <Card className="border-green-200 bg-green-50/30">
  <CardHeader>
    <CardTitle>Growth Plan Free Trial Configuration</CardTitle>
    <CardDescription>Give new signups a taste of the Growth plan automatically.</CardDescription>
  </CardHeader>
  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div className="space-y-3">
      <Label>Enable Free Trial</Label>
      <div className="flex items-center gap-2">
        <Switch 
          checked={settings.trial.active} 
          onCheckedChange={(val) => setSettings({...settings, trial: {...settings.trial, active: val}})} 
        />
        <span className="font-medium text-sm">{settings.trial.active ? "✅ Active" : "❌ Disabled"}</span>
      </div>
    </div>
    <div className="space-y-2">
      <Label>Trial Duration (Days)</Label>
      <Input 
        type="number" 
        value={settings.trial.durationDays} 
        onChange={(e) => setSettings({...settings, trial: {...settings.trial, durationDays: parseInt(e.target.value) || 0}})}
      />
    </div>
    <div className="space-y-2">
      <Label>Trial AI Credits</Label>
      <Input 
        type="number" 
        value={settings.trial.aiCredits} 
        onChange={(e) => setSettings({...settings, trial: {...settings.trial, aiCredits: parseInt(e.target.value) || 0}})}
      />
    </div>
  </CardContent>
</Card>

      {/* 2. LAUNCH OFFER (THE 150 GHS OFFER) */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle>Launch Offer (Early Tester)</CardTitle>
          <CardDescription>This overrides the Growth plan price during the campaign.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Offer Active</Label>
            <Switch 
                checked={settings.launchOffer?.active || false} 
                onCheckedChange={(val) => setSettings({...settings, launchOffer: {...settings.launchOffer, active: val}})} 
            />
          </div>
          <div className="space-y-2">
            <Label>Early Tester Price (GHS)</Label>
            <Input 
                type="number" 
                value={settings.launchOffer?.earlyAccessPrice || ''} 
                onChange={(e) => setSettings({...settings, launchOffer: {...settings.launchOffer, earlyAccessPrice: parseInt(e.target.value)}})}
            />
          </div>
          <div className="space-y-2">
            <Label>Offer End Date (YYYY-MM-DD)</Label>
            <Input 
                type="text" 
                value={settings.launchOffer?.endsAt || ''} 
                onChange={(e) => setSettings({...settings, launchOffer: {...settings.launchOffer, endsAt: e.target.value}})}
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. BASE PLAN PRICES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['starter', 'growth', 'business'].map((id) => (
          <Card key={id}>
            <CardHeader><CardTitle className="capitalize">{id} Plan</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Monthly Price (GHS)</Label>
                <Input 
                    type="number" 
                    value={settings.plans?.[id]?.monthlyPrice || ''} 
                    onChange={(e) => {
                        const newPlans = {...settings.plans};
                        newPlans[id].monthlyPrice = parseInt(e.target.value);
                        setSettings({...settings, plans: newPlans});
                    }}
                />
              </div>
              <div className="space-y-2">
                <Label>AI Credits</Label>
                <Input 
                    type="number" 
                    value={settings.plans?.[id]?.aiCredits || ''} 
                    onChange={(e) => {
                        const newPlans = {...settings.plans};
                        newPlans[id].aiCredits = parseInt(e.target.value);
                        setSettings({...settings, plans: newPlans});
                    }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}