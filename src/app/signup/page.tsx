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
import { Loader2, Mail, Eye, EyeOff, ShieldCheck, ChevronRight } from 'lucide-react';
import { slugify, cn } from '@/lib/utils';
import { HomeHeader } from '@/components/landing/HomeHeader';
import { sendOtpAction, verifyOtpAction } from '@/lib/actions';
import { isValidPhoneNumber } from 'react-phone-number-input';
import PhoneField from '@/components/ui/PhoneInput';

// ── Business category definitions ───────────────────────────────────────────
const CATEGORIES = [
  { id: 'fashion',     emoji: '👗', label: 'Fashion & Clothing',    sub: 'Clothing, Shoes, Bags, Accessories' },
  { id: 'food',        emoji: '🍲', label: 'Food & Restaurant',     sub: 'Meals, Snacks, Drinks, Catering' },
  { id: 'beauty',      emoji: '💄', label: 'Beauty & Cosmetics',    sub: 'Skincare, Makeup, Haircare, Fragrance' },
  { id: 'electronics', emoji: '📱', label: 'Electronics & Tech',    sub: 'Phones, Gadgets, Accessories' },
  { id: 'furniture',   emoji: '🛋️', label: 'Furniture & Home',      sub: 'Living Room, Bedroom, Decor' },
  { id: 'groceries',   emoji: '🥦', label: 'Groceries & Produce',   sub: 'Fresh Food, Pantry, Drinks' },
  { id: 'services',    emoji: '📋', label: 'Services & Consulting', sub: 'Packages, Bookings, Consultations' },
  { id: 'general',     emoji: '🛍️', label: 'General Retail',        sub: 'Mixed products or other categories' },
];

// ── Category picker component ────────────────────────────────────────────────
function CategoryPicker({
  selected,
  onSelect,
  onContinue,
  isLoading,
  error,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onContinue: () => void;
  isLoading: boolean;
  error?: string;
}) {
  return (
    <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center">
        <h2 className="text-2xl font-black tracking-tight text-gray-900">What do you sell?</h2>
        <p className="text-sm text-slate-500 mt-1">Pick your business type — AI will build your store instantly.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={cn(
              'flex flex-col items-start p-4 rounded-2xl border-2 text-left transition-all',
              selected === cat.id
                ? 'border-[#A155E5] bg-purple-50 shadow-md'
                : 'border-slate-100 bg-white hover:border-purple-200 hover:shadow-sm'
            )}
          >
            <span className="text-2xl mb-2">{cat.emoji}</span>
            <span className="font-bold text-sm text-gray-900 leading-tight">{cat.label}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 leading-tight">{cat.sub}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
          {error}
        </div>
      )}

      <Button
        disabled={!selected || isLoading}
        onClick={onContinue}
        className="w-full h-12 bg-[#A155E5] hover:bg-black text-white font-black text-base rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2"
      >
        {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <>Continue <ChevronRight className="h-5 w-5" /></>}
      </Button>
    </div>
  );
}

// ── Main signup form ─────────────────────────────────────────────────────────
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
  const [businessCategory, setBusinessCategory] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [step, setStep] = useState<'signup' | 'category' | 'otp'>('signup');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [userId, setUserId] = useState('');
  const [hasAuthUser, setHasAuthUser] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [canResend, setCanResend] = useState(true);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const auth = getAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();

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

  useEffect(() => {
    if (!resendCountdown) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  // Step 1 — collect details, create Firebase auth user, advance to category
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidPhoneNumber(phone)) {
      toast({ title: 'Invalid Phone Number', description: 'Please enter a valid WhatsApp number.', variant: 'destructive' });
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
            const { user } = await signInWithEmailAndPassword(auth, formData.email, formData.password);
            uid = user.uid;
            setUserId(user.uid);   // ← was missing in this branch
            setHasAuthUser(true);
          } else {
            throw createError;
          }
        }
      }

      if (hasAuthUser && !uid) {
        const current = auth.currentUser;
        if (current) {
          uid = current.uid;
          setUserId(current.uid);
        } else {
          const { user } = await signInWithEmailAndPassword(auth, formData.email, formData.password);
          uid = user.uid;
          setUserId(user.uid);
        }
      }

      setStep('category');
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

  // Step 2 — category confirmed, send OTP
  const handleCategoryConfirm = async () => {
    if (!businessCategory) return;
    setCategoryError('');
    setIsLoading(true);
    try {
      if (!userId) throw new Error('Session lost — please refresh and try again.');
      const result = await sendOtpAction(userId, formData.email, `${formData.firstName} ${formData.lastName}`);
      if (!result.success) {
        const msg = result.message || 'Could not send verification code. Please try again.';
        setCategoryError(msg);
        toast({ title: 'Could not send code', description: msg, variant: 'destructive' });
        return;
      }
      setStep('otp');
      setCanResend(false);
      setResendCountdown(60);
      setTimeout(() => setCanResend(true), 60000);
    } catch (err: any) {
      const msg = err.message || 'Something went wrong. Please try again.';
      setCategoryError(msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpInput = (value: string, index: number) => {
    const newCode = [...otpCode];
    newCode[index] = value.slice(-1);
    setOtpCode(newCode);
    if (value && index < 5) document.getElementById(`otp-${index + 1}`)?.focus();
  };

  // Step 3 — verify OTP → store created + storefront auto-built
  const handleVerifyOtp = async () => {
    setIsLoading(true);
    try {
      const affiliateCode = formData.affiliateCode || localStorage.getItem('affiliateRef') || '';
      const chosenCategory = CATEGORIES.find((c) => c.id === businessCategory);

      const result = await verifyOtpAction({
        userId,
        otp: otpCode.join(''),
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        businessName: formData.businessName,
        phone,
        affiliateCode,
        businessCategory,
        subcategory: chosenCategory?.label || businessCategory,
      });

      if (result.success) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        localStorage.removeItem('affiliateRef');
        localStorage.setItem('newSignup', 'true');
        window.location.href = '/dashboard/subscription';
        return;
      }

      const msg = result.message || 'Verification failed. Please try again.';
      toast({ title: 'Verification Failed', description: msg, variant: 'destructive' });

      if (
        msg.toLowerCase().includes('business name already taken') ||
        msg.toLowerCase().includes('phone number already registered')
      ) {
        setStep('signup');
      }
    } catch (error: any) {
      toast({ title: 'Verification Failed', description: error.message || 'Something went wrong.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || !userId) return;
    setResendLoading(true);
    try {
      const result = await sendOtpAction(userId, formData.email, `${formData.firstName} ${formData.lastName}`);
      if (!result.success) {
        toast({ title: 'Could not resend code', description: result.message || 'Please try again later.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Code sent', description: 'We just sent you a new verification code.' });
      setCanResend(false);
      setResendCountdown(60);
      setTimeout(() => setCanResend(true), 60000);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to resend code.', variant: 'destructive' });
    } finally {
      setResendLoading(false);
    }
  };

  const storeUrlPreview = slugify(formData.businessName);

  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      <HomeHeader />
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 pt-24 sm:pt-28 md:pt-32">

        {/* ── Step 1: Account details ── */}
        {step === 'signup' && (
          <div className="w-full max-w-sm space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-purple-600 font-bold bg-purple-50 border border-purple-200 px-3 sm:px-4 py-2 rounded-full mb-4 sm:mb-6 text-sm">
                <ShieldCheck size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span>Trusted by 2k+ Sellers</span>
              </div>
            </div>
            <form
              onSubmit={handleSignup}
              className="space-y-3.5 sm:space-y-4 bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-100"
            >
              <div className="grid grid-cols-2 gap-4">
                <Input required placeholder="First Name" className="h-11 sm:h-12 rounded-xl bg-slate-50 border-none font-bold text-sm sm:text-base" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                <Input required placeholder="Last Name"  className="h-11 sm:h-12 rounded-xl bg-slate-50 border-none font-bold text-sm sm:text-base" value={formData.lastName}  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
              </div>

              <div>
                <Input required placeholder="Store Name" className="h-11 sm:h-12 rounded-xl bg-slate-50 border-none font-bold text-sm sm:text-base" value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} />
                {storeUrlPreview && (
                  <p className="text-[10px] text-slate-400 font-bold pl-2 mt-1 transition-opacity duration-300 animate-in fade-in">
                    Your URL: <span className="text-purple-600">{storeUrlPreview}.sellquic.com</span>
                  </p>
                )}
              </div>

              <div>
                <PhoneField value={phone} onChange={setPhone} />
                <p className="text-[10px] text-slate-400 font-bold pl-2 mt-1">Enter your WhatsApp number.</p>
              </div>

              <div>
                <Input required type="email" placeholder="Email address" className="h-11 sm:h-12 rounded-xl bg-slate-50 border-none font-bold text-sm sm:text-base" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                <p className="text-[10px] text-slate-400 font-bold pl-2 mt-1">We'll send a verification code to this email.</p>
              </div>

              <div className="relative">
                <Input required type={showPassword ? 'text' : 'password'} placeholder="Password" className="h-11 sm:h-12 rounded-xl bg-slate-50 border-none font-bold pr-12 text-sm sm:text-base" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 sm:right-4 top-3 sm:top-3 text-slate-400">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <Input placeholder="Have an Invite Code? (Optional)" className="h-11 sm:h-12 rounded-xl bg-purple-50/50 border-purple-100 placeholder:text-purple-300 font-bold text-sm sm:text-base text-purple-700 uppercase" value={formData.affiliateCode} onChange={(e) => setFormData({ ...formData, affiliateCode: e.target.value })} />
                <p className="text-[10px] text-slate-400 font-bold pl-2 mt-1">Enter your VIP code to unlock a 14-Day Free Trial.</p>
              </div>

              <Button disabled={isLoading} className="w-full h-12 sm:h-14 bg-[#A155E5] hover:bg-black text-white font-black text-base sm:text-lg rounded-2xl transition-all shadow-xl">
                {isLoading ? <Loader2 className="animate-spin" /> : 'NEXT — CHOOSE YOUR CATEGORY'}
              </Button>

              <p className="text-center text-xs sm:text-sm font-bold text-slate-400 pt-2">
                Already selling? <Link href="/login" className="text-[#A155E5] hover:underline">Login</Link>
              </p>
            </form>
          </div>
        )}

        {/* ── Step 2: Category picker ── */}
        {step === 'category' && (
          <CategoryPicker
            selected={businessCategory}
            onSelect={(id) => { setBusinessCategory(id); setCategoryError(''); }}
            onContinue={handleCategoryConfirm}
            isLoading={isLoading}
            error={categoryError}
          />
        )}

        {/* ── Step 3: OTP verification ── */}
        {step === 'otp' && (
          <div className="w-full max-w-sm space-y-6 sm:space-y-8 text-center animate-in zoom-in px-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#A155E5]/10 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 animate-bounce">
              <Mail className="w-8 h-8 sm:w-10 sm:h-10 text-[#A155E5]" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-[1000] italic tracking-tighter uppercase leading-none">Enter Code</h2>
            <p className="text-slate-500 text-xs sm:text-sm px-2">
              We sent a verification code to <b className="break-all">{formData.email}</b>
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

            {businessCategory && (
              <div className="bg-purple-50 border border-purple-100 rounded-2xl px-4 py-3 text-sm text-purple-700 font-medium">
                {CATEGORIES.find(c => c.id === businessCategory)?.emoji}{' '}
                Your <span className="font-black">{CATEGORIES.find(c => c.id === businessCategory)?.label}</span> store will be built automatically after verification.
              </div>
            )}

            <Button
              onClick={handleVerifyOtp}
              disabled={isLoading || otpCode.includes('')}
              className="w-full h-12 sm:h-14 bg-[#A155E5] text-white font-black text-base sm:text-lg rounded-2xl shadow-xl"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : 'ACTIVATE MY STORE'}
            </Button>

            <div className="mt-3 flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={!canResend || resendLoading}
                className="text-[10px] sm:text-xs font-bold text-slate-500 hover:text-slate-700 disabled:opacity-50"
              >
                {resendLoading ? 'Sending…' : canResend ? "Didn't get the code? Resend" : `Resend in ${resendCountdown}s`}
              </button>
              <button
                onClick={() => setStep('category')}
                className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest"
              >
                Change category
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
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <SignupForm />
    </Suspense>
  );
}
