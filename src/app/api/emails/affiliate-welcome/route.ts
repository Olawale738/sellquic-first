
import { NextResponse } from 'next/server';
import { sendAffiliateWelcomeEmail } from '@/lib/resend';

export async function POST(request: Request) {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set.');
    return NextResponse.json({ success: true, message: 'Email service not configured.' });
  }

  try {
    const { email, name } = await request.json();
    
    if (!email || !name) {
       return NextResponse.json({ success: false, message: 'Missing required email data.' }, { status: 400 });
    }

    await sendAffiliateWelcomeEmail({ to: email, name });

    return NextResponse.json({ success: true, message: 'Affiliate welcome email sent.' });
  } catch (error) {
    console.error('API Error sending affiliate welcome email:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to send welcome email', details: errorMessage }, { status: 500 });
  }
}
