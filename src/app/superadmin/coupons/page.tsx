
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Loader2, Calendar as CalendarIcon, Ticket, Copy } from 'lucide-react';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, DocumentData, serverTimestamp, Timestamp } from 'firebase/firestore';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Coupon extends DocumentData {
    id: string;
    code: string;
    type: 'percentage' | 'flat';
    value: number;
    expiresAt?: Timestamp;
    validForPlan?: 'starter' | 'growth' | 'business' | 'enterprise' | 'all';
    usageCount?: number;
}

export default function CouponsPage() {
    useRequireSuperAdmin();
    const [code, setCode] = useState('');
    const [type, setType] = useState<'percentage' | 'flat'>('percentage');
    const [value, setValue] = useState('');
    const [expiresAt, setExpiresAt] = useState<Date | undefined>();
    const [validForPlan, setValidForPlan] = useState<'starter' | 'growth' | 'business' | 'enterprise' | 'all'>('all');

    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const { toast } = useToast();
    const firestore = useFirestore();

    useEffect(() => {
        if (!firestore) return;
        
        const unsubCoupons = onSnapshot(collection(firestore, 'coupons'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
            setCoupons(data);
            if(loading) setLoading(false);
        });

        return () => unsubCoupons();
    }, [firestore, loading]);

    const handleAddCoupon = async () => {
        if (!code.trim() || !type || !value) {
            toast({ title: "Code, type, and value are required", variant: "destructive" });
            return;
        }
        if (!firestore) return;

        setIsSaving(true);
        try {
            await addDoc(collection(firestore, 'coupons'), {
                code: code.trim().toUpperCase(),
                type: type,
                value: parseFloat(value),
                expiresAt: expiresAt || null,
                validForPlan: validForPlan,
                createdAt: serverTimestamp(),
                usageCount: 0,
            });
            toast({ title: "Coupon Added!", description: `Coupon "${code.toUpperCase()}" has been created.` });
            setCode('');
            setType('percentage');
            setValue('');
            setExpiresAt(undefined);
            setValidForPlan('all');
        } catch (error) {
            console.error("Error adding coupon:", error);
            toast({ title: "Failed to add coupon", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteCoupon = async (couponId: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'coupons', couponId));
            toast({ title: "Coupon Deleted" });
        } catch (error) {
            console.error("Error deleting coupon:", error);
            toast({ title: "Failed to delete coupon", variant: "destructive" });
        }
    };

    const copyCode = (codeToCopy: string) => {
        navigator.clipboard.writeText(codeToCopy);
        toast({ title: "Copied!", description: `Code ${codeToCopy} copied to clipboard.`})
    }
    
    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Add New Coupon</CardTitle>
                    <CardDescription>Create a special discount code for promotions. Dates are optional.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                        <div className="space-y-2">
                            <Label htmlFor="coupon-code">Coupon Code</Label>
                            <Input id="coupon-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., SAVE20" disabled={isSaving}/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="coupon-type">Type</Label>
                             <Select value={type} onValueChange={(v) => setType(v as 'percentage' | 'flat')}>
                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                                    <SelectItem value="flat">Flat Amount (GHS)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="coupon-value">Value</Label>
                            <Input id="coupon-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'percentage' ? "e.g., 20" : "e.g., 50"} disabled={isSaving}/>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="valid-for-plan">Valid For</Label>
                             <Select value={validForPlan} onValueChange={(v) => setValidForPlan(v as any)}>
                                <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                                <SelectContent>
                                <SelectItem value="all">All Plans</SelectItem>
<SelectItem value="starter">Standard Only</SelectItem>
<SelectItem value="growth">Growth Only</SelectItem>
<SelectItem value="business">Business Only</SelectItem>
<SelectItem value="enterprise">Legacy Enterprise</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="expires-at">Expires At (Optional)</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expiresAt && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {expiresAt ? format(expiresAt, 'PPP') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={expiresAt} onSelect={setExpiresAt} initialFocus/></PopoverContent>
                            </Popover>
                        </div>
                    </div>
                     <Button onClick={handleAddCoupon} disabled={isSaving} className="mt-4">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        {isSaving ? 'Adding...' : 'Add Coupon'}
                    </Button>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Existing Coupons</CardTitle>
                    <CardDescription>All active and expired promotional codes.</CardDescription>
                </CardHeader>
                <CardContent>
                     {loading ? (
                        <p>Loading coupons...</p>
                    ) : coupons.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Discount</TableHead>
                                    <TableHead>Valid For</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Usage</TableHead>
                                    <TableHead>Expires At</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {coupons.map(coupon => {
                                    const isExpired = coupon.expiresAt && isPast(coupon.expiresAt.toDate());
                                    return (
                                    <TableRow key={coupon.id} className={cn(isExpired && 'text-muted-foreground')}>
                                        <TableCell>
                                            <div className="flex items-center gap-2 font-medium">
                                                <Ticket className="h-4 w-4"/>
                                                <span>{coupon.code}</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(coupon.code)}><Copy className="h-3 w-3"/></Button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {coupon.type === 'percentage' ? `${coupon.value}% off` : `GHS ${coupon.value.toFixed(2)} off`}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">
                                                {coupon.validForPlan || 'All'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={isExpired ? 'destructive' : 'default'}>
                                                {isExpired ? 'Expired' : 'Active'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-semibold">{coupon.usageCount || 0}</span>
                                        </TableCell>
                                        <TableCell>
                                            {coupon.expiresAt ? format(coupon.expiresAt.toDate(), 'PP') : 'Never'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>This will permanently delete the coupon "{coupon.code}".</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteCoupon(coupon.id)}>
                                                            Yes, delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                )})}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center text-muted-foreground py-10 border-2 border-dashed rounded-lg">
                           <p>You haven't created any coupons yet.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
