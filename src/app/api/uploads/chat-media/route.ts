import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { v2 as cloudinary } from 'cloudinary';
import { db } from '@/lib/firebase-admin';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function verifyUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization token');
  }

  const token = authHeader.split('Bearer ')[1];
  const decoded = await getAuth().verifyIdToken(token);
  return decoded;
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUser(req);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const storeId = formData.get('storeId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!storeId) {
      return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });
    }

    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const storeData = storeSnap.data();
    if (storeData?.sellerId !== user.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const dataUri = `data:${file.type};base64,${buffer.toString('base64')}`;

    const resourceType = file.type.startsWith('image/') ? 'image' : 'raw';

    const uploaded = await cloudinary.uploader.upload(dataUri, {
      folder: `chat-media/${storeId}`,
      resource_type: resourceType,
      public_id: `${Date.now()}-${file.name.replace(/\.[^/.]+$/, '')}`,
    });

    return NextResponse.json({
      url: uploaded.secure_url,
      fileName: file.name,
      resourceType,
    });
  } catch (error: any) {
    console.error('chat-media upload error:', error);
    return NextResponse.json(
      { error: error?.message || 'Upload failed' },
      { status: 500 }
    );
  }
}