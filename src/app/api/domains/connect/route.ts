import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import dns from 'dns';
import { promisify } from 'util';
import { kv } from '@vercel/kv';

const resolveDns = promisify(dns.resolve4);
const resolveCname = promisify(dns.resolveCname);

export const dynamic = 'force-dynamic';

// Expected DNS values - Updated to new Vercel recommendations
const EXPECTED_A_RECORD_NEW = '216.150.1.1'; // New Vercel IP
const EXPECTED_A_RECORD_OLD = '76.76.21.21'; // Old IP (still supported)
const EXPECTED_CNAME = 'cname.vercel-dns.com';

export async function POST(request: Request) {
  try {
    // 1. Auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await authAdmin.verifyIdToken(idToken);
    const userId = decoded.uid;

    // 2. Input
    const { domain, storeId } = await request.json();
    if (!domain || !storeId) {
      return NextResponse.json({ error: 'Missing domain or storeId' }, { status: 400 });
    }

    // 3. Validate domain format
    const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}?$/;
    if (!domainRegex.test(domain)) {
      return NextResponse.json({ 
        error: 'Invalid domain format. Use format: yourbrand.com (no http://, https://, or www)',
        invalidDomain: true 
      }, { status: 400 });
    }

    // 4. Ownership check
    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    const storeData = storeSnap.data();
    const isOwner = storeData?.sellerId === userId;

    const requesterSnap = await db.collection('users').doc(userId).get();
    const isSuperAdmin = requesterSnap.exists && requesterSnap.data()?.role === 'superadmin';

    if (!isOwner && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to modify this store.' },
        { status: 403 },
      );
    }

    // 5. Clean domain
    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .toLowerCase();

    // 6. Prevent multiple stores reusing same domain
    const existingSnap = await db
      .collection('stores')
      .where('customDomain', '==', cleanDomain)
      .limit(1)
      .get();

    const existingPendingSnap = await db
      .collection('stores')
      .where('pendingDomain', '==', cleanDomain)
      .limit(1)
      .get();

    const existingDisconnectedSnap = await db
      .collection('stores')
      .where('disconnectedDomain', '==', cleanDomain)
      .limit(1)
      .get();

    const conflictDoc =
      existingSnap.docs[0] ||
      existingPendingSnap.docs[0] ||
      existingDisconnectedSnap.docs[0];

    if (conflictDoc && conflictDoc.id !== storeId) {
      return NextResponse.json(
        {
          error: 'This domain is already connected to another SellQuic store. Please disconnect it there first or use a different domain.',
          domainAlreadyExists: true
        },
        { status: 409 },
      );
    }

    // 7. NEW: Verify DNS records point to Vercel BEFORE trying to add to Vercel
    let aRecordValid = false;
    let cnameValid = false;

    try {
      // Check A record for root domain
      const aRecords = await resolveDns(cleanDomain);
      aRecordValid = aRecords.includes(EXPECTED_A_RECORD_NEW) || 
                     aRecords.includes(EXPECTED_A_RECORD_OLD); // Accept both new and old IPs
      
      console.log(`[DNS Check] A records for ${cleanDomain}:`, aRecords, '- Valid:', aRecordValid);
    } catch (error) {
      console.log(`[DNS Check] No A record found for ${cleanDomain}:`, error);
    }

    try {
      // Check CNAME for www subdomain
      const cnameRecords = await resolveCname(`www.${cleanDomain}`);
      cnameValid = cnameRecords.includes(EXPECTED_CNAME);
      
      console.log(`[DNS Check] CNAME records for www.${cleanDomain}:`, cnameRecords, '- Valid:', cnameValid);
    } catch (error) {
      console.log(`[DNS Check] No CNAME found for www.${cleanDomain}:`, error);
    }

    // If DNS is not configured correctly, return detailed error
    if (!aRecordValid || !cnameValid) {
      return NextResponse.json({ 
        error: `DNS records not configured correctly. Please add these records at your domain provider:

A Record:
  Type: A
  Name: @ (or root)
  Value: ${EXPECTED_A_RECORD_NEW} (or ${EXPECTED_A_RECORD_OLD})

CNAME Record:
  Type: CNAME
  Name: www
  Value: ${EXPECTED_CNAME}

Current Status:
  • A record (@): ${aRecordValid ? '✓ Valid' : '✗ Missing or incorrect'}
  • CNAME (www): ${cnameValid ? '✓ Valid' : '✗ Missing or incorrect'}

DNS updates can take 5-30 minutes to propagate. Please wait and try again.`,
        dnsNotReady: true 
      }, { status: 400 });
    }

    // 8. Env vars
    const PROJECT_ID = process.env.VERCEL_PROJECT_ID;
    const TEAM_ID = process.env.VERCEL_TEAM_ID;
    const AUTH_TOKEN = process.env.VERCEL_AUTH_TOKEN;

    if (!PROJECT_ID || !AUTH_TOKEN) {
      console.error('[domains/connect] Missing Vercel env vars');
      return NextResponse.json(
        { error: 'Server configuration error. Please try again later.' },
        { status: 500 },
      );
    }

    // 9. Try to attach domain to this Vercel project
    const vercelRes = await fetch(
      `https://api.vercel.com/v10/projects/${PROJECT_ID}/domains${TEAM_ID ? `?teamId=${TEAM_ID}` : ''}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: cleanDomain }),
      },
    );

    const vercelData = await vercelRes.json().catch(() => ({} as any));
    const code = vercelData?.error?.code;

    if (!vercelRes.ok) {
      // domain belongs to another account / project
      if (
        code === 'forbidden' ||
        code === 'forbidden_not_authorized' ||
        code === 'not_authorized'
      ) {
        console.error('[domains/connect] Vercel forbidden/not_authorized:', vercelData);
        return NextResponse.json(
          {
            error: 'This domain is already managed by another hosting account. Remove it there or use a different domain.',
            domainAlreadyExists: true
          },
          { status: 409 },
        );
      }

      // If Vercel says "domain_already_in_use", check if it's already on *this* project.
      if (code === 'domain_already_in_use') {
        try {
          const checkRes = await fetch(
            `https://api.vercel.com/v9/projects/${PROJECT_ID}/domains/${cleanDomain}${
              TEAM_ID ? `?teamId=${TEAM_ID}` : ''
            }`,
            {
              headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
            },
          );

          if (!checkRes.ok) {
            // Exists somewhere else, not on this project
            console.error('[domains/connect] domain_already_in_use but not on this project', await checkRes.json());
            return NextResponse.json(
              {
                error: 'This domain is already connected to a different Vercel project. Remove it there or use another domain.',
                domainAlreadyExists: true
              },
              { status: 409 },
            );
          }

          // If we reach here, it's already attached to this project – continue.
          console.log(`[domains/connect] Domain ${cleanDomain} already attached to project, linking store.`);
        } catch (err) {
          console.error('[domains/connect] Error checking existing domain:', err);
          return NextResponse.json(
            { error: 'Failed to verify existing domain configuration.' },
            { status: 400 },
          );
        }
      } 
      // Invalid domain from Vercel's perspective
      else if (code === 'invalid_domain') {
        return NextResponse.json({ 
          error: 'Vercel rejected this domain as invalid. Please check the domain name.',
          invalidDomain: true 
        }, { status: 400 });
      }
      else {
        console.error('[domains/connect] Vercel API error:', vercelData);
        return NextResponse.json(
          {
            error: vercelData?.error?.message || 'Failed to add domain to hosting. Please contact support.',
          },
          { status: 400 },
        );
      }
    }

    // 10. Also add www subdomain to Vercel
    await fetch(
      `https://api.vercel.com/v10/projects/${PROJECT_ID}/domains${TEAM_ID ? `?teamId=${TEAM_ID}` : ''}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: `www.${cleanDomain}` }),
      },
    ).catch(err => console.log('www subdomain may already exist:', err));

    // 11. Update Firestore – external domain, no expiry info
    await storeRef.update({
      customDomain: cleanDomain,
      customDomainStatus: 'active',
      pendingDomain: null,
      disconnectedDomain: null,
      domainProvider: 'external', // important for UI
      domainConnectedAt: new Date(),
      // do NOT set domainPurchasedAt / expiry here
      updatedAt: new Date(),
    });
    
    await kv.del(`store_context:${storeId}`).catch(() => {});

    console.log(`✅ Domain ${cleanDomain} successfully connected to store ${storeId}`);

    return NextResponse.json({ success: true, domain: cleanDomain });
  } catch (err: any) {
    console.error('Connect Domain Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
