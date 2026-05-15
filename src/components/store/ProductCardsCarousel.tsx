'use client';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, X, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Variant = {
  id: string;
  name: string;
  price: number;
  stock: number | null;
};

type ProductCard = {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  stock?: number | null;
  variants?: Variant[];
};

interface Props {
  products: ProductCard[];
  message: string;
  recommendations?: ProductCard[];
  recommendationNote?: string;
  onSelect?: (product: ProductCard) => void;
}

const CARD_W = 140;
const GAP = 10;
const VISIBLE = 2;
const SCROLL_AMT = CARD_W + GAP;

export function ProductBottomSheet({
  product,
  onClose,
  onConfirm,
}: {
  product: ProductCard;
  onClose: () => void;
  onConfirm: (variantId?: string, variantName?: string, quantity?: number) => void;
}) {
  const hasVariants = product.variants && product.variants.length > 0;
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [quantity, setQuantity] = useState(1);

  const activePrice = selectedVariant ? selectedVariant.price : product.price;
  const activeStock = selectedVariant ? selectedVariant.stock : product.stock ?? null;
  const isOutOfStock = activeStock !== null && activeStock === 0;
  const maxQty = activeStock !== null ? Math.max(activeStock, 1) : 99;
  const canAdd = hasVariants ? selectedVariant !== null && !isOutOfStock : !isOutOfStock;

  return (
    <div className="absolute inset-0 z-[70] flex items-end justify-center overflow-hidden rounded-2xl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet — slides up from bottom */}
      <div className="relative w-full bg-white rounded-t-2xl shadow-2xl z-10"
        style={{ maxHeight: '85%', overflowY: 'auto' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pb-6 space-y-5">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 active:scale-95 transition-all"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Product info */}
          <div className="flex gap-4 pt-2">
            <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-gray-50 flex-shrink-0 shadow-sm">
              <Image
                src={product.imageUrl || '/placeholder.svg'}
                alt={product.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="font-bold text-gray-900 text-base leading-tight">{product.name}</p>
              <p className="text-2xl font-black text-primary mt-1">
                GHS {activePrice.toFixed(2)}
              </p>
              {activeStock !== null && activeStock > 0 && activeStock <= 3 && (
                <p className="text-xs text-orange-500 font-semibold mt-1">
                  Only {activeStock} left!
                </p>
              )}
            </div>
          </div>

          {/* Variants */}
          {hasVariants && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Choose option
              </p>
              <div className="flex flex-wrap gap-2">
                {product.variants!.map((v) => {
                  const outOfStock = v.stock !== null && v.stock === 0;
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        if (outOfStock) return;
                        setSelectedVariant(v);
                        setQuantity(1);
                      }}
                      className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all active:scale-95 ${
                        outOfStock
                          ? 'opacity-40 cursor-not-allowed border-gray-200 text-gray-400 line-through'
                          : isSelected
                          ? 'bg-primary border-primary text-white shadow-md'
                          : 'border-gray-200 text-gray-700 bg-white hover:border-primary/60'
                      }`}
                    >
                      {v.name}
                      {v.price !== product.price && !outOfStock && (
                        <span className={`ml-1.5 text-xs ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                          GHS {v.price}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Quantity
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center active:scale-90 transition-all disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5 text-gray-600" />
                </button>
                <span className="text-xl font-black w-8 text-center text-gray-900">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                  disabled={quantity >= maxQty}
                  className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center active:scale-90 transition-all disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5 text-gray-600" />
                </button>
              </div>
              <span className="text-base font-bold text-gray-500">
                GHS {(activePrice * quantity).toFixed(2)}
              </span>
            </div>
          </div>

          <button
            disabled={!canAdd}
            onClick={() => {
              if (!canAdd) return;
              onConfirm(selectedVariant?.id, selectedVariant?.name, quantity);
            }}
            className={`w-full h-14 rounded-2xl font-bold text-base transition-all active:scale-[0.98] ${
              !canAdd ? 'cursor-not-allowed' : ''
            }`}
            style={{
              backgroundColor: canAdd ? 'hsl(var(--primary))' : '#f3f4f6',
              color: canAdd ? 'hsl(var(--primary-foreground))' : '#9ca3af',
              boxShadow: canAdd ? '0 4px 14px hsl(var(--primary) / 0.3)' : 'none',
            }}
          >
            {isOutOfStock
              ? 'Out of Stock'
              : hasVariants && !selectedVariant
              ? 'Select an option above'
              : `Add to Order — GHS ${(activePrice * quantity).toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductCardsCarousel({
  products,
  message,
  recommendations,
  recommendationNote,
  onSelect,
}: Props) {
  const mainRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<HTMLDivElement>(null);
  const [mainIndex, setMainIndex] = useState(0);
  const [recIndex, setRecIndex] = useState(0);

  const scroll = (
    ref: React.RefObject<HTMLDivElement>,
    dir: 'left' | 'right',
    index: number,
    setIndex: (n: number) => void,
    total: number
  ) => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir === 'left' ? -SCROLL_AMT : SCROLL_AMT, behavior: 'smooth' });
    setIndex(dir === 'left' ? Math.max(0, index - 1) : Math.min(total - 1, index + 1));
  };

  const handleCardTap = (p: ProductCard) => {
    if (p.stock === 0) return;
    onSelect?.(p);
  };

  const hasRecs = Array.isArray(recommendations) && recommendations.length > 0;
  const containerW = CARD_W * VISIBLE + GAP * (VISIBLE - 1);

  return (
    <div className="space-y-3 w-full">
      <p className="text-sm leading-relaxed">{message}</p>

      {/* Main Products */}
      <div className="relative" style={{ width: containerW + 32 }}>
        {mainIndex > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); scroll(mainRef, 'left', mainIndex, setMainIndex, products.length); }}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-20 bg-white border border-gray-200 shadow-md rounded-full w-7 h-7 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
        )}

        <div className="overflow-hidden rounded-xl mx-4" style={{ width: containerW }}>
          <div
            ref={mainRef}
            className="flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain"
            style={{ gap: GAP, scrollbarWidth: 'none', msOverflowStyle: 'none', touchAction: 'pan-x' }}
          >
            {products.map((p) => (
              <div
                key={p.productId}
                onClick={() => handleCardTap(p)}
                className={`snap-start flex-shrink-0 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden transition-all ${
                  p.stock !== 0
                    ? 'cursor-pointer active:scale-95 hover:border-primary/40 hover:shadow-md'
                    : 'opacity-60 cursor-not-allowed'
                }`}
                style={{ width: CARD_W, minWidth: CARD_W }}
              >
                <div className="relative bg-gray-50" style={{ height: 110 }}>
                  <Image
                    src={p.imageUrl || '/placeholder.svg'}
                    alt={p.name}
                    fill
                    className="object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                  />
                  {p.stock !== null && p.stock !== undefined && p.stock === 0 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-white text-[10px] font-medium bg-black/60 px-2 py-0.5 rounded-full">Out of stock</span>
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-800 truncate leading-tight">{p.name}</p>
                  <p className="text-sm font-bold text-primary mt-0.5">GHS {Number(p.price || 0).toFixed(2)}</p>
                  {p.variants && p.variants.length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{p.variants.length} options</p>
                  )}
                  {p.stock !== null && p.stock !== undefined && p.stock > 0 && !p.variants?.length && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{p.stock} in stock</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {mainIndex < products.length - VISIBLE && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); scroll(mainRef, 'right', mainIndex, setMainIndex, products.length); }}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-20 bg-white border border-gray-200 shadow-md rounded-full w-7 h-7 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* Dots */}
      {products.length > VISIBLE && (
        <div className="flex justify-center gap-1">
          {Array.from({ length: products.length - VISIBLE + 1 }).map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${i === mainIndex ? 'w-4 bg-primary' : 'w-1.5 bg-gray-200'}`}
            />
          ))}
        </div>
      )}

      {/* Recommendations */}
      {hasRecs && (
        <div className="rounded-xl border border-primary/10 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-semibold text-primary">{recommendationNote || 'You might also love these ✨'}</p>
          </div>

          <div className="relative" style={{ width: containerW + 32 }}>
            {recIndex > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); scroll(recRef, 'left', recIndex, setRecIndex, recommendations!.length); }}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-20 bg-white border border-gray-200 shadow-md rounded-full w-6 h-6 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
              >
                <ChevronLeft className="h-3 w-3 text-gray-600" />
              </button>
            )}

            <div className="overflow-hidden rounded-lg mx-4" style={{ width: containerW }}>
              <div
                ref={recRef}
                className="flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain"
                style={{ gap: GAP, scrollbarWidth: 'none', msOverflowStyle: 'none', touchAction: 'pan-x' }}
              >
                {recommendations!.map((p) => (
                  <div
                    key={p.productId}
                    onClick={() => handleCardTap(p)}
                    className={`snap-start flex-shrink-0 rounded-lg bg-white border border-gray-100 overflow-hidden shadow-sm transition-all ${onSelect ? 'cursor-pointer active:scale-95 hover:border-primary/40 hover:shadow-md' : ''}`}
                    style={{ width: CARD_W, minWidth: CARD_W }}
                  >
                    <div className="relative bg-gray-50" style={{ height: 80 }}>
                      <Image
                        src={p.imageUrl || '/placeholder.svg'}
                        alt={p.name}
                        fill
                        className="object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                      />
                    </div>
                    <div className="p-1.5">
                      <p className="text-[10px] font-medium text-gray-700 truncate">{p.name}</p>
                      <p className="text-xs font-bold text-primary">GHS {Number(p.price || 0).toFixed(2)}</p>
                      {p.variants && p.variants.length > 0 && (
                        <p className="text-[10px] text-gray-400">{p.variants.length} options</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {recIndex < recommendations!.length - VISIBLE && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); scroll(recRef, 'right', recIndex, setRecIndex, recommendations!.length); }}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-20 bg-white border border-gray-200 shadow-md rounded-full w-6 h-6 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
              >
                <ChevronRight className="h-3 w-3 text-gray-600" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
