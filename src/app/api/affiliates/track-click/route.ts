import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const { referralCode } = await request.json();
    
    if (!referralCode) {
      return NextResponse.json({ success: false, message: 'No referral code provided' }, { status: 400 });
    }

    // ✅ UPDATED: Find user by referralCode in 'users' collection
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('referralCode', '==', referralCode).limit(1).get();
    
    if (snapshot.empty) {
      console.warn(`Affiliate click tracking: Invalid referral code '${referralCode}'`);
      return NextResponse.json({ success: false, message: 'Invalid referral code' });
    }

    const userDoc = snapshot.docs[0];

    // ✅ Increment click counter in user's document
    await userDoc.ref.update({
      clicks: FieldValue.increment(1),
      lastClickAt: FieldValue.serverTimestamp()
    });

    console.log(`✅ Click tracked for referral code: ${referralCode} (User: ${userDoc.id})`);
    return NextResponse.json({ success: true, message: 'Click tracked' });
    
  } catch (error: any) {
    console.error('❌ Error tracking click:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'An internal error occurred.' 
    }, { status: 500 });
  }
}