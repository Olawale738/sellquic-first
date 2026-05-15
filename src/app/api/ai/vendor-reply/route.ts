'use server';

import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    // 1. Authenticate the vendor
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // 2. Validate input
    const {
      message,
      storeId,
      conversationId,
      imageUrl = null,
      fileUrl = null,
      fileName = null,
      type = 'text',
    } = await request.json();

    if ((!message?.trim() && !imageUrl && !fileUrl) || !storeId || !conversationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 3. Verify ownership
    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();

    if (!storeSnap.exists || storeSnap.data()?.sellerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const preview =
      type === 'image'
        ? (message?.trim() ? `📷 ${message.trim()}` : '📷 Image')
        : type === 'file'
        ? (fileName ? `📎 ${fileName}` : '📎 Attachment')
        : (message?.trim() || '');

    const batch = db.batch();

    // 4. Add vendor's message to the conversation subcollection
    const conversationRef = storeRef.collection('ai_conversations').doc(conversationId);
    const messagesRef = conversationRef.collection('messages');

    batch.set(messagesRef.doc(), {
      role: 'vendor',
      content: message?.trim() || '',
      type,
      imageUrl,
      fileUrl,
      fileName,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 5. Update the main conversation session
    batch.set(conversationRef, {
      status: 'active',
      lastMessagePreview: preview,
      lastActivityAt: FieldValue.serverTimestamp(),
      lastAssistantMessage: message?.trim() || '',
      lastAssistantMessageAt: FieldValue.serverTimestamp(),
      handoverMode: true,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // 6. Mirror update to inbox thread
    const inboxThreadRef = storeRef.collection('inboxThreads').doc(conversationId);
    batch.set(inboxThreadRef, {
      lastMessagePreview: preview,
      lastMessageAt: FieldValue.serverTimestamp(),
      status: 'open',
      unreadForVendor: false,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Vendor Reply API Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to send reply.', details: errorMessage },
      { status: 500 }
    );
  }
}