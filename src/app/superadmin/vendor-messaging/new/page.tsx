'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  ArrowLeft,
  Save,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuth } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const AUDIENCE_TYPES = [
  { id: 'all_vendors', label: 'All Vendors' },
  { id: 'active_paid_vendors', label: 'Active Paid Vendors' },
  { id: 'trial_vendors', label: 'Trial Vendors' },
  { id: 'trial_ending_soon', label: 'Trial Ending Soon' },
  { id: 'expired_trial_vendors', label: 'Expired Trial Vendors' },
  { id: 'subscription_expiring_soon', label: 'Subscription Expiring Soon' },
  { id: 'payment_failed_vendors', label: 'Payment Failed Vendors' },
  { id: 'vendors_without_whatsapp_connected', label: 'No WhatsApp Connected' },
  { id: 'vendors_without_products', label: 'Vendors with No Products' },
  { id: 'vendors_with_ai_enabled', label: 'AI Enabled Vendors' },
  { id: 'vendors_without_ai_enabled', label: 'AI Disabled Vendors' },
];

const CAMPAIGN_TYPES = [
  { id: 'subscription', label: 'Subscription Notice' },
  { id: 'trial_reminder', label: 'Trial Reminder' },
  { id: 'payment_failed', label: 'Payment Failed' },
  { id: 'product_update', label: 'Product Update' },
  { id: 'feature_announcement', label: 'Feature Announcement' },
  { id: 'onboarding', label: 'Onboarding Nudge' },
  { id: 'maintenance', label: 'Maintenance Notice' },
  { id: 'custom', label: 'Custom Message' },
];

type CampaignStatus = 'draft' | 'ready';

type RecipientPreview = {
  id?: string;
  storeId?: string | null;
  name?: string | null;
  businessName?: string | null;
  phone?: string | null;
  planId?: string | null;
  subscriptionStatus?: string | null;
  expiryDate?: any;
  whatsappConnected?: boolean;
  eligible?: boolean;
  skippedReason?: string | null;
};

export default function NewCampaignPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = getAuth();

  const [formData, setFormData] = useState({
    title: '',
    type: 'custom',
    audienceType: 'all_vendors',
    messageBody: '',
    ctaUrl: '',
    testRecipient: '',
    scheduledAt: '',
  });

  const [recipients, setRecipients] = useState<RecipientPreview[]>([]);
  const [isLoadingAudience, setIsLoadingAudience] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingSingle, setIsSendingSingle] = useState(false);

  const fetchAudiencePreview = useCallback(async () => {
    if (!formData.audienceType) return;

    setIsLoadingAudience(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('You must be signed in as a super admin.');
      }

      const idToken = await currentUser.getIdToken();

      const res = await fetch(
        `/api/superadmin/vendor-messaging/audience?type=${encodeURIComponent(
          formData.audienceType
        )}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Failed to fetch audience');
      }

      setRecipients(Array.isArray(data?.recipients) ? data.recipients : []);
    } catch (error: any) {
      console.error('[Vendor Messaging] Audience preview error:', error);
      setRecipients([]);
      toast({
        title: 'Could not load audience',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAudience(false);
    }
  }, [auth, formData.audienceType, toast]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchAudiencePreview();
    }, 500);

    return () => clearTimeout(timeout);
  }, [fetchAudiencePreview]);

  const handleSave = async (status: CampaignStatus) => {
    if (!formData.title.trim() || !formData.messageBody.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in the campaign title and message body.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('You must be signed in as a super admin.');
      }

      const idToken = await currentUser.getIdToken();

      const res = await fetch('/api/superadmin/vendor-messaging/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          ...formData,
          title: formData.title.trim(),
          messageBody: formData.messageBody.trim(),
          ctaUrl: formData.ctaUrl.trim() || null,
          testRecipient: formData.testRecipient.trim() || null,
          scheduledAt: formData.scheduledAt || null,
          status,
          recipients: recipients.map((recipient) => ({
            vendorId: recipient.id,
            storeId: recipient.storeId || null,
            vendorName: recipient.name || null,
            businessName: recipient.businessName || null,
            phone: recipient.phone || null,
            planId: recipient.planId || null,
            subscriptionStatus: recipient.subscriptionStatus || null,
            expiryDate: recipient.expiryDate || null,
            whatsappConnected: recipient.whatsappConnected === true,
            status: recipient.eligible ? 'pending' : 'skipped',
            skippedReason: recipient.skippedReason || null,
          })),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Failed to save campaign');
      }

      toast({
        title: status === 'draft' ? 'Draft Saved' : 'Campaign Prepared',
        description: `Your campaign "${formData.title.trim()}" is now ${status}.`,
      });

      router.push('/superadmin/vendor-messaging');
    } catch (error: any) {
      console.error('[Vendor Messaging] Save campaign error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to save campaign.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendSingle = async () => {
    if (!formData.testRecipient.trim()) {
      toast({
        title: 'Phone number required',
        description: 'Please enter the WhatsApp number you want to send to.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingSingle(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('You must be signed in as a super admin.');
      }

      const idToken = await currentUser.getIdToken();
      const firstEligibleRecipient = recipients.find((recipient) => recipient.eligible);

      const res = await fetch('/api/superadmin/vendor-messaging/send-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          phone: formData.testRecipient.trim(),
          vendorName: firstEligibleRecipient?.name || 'SellQuic Vendor',
          businessName: firstEligibleRecipient?.businessName || 'your store',
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to send WhatsApp message.');
      }

      toast({
        title: 'WhatsApp message sent',
        description: data.providerMessageId
          ? `Message ID: ${data.providerMessageId}`
          : 'The message was accepted by WhatsApp.',
      });
    } catch (error: any) {
      console.error('[Vendor Messaging] Send single error:', error);

      toast({
        title: 'Send failed',
        description: error?.message || 'Could not send WhatsApp message.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingSingle(false);
    }
  };

  const eligibleCount = recipients.filter((recipient) => recipient.eligible).length;
  const skippedCount = recipients.filter((recipient) => !recipient.eligible).length;

  const previewMessage = useMemo(() => {
    if (!formData.messageBody.trim()) return null;

    const firstEligible = recipients.find((recipient) => recipient.eligible);
    if (!firstEligible) return formData.messageBody;

    let text = formData.messageBody;

    text = text.replace(/{{name}}/g, firstEligible.name || 'Vendor');
    text = text.replace(/{{businessName}}/g, firstEligible.businessName || 'Your Store');
    text = text.replace(/{{plan}}/g, firstEligible.planId || 'free');

    let dateStr = 'soon';

    if (firstEligible.expiryDate) {
      try {
        const date = firstEligible.expiryDate.toDate
          ? firstEligible.expiryDate.toDate()
          : new Date(firstEligible.expiryDate);

        dateStr = format(date, 'MMM d, yyyy');
      } catch {
        dateStr = 'soon';
      }
    }

    text = text.replace(/{{expiryDate}}/g, dateStr);

    return text;
  }, [formData.messageBody, recipients]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create WhatsApp Campaign</h1>
          <p className="text-sm text-muted-foreground">
            Prepare SellQuic-to-vendor WhatsApp messages for renewals, updates, and notices.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
              <CardDescription>Define your message and target audience.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Campaign Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Growth Plan Renewal Reminder"
                  value={formData.title}
                  onChange={(event) =>
                    setFormData({ ...formData, title: event.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Message Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>

                    <SelectContent>
                      {CAMPAIGN_TYPES.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audience">Target Audience</Label>
                  <Select
                    value={formData.audienceType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, audienceType: value })
                    }
                  >
                    <SelectTrigger id="audience">
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>

                    <SelectContent>
                      {AUDIENCE_TYPES.map((audience) => (
                        <SelectItem key={audience.id} value={audience.id}>
                          {audience.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message Body</Label>
                <Textarea
                  id="message"
                  placeholder="Hello {{name}}, your trial for {{businessName}} is ending in 2 days..."
                  className="min-h-[150px] font-mono text-sm"
                  value={formData.messageBody}
                  onChange={(event) =>
                    setFormData({ ...formData, messageBody: event.target.value })
                  }
                />

                <p className="text-[10px] text-muted-foreground italic">
                  Available tags: {'{{name}}'}, {'{{businessName}}'}, {'{{plan}}'}, {'{{expiryDate}}'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cta">CTA Link (Optional)</Label>
                <Input
                  id="cta"
                  placeholder="https://sellquic.com/dashboard/subscription"
                  value={formData.ctaUrl}
                  onChange={(event) =>
                    setFormData({ ...formData, ctaUrl: event.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedule">Schedule (Optional)</Label>
                <Input
                  id="schedule"
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(event) =>
                    setFormData({ ...formData, scheduledAt: event.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center gap-4">
                <div>
                  <CardTitle>Audience Preview</CardTitle>
                  <CardDescription>
                    {isLoadingAudience
                      ? 'Calculating...'
                      : `${eligibleCount} eligible, ${skippedCount} skipped`}
                  </CardDescription>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAudiencePreview}
                  disabled={isLoadingAudience}
                >
                  {isLoadingAudience ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Store WA Setup</TableHead>
                      <TableHead>Eligibility</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isLoadingAudience ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : recipients.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground italic"
                        >
                          No recipients match this audience criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      recipients.map((recipient, index) => {
                        const skippedReason =
                          recipient.skippedReason?.replace(/_/g, ' ') || 'not eligible';

                        return (
                          <TableRow
                            key={recipient.id || index}
                            className={cn(!recipient.eligible && 'opacity-50')}
                          >
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-semibold">
                                  {recipient.name || 'Unnamed vendor'}
                                </span>
                                <span className="text-[10px]">
                                  {recipient.businessName || 'No business name'}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell className="font-mono">
                              {recipient.phone || '-'}
                            </TableCell>

                            <TableCell className="capitalize">
                              {recipient.planId || 'free'}
                            </TableCell>

                            <TableCell>
                              {recipient.whatsappConnected ? (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 scale-75 origin-left">
                                  Connected
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="scale-75 origin-left">
                                  Not Setup
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell>
                              {recipient.eligible ? (
                                <div className="flex items-center gap-1 text-green-600">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>Eligible</span>
                                </div>
                              ) : (
                                <div
                                  className="flex items-center gap-1 text-red-500"
                                  title={skippedReason}
                                >
                                  <XCircle className="h-3 w-3" />
                                  <span className="truncate max-w-[100px]">
                                    {skippedReason}
                                  </span>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {previewMessage && (
                <div className="space-y-2">
                  <Label>Message Preview</Label>

                  <div className="p-3 bg-gray-50 border rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#25D366]" />
                    <p className="text-[11px] whitespace-pre-wrap leading-relaxed text-gray-800">
                      {previewMessage}
                    </p>

                    {formData.ctaUrl && (
                      <p className="text-[11px] text-blue-600 mt-2 truncate underline">
                        {formData.ctaUrl}
                      </p>
                    )}
                  </div>

                  <p className="text-[9px] text-muted-foreground italic">
                    Preview using data from first eligible recipient. Live WhatsApp sending uses
                    the approved template configured on the server.
                  </p>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <Label htmlFor="test-phone">Send to Number</Label>

                <div className="flex gap-2">
                  <Input
                    id="test-phone"
                    placeholder="0209897154 or 233209897154"
                    value={formData.testRecipient}
                    onChange={(event) =>
                      setFormData({ ...formData, testRecipient: event.target.value })
                    }
                  />

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSendSingle}
                    disabled={isSendingSingle}
                  >
                    {isSendingSingle ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Sends one real WhatsApp template message to this number.
                </p>
              </div>

              <div className="pt-4 space-y-2">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleSave('draft')}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Draft
                </Button>

                <Button
                  className="w-full"
                  onClick={() => handleSave('ready')}
                  disabled={isSaving || eligibleCount === 0}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Prepare Campaign
                </Button>
              </div>
            </CardContent>

            <CardFooter className="bg-muted/50 p-4 border-t flex flex-col gap-3">
              <div className="w-full flex justify-between text-xs">
                <span>Eligible Recipients:</span>
                <span className="font-bold">{eligibleCount}</span>
              </div>

              <div className="w-full flex justify-between text-xs text-muted-foreground">
                <span>Message Type:</span>
                <span className="font-medium capitalize">
                  {formData.type.replace(/_/g, ' ')}
                </span>
              </div>
            </CardFooter>
          </Card>

          <Card className="bg-amber-50 border-amber-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Meta Rule Reminder
              </CardTitle>
            </CardHeader>

            <CardContent className="text-xs text-amber-700 leading-relaxed">
              Messaging vendors through WhatsApp requires approved WhatsApp templates
              before live sending. Billing and subscription notices should use the right
              template category before sending.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}