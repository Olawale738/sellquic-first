import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

async function verifySuperAdmin(request: Request) {
  const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
  if (!idToken) return null;
  const decoded = await authAdmin.verifyIdToken(idToken);
  const userDoc = await db.collection('users').doc(decoded.uid).get();
  if (userDoc.data()?.role !== 'superadmin') return null;
  return decoded;
}

// POST — create automation
export async function POST(request: Request) {
  try {
    const user = await verifySuperAdmin(request);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { name, trigger, delayDays, templateId } = await request.json();
    if (!name || !trigger || delayDays === undefined || !templateId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate template exists
    const templateDoc = await db.collection('email_templates').doc(templateId).get();
    if (!templateDoc.exists) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const ref = db.collection('email_automations').doc();
    await ref.set({
      name,
      trigger,
      delayDays: parseInt(delayDays),
      templateId,
      isActive: true,
      sentCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: ref.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — delete automation
export async function DELETE(request: Request) {
  try {
    const user = await verifySuperAdmin(request);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await db.collection('email_automations').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
