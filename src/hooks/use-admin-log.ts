'use client';

import { useCallback } from 'react';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';

export type AdminActionType =
  | 'vendor.suspend'
  | 'vendor.activate'
  | 'vendor.delete'
  | 'vendor.plan_change'
  | 'vendor.impersonate'
  | 'vendor.subdomain_change'
  | 'domain.approve'
  | 'domain.reject'
  | 'coupon.create'
  | 'coupon.delete'
  | 'announcement.create'
  | 'announcement.delete'
  | 'subscription.manual_upgrade'
  | 'subscription.downgrade';

export interface AdminLogEntry {
  action: AdminActionType;
  targetId?: string;          // vendorId, domainId, etc.
  targetName?: string;        // human-readable name
  targetEmail?: string;
  details?: string;           // free-form note
  before?: Record<string, any>;  // previous state
  after?: Record<string, any>;   // new state
}

export function useAdminLog() {
  const { user } = useAuth();

  const log = useCallback(async (entry: AdminLogEntry) => {
    if (!user) return;

    try {
      const firestore = getFirestore();
      await addDoc(collection(firestore, 'admin_logs'), {
        ...entry,
        adminId: user.uid,
        adminEmail: user.email || '',
        adminName: user.displayName || user.email || 'Admin',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      // Logging should never break the UI — fail silently
      console.warn('[AdminLog] Failed to write log:', err);
    }
  }, [user]);

  return { log };
}
