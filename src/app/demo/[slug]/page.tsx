
'use client';
import { StoreHero } from '@/components/store-hero';
import { StoreProductGrid } from '@/components/store-product-grid';
import { Button } from '@/components/ui/button';
import { useStore } from '@/context/store-context';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function DemoStoreHomePage() {
    const { store } = useStore();
    const router = useRouter();
    const { toast } = useToast();

    const handleGetStarted = async () => {
        if (!store?.id) return;
        try {
            await fetch('/api/demos/log-lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ demoId: store.id })
            });
        } catch(err) {
            console.error("Failed to log lead", err);
        }
        router.push('/signup');
    };

    return (
        <div>
            <div className="bg-yellow-100 text-yellow-800 text-center p-2 text-sm font-semibold">
                This is a demo store. To go live,{" "}
                <Button 
                    onClick={handleGetStarted}
                    variant="link" 
                    className="p-0 h-auto text-yellow-800 font-semibold"
                >
                    click here to sign up!
                </Button>
            </div>
            <StoreHero />
            <StoreProductGrid />
        </div>
    );
}
