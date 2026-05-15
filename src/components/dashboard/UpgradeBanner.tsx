'use client';

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, Rocket } from 'lucide-react';
import Link from 'next/link';

export function UpgradeBanner() {
  const { user } = useAuth();

  // Only show if user is on Free plan
  const isFree = !user?.subscription?.planId || user.subscription.planId === 'free';

  if (!isFree) return null;

  return (
    <Card className="bg-gradient-to-r from-violet-600 to-indigo-600 border-none text-white mb-6 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Rocket className="h-48 w-48 -mr-10 -mt-10" />
      </div>
      
      <CardContent className="p-6 relative z-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-300" />
              Unlock the full power of SellQuic
            </h3>
            <p className="text-indigo-100 max-w-xl text-sm md:text-base">
              You are currently on the Free plan (5 product limit). 
              Upgrade to Premium to get <strong>Unlimited Products</strong>, 
              <strong>AI Descriptions</strong>, and <strong>Priority Support</strong>.
            </p>
          </div>
          
          <Button asChild variant="secondary" size="lg" className="whitespace-nowrap shadow-lg font-semibold">
            <Link href="/dashboard/subscription">
              Upgrade Now <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}