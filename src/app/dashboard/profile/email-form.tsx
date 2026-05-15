'use client';

import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { sendOtpAction, verifyOtpAction } from '@/lib/actions';

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [newEmail, setNewEmail] = useState('');
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const auth = getAuth();

  const handleRequestChange = async () => {
    setIsLoading(true);
    const result = await sendOtpAction(auth.currentUser!.uid, newEmail, auth.currentUser!.displayName || 'Vendor');
    if (result.success) setStep('otp');
    setIsLoading(false);
  };

  const handleVerifyChange = async () => {
    setIsLoading(true);
    const result = await verifyOtpAction(auth.currentUser!.uid, otp, true, newEmail);
    if (result.success) {
      toast({ title: "Email Updated!" });
      window.location.reload();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-4 max-w-md">
      {step === 'input' ? (
        <>
          <Input type="email" placeholder="New Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="h-12 rounded-xl" />
          <Button onClick={handleRequestChange} disabled={isLoading} className="bg-[#A155E5] w-full h-12 rounded-xl font-bold">
            {isLoading ? <Loader2 className="animate-spin" /> : "Send Verification Code"}
          </Button>
        </>
      ) : (
        <>
          <Input placeholder="6-digit code" value={otp} onChange={e => setOtp(e.target.value)} className="h-12 rounded-xl text-center text-2xl font-bold tracking-[10px]" />
          <Button onClick={handleVerifyChange} disabled={isLoading} className="bg-[#A155E5] w-full h-12 rounded-xl font-bold">
            {isLoading ? <Loader2 className="animate-spin" /> : "Verify & Update Email"}
          </Button>
        </>
      )}
    </div>
  );
}
