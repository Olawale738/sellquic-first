'use client';
import { Timestamp } from 'firebase/firestore';

// Corresponds to /stores/{storeId}/conversation_sessions/{sessionId}
export interface ConversationSession {
  id: string;
  storeId: string;
  sellerId: string;
  
  startedAt: Timestamp;
  lastActivityAt: Timestamp;
  
  channel: 'web_chat'; // Future: 'whatsapp', 'instagram'
  
  // User info
  customer?: {
      name?: string;
      phone?: string;
      email?: string;
  };
  
  // Session rollups
  messageCount: {
    user: number;
    model: number;
    system: number;
  };
  
  // Funnel state
  conversionStage: 'started' | 'browsing' | 'checkout_created' | 'paid';
  
  // Classification rollups
  questionCategoryCounts: Record<string, number>;
  objectionCounts: Record<string, number>;
  productInteractions: Record<string, {name: string, mentions: number, checkouts: number}>;
  sentimentCounts: {
    positive: number;
    neutral: number;
    negative: number;
  };

  // Outcome
  status: 'active' | 'needs_review' | 'resolved' | 'abandoned';
  handoverReason?: string; // e.g., 'complaint', 'ai_disabled', 'tool_failure'
  resolution?: 'sale' | 'no_sale' | 'support_provided';

  // Last message for inbox preview
  lastMessagePreview?: string;
  unreadForVendor?: boolean;
  
  // Schema versioning
  schemaVersion: number; 
}


// Corresponds to /stores/{storeId}/events/{eventId}
export interface CriticalEvent {
    id: string;
    storeId: string;
    conversationId: string;
    timestamp: Timestamp;
    
    type: 'checkout_created' | 'payment_completed' | 'payment_failed' | 'handover_triggered' | 'complaint_detected' | 'refund_request';
    
    // Contextual data
    payload: {
        checkoutId?: string;
        orderId?: string;
        amount?: number;
        reason?: string; // for handover
        messageSnippet?: string; // for complaints/refunds
        [key: string]: any;
    };
    
    // Schema versioning
    schemaVersion: number;
}

// Corresponds to /stores/{storeId}/reports/daily/{YYYY-MM-DD}
export interface DailyReport {
  handoverCount: number;
  date: string; // YYYY-MM-DD
  
  // Overview
  totalConversations: number;
  totalUsers: number; // Unique customers
  
  // Funnel
  conversionFunnel: {
    started: number;
    browsing: number;
    checkout_created: number;
    paid: number;
  };
  
  // Product Demand
  productInterest: {
    [productId: string]: {
      name: string;
      mentions: number;
      checkouts: number;
    }
  };

  // Questions & Objections
  questionCategories: Record<string, number>;
  objectionTypes: Record<string, number>;

  // Handover & Sentiment
  handoverRate: number; // As a percentage
  handoverReasons: Record<string, number>;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };

  schemaVersion: number;
}
