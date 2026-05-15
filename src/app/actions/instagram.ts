// src/app/actions/instagram.ts
'use server';

import { db } from '@/lib/firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue } from 'firebase-admin/firestore';
import { kv } from '@vercel/kv';
import { genAI } from '@/ai/genkit';
import { v2 as cloudinary } from 'cloudinary';

// ── Cloudinary Configuration ────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Helper: Upload Image to Firebase Storage ────────────────────────────────
async function uploadImageToFirebase(storeId: string, productId: string, imageUrl: string) {
  try {
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) throw new Error('Firebase Storage Bucket env var is missing');

    const bucket = getStorage().bucket(bucketName);
    const fileName = `products/${storeId}/${productId}_ig_${Date.now()}.jpg`;
    const file = bucket.file(fileName);

    // Fetch the image from Instagram's CDN
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to Firebase Storage
    await file.save(buffer, {
      contentType: 'image/jpeg',
      metadata: { cacheControl: 'public, max-age=31536000' }
    });

    // Return the permanent Firebase download URL
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(fileName)}?alt=media`;
  } catch (error) {
    console.error('[Firebase Upload Error]', error);
    return imageUrl; // Fallback to IG url if upload fails (rare)
  }
}

// ── Helper: Upload Video to Cloudinary ──────────────────────────────────────
async function uploadVideoToCloudinary(storeId: string, videoUrl: string) {
  try {
    // Cloudinary natively supports uploading directly from a remote URL!
    const result = await cloudinary.uploader.upload(videoUrl, {
      resource_type: 'video',
      folder: `sellquic/products/${storeId}`,
    });
    return result.secure_url; // Returns the permanent Cloudinary .mp4 URL
  } catch (error) {
    console.error('[Cloudinary Upload Error]', error);
    return videoUrl; // Fallback to IG url
  }
}

// ── 1. Fetch Instagram Posts ─────────────────────────────────────────────────
export async function getInstagramPosts(storeId: string) {
  try {
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new Error('Store not found');

    const storeData = storeSnap.data() || {};
    const igData = storeData.instagram || {};

    const isActive = igData.status === 'active' || igData.connected === true;
    if (!isActive || !igData.accessToken || !igData.accountId) {
      throw new Error('Instagram is not connected or missing tokens.');
    }

    const res = await fetch(
      `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=50&access_token=${igData.accessToken}`
    );

    if (!res.ok) throw new Error('Failed to fetch Instagram posts from Meta.');

    const data = await res.json();

    const posts = (data.data || []).map((post: any) => ({
      id: post.id,
      caption: post.caption || '',
      mediaType: post.media_type, 
      imageUrl: post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url,
      videoUrl: post.media_type === 'VIDEO' ? post.media_url : null,
      permalink: post.permalink,
      timestamp: post.timestamp,
    })).filter((post: any) => post.imageUrl); 

    return { success: true, posts };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── 2. AI Caption Extractor ──────────────────────────────────────────────────
export async function extractProductDetails(posts: Array<{ id: string; caption: string; imageUrl: string; mediaType: string; videoUrl?: string }>) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
      You are an expert Ghanaian e-commerce assistant.
      Extract details from these Instagram captions:
      1. "name": Short, clean product name (max 40 chars).
      2. "price": Number. Look for GHS, GH, cedis, ¢. If none, return 0.
      3. "description": Clean text, remove excessive hashtags.
      Return ONLY a JSON array of objects with keys: "id", "name", "price", "description".
      Input Data: ${JSON.stringify(posts.map(p => ({ id: p.id, caption: p.caption })))}
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    if (text.startsWith('```json')) text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const extractedData = JSON.parse(text);

    const stagedProducts = posts.map(post => {
      const aiData = extractedData.find((d: any) => d.id === post.id) || {};
      return {
        id: post.id,
        imageUrl: post.imageUrl,
        videoUrl: post.videoUrl || null,
        mediaType: post.mediaType,
        name: aiData.name || 'Instagram Product',
        price: Number(aiData.price) || 0,
        description: aiData.description || post.caption || '',
        hasVariants: false,
      };
    });

    return { success: true, stagedProducts };
  } catch (error) {
    return { success: false, error: 'Failed to extract AI details' };
  }
}

export async function importPostsAsProducts(
  storeId: string, 
  sellerId: string, 
  selectedPosts: Array<any>
) {
  try {
    const productsRef = db.collection('products');
    
    // 1. Silent AI Extraction with safety check
    let extractedData: any[] = [];
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt = `Extract from these captions: "name" (clean, max 40 chars), "price" (number), "description". Return raw JSON array. Input: ${JSON.stringify(selectedPosts.map(p => ({ id: p.id, caption: p.caption })))}`;
      
      const aiResult = await model.generateContent(prompt);
      let text = aiResult.response.text().trim();
      if (text.startsWith('```json')) text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      extractedData = JSON.parse(text);
      if (!Array.isArray(extractedData)) extractedData = [];
    } catch (e) {
      console.warn('[IG Import] AI Extraction failed, using defaults');
      extractedData = [];
    }

    const processProduct = async (post: any) => {
      if (!post) return null; // Safety check
      
      try {
        const aiInfo = extractedData.find((d: any) => d.id === post.id) || {};
        const newDocId = productsRef.doc().id;
        
        // 🚀 THE FIX: Force values to String before calling .toLowerCase()
        const rawName = String(aiInfo.name || 'New IG Product');
        const cleanName = rawName.substring(0, 40).trim();
        const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + newDocId.slice(0, 5);

        // 2. Permanent Uploads
        const permanentImageUrl = await uploadImageToFirebase(storeId, newDocId, post.imageUrl);
        let permanentVideoUrl = '';
        if (post.mediaType === 'VIDEO' && post.videoUrl) {
          permanentVideoUrl = await uploadVideoToCloudinary(storeId, post.videoUrl);
        }

        return {
          id: newDocId,
          name: cleanName,
          slug: slug,
          price: Number(aiInfo.price) || 0,
          stock: 1, 
          images: [permanentImageUrl], 
          videoUrl: permanentVideoUrl, 
          description: String(aiInfo.description || post.caption || 'Imported from Instagram'),
          category: 'Imported',
          sellerId,
          storeId,
          status: 'draft',
          sellingStatus: 'none',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
      } catch (err) { 
        console.error('[IG Import] Single item failure:', err);
        return null; 
      }
    };

    const successfulProducts: any[] = [];
    const chunkSize = 3;
    for (let i = 0; i < selectedPosts.length; i += chunkSize) {
      const chunk = selectedPosts.slice(i, i + chunkSize);
      const results = await Promise.all(chunk.map(processProduct));
      successfulProducts.push(...results.filter(Boolean));
    }

    if (successfulProducts.length === 0) throw new Error('No products were successfully processed.');

    const batch = db.batch();
    for (const prod of successfulProducts) {
      batch.set(productsRef.doc(prod.id), prod);
    }
    await batch.commit();
    await kv.del(`store_context:${storeId}`).catch(() => {});

    return { success: true };
  } catch (error: any) {
    console.error('[IG Import Master Error]:', error);
    return { success: false, error: error.message };
  }
}
