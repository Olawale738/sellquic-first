
import { NextRequest, NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

async function requireSuperAdmin(request: NextRequest) {
  const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
  if (!idToken) throw new Error('Unauthorized');

  const decodedToken = await authAdmin.verifyIdToken(idToken);
  const userDoc = await db.collection('users').doc(decodedToken.uid).get();

  if (userDoc.data()?.role !== 'superadmin') throw new Error('Forbidden');
  return decodedToken.uid;
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const snap = await db.collection('admin_whatsapp_templates').orderBy('createdAt', 'desc').get();
    const templates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json(templates);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminId = await requireSuperAdmin(request);
    const body = await request.json();

    const { name, language, category, variableCount, variableLabels, status, description } = body;

    if (!name || !language || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const ref = db.collection('admin_whatsapp_templates').doc();
    await ref.set({
      name,
      language,
      category,
      variableCount: Number(variableCount || 0),
      variableLabels: variableLabels || [],
      status: status || 'pending',
      description: description || null,
      createdBy: adminId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: ref.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
