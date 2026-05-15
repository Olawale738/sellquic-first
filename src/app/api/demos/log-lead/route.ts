
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const { demoId } = await request.json();

    if (!demoId) {
      return NextResponse.json({ error: 'Missing demoId' }, { status: 400 });
    }

    const demoRef = db.collection('demo_stores').doc(demoId);
    
    await demoRef.update({
      leads: FieldValue.arrayUnion({
        timestamp: FieldValue.serverTimestamp(),
        userAgent: request.headers.get('user-agent') || '',
      })
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Error logging lead:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
