
import { DocumentData } from 'firebase/firestore';

export interface ProductVariant extends DocumentData {
  id: string;
  name: string;
  price: number;
  stock: number;
  image?: string;
  moq?: number;
}

export interface Product extends DocumentData {
  id: string;
  name: string;
  slug: string;
  price: number;
  regularPrice?: number;
  stock: number;
  images: string[];
  description: string;
  category: string;
  sellerId: string;
  storeId: string;
  sellingStatus: 'none' | 'best-seller' | 'new-arrival';
  status?: 'draft' | 'published';
  hasVariants?: boolean;
  variants?: ProductVariant[];
  manageStock?: boolean;
  isOutOfStock?: boolean;
  isArchived?: boolean; // New field for plan limits
  videoUrl?: string; // Video URL from Cloudinary
  moq?: number;
}
