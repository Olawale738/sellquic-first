'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { MailCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { sendOtpAction, verifyOtpAction } from '@/lib/actions';
import type { AppUser } from '@/hooks/use-auth';

export function VerifyEmailBanner({ user }: { user: AppUser }) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSendCode = async () => {
    setIsSending(true);
    try {
      const result = await sendOtpAction(user.uid, user.email!, user.displayName || 'Vendor');
      if (result.success) {
        toast({ 
          title: 'Verification Code Sent!', 
          description: 'Please check your email inbox (and spam folder).' 
        });
        setShowOtpInput(true);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to send verification code.', 
        variant: 'destructive' 
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (otp.length !== 6) {
      toast({ 
        title: "Invalid Code", 
        description: "Please enter the 6-digit code from your email.", 
        variant: "destructive"
      });
      return;
    }

    setIsVerifying(true);
    try {
      const result = await verifyOtpAction(user.uid, otp);
      if (result.success) {
        toast({ 
          title: "Success!", 
          description: "Your email has been verified. Thank you!" 
        });
        // Reload to update UI
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast({ 
          title: "Verification Failed", 
          description: result.message, 
          variant: "destructive" 
        });
      }
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to verify code.', 
        variant: 'destructive' 
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6" role="alert">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-0.5">
          <MailCheck className="h-5 w-5 text-yellow-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-yellow-900 text-sm mb-1">
            Verify Your Email Address
          </p>
          <p className="text-xs text-yellow-800 mb-3">
            Verify your email to secure your account and ensure you receive important notifications.
          </p>

          {!showOtpInput ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSendCode}
              disabled={isSending}
              className="bg-yellow-200 text-yellow-900 hover:bg-yellow-300 h-8 text-xs font-medium"
            >
              {isSending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {isSending ? 'Sending...' : 'Send Verification Code'}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Input 
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="h-8 w-32 text-center text-sm font-mono tracking-wider"
                disabled={isVerifying}
              />
              <Button
                size="sm"
                onClick={handleVerifyCode}
                disabled={isVerifying || otp.length !== 6}
                className="bg-yellow-600 hover:bg-yellow-700 text-white h-8 text-xs font-medium"
              >
                {isVerifying ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verify
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSendCode}
                disabled={isSending}
                className="text-yellow-700 hover:text-yellow-900 h-8 text-xs"
              >
                Resend
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}