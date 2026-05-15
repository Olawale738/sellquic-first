
import { NextResponse } from 'next/server';
import { sendSms } from '@/lib/mnotify';
import { authAdmin } from '@/lib/firebase-admin';


export async function POST(request: Request) {
  try {
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!idToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const user = await authAdmin.getUser(decodedToken.uid);
    const isSuperAdmin = user.customClaims?.superadmin === true;

    if (!isSuperAdmin) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { to, message } = await request.json();

    if (!to || !message) {
      return NextResponse.json({ error: 'Missing "to" or "message" field' }, { status: 400 });
    }

    const smsResponse = await sendSms(to, message);

    return NextResponse.json({ success: true, ...smsResponse }, { status: 200 });
  } catch (error) {
    console.error('API Error sending SMS:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to send SMS', details: errorMessage }, { status: 500 });
  }
}
