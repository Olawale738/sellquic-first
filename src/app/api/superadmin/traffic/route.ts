
import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { startOfDay, startOfWeek, startOfMonth, subDays, format } from 'date-fns';

export async function GET(request: Request) {
    try {
        const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
        if (!idToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();

        if (!userDoc.exists || userDoc.data()?.role !== 'superadmin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const visitsRef = db.collectionGroup('visits');
        
        const now = new Date();
        const todayStart = startOfDay(now);
        const weekStart = startOfWeek(now);
        const monthStart = startOfMonth(now);
        const last30Days = subDays(now, 30);

        const [todaySnap, weekSnap, monthSnap, chartSnap] = await Promise.all([
            visitsRef.where('timestamp', '>=', todayStart).count().get(),
            visitsRef.where('timestamp', '>=', weekStart).count().get(),
            visitsRef.where('timestamp', '>=', monthStart).count().get(),
            visitsRef.where('timestamp', '>=', last30Days).orderBy('timestamp', 'asc').get()
        ]);

        const chartDataMap: Record<string, number> = {};
        chartSnap.forEach(doc => {
            const date = doc.data().timestamp.toDate();
            const key = format(date, 'MMM dd');
            chartDataMap[key] = (chartDataMap[key] || 0) + 1;
        });

        const chartData = [];
        for (let i = 29; i >= 0; i--) {
            const d = subDays(now, i);
            const k = format(d, 'MMM dd');
            chartData.push({ name: k, visits: chartDataMap[k] || 0 });
        }

        return NextResponse.json({
            today: todaySnap.data().count,
            week: weekSnap.data().count,
            month: monthSnap.data().count,
            chartData
        });

    } catch (error: any) {
        console.error("Error fetching traffic data:", error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
