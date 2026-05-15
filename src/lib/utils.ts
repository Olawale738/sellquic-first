
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { cva } from "class-variance-authority";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(str: string) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove special chars
    .replace(/\s+/g, '-')     // spaces → dashes
    .replace(/--+/g, '-');    // collapse multiple dashes
}

/**
 * Formats a phone number to E.164 international format without the '+'.
 * robustly handling Ghana specific edge cases.
 */
export function formatPhoneNumberForApi(phoneNumber: string): string {
    if (!phoneNumber) return '';

    // 1. Remove ALL non-digit characters (spaces, dashes, +, parentheses)
    let cleaned = phoneNumber.replace(/\D/g, '');

    // 2. FIX: Handle the "2330..." error (User typed +233 050...)
    // This was the specific cause of your previous failure
    if (cleaned.startsWith('2330')) {
        return '233' + cleaned.substring(4);
    }

    // 3. Handle Standard Local Format (User typed 050...)
    if (cleaned.startsWith('0')) {
        return '233' + cleaned.substring(1);
    }

    // 4. Handle Short Format (User typed 50...)
    // If it's exactly 9 digits, assume it's a Ghana number missing the prefix
    if (cleaned.length === 9) {
        return '233' + cleaned;
    }

    // 5. Return clean number (Assumes it's already 23350...)
    return cleaned;
}

export function generateEventId(orderId: string) {
  return `purchase_${orderId}`;
}

export { cva };
