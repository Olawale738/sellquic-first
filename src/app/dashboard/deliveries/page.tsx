'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Loader2, Save } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, DocumentData, updateDoc } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getAuth } from 'firebase/auth';

interface DeliveryOption extends DocumentData {
    id: string;
    label: string;
    fee: number;
    type: 'delivery' | 'pickup';
}

export default function DeliveriesPage() {
    const [label, setLabel] = useState('');
    const [fee, setFee] = useState('');
    const [type, setType] = useState<'delivery' | 'pickup'>('delivery');
    const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
    
    const [deliveryNotice, setDeliveryNotice] = useState('');
    const [deliveryTimeline, setDeliveryTimeline] = useState('');
    const [returnPolicy, setReturnPolicy] = useState('');
    const [isReturnPolicyActive, setIsReturnPolicyActive] = useState(false);

    const [isSavingOption, setIsSavingOption] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [loading, setLoading] = useState(true);

    const { user, activeStore, loading: authLoading, refreshUser } = useAuth();
    const { toast } = useToast();
    const firestore = useFirestore();
    const router = useRouter();
    const auth = getAuth();

    useEffect(() => {
        if (!user || !activeStore || !firestore) {
            setLoading(false);
            return;
        };

        setDeliveryNotice(activeStore.deliveryNotice || '');
        setDeliveryTimeline(activeStore.deliveryTimeline || '');
        setReturnPolicy(activeStore.returnPolicy || '');
        setIsReturnPolicyActive(activeStore.isReturnPolicyActive || false);

        const q = collection(firestore, 'stores', activeStore.id, 'deliveries');
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const optionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryOption));
            setDeliveryOptions(optionsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching delivery options:", error);
            toast({ title: "Error fetching delivery options", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, activeStore, toast, firestore]);

    const handleAddOption = async () => {
        if (!label.trim()) {
            toast({ title: "Label cannot be empty", variant: "destructive" });
            return;
        }
        if (!user || !activeStore || !firestore) return;

        const isFirstOption = deliveryOptions.length === 0;
        setIsSavingOption(true);
        try {
            await addDoc(collection(firestore, 'stores', activeStore.id, 'deliveries'), {
                label: label,
                fee: parseFloat(fee || '0'),
                type: type,
                createdAt: new Date(),
            });

            // Cache invalidation
            try {
              const token = await auth.currentUser?.getIdToken();
              await fetch('/api/cache/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ storeId: activeStore.id })
              });
            } catch(e) {
              console.warn("Failed to clear AI cache", e);
            }
            
            toast({ title: "Option Added!", description: `"${label}" has been added.` });
            
            if (isFirstOption) {
                router.push('/dashboard');
            } else {
                setLabel('');
                setFee('');
            }
        } catch (error) {
            toast({ title: "Failed to add option", variant: "destructive" });
        } finally {
            setIsSavingOption(false);
        }
    };
    
    const handleDeleteOption = async (optionId: string) => {
        if (!user || !activeStore || !firestore) return;
        try {
            await deleteDoc(doc(firestore, 'stores', activeStore.id, 'deliveries', optionId));
            
            // Cache invalidation
            const token = await auth.currentUser?.getIdToken();
            await fetch('/api/cache/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ storeId: activeStore.id })
            });

            toast({ title: "Delivery Option Deleted" });
        } catch (error) {
            toast({ title: "Failed to delete option", variant: "destructive" });
        }
    };

     const handleSaveSettings = async () => {
        if (!user || !activeStore || !firestore) return;
        setIsSavingSettings(true);
        try {
            await updateDoc(doc(firestore, 'stores', activeStore.id), {
                deliveryNotice,
                deliveryTimeline,
                returnPolicy,
                isReturnPolicyActive,
            });

            // Cache invalidation
            const token = await auth.currentUser?.getIdToken();
            await fetch('/api/cache/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ storeId: activeStore.id })
            });
            
            toast({ title: "Delivery & Return settings saved!" });
            await refreshUser();
        } catch (error) {
             toast({ title: "Failed to save settings", variant: "destructive" });
        } finally {
            setIsSavingSettings(false);
        }
    }
    
    if (authLoading) return <p>Loading...</p>;
    if (!activeStore) return <p>Please select a store to manage deliveries.</p>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Delivery & Returns</CardTitle>
                    <CardDescription>Provide general information about your customer policies.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="delivery-notice">Delivery Notice (Optional)</Label>
                        <Textarea
                            id="delivery-notice"
                            value={deliveryNotice}
                            onChange={(e) => setDeliveryNotice(e.target.value)}
                            placeholder="e.g., We deliver on Tuesdays and Fridays between 9am - 5pm."
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="delivery-timeline">Delivery Timeline (Optional)</Label>
                        <Input
                            id="delivery-timeline"
                            value={deliveryTimeline}
                            onChange={(e) => setDeliveryTimeline(e.target.value)}
                            placeholder="e.g., 1-2 business days, Same-day"
                        />
                    </div>
                    
                    <div className="pt-4 border-t">
                        <Collapsible open={isReturnPolicyActive} onOpenChange={setIsReturnPolicyActive}>
                            <div className="flex items-center space-x-2 mb-4">
                                <Switch id="return-policy-active" checked={isReturnPolicyActive} onCheckedChange={setIsReturnPolicyActive} />
                                <Label htmlFor="return-policy-active" className="cursor-pointer font-medium">Show Return & Refund Policy</Label>
                            </div>
                            <CollapsibleContent className="space-y-2">
                                <Label htmlFor="returnPolicy">Policy Content</Label>
                                <Textarea 
                                    id="returnPolicy" 
                                    placeholder="Explain your policy on returns and refunds..." 
                                    value={returnPolicy} 
                                    onChange={(e) => setReturnPolicy(e.target.value)}
                                    className="min-h-[100px]"
                                />
                            </CollapsibleContent>
                        </Collapsible>
                    </div>

                    <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
                         {isSavingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Settings
                    </Button>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="animated-border-card">
                    <Card>
                        <CardHeader>
                            <CardTitle>Add Delivery/Pickup Option</CardTitle>
                            <CardDescription>Create a new fee for a location or a pickup point.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select value={type} onValueChange={(v) => setType(v as any)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="delivery">Delivery</SelectItem>
                                            <SelectItem value="pickup">Pickup Location</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="delivery-label">Location / Pickup Point Label</Label>
                                    <Input
                                        id="delivery-label"
                                        value={label}
                                        onChange={(e) => setLabel(e.target.value)}
                                        placeholder={type === 'delivery' ? "e.g., Within Accra, Same-day" : "e.g., Accra Mall Pickup Point"}
                                        disabled={isSavingOption}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="delivery-fee">Fee (GHS)</Label>
                                    <Input
                                        id="delivery-fee"
                                        type="number"
                                        value={fee}
                                        onChange={(e) => setFee(e.target.value)}
                                        placeholder={type === 'delivery' ? "e.g., 20.00" : "0.00 for free pickup"}
                                        disabled={isSavingOption}
                                    />
                                </div>
                                <Button onClick={handleAddOption} disabled={isSavingOption}>
                                    {isSavingOption ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                    {isSavingOption ? 'Adding...' : 'Add Option'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="animated-border-card">
                    <Card>
                        <CardHeader>
                            <CardTitle>Your Options</CardTitle>
                            <CardDescription>Your current delivery and pickup locations.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <p>Loading options...</p>
                            ) : deliveryOptions.length > 0 ? (
                                <div className="space-y-2">
                                    {deliveryOptions.map(option => (
                                        <div key={option.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                                            <div>
                                                <p className="font-medium">{option.label}</p>
                                                <p className="text-sm text-muted-foreground">{option.type === 'pickup' ? 'Pickup' : 'Delivery'}: GHS {option.fee.toFixed(2)}</p>
                                            </div>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will permanently delete this option.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteOption(option.id)}>
                                                            Yes, delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground py-10 border-2 border-dashed rounded-lg">
                                <p>You haven't created any options yet.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
