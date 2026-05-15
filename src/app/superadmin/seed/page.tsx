'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { seedPlatformSettings, type SeedResult } from '@/app/actions/admin'; // Import the type
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRequireSuperAdmin } from '@/hooks/use-auth';

export default function SeedDataPage() {
  useRequireSuperAdmin();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSeed = async () => {
    setIsLoading(true);
    try {
      // result is now typed as SeedResult
      const result: SeedResult = await seedPlatformSettings();
      
      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
      } else {
        // This will now work because result.message is guaranteed to exist
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to seed database.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-10">
      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle>Seed Platform Data</CardTitle>
          <CardDescription>
            This is a one-time action to initialize your platform's pricing and settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSeed} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Seed Pricing & Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}