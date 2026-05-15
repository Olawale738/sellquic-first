'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Send, X, ShoppingCart, ImagePlus, CheckCheck, ArrowLeft, Phone } from 'lucide-react';
import { useStore } from '@/context/store-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getStoreBasePath } from '@/lib/url';
import Image from 'next/image';
import ProductCardsCarousel, { ProductBottomSheet } from '@/components/store/ProductCardsCarousel';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { usePathname } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckoutItemPreview = {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  quantity: number;
  lineTotal: number;
};

type CheckoutActionNew = {
  type: 'action';
  action: 'checkout';
  label: string;
  url: string;
  content?: string;
  items?: CheckoutItemPreview[];
  total?: number;
  currency?: string;
};

type ProductCard = {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  stock?: number | null;
  variants?: Array<{ id: string; name: string; price: number; stock: number | null }>;
};

interface Message {
  id: string;
  role: 'user' | 'model' | 'system' | 'vendor';
  content: string;
  timestamp?: Date;
  type?: 'text' | 'product_cards' | 'action';
  products?: ProductCard[];
  recommendations?: ProductCard[];
  recommendationNote?: string;
  action?: CheckoutActionNew;
  isStreaming?: boolean;
  imageUrl?: string;
  quickReplies?: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const CLOUDINARY_PRESET = 'sellquic_chat_images';

// ── WhatsApp Doodle SVG Background ────────────────────────────────────────────

const WA_BG_PATTERN = `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='p' width='100' height='100' patternUnits='userSpaceOnUse'%3E%3Cpath d='M10 10h4v4h-4z' fill='%23667788' opacity='0.06'/%3E%3Cpath d='M30 20h3v3h-3z' fill='%23667788' opacity='0.05'/%3E%3Cpath d='M60 10h4v4h-4z' fill='%23667788' opacity='0.06'/%3E%3Cpath d='M80 30h3v3h-3z' fill='%23667788' opacity='0.05'/%3E%3Cpath d='M20 50h4v4h-4z' fill='%23667788' opacity='0.06'/%3E%3Cpath d='M50 60h3v3h-3z' fill='%23667788' opacity='0.05'/%3E%3Cpath d='M70 70h4v4h-4z' fill='%23667788' opacity='0.06'/%3E%3Cpath d='M40 80h3v3h-3z' fill='%23667788' opacity='0.05'/%3E%3Ccircle cx='15' cy='35' r='1.5' fill='%23667788' opacity='0.05'/%3E%3Ccircle cx='85' cy='55' r='1.5' fill='%23667788' opacity='0.05'/%3E%3Ccircle cx='45' cy='15' r='1.5' fill='%23667788' opacity='0.05'/%3E%3Ccircle cx='75' cy='90' r='1.5' fill='%23667788' opacity='0.05'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='400' height='400' fill='%23ECE5DD'/%3E%3Crect width='400' height='400' fill='url(%23p)'/%3E%3C/svg%3E")`;

// ── Cloudinary upload ─────────────────────────────────────────────────────────

async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('folder', 'chat_images');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Image upload failed.');
  }

  const data = await res.json();
  const base = data.secure_url as string;
  return base.replace('/upload/', '/upload/q_auto,f_auto,w_1200,c_limit/');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCookieDomain(hostname: string): string {
  if (hostname === 'localhost' || hostname.startsWith('localhost:')) return 'localhost';
  const parts = hostname.split('.');
  if (parts.length >= 2) return '.' + parts.slice(-2).join('.');
  return hostname;
}

function buildCheckoutHref(basePath: string, checkoutUrl: string) {
  if (!checkoutUrl) return basePath || '/';

  const raw = String(checkoutUrl).trim();

  // Already absolute
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  // Handle malformed absolute URL like "https:/domain.com/..."
  if (/^https?:\/(?!\/)/i.test(raw)) {
    return raw.replace(/^https?:\/(?!\/)/i, (match) =>
      match.startsWith('https:') ? 'https://' : 'http://'
    );
  }

  const cleanPath = raw.startsWith('/') ? raw : `/${raw}`;

  if (basePath.startsWith('http://') || basePath.startsWith('https://')) {
    const cleanBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    return `${cleanBase}${cleanPath}`;
  }

  const cleanBase = basePath === '/' ? '' : basePath.replace(/\/$/, '');
  return `${cleanBase}${cleanPath}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// --- Skeleton Loader Component ---
const ChatSkeleton = () => (
  <div className="flex-1 p-3 space-y-4 animate-pulse">
    <div className="flex justify-start">
      <div className="h-10 w-48 max-w-[70%] rounded-lg rounded-tl-none bg-gray-200" />
    </div>
    <div className="flex justify-end">
      <div className="h-14 w-56 max-w-[80%] rounded-lg rounded-tr-none bg-green-200" />
    </div>
    <div className="flex justify-start">
      <div className="h-8 w-24 max-w-[50%] rounded-lg rounded-tl-none bg-gray-200" />
    </div>
    <div className="flex justify-end">
      <div className="h-10 w-40 max-w-[70%] rounded-lg rounded-tr-none bg-green-200" />
    </div>
    <div className="flex justify-start">
      <div className="h-12 w-32 max-w-[60%] rounded-lg rounded-tl-none bg-gray-200" />
    </div>
  </div>
);

// ── Main Wrapper Component ────────────────────────────────────────────────────
interface StoreAIWidgetProps {
  fullscreen?: boolean;
}

export function StoreAIWidget(props: StoreAIWidgetProps) {
  const pathname = usePathname();
  if (pathname?.includes('/chat') && !props.fullscreen) {
    return null;
  }
  return <StoreAIWidgetInner {...props} />;
}

// ── Inner Component logic ──────────────────────────────────────────────────────
function StoreAIWidgetInner({ fullscreen = false }: StoreAIWidgetProps) {
  const { store, isDemo } = useStore();
  const [isOpen, setIsOpen] = useState(fullscreen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<ProductCard | null>(null);

  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const firestore = getFirestore();
  const greetedRef = useRef(false);
  const isSendingRef = useRef(false);
  const pendingUserMessages = useRef<Map<string, Message>>(new Map());

  const conversationRef = useMemo(() => {
    if (!firestore || !store?.id || !conversationId) return null;
    return doc(firestore, 'stores', store.id, 'ai_conversations', conversationId);
  }, [firestore, store?.id, conversationId]);

  const { data: conversationData } = useDoc(conversationRef);
  const isHandover = conversationData?.handoverMode === true;

  const assistantName = store?.aiAssistant?.assistantName || 'Ama';
  const assistantLabel = store?.aiAssistant?.assistantLabel || 'Shop Assistant';

  const basePath = useMemo(() => {
    if (!store) return '/';
    if (isDemo) return `/demo/${store.slug}`;
    return getStoreBasePath(store.subdomain);
  }, [store, isDemo]);

  const useAiV2 =
  (store as any)?.aiV2?.enabled === true &&
  (store as any)?.aiV2?.channels?.webchat === true;

const aiEndpoint = useAiV2 ? '/api/ai-v2/chat' : '/api/ai/chat';

  useEffect(() => { if (fullscreen) setIsOpen(true); }, [fullscreen]);
  useEffect(() => { greetedRef.current = false; }, [conversationId]);
  useEffect(() => {
    return () => { if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview); };
  }, [pendingImagePreview]);

  // Conversation ID
  useEffect(() => {
    if (!store?.id) return;
    const storageKey = `ai_conv_id_${store.id}`;
    let convId = localStorage.getItem(storageKey);
    if (!convId) {
      convId = crypto.randomUUID();
      localStorage.setItem(storageKey, convId);
    }
    const hostname = window.location.hostname;
    const domain = getCookieDomain(hostname);
    const isSecure = hostname !== 'localhost' && !hostname.startsWith('localhost:');
    document.cookie = `ai_conv_id_${store.id}=${convId}; path=/; domain=${domain}; max-age=604800; SameSite=Lax${isSecure ? '; Secure' : ''}`;
    setConversationId(convId);
  }, [store?.id]);

  // Firestore listener
  useEffect(() => {
    if (!store?.id || !conversationId) return;

    const messagesRef = collection(firestore, 'stores', store.id, 'ai_conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        setIsLoading(false);
        if (snapshot.empty) {
          if (!greetedRef.current && store?.aiAssistant?.greetingTemplate) {
            const greeting = store.aiAssistant.greetingTemplate.replace('{{storeName}}', store.name);
            setMessages([{ id: 'system-greeting', role: 'system', content: greeting, timestamp: new Date() }]);
            greetedRef.current = true;
          }
          return;
        }

        const dbMsgs: Message[] = snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            role: data.role as Message['role'],
            content: data.content ?? '',
            type: data.type ?? 'text',
            products: data.products,
            recommendations: data.recommendations,
            recommendationNote: data.recommendationNote,
            action: data.actionData,
            imageUrl: data.imageUrl || undefined,
            timestamp: data.createdAt?.toDate?.() ?? new Date(),
            isStreaming: false,
            quickReplies: data.quickReplies,
          };
        });

        const dbIds = new Set(dbMsgs.map(m => m.id));
        pendingUserMessages.current.forEach((_, id) => {
          if (dbIds.has(id)) pendingUserMessages.current.delete(id);
        });
        const stillPending = Array.from(pendingUserMessages.current.values());
        setMessages([...dbMsgs, ...stillPending]);
      },
      (error) => {
        console.error('Firestore message listener error:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [store?.id, store?.name, store?.aiAssistant?.greetingTemplate, conversationId, firestore]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageError('Only JPEG, PNG, WebP, or HEIC images are allowed.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setImageError('Image must be under 5MB. Try a smaller photo 📸');
      e.target.value = '';
      return;
    }
    setPendingImage(file);
    setPendingImagePreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const clearPendingImage = () => {
    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    setPendingImage(null);
    setPendingImagePreview(null);
    setImageError(null);
  };

  const sendMessage = async (e: React.FormEvent, messageToSend?: string) => {
    e.preventDefault();
    const currentMessage = (messageToSend || input).trim();
    const hasImage = !!pendingImage;
    if ((!currentMessage && !hasImage) || isLoading || isSendingRef.current || !conversationId || !store?.id) return;

    isSendingRef.current = true;
    const clientMessageId = crypto.randomUUID();
    setInput('');
    setLastFailedMessage(null);
    setIsLoading(true);

    const optimisticMsg: Message = {
      id: clientMessageId,
      role: 'user',
      content: currentMessage,
      imageUrl: pendingImagePreview || undefined,
      timestamp: new Date(),
    };
    pendingUserMessages.current.set(clientMessageId, optimisticMsg);
    setMessages(prev => [...prev, optimisticMsg]);

    const imageFile = pendingImage;
    clearPendingImage();

    try {
      let uploadedImageUrl: string | undefined;
      if (imageFile) {
        setIsUploading(true);
        uploadedImageUrl = await uploadToCloudinary(imageFile);
        setIsUploading(false);
      }

      if (isHandover) {
        const messagesRef = collection(firestore, 'stores', store.id, 'ai_conversations', conversationId, 'messages');
        await setDoc(doc(messagesRef, clientMessageId), {
          role: 'user', content: currentMessage || '', imageUrl: uploadedImageUrl || null,
          createdAt: serverTimestamp(), type: 'text',
        });
        const inboxRef = doc(firestore, 'stores', store.id, 'inboxThreads', conversationId);
        await setDoc(inboxRef, {
          lastMessagePreview: currentMessage || '📷 Image', lastMessageAt: serverTimestamp(),
          unreadForVendor: true, status: 'open', storeId: store.id,
        }, { merge: true });
        pendingUserMessages.current.delete(clientMessageId);
        setIsLoading(false);
        return;
      }

      const response = await fetch(aiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentMessage || null,
          storeId: store.id,
          conversationId,
          clientMessageId,
          imageUrl: uploadedImageUrl || null,
          channel: 'webchat',
        })
      });

      if (!response.ok) throw new Error('Failed to get a response.');
      await response.json();
      pendingUserMessages.current.delete(clientMessageId);

    } catch (error: any) {
      console.error('Send error:', error);
      setIsUploading(false);
      pendingUserMessages.current.delete(clientMessageId);
      setLastFailedMessage(currentMessage || null);

      const errMsg = error.message?.toLowerCase().includes('upload')
        ? "Couldn't upload the image. Please try a smaller photo 📸"
        : "Sorry, I'm having trouble connecting. Please try again.";

      setMessages(prev => [
        ...prev.filter(m => m.id !== clientMessageId),
        { id: 'error-' + Date.now(), role: 'system', content: errMsg, timestamp: new Date() }
      ]);
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  };

  if (!store) {
    if (fullscreen) return <div className="bg-[#111B21] w-full h-[100dvh]" />;
    return null;
  }

  if (!store.aiAssistant?.enabled) {
    if (fullscreen) return (
      <div className="bg-[#111B21] flex items-center justify-center p-6 w-full h-[100dvh]">
        <p className="text-white/60 text-sm">Chat is currently disabled.</p>
      </div>
    );
    return null;
  }

  const canSend = (input.trim() || pendingImage) && !isLoading && !isUploading;

  const chatInterface = (
    <div className={cn(
      "relative overflow-hidden flex flex-col",
      fullscreen
        ? "w-full h-full"
        : "rounded-xl shadow-2xl h-[85vh] max-h-[calc(100vh-2rem)] sm:max-h-[700px]"
    )}
    style={{ background: '#ECE5DD' }}
    >
      <header className="flex items-center gap-3 px-3 py-3 flex-shrink-0"
        style={{ background: '#075E54', paddingTop: 'calc(env(safe-area-inset-top, 0) + 0.75rem)' }}>
        {!fullscreen && (
          <button onClick={() => setIsOpen(false)} className="text-white/90 hover:text-white p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <Avatar className="h-9 w-9 border-2 border-white/20">
          {store?.logoUrl && <AvatarImage src={store.logoUrl} alt={store.name} />}
          <AvatarFallback className="bg-[#25D366] text-white text-sm font-bold">
            {assistantName.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-[15px] leading-tight truncate">{store.name}</p>
          <p className="text-white/70 text-[12px] leading-tight">
            {isLoading ? 'typing...' : 'online'}
          </p>
        </div>
        {!fullscreen && (
          <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        )}
      </header>

      <div
        className="flex-1 min-h-0 px-2 py-2 space-y-1.5 overflow-y-auto"
        style={{ backgroundImage: WA_BG_PATTERN, backgroundSize: '400px 400px', overscrollBehavior: 'contain' }}
      >
        {isLoading && messages.length === 0 && <ChatSkeleton />}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';
          const isProductCards = msg.type === 'product_cards' && Array.isArray(msg.products) && msg.products.length > 0;
          const isCheckoutAction = msg.type === 'action' && msg.action?.action === 'checkout';
          const activeCheckoutUrl =
  useAiV2 && conversationData
    ? ((conversationData as any)?.lastCheckoutLink ||
       (conversationData as any)?.lastActionData?.url ||
       null)
    : null;

const isStaleCheckoutAction =
  useAiV2 &&
  isCheckoutAction &&
  (!activeCheckoutUrl || msg.action?.url !== activeCheckoutUrl);

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-1.5">
                <div className="bg-white/80 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-sm">
                  <p className="text-[11px] text-gray-600 text-center">{msg.content}</p>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className={cn('flex mb-1', isUser ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'relative max-w-[85%] rounded-lg px-2.5 py-1.5 shadow-sm',
                isUser ? 'bg-[#DCF8C6] rounded-tr-none' : 'bg-white rounded-tl-none'
              )}>
                <div className={cn(
                  'absolute top-0 w-3 h-3',
                  isUser ? '-right-1.5 border-t-[12px] border-l-[12px] border-t-[#DCF8C6] border-l-transparent' : '-left-1.5 border-t-[12px] border-r-[12px] border-t-white border-r-transparent'
                )} />

                {msg.imageUrl && (
                  <div className="mb-1.5 -mx-0.5 -mt-0.5 rounded-md overflow-hidden">
                    <Image src={msg.imageUrl} alt="Shared" width={260} height={180} className="object-cover w-full h-auto" />
                  </div>
                )}

                {isProductCards ? (
                  <div className="min-w-[240px]">
                    <ProductCardsCarousel
                      products={msg.products!}
                      message={msg.content}
                      recommendations={msg.recommendations}
                      recommendationNote={msg.recommendationNote}
                      onSelect={(product) => setActiveSheet(product)}
                    />
                  </div>
                ) : isCheckoutAction ? (
                  <div className="space-y-2 min-w-[220px]">
                    <p className="text-[14px] text-gray-900 leading-relaxed">{msg.content}</p>
                    {msg.action!.items && msg.action!.items.length > 0 && (
                      <div className="space-y-1.5 border-t border-gray-200/60 pt-2 mt-2">
                        {msg.action!.items.map((item) => (
                          <div key={item.productId} className="flex items-center gap-2">
                            {item.imageUrl && (
                              <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                                <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-medium truncate text-gray-800">{item.name}</p>
                              <p className="text-[10px] text-gray-500">x{item.quantity}</p>
                            </div>
                            <p className="text-[12px] font-bold text-gray-800 flex-shrink-0">GHS {item.lineTotal.toFixed(2)}</p>
                          </div>
                        ))}
                        {msg.action!.total && (
                          <div className="flex justify-between font-bold text-[13px] border-t border-gray-200/60 pt-1.5 mt-1 text-gray-900">
                            <span>Total</span>
                            <span>GHS {msg.action!.total.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {isStaleCheckoutAction ? (
  <div className="w-full mt-2 rounded-lg bg-gray-100 border border-gray-200 px-3 py-2 text-[12px] text-gray-600 text-center">
    This checkout link has been updated. Please use the latest checkout link below.
  </div>
) : (
  <Button
    asChild
    className="w-full mt-2 bg-[#25D366] hover:bg-[#1DA855] text-white font-medium rounded-lg h-9 text-[13px]"
    onClick={() => {
      if (!fullscreen) setIsOpen(false);
    }}
  >
    <Link
      href={buildCheckoutHref(basePath, msg.action!.url)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
      {msg.action!.label || 'Complete Order'}
    </Link>
  </Button>
)}
                  </div>
                ) : (
                  msg.content && <p className="text-[14px] text-gray-900 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}

                <div className={cn('flex items-center gap-1 mt-0.5', isUser ? 'justify-end' : 'justify-end')}>
                  {msg.timestamp && <span className="text-[10px] text-gray-500">{formatTime(new Date(msg.timestamp))}</span>}
                  {isUser && <CheckCheck className="h-3.5 w-3.5 text-[#53BDEB]" />}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && messages.length > 0 && (
          <div className="flex justify-start mb-1">
            <div className="relative bg-white rounded-lg rounded-tl-none px-4 py-2.5 shadow-sm">
              <div className="absolute top-0 -left-1.5 w-3 h-3 border-t-[12px] border-r-[12px] border-t-white border-r-transparent" />
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {activeSheet && (
        <ProductBottomSheet product={activeSheet} onClose={() => setActiveSheet(null)} onConfirm={(variantId, variantName, quantity) => {
            const qty = quantity || 1;
            const variantPart = variantName ? ` - ${variantName}` : '';
            const variantIdPart = variantId ? ` (variantId: ${variantId})` : '';
            const text = `I want ${qty} of ${activeSheet.name}${variantPart}${variantIdPart}`;
            setActiveSheet(null);
            sendMessage({ preventDefault: () => {} } as React.FormEvent, text);
          }}
        />
      )}

      <div className="flex-shrink-0" style={{ background: '#F0F0F0', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {imageError && (
          <div className="mx-3 mt-2 text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span>⚠️</span>
            <span className="flex-1">{imageError}</span>
            <button onClick={() => setImageError(null)}><X className="h-3 w-3" /></button>
          </div>
        )}
        {pendingImagePreview && (
          <div className="px-3 pt-2">
            <div className="relative inline-block">
              <Image src={pendingImagePreview} alt="Preview" width={64} height={64} className="rounded-lg object-cover border border-gray-300" style={{ width: 64, height: 64 }} />
              <button type="button" onClick={clearPendingImage} className="absolute -top-1.5 -right-1.5 bg-[#075E54] rounded-full p-0.5 shadow" aria-label="Remove">
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          </div>
        )}
        <div className="flex items-end gap-2 px-2 py-1.5">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={handleImageSelect} />
          <div className="flex-1 flex items-end bg-white rounded-2xl px-2 py-1 min-h-[44px] shadow-sm">
            <button type="button" onClick={() => { setImageError(null); fileInputRef.current?.click(); }} disabled={isLoading || isUploading} className="text-gray-500 hover:text-gray-700 p-1.5 flex-shrink-0 self-end mb-0.5">
              <ImagePlus className="h-5 w-5" />
            </button>
            <form onSubmit={sendMessage} className="flex-1 flex items-end">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-transparent border-0 outline-none placeholder:text-gray-400 px-2 py-1.5 resize-none"
                style={{ fontSize: '16px' }}
                disabled={isLoading || isUploading}
              />
            </form>
          </div>
          <button type="button" onClick={(e) => sendMessage(e)} disabled={!canSend}
            className={cn(
              'h-[44px] w-[44px] rounded-full flex items-center justify-center flex-shrink-0 transition-all shadow-sm',
              canSend ? 'bg-[#25D366] hover:bg-[#1DA855] text-white active:scale-95' : 'bg-gray-300 text-white/90 cursor-not-allowed'
            )}
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        {lastFailedMessage && (
          <div className="px-3 pb-2">
            <button onClick={(e) => sendMessage(e, lastFailedMessage)} className="w-full text-[12px] text-[#075E54] bg-white rounded-lg py-1.5 border border-[#25D366]/30 hover:bg-[#25D366]/5">
              ↻ Tap to retry
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="bg-[#111B21] flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="w-full sm:max-w-md overflow-hidden" style={{ height: '100dvh' }}>
          {chatInterface}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 1 }}
        >
          <button
            onClick={() => setIsOpen(true)}
            className="h-14 w-14 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            style={{ background: '#25D366' }}
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-white fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"/>
            </svg>
          </button>
        </motion.div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[60] w-[calc(100vw-2rem)] max-w-sm"
          >
            {chatInterface}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
