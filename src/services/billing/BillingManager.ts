/**
 * BillingManager — Unified singleton billing session manager.
 *
 * Replaces the three fragmented billing managers:
 *   - SimpleBillingManager.ts    (no GST, no stock guard)
 *   - billingSessionManager.ts   (legacy, mixed OCR + voice concerns)
 *   - billingSessionManagerFixed.ts (partial fix, duplicated state)
 *
 * This is the single source of truth for cart state used by all screens.
 * Uses CartManager for item/totals state, and provides higher-level
 * session helpers (OCR import, voice, barcode, checkout).
 */

import { cartManager } from './CartManager';
import type { CartItem, CartTotals } from './CartManager';
import type { Product } from '../../models/Product';
import type { SlipOCRResult } from '../../models/Slip';

export type { CartItem, CartTotals };

// ── Session Metadata ──────────────────────────────────────────────────────────

export interface BillingSession {
  sessionId: string;
  startedAt: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  billerName?: string;
  orderType: 'in_store' | 'delivery' | 'takeaway' | 'wholesale';
  deliveryAddress?: string;
}

export type SessionListener = (session: BillingSession) => void;

// ── BillingManager ────────────────────────────────────────────────────────────

class BillingManager {
  private session: BillingSession = this.newSession();
  private sessionListeners: Set<SessionListener> = new Set();

  // ── Session ──────────────────────────────────────────────────────────────

  private newSession(): BillingSession {
    return {
      sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      startedAt: new Date().toISOString(),
      orderType: 'in_store',
    };
  }

  /** Start a fresh session (called after checkout or manual reset) */
  public startNewSession(): void {
    this.session = this.newSession();
    cartManager.clearCart();
    this.notifySessionListeners();
    console.log('[BillingManager] New session started:', this.session.sessionId);
  }

  public getSession(): BillingSession {
    return { ...this.session };
  }

  public updateSession(patch: Partial<Omit<BillingSession, 'sessionId' | 'startedAt'>>): void {
    this.session = { ...this.session, ...patch };
    this.notifySessionListeners();
  }

  public onSessionChange(listener: SessionListener): () => void {
    this.sessionListeners.add(listener);
    return () => this.sessionListeners.delete(listener);
  }

  private notifySessionListeners(): void {
    const snap = { ...this.session };
    this.sessionListeners.forEach(l => l(snap));
  }

  // ── Cart delegation ──────────────────────────────────────────────────────

  /**
   * Add product to cart with stock guard.
   * Returns true if added, false if out of stock.
   */
  public addProduct(product: Product, quantity: number = 1): boolean {
    return cartManager.addItem(product, quantity);
  }

  public removeProduct(productId: string): void {
    cartManager.removeItem(productId);
  }

  public updateQuantity(productId: string, quantity: number): void {
    cartManager.updateQuantity(productId, quantity);
  }

  public getCart(): CartItem[] {
    return cartManager.getItems();
  }

  public getTotals(): CartTotals {
    return cartManager.getTotals();
  }

  public onCartChange(listener: import('./CartManager').CartListener): () => void {
    return cartManager.subscribe(listener);
  }

  // ── OCR Slip Import ──────────────────────────────────────────────────────

  /**
   * Import items from a slip OCR result into the cart.
   * Matches against known products; unmatched items added as temp products
   * with price derived from the slip's left-column line total.
   *
   * @param ocr        SlipOCRResult from AI
   * @param allProducts All products from inventory for matching
   * @returns { added, unmatched }
   */
  public importSlip(
    ocr: SlipOCRResult,
    allProducts: Product[],
  ): { added: number; unmatched: string[] } {
    const unmatched: string[] = [];
    let added = 0;

    if (!ocr.items || ocr.items.length === 0) return { added, unmatched };

    for (const item of ocr.items) {
      if (!item.name?.trim()) continue;

      const product = this.matchProduct(item.name, allProducts);

      if (product) {
        cartManager.addItem(product, Math.max(1, item.qty || 1));
        added++;
      } else {
        const qty = Math.max(1, item.qty || 1);
        const lineTotal = Number(item.amount) || 0;
        const derivedPrice = lineTotal > 0 ? Math.round(lineTotal / qty) : 0;

        const tempProduct: Product = {
          id: `slip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: item.name.trim(),
          category: 'Other',
          price: derivedPrice,
          unit: item.unit || 'pcs',
          currentStock: 9999,
          minThreshold: 0,
          gstPercent: 0,
          isWeightBased: false,
          isActive: true,
          imageUrl: '',
          supplierId: '',
          supplierPhone: '',
          purchasePrice: 0,
        };

        cartManager.addItem(tempProduct, qty);
        unmatched.push(item.name.trim());
        added++;
      }
    }

    // Set customer from slip if not already set
    if (ocr.name && !this.session.customerName) {
      this.updateSession({ customerName: ocr.name });
    }

    return { added, unmatched };
  }

  /** Three-tier fuzzy product matching */
  private matchProduct(name: string, products: Product[]): Product | null {
    const lower = name.toLowerCase().trim();

    // 1. Exact (case-insensitive)
    const exact = products.find(p => p.name.toLowerCase() === lower);
    if (exact) return exact;

    // 2. Substring
    const sub = products.find(p => {
      const pn = p.name.toLowerCase();
      return pn.includes(lower) || lower.includes(pn);
    });
    if (sub) return sub;

    // 3. Word overlap (>= 1 shared word > 2 chars)
    const itemWords = lower.split(/[\s,\-()+]+/).filter(w => w.length > 2);
    let best: Product | null = null;
    let bestScore = 0;

    for (const p of products) {
      const pWords = p.name.toLowerCase().split(/[\s,\-()+]+/).filter(w => w.length > 2);
      let score = 0;
      for (const iw of itemWords) {
        for (const pw of pWords) {
          if (iw.includes(pw) || pw.includes(iw)) { score++; break; }
        }
      }
      if (score > bestScore) { bestScore = score; best = p; }
    }

    return bestScore >= 1 ? best : null;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const billingManager = new BillingManager();
