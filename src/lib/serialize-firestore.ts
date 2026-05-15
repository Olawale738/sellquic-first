
import { Timestamp } from 'firebase-admin/firestore';

// Helper function to check if a value is a plain object
function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Recursively sanitizes data from Firestore by converting Timestamp objects to ISO strings.
 * This makes the data safe to pass from Server Components to Client Components.
 * @param data The data to sanitize (can be an object, array, or any other type).
 * @returns The sanitized data.
 */
export function sanitizeTimestamps<T>(data: T): T {
  if (!data) {
    return data;
  }

  if (Array.isArray(data)) {
    // If it's an array, sanitize each item
    return data.map(item => sanitizeTimestamps(item)) as any;
  }
  
  if (isObject(data)) {
    const newObj: { [key: string]: any } = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        if (value instanceof Timestamp) {
          // Convert Timestamp to a serializable ISO string
          newObj[key] = value.toDate().toISOString();
        } else {
          // Recursively sanitize nested objects or arrays
          newObj[key] = sanitizeTimestamps(value);
        }
      }
    }
    return newObj as T;
  }

  // Return primitives and other types as is
  return data;
}
