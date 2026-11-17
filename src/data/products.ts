/**
 * Hardcoded Products - Works WITHOUT Firebase
 * Use this for testing when Firebase isn't set up
 */

export interface Product {
  id: string;
  name: string;
  price: number;
  category?: string;
  barcode?: string;
  sku?: string;
  stock?: number;
}

// HARDCODED PRODUCTS - No database needed!
export const HARDCODED_PRODUCTS: Product[] = [
  {
    id: '1',
    name: '🍚 Basmati Rice',
    price: 110,
    category: 'Rice',
    stock: 50,
  },
  {
    id: '2',
    name: '🍚 Regular Rice',
    price: 45,
    category: 'Rice',
    stock: 100,
  },
  {
    id: '3',
    name: '🍚 Type 2 Rice',
    price: 60,
    category: 'Rice',
    stock: 75,
  },
  {
    id: '4',
    name: '🥚 Eggs (Dozen)',
    price: 80,
    category: 'Eggs',
    stock: 30,
  },
  {
    id: '5',
    name: '🥛 Milk (1L)',
    price: 50,
    category: 'Dairy',
    stock: 40,
  },
  {
    id: '6',
    name: '🍞 Bread',
    price: 30,
    category: 'Bakery',
    stock: 20,
  },
  {
    id: '7',
    name: '🧈 Butter (500g)',
    price: 150,
    category: 'Dairy',
    stock: 15,
  },
  {
    id: '8',
    name: '🧂 Salt (1kg)',
    price: 25,
    category: 'Spices',
    stock: 60,
  },
];

/**
 * Get products from local source
 * (Use this when Firebase isn't configured)
 */
export async function getLocalProducts(): Promise<Product[]> {
  console.log('📦 Loading products from local data');
  return HARDCODED_PRODUCTS;
}

/**
 * Get products from Firebase
 * (Use this when Firebase is set up)
 */
export async function getFirebaseProducts(): Promise<Product[]> {
  try {
    console.log('🔥 Attempting to load products from Firebase...');
    // This will be implemented once Firebase is connected
    console.warn('⚠️ Firebase not configured, using local products instead');
    return HARDCODED_PRODUCTS;
  } catch (error) {
    console.error('❌ Firebase error:', error);
    console.log('⚠️ Falling back to local products');
    return HARDCODED_PRODUCTS;
  }
}

/**
 * Smart loader - tries Firebase first, falls back to local
 */
export async function getProducts(): Promise<Product[]> {
  try {
    // Try Firebase first
    return await getFirebaseProducts();
  } catch (error) {
    // Fall back to local
    console.log('Falling back to local products');
    return getLocalProducts();
  }
}