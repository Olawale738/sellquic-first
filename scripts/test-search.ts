// scripts/test-search.ts
import { searchProductsWithFirestoreFallback } from '../src/ai-v2/search/firestoreProductSearchProvider';
import type { ProductV2 } from '../src/ai-v2/types';

// Tiny synthetic catalog covering the test cases. Replace with real
// snapshots from Firestore once you want to test against production data.
const catalog: ProductV2[] = [
  {
    id: 'red-wedding-dress',
    name: 'Red Lace Wedding Gown',
    category: 'Dresses',
    description: 'Elegant red lace gown perfect for weddings and graduations.',
    tags: ['red', 'wedding', 'graduation', 'elegant', 'lace'],
    images: ['x'], status: 'published',
    isArchived: false, isOutOfStock: false, manageStock: false, hasVariants: false,
    price: 800, stock: 5,
  } as any,
  {
    id: 'blue-casual-dress',
    name: 'Blue Casual Day Dress',
    category: 'Dresses',
    description: 'Lightweight blue dress for everyday wear.',
    tags: ['blue', 'casual', 'everyday'],
    images: ['x'], status: 'published',
    isArchived: false, isOutOfStock: false, manageStock: false, hasVariants: false,
    price: 250, stock: 10,
  } as any,
  {
    id: 'straight-black-dress',
    name: 'Straight-Cut Black Dress',
    category: 'Dresses',
    description: 'A straight silhouette black dress, suitable for office and formal events.',
    tags: ['black', 'straight', 'formal', 'office'],
    images: ['x'], status: 'published',
    isArchived: false, isOutOfStock: false, manageStock: false, hasVariants: false,
    price: 350, stock: 8,
  } as any,
  {
    id: 'white-shirt-formal',
    name: 'Classic White Formal Shirt',
    category: 'Shirts',
    description: 'A crisp white shirt suitable for church, office, and formal events.',
    tags: ['white', 'formal', 'church', 'sunday', 'office'],
    images: ['x'], status: 'published',
    isArchived: false, isOutOfStock: false, manageStock: false, hasVariants: false,
    price: 180, stock: 20,
  } as any,
  {
    id: 'red-handbag',
    name: 'Red Leather Handbag',
    category: 'Bags',
    description: 'A red leather handbag, ideal for graduations, weddings, and formal events.',
    tags: ['red', 'handbag', 'graduation', 'wedding', 'leather'],
    images: ['x'], status: 'published',
    isArchived: false, isOutOfStock: false, manageStock: false, hasVariants: false,
    price: 250, stock: 4,
  } as any,
  {
    id: 'office-laptop',
    name: 'HP ProBook Business Laptop',
    category: 'Laptops',
    description: 'Reliable laptop for office work, business, and student use.',
    tags: ['laptop', 'business', 'office', 'student'],
    images: ['x'], status: 'published',
    isArchived: false, isOutOfStock: false, manageStock: false, hasVariants: false,
    price: 6500, stock: 3,
  } as any,
  {
    id: 'acne-cream',
    name: 'Clarifying Acne Treatment Cream',
    category: 'Skincare',
    description: 'Targets acne-prone skin, helps reduce dark spots and pigmentation.',
    tags: ['acne', 'skincare', 'spots'],
    images: ['x'], status: 'published',
    isArchived: false, isOutOfStock: false, manageStock: false, hasVariants: false,
    price: 95, stock: 15,
  } as any,
  {
    id: 'body-lotion',
    name: 'Cocoa Body Lotion',
    category: 'Skincare',
    description: 'Daily moisturizing body lotion with cocoa butter.',
    tags: ['body', 'lotion', 'moisturizing'],
    images: ['x'], status: 'published',
    isArchived: false, isOutOfStock: false, manageStock: false, hasVariants: false,
    price: 60, stock: 30,
  } as any,
  {
    id: 'graduation-wig',
    name: 'Long Curly Wig - Natural Black',
    category: 'Wigs',
    description: 'Long curly natural black wig, suitable for graduations and weddings.',
    tags: ['wig', 'graduation', 'wedding', 'long', 'curly'],
    images: ['x'], status: 'published',
    isArchived: false, isOutOfStock: false, manageStock: false, hasVariants: false,
    price: 450, stock: 6,
  } as any,
  {
    id: 'boys-set-black',
    name: "Boys' Casual Pocket Top & Shorts Set (Black)",
    category: 'Boys',
    description: 'Casual two-piece outfit set for boys.',
    tags: ['boys', 'casual', 'set', 'black'],
    images: ['x'], status: 'published',
    isArchived: false, isOutOfStock: false, manageStock: true, hasVariants: true,
    price: 250, stock: 0,
    variants: [
      { id: 'black', name: 'Boys Set Black', price: 250, stock: 20 },
      { id: 'green', name: 'Boys Set Green', price: 250, stock: 0 },
    ],
  } as any,
  {
    id: 'jumbo-shito',
    name: "Akwasi's Shito Supreme",
    category: 'Sauces',
    description: 'Spicy Ghanaian shito.',
    tags: ['shito', 'spicy'],
    images: ['x'], status: 'published',
    isArchived: false, isOutOfStock: false, manageStock: false, hasVariants: true,
    price: 200, stock: 999,
    variants: [
      { id: 'small', name: 'Small', price: 50, stock: 10 },
      { id: 'jumbo', name: 'Jumbo', price: 220, stock: 5 },
    ],
  } as any,
  {
    id: 'medical-scale',
    name: 'SECA Scales 874, 896, 813',
    category: 'Medicals',
    description:
      'Seca scales are high-precision medical-grade weighing devices for hospitals and clinics. Used for monitoring patient weight, body fat, muscle mass, body composition, body water, BMI, pediatric monitoring, newborn growth, baby weight, nutritional status, clinical needs, mother-and-child function, EMR-validated wireless data transfer, body fat mass.',
    tags: [],
    images: ['x'], status: 'published',
    isArchived: false, isOutOfStock: false, manageStock: true, hasVariants: false,
    price: 5600, stock: 20,
  } as any,
];

const queries = [
  'red dress for wedding',
  'blue dress',
  'shirt for sunday service',
  'straight dress',
  'red handbag for graduation',
  'laptop for office',
  'acne product',
  'body lotion',
  'wig for graduation',
  'black set',
  'jumbo size',
];

(async () => {
  for (const q of queries) {
    const result = await searchProductsWithFirestoreFallback({
      query: q,
      products: catalog,
      storeId: 'test',
      limit: 6,
    });

    console.log(`\nQUERY: "${q}"`);
    console.log(`  status: ${result.status}  conf: ${result.confidence.toFixed(2)}  reason: ${result.reason}`);
    console.log(`  top:    ${result.products.slice(0, 3).map(p => p.name).join(' | ')}`);
    if (result.debug?.scores?.length) {
      console.log(`  scores:`);
      for (const s of result.debug.scores.slice(0, 3)) {
        console.log(`    - ${s.score.toFixed(2)}  ${s.name}  (${s.reason})`);
      }
    }
  }
})();