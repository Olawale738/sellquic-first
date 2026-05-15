
'use client';

import React from 'react';
import BuyDomainForm from '@/components/dashboard/settings/BuyDomainForm';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function DomainPage() {
    const { user, activeStore, loading: authLoading } = useAuth();
    
    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!activeStore) {
      return (
        <div className="text-center py-10">
            <p className="text-muted-foreground">Please create or select a store to manage settings.</p>
            <Button asChild className="mt-4">
                <Link href="/dashboard/stores">
                    Manage Stores
                </Link>
            </Button>
        </div>
      );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* The BuyDomainForm now handles all states: buy, connect, and view status */}
            <BuyDomainForm store={activeStore} />
        </div>
    );
}