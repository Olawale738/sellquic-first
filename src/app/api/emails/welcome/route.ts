
import { NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/resend';

export async function POST(request: Request) {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set. Welcome email will not be sent.');
    return NextResponse.json({ success: true, message: 'Email service not configured.' });
  }

  try {
    const { email, firstName } = await request.json();
    
    if (!email || !firstName) {
       return NextResponse.json({ success: false, message: 'Missing required email data.' }, { status: 400 });
    }

    await sendWelcomeEmail({ to: email, firstName });

    return NextResponse.json({ success: true, message: 'Welcome email sent successfully.' });
  } catch (error) {
    console.error('API Error sending welcome email:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to send welcome email', details: errorMessage }, { status: 500 });
  }
}
