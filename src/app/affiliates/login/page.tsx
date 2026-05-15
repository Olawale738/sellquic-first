
'use client';

import { useState, useEffect } from 'react';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function AffiliateLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const auth = getAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useAuth();

  useEffect(() => {
    // Redirect if user is already logged in
    if (!isUserLoading && user) {
        if(user.role === 'affiliate') {
            router.push('/affiliates/dashboard');
        } else {
            router.push('/dashboard');
        }
    }
  }, [user, isUserLoading, router]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: 'Login Successful',
        description: "Welcome back! Redirecting you now...",
      });
      // The useEffect will handle the redirect
    } catch (error: any) {
      let description = 'An unexpected error occurred. Please try again.';
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          description = 'Invalid email or password. Please check your credentials and try again.';
          break;
        case 'auth/too-many-requests':
          description = 'Access to this account has been temporarily disabled due to many failed login attempts. You can reset your password to restore it or try again later.';
          break;
      }
      toast({
        title: 'Login Failed',
        description: description,
        variant: 'destructive',
      });
       setIsLoading(false);
    }
  };
  
  const handlePasswordReset = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!resetEmail) {
          toast({ title: 'Please enter your email address.', variant: 'destructive'});
          return;
      }
      setIsResetting(true);
      try {
          await sendPasswordResetEmail(auth, resetEmail);
          toast({
              title: 'Password Reset Email Sent',
              description: 'Please check your inbox for instructions to reset your password.',
          });
          setIsDialogOpen(false);
          setResetEmail('');
      } catch (error: any) {
           toast({
                title: 'Reset Failed',
                description: error.message,
                variant: 'destructive',
            });
      } finally {
          setIsResetting(false);
      }
  }

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <CardTitle className="text-2xl">Affiliate Login</CardTitle>
            <CardDescription>Enter your email to login to your dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
               <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                   <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                         <Button variant="link" className="ml-auto inline-block text-sm underline px-0 h-auto">
                           Forgot your password?
                         </Button>
                      </DialogTrigger>
                       <DialogContent className="sm:max-w-[425px]">
                            <form onSubmit={handlePasswordReset}>
                                <DialogHeader>
                                <DialogTitle>Reset Password</DialogTitle>
                                <DialogDescription>
                                    Enter your email address and we'll send you a link to reset your password.
                                </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="reset-email" className="text-right">
                                    Email
                                    </Label>
                                    <Input
                                        id="reset-email"
                                        type="email"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        className="col-span-3"
                                        placeholder="you@example.com"
                                        disabled={isResetting}
                                    />
                                </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="secondary" disabled={isResetting}>
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={isResetting}>
                                        {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Send Reset Email
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pr-10"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:bg-transparent"
                    onClick={() => setShowPassword(prev => !prev)}
                >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an affiliate account?{' '}
            <Link href="/affiliates/register" className="underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
