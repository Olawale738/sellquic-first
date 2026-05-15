'use client';

import {
  Loader2,
  ArrowLeft,
  Send,
  User,
  Bot,
  Sparkles,
  Star,
  RotateCcw,
  Paperclip,
  X,
  Image as ImageIcon,
  FileText,
  CheckCheck,
} from 'lucide-react';
import Link from 'next/link';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import {
  collection,
  query,
  onSnapshot,
  doc,
  orderBy,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getAuth } from 'firebase/auth';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  role: 'user' | 'model' | 'system' | 'vendor';
  content?: string;
  createdAt: Timestamp;
  imageUrl?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  type?: 'text' | 'image' | 'file';
}

export default function ConversationPage() {
  const { conversationId } = useParams();
  const { activeStore } = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const auth = getAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<any>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const conversationRef = useMemo(() => {
    if (!firestore || !activeStore?.id || !conversationId) return null;
    return doc(
      firestore,
      'stores',
      activeStore.id,
      'ai_conversations',
      conversationId as string
    );
  }, [activeStore?.id, firestore, conversationId]);

  const { data: conversationData } = useDoc(conversationRef);

  useEffect(() => {
    async function checkCustomer() {
      if (conversationData?.customerPhone && activeStore?.id) {
        try {
          const token = await auth.currentUser?.getIdToken();
          const res = await fetch(
            `/api/customers?storeId=${activeStore.id}&phone=${conversationData.customerPhone}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const data = await res.json();
          if (data && data.totalOrders > 0) setCustomerProfile(data);
          else setCustomerProfile(null);
        } catch {
          setCustomerProfile(null);
        }
      } else {
        setCustomerProfile(null);
      }
    }
    checkCustomer();
  }, [conversationData?.customerPhone, activeStore?.id, auth.currentUser]);

  useEffect(() => {
    if (!firestore || !activeStore?.id || !conversationId) {
      if (activeStore?.id) setLoading(false);
      return;
    }

    const messagesQuery = query(
      collection(
        firestore,
        'stores',
        activeStore.id,
        'ai_conversations',
        conversationId as string,
        'messages'
      ),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const msgs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Message)
        );
        setMessages(msgs);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching messages:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, activeStore?.id, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isHandover = conversationData?.handoverMode === true;

  const handleHandoverToggle = async (checked: boolean) => {
    if (!conversationRef) return;
    try {
      await updateDoc(conversationRef, { handoverMode: checked });
      toast({
        title: checked ? 'You have taken over' : 'AI is back in control',
        description: checked
          ? 'You are now replying directly to the customer.'
          : 'The AI will now handle replies automatically.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Could not change handover mode.',
        variant: 'destructive',
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    if (file && file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !auth.currentUser || !activeStore || !conversationId) {
      return;
    }

    setIsSending(true);

    try {
      const token = await auth.currentUser.getIdToken();
      const isWhatsApp = (conversationId as string).startsWith('wa_');

      let uploadedFileUrl: string | null = null;
      let uploadedFileName: string | null = null;
      let uploadedType: 'image' | 'file' | 'text' = 'text';

      if (selectedFile) {
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('storeId', activeStore.id);

        const uploadRes = await fetch('/api/uploads/chat-media', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error('Upload failed');
        }

        const uploadData = await uploadRes.json();
        uploadedFileUrl = uploadData.url;
        uploadedFileName = uploadData.fileName || selectedFile.name;
        uploadedType = selectedFile.type.startsWith('image/') ? 'image' : 'file';
      }

      const response = await fetch(
        isWhatsApp ? '/api/whatsapp/send-vendor-reply' : '/api/ai/vendor-reply',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: newMessage,
            storeId: activeStore.id,
            conversationId,
            type: uploadedType,
            imageUrl: uploadedType === 'image' ? uploadedFileUrl : null,
            fileUrl: uploadedType === 'file' ? uploadedFileUrl : null,
            fileName: uploadedFileName,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send message.');
      }

      setNewMessage('');
      clearSelectedFile();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not send reply. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setIsSending(false);
    }
  };

  const renderMessageBody = (
    msg: Message,
    opts: { isUser: boolean; isVendor: boolean; isModel: boolean }
  ) => {
    const { isUser, isVendor, isModel } = opts;

    return (
      <div className="relative flex w-full max-w-full min-w-0 flex-col">
        {msg.imageUrl && (
          <a
            href={msg.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="mb-1.5 block min-w-0 max-w-full"
          >
            <img
              src={msg.imageUrl}
              alt="Shared image"
              className="block w-full max-w-[240px] rounded-lg border border-black/5 object-cover sm:max-w-[260px] max-h-80"
            />
          </a>
        )}

        {msg.fileUrl && !msg.imageUrl && (
          <a
            href={msg.fileUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'mb-1.5 flex min-w-0 w-full max-w-[240px] items-center gap-3 overflow-hidden rounded-lg border px-3 py-2 sm:max-w-[260px]',
              isVendor
                ? 'border-green-300 bg-green-500/20 text-white'
                : isUser
                ? 'border-black/10 bg-black/5 text-foreground'
                : 'border-black/10 bg-white/40 text-foreground'
            )}
          >
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                isVendor ? 'bg-white/20' : 'bg-black/5'
              )}
            >
              <FileText className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {msg.fileName || 'Attachment'}
              </p>
              <p
                className={cn(
                  'truncate text-[11px]',
                  isVendor ? 'text-white/80' : 'text-muted-foreground'
                )}
              >
                Tap to open
              </p>
            </div>
          </a>
        )}

        {msg.content && (
          <div
            className="min-w-0 w-full text-left text-[14px] leading-[1.45] whitespace-pre-wrap break-words md:text-[15px]"
            style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
          >
            {msg.content}
          </div>
        )}

        {(isVendor || isModel || isUser) && msg.createdAt && (
          <div
            className={cn(
              'mt-1 flex shrink-0 select-none items-center justify-end gap-1 text-[10px]',
              isUser ? 'text-black/40' : isVendor ? 'text-white/70' : 'text-black/50'
            )}
          >
            <span>{format(msg.createdAt.toDate(), 'h:mm a')}</span>
            {(isVendor || isModel) && (
              <CheckCheck
                className={cn(
                  'h-[14px] w-[14px]',
                  isVendor ? 'text-[#4ade80]' : 'text-[#53bdeb]'
                )}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#efeae2]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] justify-center bg-[#e5ddd5]">
      <div className="flex h-full w-full max-w-6xl min-w-0 flex-col bg-[#efeae2] shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-[#f0f2f5] px-2.5 py-2 md:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              onClick={() => router.push('/dashboard/inbox')}
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full md:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-sm font-semibold text-muted-foreground">
              {conversationData?.customerName?.[0]?.toUpperCase?.() || 'C'}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-sm font-semibold md:text-base">
                  {conversationData?.customerName || 'Customer'}
                </h1>

                {isHandover ? (
                  <Badge className="shrink-0 gap-1 bg-green-600 text-white hover:bg-green-600">
                    <User className="h-3 w-3" /> Human mode
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="shrink-0 gap-1 border-primary/30 bg-primary/5 text-primary"
                  >
                    <Sparkles className="h-3 w-3" /> AI mode
                  </Badge>
                )}
              </div>

              <p className="truncate text-xs text-muted-foreground">
                {conversationData?.customerPhone ||
                  conversationData?.customerWhatsAppId ||
                  `${messages.length} messages`}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
                    {isHandover ? (
                      <User className="h-4 w-4 text-green-600" />
                    ) : (
                      <Bot className="h-4 w-4 text-primary" />
                    )}
                    <Switch checked={isHandover} onCheckedChange={handleHandoverToggle} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isHandover ? 'Hand back to AI' : 'Take over conversation'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Customer Banner */}
        {customerProfile && (
          <Link
            href={`/dashboard/customers?search=${customerProfile.phone}`}
            className={cn(
              'flex items-center gap-2 border-b px-4 py-2 text-sm font-medium transition-colors',
              customerProfile.segment === 'vip'
                ? 'border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100'
                : 'border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100'
            )}
          >
            {customerProfile.segment === 'vip' ? (
              <Star className="h-4 w-4 shrink-0 fill-current" />
            ) : (
              <RotateCcw className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate">
              {customerProfile.segment === 'vip' ? 'VIP Customer' : 'Returning Customer'} —{' '}
              {customerProfile.name} • {customerProfile.totalOrders} orders • GHS{' '}
              {customerProfile.totalSpent?.toLocaleString()}
            </span>
          </Link>
        )}

        {/* Messages */}
        <div
          className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto px-2 py-3 sm:px-3 md:px-4 md:py-5"
          style={{
            backgroundColor: '#efeae2',
            backgroundImage:
              'radial-gradient(rgba(0,0,0,0.03) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-1.5">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isVendor = msg.role === 'vendor';
              const isModel = msg.role === 'model';
              const isSystem = msg.role === 'system';

              const prevMsg = messages[index - 1];
              const showDate =
                !prevMsg ||
                (msg.createdAt &&
                  prevMsg.createdAt &&
                  format(msg.createdAt.toDate(), 'yyyy-MM-dd') !==
                    format(prevMsg.createdAt.toDate(), 'yyyy-MM-dd'));

              return (
                <React.Fragment key={msg.id}>
                  {showDate && msg.createdAt && (
                    <div className="flex justify-center py-2.5">
                      <span className="rounded-md border border-black/5 bg-white/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
                        {format(msg.createdAt.toDate(), 'MMM d, yyyy')}
                      </span>
                    </div>
                  )}

                  {isSystem ? (
                    <div className="flex justify-center py-1">
                      <span className="rounded-md bg-white/70 px-3 py-1 text-[11px] italic text-muted-foreground">
                        {msg.content}
                      </span>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'mb-1 flex w-full min-w-0',
                        isUser ? 'justify-start' : 'justify-end'
                      )}
                    >
                      <div
                        className={cn(
                          'flex min-w-0 max-w-[85%] flex-col overflow-hidden rounded-2xl px-3 py-2 shadow-sm sm:max-w-[75%] md:max-w-[65%]',
                          isUser
                            ? 'rounded-tl-sm border border-black/5 bg-white text-[#111111]'
                            : isVendor
                            ? 'rounded-tr-sm bg-[#005c4b] text-white'
                            : 'rounded-tr-sm border border-black/5 bg-[#dcf8c6] text-[#111111]'
                        )}
                      >
                        {!isUser && (
                          <span
                            className={cn(
                              'mb-0.5 select-none text-[11px] font-bold',
                              isVendor ? 'text-[#4ade80]' : 'text-[#075e54]'
                            )}
                          >
                            {isVendor ? 'You' : 'Assistant'}
                          </span>
                        )}

                        {renderMessageBody(msg, { isUser, isVendor, isModel })}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Footer / Composer */}
        <div className="border-t bg-[#f0f2f5] px-2 py-2 md:p-3">
          <div className="mx-auto max-w-3xl">
            {!isHandover ? (
              <div className="py-2 text-center">
                <p className="text-xs text-muted-foreground md:text-sm">
                  AI is handling this conversation.{' '}
                  <button
                    onClick={() => handleHandoverToggle(true)}
                    className="font-medium text-primary underline underline-offset-2 hover:no-underline"
                  >
                    Take over
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="space-y-2">
                {selectedFile && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white p-2 shadow-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="h-14 w-14 shrink-0 rounded-xl border border-black/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-muted">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 rounded-full"
                      onClick={clearSelectedFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    onChange={handleFileChange}
                    disabled={isSending || isUploading}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-full border border-black/10 bg-white md:h-11 md:w-11"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending || isUploading}
                  >
                    {selectedFile?.type?.startsWith('image/') ? (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Paperclip className="h-5 w-5 text-muted-foreground" />
                    )}
                  </Button>

                  <div className="min-w-0 flex-1 rounded-3xl border border-black/10 bg-white px-3 py-2 shadow-sm">
                    <Input
                      id="message"
                      placeholder="Type a message"
                      className="h-auto min-w-0 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                      autoComplete="off"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={isSending || isUploading}
                      autoFocus
                    />
                  </div>

                  <Button
                    type="submit"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-full bg-[#00a884] text-white hover:bg-[#019270] md:h-11 md:w-11"
                    disabled={
                      isSending ||
                      isUploading ||
                      (!newMessage.trim() && !selectedFile)
                    }
                  >
                    {isSending || isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span className="sr-only">Send</span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}