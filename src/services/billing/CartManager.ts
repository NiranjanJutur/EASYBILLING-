import type { Product } from '../../models/Product';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  gstPercent: number;
  gstAmount: number;
  subtotal: number; // price * quantity
  total: number;    // subtotal + gstAmount
  unit: string;
}

export interface CartTotals {
  subtotal: number;
  gstTotal: number;
  total: number;
  itemCount: number;
}

export type CartListener = (items: CartItem[], totals: CartTotals) => void;

class CartManager {
  private items: CartItem[] = [];
  private listeners: Set<CartListener> = new Set();
  // Tracks live stock so we can enforce stock guards without a DB round-trip.
  // Populated from the Product passed to addItem.
  private stockMap: Map<string, number> = new Map();

  /**
   * Calculate totals for the entire cart
   */
  private calculateTotals(): CartTotals {
    return this.items.reduce(
      (acc, item) => ({
        subtotal: acc.subtotal + item.subtotal,
        gstTotal: acc.gstTotal + item.gstAmount,
        total: acc.total + item.total,
        itemCount: acc.itemCount + item.quantity,
      }),
      { subtotal: 0, gstTotal: 0, total: 0, itemCount: 0 }
    );
  }

  /**
   * Notify all subscribers of the current state
   */
  private notifyListeners(): void {
    const totals = this.calculateTotals();
    this.listeners.forEach(listener => listener([...this.items], totals));
  }

  /**
   * Add a product to the cart.
   * Returns false if currentStock is 0 (nothing to sell).
   */
  public addItem(product: Product, quantity: number = 1): boolean {
    // Seed the stock map the first time we see this product
    if (!this.stockMap.has(product.id)) {
      this.stockMap.set(product.id, product.currentStock ?? 0);
    }

    const existingIndex = this.items.findIndex(item => item.productId === product.id);
    const alreadyInCart = existingIndex > -1 ? this.items[existingIndex].quantity : 0;
    const available = this.stockMap.get(product.id) ?? 0;

    // Guard: refuse if no stock at all
    if (available <= 0 && product.isWeightBased === false) {
      console.warn(`[CartManager] No stock for ${product.name}`);
      return false;
    }

    // Clamp quantity so we never exceed available stock
    const maxAddable = Math.max(0, available - alreadyInCart);
    const safeQty = product.isWeightBased ? quantity : Math.min(quantity, maxAddable);

    if (existingIndex > -1) {
      this.updateQuantity(product.id, this.items[existingIndex].quantity + safeQty);
    } else {
      if (safeQty <= 0) {
        console.warn(`[CartManager] Cannot add ${product.name} — already at stock limit`);
        return false;
      }
      const subtotal = product.price * safeQty;
      const gstAmount = (subtotal * product.gstPercent) / 100;

      const newItem: CartItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: safeQty,
        gstPercent: product.gstPercent ?? 0,
        gstAmount: gstAmount,
        subtotal: subtotal,
        total: subtotal + gstAmount,
        unit: product.unit,
      };

      this.items.push(newItem);
      this.notifyListeners();
      console.log(`[CartManager] Added: ${product.name} x${safeQty}`);
    }
    return true;
  }

  /**
   * Update quantity of an item
   */
  public updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(productId);
      return;
    }

    const itemIndex = this.items.findIndex(item => item.productId === productId);
    if (itemIndex > -1) {
      const item = this.items[itemIndex];
      const subtotal = item.price * quantity;
      const gstAmount = (subtotal * item.gstPercent) / 100;

      this.items[itemIndex] = {
        ...item,
        quantity: quantity,
        subtotal: subtotal,
        gstAmount: gstAmount,
        total: subtotal + gstAmount,
      };
      
      this.notifyListeners();
    }
  }

  /**
   * Remove item from cart
   */
  public removeItem(productId: string): void {
    this.items = this.items.filter(item => item.productId !== productId);
    this.notifyListeners();
    console.log(`[CartManager] Removed: ${productId}`);
  }

  /**
   * Clear the entire cart and reset stock tracking
   */
  public clearCart(): void {
    this.items = [];
    this.stockMap.clear();
    this.notifyListeners();
    console.log('[CartManager] Cart cleared');
  }

  /**
   * Subscribe to cart updates
   * Returns an unsubscribe function
   */
  public subscribe(listener: CartListener): () => void {
    this.listeners.add(listener);
    // Initial notification upon subscription
    listener([...this.items], this.calculateTotals());
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current items
   */
  public getItems(): CartItem[] {
    return [...this.items];
  }

  /**
   * Get current totals
   */
  public getTotals(): CartTotals {
    return this.calculateTotals();
  }

  /**
   * How many units of productId can still be added to cart
   * (stockMap value minus units already in cart)
   */
  public getAvailableQuantity(productId: string): number {
    const inCart = this.items.find(i => i.productId === productId)?.quantity ?? 0;
    const stock = this.stockMap.get(productId) ?? Infinity; // Infinity = weight-based, no hard limit
    return Math.max(0, stock - inCart);
  }
}

// Singleton instance
export const cartManager = new CartManager();
export default cartManager;
