import { NextResponse } from 'next/server';
import whoiser from 'whoiser';

export const dynamic = 'force-dynamic'; // Prevent caching results

function cleanDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, ''); // remove any path
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawDomain = searchParams.get('q');

  if (!rawDomain) {
    return NextResponse.json({ error: 'Domain required' }, { status: 400 });
  }

  const domain = cleanDomain(rawDomain);

  // Very basic format check (we only care for things like myshop.com)
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return NextResponse.json(
      { available: false, error: 'Invalid domain format.' },
      { status: 400 }
    );
  }

  try {
    // 1. Perform WHOIS lookup
    const whoisData = await whoiser(domain);

    const keys = Object.keys(whoisData || {});
    if (keys.length === 0) {
      console.warn(`[whois] Empty WHOIS response for ${domain}`);
      // Don't risk selling — treat as not available / unknown
      return NextResponse.json({
        domain,
        available: false,
        error: 'Could not verify domain availability. Please try again later.',
      });
    }

    // Some TLDs return multiple sections; we just pick the first for now
    const firstKey = keys[0];
    const data = whoisData[firstKey];

    const text = JSON.stringify(data || {}).toLowerCase();

    // 2. CHECK FOR BLOCKS / RATE LIMITS
    if (
      text.includes('limit exceeded') ||
      text.includes('quota exceeded') ||
      text.includes('try again later') ||
      text.includes('rate limit')
    ) {
      console.error(`[whois] Rate limit / busy for ${domain}`);
      return NextResponse.json({
        domain,
        available: false,
        error: 'WHOIS service is busy. Please try again in a few minutes.',
      });
    }

    // 3. CHECK IF TAKEN
    const isTaken =
      text.includes('domain name:') ||
      text.includes('registry domain id') ||
      text.includes('creation date:') ||
      text.includes('created:') ||
      text.includes('status: active') ||
      text.includes('status: ok') ||
      text.includes('updated date:');

    // 4. CHECK IF EXPLICITLY AVAILABLE
    const isExplicitlyAvailable =
      text.includes('no match') ||
      text.includes('not found') ||
      text.includes('no entries found') ||
      text.includes('no data found');

    // Final logic (safety first):
    // - If we clearly see "taken" signals  -> available = false
    // - Else if WHOIS clearly says "no match"/"not found" -> available = true
    // - Else (unknown / weird response) -> available = false + soft error
    if (isTaken) {
      return NextResponse.json({
        domain,
        available: false,
      });
    }

    if (isExplicitlyAvailable) {
      return NextResponse.json({
        domain,
        available: true,
      });
    }

    // Unknown case – do NOT risk selling it as free
    console.warn(`[whois] Unknown WHOIS result for ${domain}`);
    return NextResponse.json({
      domain,
      available: false,
      error: 'Could not confidently verify this domain. Please contact support.',
    });
  } catch (error) {
    console.error('Whois Error:', error);
    return NextResponse.json(
      { domain: rawDomain, available: false, error: 'Could not check domain' },
      { status: 500 }
    );
  }
}
