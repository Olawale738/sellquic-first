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

export async function POST(request: Request) {
  try {
    const user = await verifySuperAdmin(request);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { name, subject, body } = await request.json();
    if (!name || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newTemplateRef = db.collection('email_templates').doc();
    await newTemplateRef.set({
      name,
      subject,
      body,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: newTemplateRef.id });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}





export async function PUT(request: Request) {
  try {
    const user = await verifySuperAdmin(request);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, name, subject, body } = await request.json();
    if (!id || !name || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await db.collection('email_templates').doc(id).update({
      name,
      subject,
      body,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export async function DELETE(request: Request) {
  try {
    const user = await verifySuperAdmin(request);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing template ID' }, { status: 400 });
    }

    await db.collection('email_templates').doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /templates]', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
