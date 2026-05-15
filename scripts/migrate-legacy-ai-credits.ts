import { config } from 'dotenv';
config({ path: '.env.local' });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountJson) {
  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON in .env.local');
}

let serviceAccount: any;

try {
  serviceAccount = JSON.parse(serviceAccountJson);
} catch {
  throw new Error('Could not parse FIREBASE_SERVICE_ACCOUNT_JSON. Check your env formatting.');
}

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function migrateAllLegacyAiCredits() {
  console.log('🔍 Searching for legacy ai_credits docs...');

  const legacySnap = await db.collectionGroup('ai_credits').get();

  if (legacySnap.empty) {
    console.log('✅ No legacy ai_credits docs found.');
    return;
  }

  console.log(`Found ${legacySnap.size} legacy ai_credits docs.`);

  let migrated = 0;
  let skipped = 0;

  for (const legacyDoc of legacySnap.docs) {
    const data = legacyDoc.data();

    const userRef = legacyDoc.ref.parent.parent;

    if (!userRef) {
      console.log(`Skipping ${legacyDoc.ref.path}: no parent user`);
      skipped++;
      continue;
    }

    const userId = userRef.id;
    const month = String(data.month || legacyDoc.id); // e.g. 2026-04
    const [year, monthNumber] = month.split('-').map(Number);

    if (!year || !monthNumber) {
      console.log(`Skipping invalid month for user ${userId}: ${month}`);
      skipped++;
      continue;
    }

    const periodStart = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(year, monthNumber, 1, 0, 0, 0));

    const periodRef = userRef
      .collection('ai_credit_periods')
      .doc(`migrated_${month}`);

    const existingPeriod = await periodRef.get();

    if (existingPeriod.exists) {
      console.log(`Skipping ${userId}/${month}: already migrated`);
      skipped++;
      continue;
    }

    await periodRef.set(
      {
        planId: data.planId || 'growth',
        billingCycle: 'monthly',
        status: 'active',
        periodStart: Timestamp.fromDate(periodStart),
        periodEnd: Timestamp.fromDate(periodEnd),
        totalCredits: Number(data.totalCredits || 0),
        usedCredits: Number(data.usedCredits || 0),
        remainingCredits: Number(data.remainingCredits || 0),
        source: 'migration_from_ai_credits',
        legacyMonth: month,
        legacyPath: legacyDoc.ref.path,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await userRef.set(
      {
        aiCredits: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    migrated++;

    console.log(
      `✅ Migrated ${userId}/${month}: ${Number(data.remainingCredits || 0)} remaining`
    );
  }

  console.log('--------------------------------');
  console.log(`✅ Migration complete`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped: ${skipped}`);
}

migrateAllLegacyAiCredits()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

  