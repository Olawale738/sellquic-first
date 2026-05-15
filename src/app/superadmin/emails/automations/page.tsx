'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Loader2, PlusCircle, Zap, Trash2, ToggleLeft, Clock, Users, RefreshCw, LogIn, ShoppingBag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

const TRIGGER_OPTIONS = [
  { value: 'signup', label: 'After Signup', description: 'Sent X days after vendor registers', icon: Users },
  { value: 'first_order', label: 'First Order', description: 'Sent X days after vendor gets their first order', icon: ShoppingBag },
  { value: 'inactive', label: 'Inactive Vendor', description: 'Sent when vendor hasn\'t logged in for X days', icon: Clock },
  { value: 'expiring', label: 'Plan Expiring', description: 'Sent X days before vendor\'s plan expires', icon: RefreshCw },
  { value: 'no_login', label: 'No Login After Signup', description: 'Sent when vendor signed up but never logged in after X days', icon: LogIn },
];

const TRIGGER_ICONS: Record<string, any> = {
  signup: Users,
  first_order: ShoppingBag,
  inactive: Clock,
  expiring: RefreshCw,
  no_login: LogIn,
};

export default function EmailAutomationsPage() {
  useRequireSuperAdmin();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [automations, setAutomations] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formTrigger, setFormTrigger] = useState('');
  const [formDelayDays, setFormDelayDays] = useState('1');
  const [formTemplateId, setFormTemplateId] = useState('');

  useEffect(() => {
    if (!firestore) return;

    const autoQuery = query(collection(firestore, 'email_automations'), orderBy('createdAt', 'desc'));
    const templatesQuery = query(collection(firestore, 'email_templates'), orderBy('createdAt', 'desc'));

    const unsubAuto = onSnapshot(autoQuery, (snap) => {
      setAutomations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const unsubTemplates = onSnapshot(templatesQuery, (snap) => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubAuto(); unsubTemplates(); };
  }, [firestore]);

  const handleToggle = async (automationId: string, currentValue: boolean) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'email_automations', automationId), {
        isActive: !currentValue,
      });
      toast({ title: !currentValue ? 'Automation enabled' : 'Automation paused' });
    } catch {
      toast({ title: 'Error', description: 'Could not update automation.', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!formName || !formTrigger || !formTemplateId || !formDelayDays) {
      toast({ title: 'All fields required.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/superadmin/emails/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          name: formName,
          trigger: formTrigger,
          delayDays: parseInt(formDelayDays),
          templateId: formTemplateId,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save.');

      toast({ title: 'Automation created!' });
      setIsDialogOpen(false);
      setFormName(''); setFormTrigger(''); setFormDelayDays('1'); setFormTemplateId('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (automationId: string) => {
    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();
      await fetch(`/api/superadmin/emails/automations?id=${automationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      toast({ title: 'Automation deleted.' });
    } catch {
      toast({ title: 'Error deleting automation.', variant: 'destructive' });
    }
  };

  const getTriggerLabel = (trigger: string) => TRIGGER_OPTIONS.find(t => t.value === trigger)?.label || trigger;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Email Automations</h2>
          <p className="text-sm text-muted-foreground">Set-and-forget emails that send automatically based on vendor behaviour.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="mr-2 h-4 w-4" /> New Automation</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Create Automation</DialogTitle>
              <DialogDescription>Choose a trigger, delay, and template. It runs automatically from then on.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Automation Name</Label>
                <Input placeholder="e.g., Welcome Day 1 Tip" value={formName} onChange={e => setFormName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Trigger</Label>
                <Select value={formTrigger} onValueChange={setFormTrigger}>
                  <SelectTrigger><SelectValue placeholder="When should this send?" /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <div>
                          <p className="font-medium">{t.label}</p>
                          <p className="text-xs text-muted-foreground">{t.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Delay (days)</Label>
                <Input
                  type="number"
                  min="0"
                  max="365"
                  placeholder="e.g., 1"
                  value={formDelayDays}
                  onChange={e => setFormDelayDays(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {formTrigger === 'expiring' ? 'Days BEFORE expiry to send.' : 'Days AFTER trigger to send. Use 0 for same day.'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Email Template</Label>
                <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Select a template..." /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                Create Automation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : automations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <Zap className="h-10 w-10 mb-3" />
            <p className="font-semibold">No automations yet</p>
            <p className="text-sm">Create your first automation to start sending emails on autopilot.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {automations.map(auto => {
            const TriggerIcon = TRIGGER_ICONS[auto.trigger] || Zap;
            const template = templates.find(t => t.id === auto.templateId);
            return (
              <Card key={auto.id} className={auto.isActive ? 'border-primary/30' : 'opacity-60'}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${auto.isActive ? 'bg-primary/10' : 'bg-muted'}`}>
                        <TriggerIcon className={`h-5 w-5 ${auto.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{auto.name}</p>
                          <Badge variant={auto.isActive ? 'default' : 'secondary'} className="text-[10px]">
                            {auto.isActive ? 'Active' : 'Paused'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Trigger: <span className="font-medium text-foreground">{getTriggerLabel(auto.trigger)}</span>
                          {' · '}
                          {auto.trigger === 'expiring'
                            ? `${auto.delayDays} days before expiry`
                            : `${auto.delayDays} day${auto.delayDays !== 1 ? 's' : ''} after trigger`
                          }
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Template: <span className="font-medium text-foreground">{template?.name || auto.templateId}</span>
                        </p>
                        {auto.sentCount > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Sent {auto.sentCount} times total
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={auto.isActive}
                        onCheckedChange={() => handleToggle(auto.id, auto.isActive)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(auto.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
