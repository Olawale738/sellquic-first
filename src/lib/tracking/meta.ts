'use client';

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

export function trackMetaEvent(
  eventName: string,
  params?: Record<string, any>,
  eventId?: string
) {
  if (typeof window === 'undefined') return;
  if (!window.fbq) return;

  const cleanParams = params || {};

  if (eventId) {
    window.fbq('track', eventName, cleanParams, { eventID: eventId });
  } else {
    window.fbq('track', eventName, cleanParams);
  }
}

export function generateMetaEventId(prefix: string, id?: string) {
  return `${prefix}_${id || crypto.randomUUID()}_${Date.now()}`;
}