import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const formData = await request.formData();
  
  const from = formData.get('From') as string;
  const body = formData.get('Body') as string;
  const to = formData.get('To') as string;

  console.log('📩 Incoming SMS:');
  console.log('From:', from);
  console.log('To:', to);
  console.log('Body:', body);

  // Extract 6-digit code if present
  const codeMatch = body?.match(/\b(\d{6})\b/);
  if (codeMatch) {
    console.log('🔑 OTP Code:', codeMatch[1]);
  }

  // Twilio expects TwiML response
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  );
}