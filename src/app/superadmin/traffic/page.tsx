
'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { AreaChart, Area, CartesianGrid, XAxis, Tooltip } from 'recharts';
import { TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { getAuth } from 'firebase/auth';

const chartConfig = {
  visits: {
    label: 'Visits',
    color: 'hsl(var(--primary))',
  },
};

export default function TrafficPage() {
  useRequireSuperAdmin();
  const searchParams = useSearchParams();
  const initialToday = Number(searchParams.get('today')) || 0;

  const [stats, setStats] = useState<any>({ today: initialToday, week: 0, month: 0, chartData: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const auth = getAuth();
            const idToken = await auth.currentUser?.getIdToken();

            const res = await fetch('/api/superadmin/traffic', {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.details || 'Failed to fetch traffic data.');
            }
            const data = await res.json();
            setStats(data);
        } catch (err: any) {
            console.error("Traffic page error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
       {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Database Query Error</AlertTitle>
                <AlertDescription>
                    {error} This might be because a database index is required. Please check your browser's developer console for a link from Firebase to create the necessary index automatically. This is a one-time setup.
                </AlertDescription>
            </Alert>
        )}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Visits</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.today ?? 0}</div>
            <p className="text-xs text-muted-foreground">Total store visits today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
             <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.week ?? 0}</div>
             <p className="text-xs text-muted-foreground">Total visits this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
             <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.month ?? 0}</div>
            <p className="text-xs text-muted-foreground">Total visits this month</p>
          </CardContent>
        </Card>
      </div>
      
       <Card>
          <CardHeader>
            <CardTitle>Visits - Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {loading && !stats?.chartData?.length ? (
                <div className="flex h-[350px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <AreaChart data={stats?.chartData || []} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    />
                    <Tooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                    />
                    <Area
                    dataKey="visits"
                    type="natural"
                    fill="var(--color-visits)"
                    fillOpacity={0.4}
                    stroke="var(--color-visits)"
                    />
                </AreaChart>
                </ChartContainer>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
