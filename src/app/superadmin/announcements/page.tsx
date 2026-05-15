'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, FileText } from 'lucide-react';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
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
import { getAuth } from 'firebase/auth';

export default function AnnouncementsPage() {
    const { user } = useRequireSuperAdmin();
    const [message, setMessage] = useState('');
    const [recipientGroup, setRecipientGroup] = useState('all');
    const [specificNumbers, setSpecificNumbers] = useState('');
    const [isSending, setIsSending] = useState(false);
    const { toast } = useToast();

    const loadNudgeTemplate = () => {
        setMessage("Hi! You signed up on SellQuic but haven't listed any products yet. It only takes 2 minutes! Log in now and start selling today 🚀 sellquic.com");
    };

    const loadReengagementTemplate = () => {
        setMessage("Hey! Your SellQuic store has been empty for 60+ days. Don't let your store go to waste — add your products today and start getting orders 💪 sellquic.com");
    };

    const handleSendBroadcast = async () => {
        if (!user) {
            toast({ title: 'You must be logged in.', variant: 'destructive' });
            return;
        }

        if (!message.trim()) {
            toast({ title: 'Message cannot be empty', variant: 'destructive' });
            return;
        }

        let payload: { message: string; group: string; numbers?: string[] };

        if (recipientGroup === 'specific') {
            const numbers = specificNumbers.split(',').map(num => num.trim()).filter(num => num.length > 0);
            if (numbers.length === 0) {
                toast({ title: 'Please provide at least one phone number.', variant: 'destructive' });
                return;
            }
            payload = { message, group: 'specific', numbers };
        } else {
            payload = { message, group: recipientGroup };
        }

        setIsSending(true);

        try {
            const auth = getAuth();
            const idToken = await auth.currentUser?.getIdToken();

            const response = await fetch('/api/broadcast-sms', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to send broadcast.');
            }

            toast({
                title: 'Broadcast Sent!',
                description: `Your message has been sent to ${result.sentCount} vendors.`,
            });
            setMessage('');
            setSpecificNumbers('');

        } catch (error) {
            console.error('Broadcast error:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            toast({
                title: 'Broadcast Failed',
                description: errorMessage,
                variant: 'destructive',
            });
        } finally {
            setIsSending(false);
        }
    };

    // Helper to format the button text dynamically
    const getButtonText = () => {
        if (recipientGroup === 'specific') return 'specific numbers';
        if (recipientGroup === 'no_products_30') return 'vendors (30-60d no products)';
        if (recipientGroup === 'no_products_60') return 'vendors (60d+ no products)';
        return `${recipientGroup} vendors`;
    };

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Send Announcement</CardTitle>
                <CardDescription>Broadcast an SMS message to your vendors.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="message">Message</Label>
                        {recipientGroup === 'no_products_30' && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-xs border-orange-200 text-orange-700 hover:bg-orange-50" 
                                onClick={loadNudgeTemplate}
                                type="button"
                            >
                                <FileText className="h-3 w-3 mr-1" />
                                Use Nudge Template
                            </Button>
                        )}
                        {recipientGroup === 'no_products_60' && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50" 
                                onClick={loadReengagementTemplate}
                                type="button"
                            >
                                <FileText className="h-3 w-3 mr-1" />
                                Use Re-engagement Template
                            </Button>
                        )}
                    </div>
                    <Textarea
                        id="message"
                        placeholder="Type your announcement here..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="min-h-[120px]"
                        disabled={isSending}
                    />
                    <p className="text-xs text-muted-foreground">The message will be sent as an SMS. Standard rates apply.</p>
                </div>

                <div className="space-y-2">
                    <Label>Recipients</Label>
                    <RadioGroup
                        value={recipientGroup}
                        onValueChange={setRecipientGroup}
                        className="flex flex-col space-y-2"
                        disabled={isSending}
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="all" id="all" />
                            <Label htmlFor="all">All Vendors</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="paid" id="paid" />
                            <Label htmlFor="paid">Paid Vendors Only (Premium & Business)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="free" id="free" />
                            <Label htmlFor="free">Free Vendors Only</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="expired" id="expired" />
                            <Label htmlFor="expired">Expired Vendors</Label>
                        </div>
                        
                        {/* New Segmented No-Products Options */}
                        <div className="flex items-center space-x-2 mt-2 pt-2 border-t">
                            <RadioGroupItem value="no_products_30" id="no_products_30" />
                            <Label htmlFor="no_products_30" className="text-orange-600 font-medium">
                                No Products — Registered 30–60 days ago (Nudge)
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no_products_60" id="no_products_60" />
                            <Label htmlFor="no_products_60" className="text-red-600 font-medium">
                                No Products — Registered 60+ days ago (Re-engagement)
                            </Label>
                        </div>
                        
                        <div className="flex items-center space-x-2 mt-2 pt-2 border-t">
                            <RadioGroupItem value="specific" id="specific" />
                            <Label htmlFor="specific">Specific Numbers</Label>
                        </div>
                    </RadioGroup>
                </div>
                
                {recipientGroup === 'specific' && (
                    <div className="space-y-2 animate-in fade-in">
                        <Label htmlFor="specific-numbers">Paste Numbers</Label>
                         <Textarea
                            id="specific-numbers"
                            placeholder="Paste numbers here, separated by commas..."
                            value={specificNumbers}
                            onChange={(e) => setSpecificNumbers(e.target.value)}
                            className="min-h-[100px] font-mono text-sm"
                            disabled={isSending}
                        />
                         <p className="text-xs text-muted-foreground">e.g., 0244123456, 0557654321, +233201112222</p>
                    </div>
                )}

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="lg" disabled={isSending || !message.trim()} className="w-full sm:w-auto">
                            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            {isSending ? 'Sending...' : `Send to ${getButtonText()}`}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will send an SMS to the selected recipients. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSendBroadcast}>
                                Yes, Send  Broadcast
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}