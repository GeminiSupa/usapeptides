'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem } from '@/types';
import { track } from '@/lib/track';

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  totalItems: number;
  subtotal: number;
  bulkDiscountSavings: number;
  couponCode: string;
  couponDiscount: number;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  finalTotal: number;
  freeShippingThreshold: number;
  amountNeededForFreeShipping: number;
  hasFreeShipping: boolean;
  selectedCOAProduct: Product | null;
  setSelectedCOAProduct: (product: Product | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscountPercent, setCouponDiscountPercent] = useState(0);
  const [selectedCOAProduct, setSelectedCOAProduct] = useState<Product | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const freeShippingThreshold = 100.0;

  useEffect(() => {
    try {
      const storedCart = localStorage.getItem('bbp_cart');
      const storedCoupon = localStorage.getItem('bbp_coupon');
      if (storedCart) {
        setCart(JSON.parse(storedCart));
      }
      if (storedCoupon) {
        const parsed = JSON.parse(storedCoupon);
        setCouponCode(parsed.code || '');
        setCouponDiscountPercent(parsed.discount || 0);
      }
    } catch (e) {
      console.error('Failed to parse cart storage', e);
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem('bbp_cart', JSON.stringify(cart));
        localStorage.setItem(
          'bbp_coupon',
          JSON.stringify({ code: couponCode, discount: couponDiscountPercent })
        );
      } catch (e) {
        console.error('Failed to save cart storage', e);
      }
    }
  }, [cart, couponCode, couponDiscountPercent, isInitialized]);

  const calculateTierPrice = (product: Product, qty: number): number => {
    let discount = 0;
    if (qty >= 10) discount = 0.20;
    else if (qty >= 5) discount = 0.15;
    else if (qty >= 3) discount = 0.10;

    const basePrice = product.price;
    return Number((basePrice * (1 - discount)).toFixed(2));
  };

  const addToCart = (product: Product, quantity = 1) => {
    track('add_to_cart', { slug: product.slug, qty: quantity, value: (product.salePrice ?? product.price) * quantity });
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + quantity;
        const newPrice = calculateTierPrice(product, newQty);
        return prevCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: newQty, selectedPrice: newPrice }
            : item
        );
      } else {
        const newPrice = calculateTierPrice(product, quantity);
        return [...prevCart, { product, quantity, selectedPrice: newPrice }];
      }
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          const newPrice = calculateTierPrice(item.product, quantity);
          return { ...item, quantity, selectedPrice: newPrice };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCart([]);
    setCouponCode('');
    setCouponDiscountPercent(0);
  };

  const applyCoupon = (code: string) => {
    const formatted = code.trim().toUpperCase();
    if (formatted === 'RESEARCH10' || formatted === 'BATTLE10') {
      setCouponCode(formatted);
      setCouponDiscountPercent(0.10);
      return { success: true, message: '10% Research Lab discount applied!' };
    }
    if (formatted === 'USA20' || formatted === 'BULK20') {
      setCouponCode(formatted);
      setCouponDiscountPercent(0.20);
      return { success: true, message: '20% Special Institution discount applied!' };
    }
    return { success: false, message: 'Invalid or expired promotional code' };
  };

  const removeCoupon = () => {
    setCouponCode('');
    setCouponDiscountPercent(0);
  };

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const rawBaseTotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const subtotal = cart.reduce((acc, item) => acc + item.selectedPrice * item.quantity, 0);
  const bulkDiscountSavings = Math.max(0, rawBaseTotal - subtotal);

  const couponDiscount = Number((subtotal * couponDiscountPercent).toFixed(2));
  const finalTotal = Math.max(0, Number((subtotal - couponDiscount).toFixed(2)));

  const hasFreeShipping = subtotal >= freeShippingThreshold;
  const amountNeededForFreeShipping = Math.max(0, Number((freeShippingThreshold - subtotal).toFixed(2)));

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        totalItems,
        subtotal,
        bulkDiscountSavings,
        couponCode,
        couponDiscount,
        applyCoupon,
        removeCoupon,
        finalTotal,
        freeShippingThreshold,
        amountNeededForFreeShipping,
        hasFreeShipping,
        selectedCOAProduct,
        setSelectedCOAProduct,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
