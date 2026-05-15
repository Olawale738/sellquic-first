'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuth, applyActionCode, verifyPasswordResetCode, confirmPasswordReset, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, writeBatch, serverTimestamp, collection } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, AlertCircle, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function ActionHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = getAuth();
  const db = useFirestore();
  const { toast } = useToast();

  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  const [state, setState] = useState<'loading' | 'reset_form' | 'success' | 'error'>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const finalizeStore = useCallback(async (user: User) => {
    if (!db) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists() && userSnap.data().status === 'pending_verification') {
        const data = userSnap.data();
        const batch = writeBatch(db);
        batch.update(userRef, { status: 'active', emailVerified: true, updatedAt: serverTimestamp() });
        const storeRef = doc(collection(db, 'stores'));
        batch.set(storeRef, {
          sellerId: user.uid,
          name: data.displayName,
          subdomain: data.businessNameSlug,
          createdAt: serverTimestamp(),
          status: 'active'
        });
        await batch.commit();
      }
      setInfoMessage("Store activated! Redirecting to your dashboard...");
      setState('success');
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (e) {
      setInfoMessage("Email verified! Log in to finish setup.");
      setState('success');
    }
  }, [db, router]);

  useEffect(() => {
    if (!mode || !oobCode || !db) return;

    const runAction = async () => {
      try {
        if (mode === 'verifyEmail') {
          await applyActionCode(auth, oobCode);
          onAuthStateChanged(auth, (user) => {
            if (user) finalizeStore(user);
            else {
              setInfoMessage("Email verified! You can now log in to SellQuic.");
              setState('success');
            }
          });
        } 
        else if (mode === 'resetPassword') {
          await verifyPasswordResetCode(auth, oobCode);
          setState('reset_form');
        } else if (mode === 'verifyAndChangeEmail') {
          await applyActionCode(auth, oobCode);
          
          const currentUser = auth.currentUser;
          if (currentUser && db) {
              const userRef = doc(db, 'users', currentUser.uid);
              const batch = writeBatch(db);
              batch.update(userRef, {
                  email: currentUser.email?.toLowerCase(),
                  updatedAt: serverTimestamp()
              });
              await batch.commit();
          }

          setInfoMessage("Your email address has been successfully updated in our system.");
          setState('success');
          setTimeout(() => router.push('/dashboard/profile'), 3000);
        }
      } catch (e: any) {
        setErrorMessage("This link is invalid or has expired.");
        setState('error');
      }
    };
    runAction();
  }, [mode, oobCode, auth, db, finalizeStore]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode!, newPassword);
      setInfoMessage("Password updated! Redirecting to login...");
      setState('success');
      setTimeout(() => router.push('/login'), 2000);
    } catch (e) {
      setErrorMessage("Failed to reset password.");
      setState('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto p-4 text-center">
      {state === 'loading' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="animate-spin text-[#A155E5]" size={48} />
          <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Verifying...</p>
        </div>
      )}

      {state === 'reset_form' && (
        <Card className="border-none shadow-2xl rounded-[2rem] p-6 text-left">
          <CardHeader className="text-center p-0 mb-6">
            <KeyRound className="text-[#A155E5] mx-auto mb-2" size={40} />
            <CardTitle className="text-2xl font-black italic">New Password</CardTitle>
          </CardHeader>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <Input type="password" required placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-12 rounded-xl bg-slate-50 border-none" />
            <Button disabled={submitting} className="w-full h-12 bg-[#A155E5] font-bold rounded-xl shadow-lg">
                {submitting ? "Processing..." : "Update Password"}
            </Button>
          </form>
        </Card>
      )}

      {state === 'success' && (
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-50 animate-in zoom-in">
          <CheckCircle className="text-green-500 mx-auto mb-6" size={64} />
          <h2 className="text-3xl font-[1000] italic tracking-tighter mb-2 uppercase">Verified!</h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">{infoMessage}</p>
          <Button onClick={() => router.push('/login')} className="w-full h-14 bg-[#A155E5] hover:bg-black text-white font-black text-lg rounded-2xl shadow-xl transition-all">
            GO TO DASHBOARD
          </Button>
        </div>
      )}

      {state === 'error' && (
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-red-50">
          <AlertCircle className="text-red-500 mx-auto mb-6" size={64} />
          <h2 className="text-2xl font-black mb-2 uppercase tracking-tighter">Link Invalid</h2>
          <p className="text-red-600 text-sm mb-8">{errorMessage}</p>
          <Button onClick={() => router.push('/login')} variant="outline" className="w-full h-12 rounded-xl font-bold">Back to Login</Button>
        </div>
      )}
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Suspense fallback={<Loader2 className="animate-spin text-[#A155E5]" size={48} />}>
        <ActionHandler />
      </Suspense>
    </div>
  );
}
