
'use client';

import { useState, useEffect, createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { Product, ProductVariant } from '@/types/product';
import { useStore } from '@/context/store-context';
import { AiCheckoutItem } from '@/lib/ai-checkout';
import { useToast } from './use-toast';

export interface CartItem extends Product {
  quantity: number;
  selectedVariant?: ProductVariant;
}

interface CartContextType {
  cart: CartItem[];
  addItem: (item: Product, quantity: number, selectedVariant?: ProductVariant) => void;
  addItems: (items: AiCheckoutItem[]) => Promise<{ added: number }>;
  removeItem: (itemId: string, variantId?: string) => void;
  updateQuantity: (itemId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  total: number;
  cartCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { store } = useStore();
  const [cart, setCart] = useState<CartItem[]>([]);
  const { toast } = useToast();
  
  const cartStorageKey = useMemo(() => store ? `cart_${store.id}` : null, [store]);

  // Load cart from localStorage when store context is available
  useEffect(() => {
    if (cartStorageKey) {
      try {
        const storedCart = localStorage.getItem(cartStorageKey);
        if (storedCart) {
          setCart(JSON.parse(storedCart));
        } else {
          setCart([]); // Ensure cart is empty if nothing is stored
        }
      } catch (error) {
        console.error("Failed to parse cart from localStorage", error);
        setCart([]);
      }
    }
  }, [cartStorageKey]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (cartStorageKey) {
       try {
        if (cart.length > 0) {
            localStorage.setItem(cartStorageKey, JSON.stringify(cart));
        } else {
            localStorage.removeItem(cartStorageKey);
        }
       } catch (error) {
        console.error("Failed to save cart to localStorage", error);
       }
    }
  }, [cart, cartStorageKey]);

  const addItem = useCallback((item: Product, quantity: number, selectedVariant?: ProductVariant) => {
    const moq = selectedVariant?.moq || item.moq || 1;
    if (quantity < moq) {
      toast({
        title: "Minimum Order Quantity",
        description: `You need to order at least ${moq} of this item.`,
        variant: "destructive",
      });
      return;
    }

    setCart(prevCart => {
      const existingItemIndex = prevCart.findIndex(i => 
        i.id === item.id && i.selectedVariant?.id === selectedVariant?.id
      );

      if (existingItemIndex > -1) {
        const newCart = [...prevCart];
        newCart[existingItemIndex] = {
            ...newCart[existingItemIndex],
            quantity: quantity
        };
        return newCart;
      } else {
        const price = selectedVariant ? selectedVariant.price : item.price;
        return [...prevCart, { ...item, quantity, selectedVariant, price }];
      }
    });
  }, [toast]);

  const addItems = useCallback(async (items: AiCheckoutItem[]): Promise<{ added: number }> => {
    if (!store?.products) return { added: 0 };
  
    let itemsAdded = 0;
  
    setCart(prevCart => {
      let newCart = [...prevCart];
  
      items.forEach(itemToAdd => {
        const product = store.products.find((p: Product) => p.id === itemToAdd.productId);
        if (!product) return;
  
        // Resolve variant (if provided)
        const selectedVariant = itemToAdd.variantId
          ? product.variants?.find((v: ProductVariant) => v.id === itemToAdd.variantId)
          : undefined;
  
        // If a variantId was provided but not found, skip (prevents adding wrong item)
        if (itemToAdd.variantId && !selectedVariant) return;
  
        itemsAdded++;
  
        const existingItemIndex = newCart.findIndex(i =>
          i.id === product.id && i.selectedVariant?.id === selectedVariant?.id
        );
  
        if (existingItemIndex > -1) {
          newCart[existingItemIndex].quantity += itemToAdd.quantity;
        } else {
          const price = selectedVariant ? selectedVariant.price : product.price;
          newCart.push({ ...product, quantity: itemToAdd.quantity, selectedVariant, price });
        }
      });
  
      return newCart;
    });
  
    return { added: itemsAdded };
  }, [store]);

  const removeItem = useCallback((itemId: string, variantId?: string) => {
    const vid = variantId || undefined;
    setCart(prevCart =>
        prevCart.filter(item => {
            const itemVid = item.selectedVariant?.id || undefined;
            return !(item.id === itemId && itemVid === vid);
        })
    );
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number, variantId?: string) => {
    const vid = variantId || undefined;
    
    if (quantity <= 0) {
        removeItem(itemId, vid);
        return;
    }

    setCart(prevCart =>
        prevCart.map(item => {
            const itemVid = item.selectedVariant?.id || undefined;
            return (item.id === itemId && itemVid === vid) ? { ...item, quantity } : item;
        })
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const total = useMemo(() => {
    return cart.reduce((sum, item) => {
       const price = item.selectedVariant ? item.selectedVariant.price : item.price;
       return sum + price * item.quantity;
    }, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
      return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);


  return (
    <CartContext.Provider value={{ cart, addItem, addItems, removeItem, updateQuantity, clearCart, total, cartCount }}>
      {children}
    </CartContext.Provider>
  );
};
