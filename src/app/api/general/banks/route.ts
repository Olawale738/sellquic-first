import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return NextResponse.json({ error: 'Config Error' }, { status: 500 });

    // Fetch Ghana Banks from Paystack
    const response = await fetch('https://api.paystack.co/bank?country=ghana', {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
      next: { revalidate: 86400 } // Cache for 24 hours to be fast
    });

    if (!response.ok) {
      throw new Error('Failed to fetch banks');
    }

    const data = await response.json();
    
    // Sort banks alphabetically
    const banks = data.data.sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json(banks);
  } catch (error) {
    console.error('Bank Fetch Error:', error);
    return NextResponse.json([], { status: 500 });
  }
}