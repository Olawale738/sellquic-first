
'use client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getAuth, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut(getAuth());
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      router.push('/affiliates/login'); // Redirect to affiliate login page
    } catch (error: any) {
      toast({
        title: 'Logout Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* HEADER */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4">
            <Link href="/affiliates" className="flex items-center gap-2">
                <Image src="/logo.png" alt="SellQuic Logo" width={140} height={40} />
            </Link>

            <div className="flex items-center gap-4">
                {user ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="rounded-full">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'A'}</AvatarFallback>
                          </Avatar>
                          <span className="sr-only">Toggle user menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{user.displayName || user.email}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                           <Link href="/affiliates/dashboard">Dashboard</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>Profile</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <>
                        <Button asChild variant="ghost">
                            <Link href="/affiliate/login">Login</Link>
                        </Button>
                        <Button asChild>
                            <Link href="/affiliate/register">Join Program</Link>
                        </Button>
                    </>
                )}
            </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1">
        {children}
      </main>

      {/* FOOTER */}
      <footer className="py-6 text-center text-sm text-muted-foreground border-t bg-white">
        <p>© {new Date().getFullYear()} SellQuic. Affiliate Program Policy applies.</p>
      </footer>
    </div>
  );
}
