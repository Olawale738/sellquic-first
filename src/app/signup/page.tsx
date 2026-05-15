
'use client';

import { Suspense, useEffect, useState } from 'react';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Loader2, Mail, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { slugify } from '@/lib/utils';
import { HomeHeader } from '@/components/landing/HomeHeader';
import { sendOtpAction, verifyOtpAction } from '@/lib/actions';
import { isValidPhoneNumber } from 'react-phone-number-input';
import PhoneField from '@/components/ui/PhoneInput';

function SignupForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    businessName: '',
    affiliateCode: '',
  });
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'signup' | 'otp'>('signup');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [userId, setUserId] = useState('');
  const [hasAuthUser, setHasAuthUser] = useState(false); // track if we already created an auth user
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Resend OTP state
  const [canResend, setCanResend] = useState(true);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const auth = getAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Track affiliate link clicks (?ref=CODE)
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('affiliateRef', ref);
      fetch('/api/affiliates/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCode: ref }),
      }).catch((err) => console.error('Failed to track click:', err));
    }
  }, [searchParams]);

  // Countdown for resend button
  useEffect(() => {
    if (!resendCountdown) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidPhoneNumber(phone)) {
      toast({
        title: 'Invalid Phone Number',
        description: 'Please enter a valid WhatsApp number.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      let uid = userId;

      if (!hasAuthUser) {
        try {
          const { user } = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
          uid = user.uid;
          setUserId(user.uid);
          setHasAuthUser(true);
        } catch (createError: any) {
          if (createError.code === 'auth/email-already-in-use') {
            // Auth exists but store doesn't — sign them in and continue
            const { user } = await signInWithEmailAndPassword(auth, formData.email, formData.password);
            uid = user.uid;
            setUserId(user.uid);
            setHasAuthUser(true);
          } else {
            throw createError; // re-throw anything else
          }
        }
      }

      // If we already have an auth user (e.g. retry after slug/phone error)
      if (hasAuthUser && !uid) {
        // In theory shouldn't happen, but safety check
        const current = auth.currentUser;
        if (current) {
          uid = current.uid;
          setUserId(current.uid);
        } else {
          // Try signing them in with the same credentials
          const { user } = await signInWithEmailAndPassword(
            auth,
            formData.email,
            formData.password
          );
          uid = user.uid;
          setUserId(user.uid);
        }
      }

      // Send OTP
      const result = await sendOtpAction(
        uid,
        formData.email,
        `${formData.firstName} ${formData.lastName}`
      );

      if (!result.success) {
        toast({
          title: 'Could not send code',
          description: result.message || 'Please try again later.',
          variant: 'destructive',
        });
        return;
      }

      // Move to OTP step
      setStep('otp');
      setCanResend(false);
      setResendCountdown(60);
      setTimeout(() => setCanResend(true), 60000);
    } catch (error: any) {
      let title = 'Signup Failed';
      let description = 'An unexpected error occurred. Please try again.';
      switch (error.code) {
        case 'auth/email-already-in-use':
          title = 'Email Already in Use';
          description = 'This email is already registered. Please try logging in instead.';
          break;
        case 'auth/invalid-email':
          title = 'Invalid Email';
          description = 'Please enter a valid email address.';
          break;
        case 'auth/weak-password':
          title = 'Weak Password';
          description = 'Your password should be at least 6 characters long.';
          break;
      }
      toast({ title, description, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpInput = (value: string, index: number) => {
    const newCode = [...otpCode];
    newCode[index] = value.slice(-1);
    setOtpCode(newCode);
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    setIsLoading(true);

    try {
      const affiliateCode =
        formData.affiliateCode ||
        localStorage.getItem('affiliateRef') ||
        '';

      const result = await verifyOtpAction({
        userId,
        otp: otpCode.join(''),
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        businessName: formData.businessName,
        phone,
        affiliateCode,
      });

      if (result.success) {
        // Sign in and redirect
        await signInWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );
        localStorage.removeItem('affiliateRef');
        localStorage.setItem('newSignup', 'true');
        window.location.href = '/dashboard/subscription';
        return;
      }

      // Handle specific server-side validation messages
      const msg = result.message || 'Verification failed. Please try again.';

      toast({
        title: 'Verification Failed',
        description: msg,
        variant: 'destructive',
      });

      // If it's a unique constraint issue, send them back to edit the form
      if (
        msg.toLowerCase().includes('business name already taken') ||
        msg.toLowerCase().includes('business name is already taken') ||
        msg.toLowerCase().includes('phone number already registered')
      ) {
        setStep('signup');
      }
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || !userId) return;

    setResendLoading(true);
    try {
      const result = await sendOtpAction(
        userId,
        formData.email,
        `${formData.firstName} ${formData.lastName}`
      );

      if (!result.success) {
        toast({
          title: 'Could not resend code',
          description: result.message || 'Please try again later.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Code sent',
        description: 'We just sent you a new verification code.',
      });

      setCanResend(false);
      setResendCountdown(60);
      setTimeout(() => setCanResend(true), 60000);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to resend code.',
        variant: 'destructive',
      });
    } finally {
      setResendLoading(false);
    }
  };

  const storeUrlPreview = slugify(formData.businessName);

  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      <HomeHeader />
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 pt-24 sm:pt-28 md:pt-32">
        {step === 'signup' ? (
          <div className="w-full max-w-sm space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-purple-600 font-bold bg-purple-50 border border-purple-200 px-3 sm:px-4 py-2 rounded-full mb-4 sm:mb-6 text-sm">
                <ShieldCheck
                  size={16}
                  className="sm:w-[18px] sm:h-[18px]"
                />
                <span>Trusted by 2k+ Sellers</span>
              </div>
            </div>
            <form
              onSubmit={handleSignup}
              className="space-y-3.5 sm:space-y-4 bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-100"
            >
              <div className="grid grid-cols-2 gap-4">
                <Input
                  required
                  placeholder="First Name"
                  className="h-11 sm:h-12 rounded-xl bg-slate-50 border-none font-bold text-sm sm:text-base"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      firstName: e.target.value,
                    })
                  }
                />
                <Input
                  required
                  placeholder="Last Name"
                  className="h-11 sm:h-12 rounded-xl bg-slate-50 border-none font-bold text-sm sm:text-base"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lastName: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Input
                  required
                  placeholder="Store Name"
                  className="h-11 sm:h-12 rounded-xl bg-slate-50 border-none font-bold text-sm sm:text-base"
                  value={formData.businessName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      businessName: e.target.value,
                    })
                  }
                />
                {storeUrlPreview && (
                  <p className="text-[10px] text-slate-400 font-bold pl-2 mt-1 transition-opacity duration-300 animate-in fade-in">
                    Your URL will be:{' '}
                    <span className="text-purple-600">
                      {storeUrlPreview}.sellquic.com
                    </span>
                  </p>
                )}
              </div>

              <div>
                <PhoneField value={phone} onChange={setPhone} />
                <p className="text-[10px] text-slate-400 font-bold pl-2 mt-1">
                  Enter your WhatsApp number.
                </p>
              </div>

              <div>
                <Input
                  required
                  type="email"
                  placeholder="Email address"
                  className="h-11 sm:h-12 rounded-xl bg-slate-50 border-none font-bold text-sm sm:text-base"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      email: e.target.value,
                    })
                  }
                />
                <p className="text-[10px] text-slate-400 font-bold pl-2 mt-1">
                  We'll send a verification code to this email.
                </p>
              </div>

              <div className="relative">
                <Input
                  required
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className="h-11 sm:h-12 rounded-xl bg-slate-50 border-none font-bold pr-12 text-sm sm:text-base"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      password: e.target.value,
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 sm:right-4 top-3 sm:top-3 text-slate-400"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <Input
                  placeholder="Have an Invite Code? (Optional)"
                  className="h-11 sm:h-12 rounded-xl bg-purple-50/50 border-purple-100 placeholder:text-purple-300 font-bold text-sm sm:text-base text-purple-700 uppercase"
                  value={formData.affiliateCode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      affiliateCode: e.target.value,
                    })
                  }
                />
                <p className="text-[10px] text-slate-400 font-bold pl-2 mt-1">
                  Enter your VIP code here to unlock your 14-Day Free Trial.
                </p>
              </div>

              <Button
                disabled={isLoading}
                className="w-full h-12 sm:h-14 bg-[#A155E5] hover:bg-black text-white font-black text-base sm:text-lg rounded-2xl transition-all shadow-xl"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  'CREATE ACCOUNT'
                )}
              </Button>

              <p className="text-center text-xs sm:text-sm font-bold text-slate-400 pt-2">
                Already selling?{' '}
                <Link
                  href="/login"
                  className="text-[#A155E5] hover:underline"
                >
                  Login
                </Link>
              </p>
            </form>
          </div>
        ) : (
          <div className="w-full max-w-sm space-y-6 sm:space-y-8 text-center animate-in zoom-in px-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#A155E5]/10 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 animate-bounce">
              <Mail className="w-8 h-8 sm:w-10 sm:h-10 text-[#A155E5]" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-[1000] italic tracking-tighter uppercase leading-none">
              Enter Code
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm px-2">
              We sent a verification code to{' '}
              <b className="break-all">{formData.email}</b>
            </p>
            <div className="flex justify-center gap-1.5 sm:gap-2">
              {otpCode.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="number"
                  value={digit}
                  onChange={(e) => handleOtpInput(e.target.value, i)}
                  className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-black rounded-xl bg-slate-100 border-none focus:ring-2 focus:ring-[#A155E5]"
                />
              ))}
            </div>
            <Button
              onClick={handleVerifyOtp}
              disabled={isLoading || otpCode.includes('')}
              className="w-full h-12 sm:h-14 bg-[#A155E5] text-white font-black text-base sm:text-lg rounded-2xl shadow-xl"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                'ACTIVATE MY STORE'
              )}
            </Button>

            <div className="mt-3 flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={!canResend || resendLoading}
                className="text-[10px] sm:text-xs font-bold text-slate-500 hover:text-slate-700 disabled:opacity-50"
              >
                {resendLoading
                  ? 'Sending...'
                  : canResend
                  ? "Didn't get the code? Resend"
                  : `Resend available in ${resendCountdown}s`}
              </button>

              <button
                onClick={() => setStep('signup')}
                className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest"
              >
                Wrong email? Go back
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
