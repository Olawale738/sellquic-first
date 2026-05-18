import { Suspense } from 'react';
import { db } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import { sanitizeTimestamps } from '@/lib/serialize-firestore';
import StoreChatClient from './StoreChatClient';
import type { Metadata } from 'next';

/* ─────────────────────────── types ─────────────────────────── */

export interface StoreChatData {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  customDomain: string | null;
  logoUrl: string | null;
  brandColor: string | null;
  theme: 'classic' | 'modern' | 'minimal' | string;
  aiAssistant: Record<string, unknown> | null;
  aiV2?: {
    enabled?: boolean;
    channels?: {
      webchat?: boolean;
      whatsapp?: boolean;
      instagram?: boolean;
    };
  } | null;
}

interface PageProps {
  params: { storeId: string };
}

/* ─────────────────────────── data fetch ─────────────────────── */

async function getStoreDataForChat(identifier: string): Promise<StoreChatData | null> {
  try {
    const normalized = identifier.toLowerCase().trim();
    const storesRef = db.collection('stores');

    const storeQuery = normalized.includes('.')
      ? storesRef.where('customDomain', '==', normalized).limit(1)
      : storesRef.where('subdomain', '==', normalized).limit(1);

    const storeSnapshot = await storeQuery.get();

    if (storeSnapshot.empty) {
      console.error(`[Chat Page] No store found for identifier: ${normalized}`);
      return null;
    }

    const storeDoc  = storeSnapshot.docs[0];
    const storeData = storeDoc.data();

    // Fetch only the minimal data needed for the chat page context
    return sanitizeTimestamps({
      id:           storeDoc.id,
      name:         storeData.name,
      slug:         storeData.slug,
      subdomain:    storeData.subdomain,
      customDomain: storeData.customDomain  ?? null,
      logoUrl:      storeData.logoUrl       ?? null,
      brandColor:   storeData.brandColor    ?? null,
      theme:        storeData.theme         ?? 'classic',
      aiAssistant:  storeData.aiAssistant   ?? null,
      aiV2:         storeData.aiV2          ?? null,
    }) as StoreChatData;

  } catch (error) {
    console.error('[Chat Page] Error fetching store data:', error);
    return null;
  }
}

/* ─────────────────────── dynamic metadata ───────────────────── */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const store = await getStoreDataForChat(params.storeId);

  if (!store) {
    return {
      title: 'Chat | Store Not Found',
      description: 'This store could not be found.',
    };
  }

  const title       = `Chat with ${store.name}`;
  const description = `Ask ${store.name} anything — products, orders, availability and more.`;
  const ogImage     = store.logoUrl ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(ogImage && { images: [{ url: ogImage, width: 512, height: 512, alt: store.name }] }),
      type: 'website',
    },
    twitter: {
      card:        'summary',
      title,
      description,
      ...(ogImage && { images: [ogImage] }),
    },
    themeColor: store.brandColor ?? '#0C0C0C',
  };
}

/* ─────────────────────── loading skeleton ───────────────────── */

function ChatPageSkeleton() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');

        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.9; }
        }
        @keyframes skeleton-slide {
          from { transform: translateX(-100%); }
          to   { transform: translateX(100%); }
        }
        @keyframes skeleton-fade {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .sk-page {
          min-height: 100dvh;
          background: #0C0C0C;
          display: flex;
          flex-direction: column;
          font-family: 'DM Sans', system-ui, sans-serif;
          animation: skeleton-fade 0.35s ease both;
          position: relative;
          overflow: hidden;
        }

        /* Ambient orb */
        .sk-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          animation: skeleton-pulse 3s ease-in-out infinite;
        }
        .sk-orb-1 { width:420px; height:420px; top:-120px; left:-80px;  background:radial-gradient(circle, rgba(212,168,83,0.08) 0%, transparent 70%); }
        .sk-orb-2 { width:320px; height:320px; bottom:-80px; right:-60px; background:radial-gradient(circle, rgba(107,140,174,0.07) 0%, transparent 70%); animation-delay:1.4s; }

        /* Gold top bar */
        .sk-topbar {
          position: absolute;
          top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(212,168,83,0.5), transparent);
        }

        /* Header bar */
        .sk-header {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(20,20,20,0.8);
          backdrop-filter: blur(12px);
        }
        .sk-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: #1E1E1E;
          position: relative; overflow: hidden; flex-shrink: 0;
          animation: skeleton-pulse 1.8s ease-in-out infinite;
        }
        .sk-avatar::after {
          content:''; position:absolute; inset:0;
          background: linear-gradient(90deg, transparent 0%, rgba(212,168,83,0.15) 50%, transparent 100%);
          animation: skeleton-slide 1.8s ease infinite;
        }
        .sk-header-lines { display:flex; flex-direction:column; gap:6px; flex:1; }
        .sk-line {
          border-radius: 4px;
          background: #1E1E1E;
          position: relative; overflow: hidden;
          animation: skeleton-pulse 1.8s ease-in-out infinite;
        }
        .sk-line::after {
          content:''; position:absolute; inset:0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%);
          animation: skeleton-slide 1.8s ease infinite;
        }
        .sk-line-title  { height:14px; width:140px; }
        .sk-line-sub    { height:10px; width:90px;  animation-delay:0.2s; }

        /* Message area */
        .sk-messages {
          flex: 1;
          position: relative;
          z-index: 2;
          padding: 32px 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .sk-bubble {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .sk-bubble-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: #1A1A1A;
          flex-shrink: 0;
          animation: skeleton-pulse 1.8s ease-in-out infinite;
        }
        .sk-bubble-lines { display:flex; flex-direction:column; gap:8px; max-width:360px; }
        .sk-bubble-line {
          height: 12px; border-radius: 8px;
          background: #1A1A1A;
          position: relative; overflow: hidden;
          animation: skeleton-pulse 1.8s ease-in-out infinite;
        }
        .sk-bubble-line::after {
          content:''; position:absolute; inset:0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
          animation: skeleton-slide 1.8s ease infinite;
        }
        .sk-bubble.user {
          flex-direction: row-reverse;
          align-self: flex-end;
        }
        .sk-bubble.user .sk-bubble-lines { align-items: flex-end; }
        .sk-bubble.user .sk-bubble-line  { background: rgba(212,168,83,0.1); }
        .sk-bubble.user .sk-bubble-line::after {
          background: linear-gradient(90deg, transparent, rgba(212,168,83,0.08), transparent);
        }

        /* Input bar */
        .sk-inputbar {
          position: relative;
          z-index: 2;
          padding: 16px 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: rgba(14,14,14,0.9);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sk-input {
          flex: 1;
          height: 44px;
          border-radius: 12px;
          background: #181818;
          border: 1px solid rgba(255,255,255,0.06);
          position: relative; overflow: hidden;
          animation: skeleton-pulse 1.8s ease-in-out infinite;
        }
        .sk-input::after {
          content:''; position:absolute; inset:0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
          animation: skeleton-slide 1.8s ease infinite;
        }
        .sk-send-btn {
          width: 44px; height: 44px; border-radius: 12px;
          background: rgba(212,168,83,0.1);
          border: 1px solid rgba(212,168,83,0.2);
          flex-shrink: 0;
          animation: skeleton-pulse 1.8s ease-in-out infinite;
        }

        /* Status label */
        .sk-status {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          pointer-events: none;
        }
        .sk-status-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #D4A853;
          animation: skeleton-pulse 1.2s ease-in-out infinite;
        }
        .sk-status-text {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(212,168,83,0.5);
        }
      `}</style>

      <div className="sk-page">
        <div className="sk-orb sk-orb-1" />
        <div className="sk-orb sk-orb-2" />
        <div className="sk-topbar"        />

        {/* Header skeleton */}
        <div className="sk-header">
          <div className="sk-avatar" />
          <div className="sk-header-lines">
            <div className="sk-line sk-line-title" />
            <div className="sk-line sk-line-sub"   />
          </div>
        </div>

        {/* Messages skeleton */}
        <div className="sk-messages">
          {/* AI bubble 1 */}
          <div className="sk-bubble">
            <div className="sk-bubble-avatar" />
            <div className="sk-bubble-lines">
              <div className="sk-bubble-line" style={{ width: 220 }} />
              <div className="sk-bubble-line" style={{ width: 160 }} />
            </div>
          </div>
          {/* User bubble */}
          <div className="sk-bubble user">
            <div className="sk-bubble-avatar" />
            <div className="sk-bubble-lines">
              <div className="sk-bubble-line" style={{ width: 140 }} />
            </div>
          </div>
          {/* AI bubble 2 */}
          <div className="sk-bubble">
            <div className="sk-bubble-avatar" />
            <div className="sk-bubble-lines">
              <div className="sk-bubble-line" style={{ width: 260 }} />
              <div className="sk-bubble-line" style={{ width: 200 }} />
              <div className="sk-bubble-line" style={{ width: 120 }} />
            </div>
          </div>
        </div>

        {/* Centred loading label */}
        <div className="sk-status">
          <div className="sk-status-dot" />
          <span className="sk-status-text">Loading chat…</span>
        </div>

        {/* Input bar skeleton */}
        <div className="sk-inputbar">
          <div className="sk-input"    />
          <div className="sk-send-btn" />
        </div>
      </div>
    </>
  );
}

/* ──────────────────────────── page ─────────────────────────── */

export default async function StoreChatPage({ params }: PageProps) {
  const store = await getStoreDataForChat(params.storeId);

  if (!store) {
    return notFound();
  }

  return (
    <Suspense fallback={<ChatPageSkeleton />}>
      <StoreChatClient store={store} />
    </Suspense>
  );
}
