import { supabase } from '../../config/supabase';
import { getActiveStoreId } from '../activeStoreId';
import type { Product } from '../../models/Product';
import { updateProduct } from './supabaseDataService';

// Reusing rowToProduct logic simply
function rowToProduct(row: Record<string, any>): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? '',
    imageUrl: row.image_url ?? '',
    price: Number(row.price),
    gstPercent: row.gst_percent,
    currentStock: Number(row.current_stock),
    minThreshold: Number(row.min_threshold),
    unit: row.unit ?? 'pcs',
    packSize: row.pack_size != null ? Number(row.pack_size) : undefined,
    supplierId: row.supplier_id ?? null,
    supplierPhone: row.supplier_phone ?? '',
    purchasePrice: Number(row.purchase_price),
    isWeightBased: Boolean(row.is_weight_based),
    isActive: Boolean(row.is_active),
  };
}

export const getGodownProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .eq('store_id', 'godown')
    .order('name');
  
  if (error) {
    console.error('[Godown] getGodownProducts:', error.message);
    return [];
  }
  return (data as Record<string, any>[]).map(rowToProduct);
};

export const addGodownProduct = async (product: Omit<Product, 'id'>): Promise<string> => {
  const row = {
    name: product.name,
    category: product.category,
    price: product.price,
    gst_percent: product.gstPercent,
    current_stock: product.currentStock,
    min_threshold: product.minThreshold,
    unit: product.unit,
    purchase_price: product.purchasePrice,
    is_weight_based: product.isWeightBased,
    is_active: product.isActive,
    store_id: 'godown', // Enforce Godown identity
  };

  const { data, error } = await supabase
    .from('products')
    .insert([row])
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id;
};

/**
 * Pulls stock directly from the Godown to the active Store.
 * Magically matches the product by name, or creates a new one in the Store if it doesn't exist!
 */
export const pullStockToLocalStore = async (
  godownProduct: Product,
  pullQty: number
): Promise<Product> => {
  if (pullQty <= 0) throw new Error('Pull quantity must be greater than zero.');
  const localStoreId = getActiveStoreId();
  if (localStoreId === 'godown') throw new Error('Cannot pull Godown stock into Godown itself.');

  if (godownProduct.currentStock < pullQty) {
    throw new Error('Not enough stock in the Godown to pull!');
  }

  // 1. Try to find a matching product in the local store by exact name
  const { data: localMatch, error: matchError } = await supabase
    .from('products')
    .select('id, current_stock')
    .eq('store_id', localStoreId)
    .eq('name', godownProduct.name)
    .maybeSingle();

  if (matchError && matchError.code !== 'PGRST116') throw new Error(matchError.message);

  // 2. Decrement Godown stock
  const newGodownStock = godownProduct.currentStock - pullQty;
  const { error: godownUpdateError } = await supabase
    .from('products')
    .update({ current_stock: newGodownStock })
    .eq('id', godownProduct.id);

  if (godownUpdateError) throw new Error(godownUpdateError.message);

  // 3. Increment or Create the local product
  if (localMatch) {
    // Match found! Increment local
    const newLocalStock = Number(localMatch.current_stock) + pullQty;
    const { error: localUpdateError } = await supabase
      .from('products')
      .update({ current_stock: newLocalStock })
      .eq('id', localMatch.id);
    if (localUpdateError) throw new Error(localUpdateError.message);
    
    return {
      ...godownProduct,
      id: localMatch.id,
      currentStock: newLocalStock
    };
  } else {
    // No match found! Seamlessly clone the Godown item into the local store
    const newLocalRow = {
      name: godownProduct.name,
      category: godownProduct.category,
      price: godownProduct.price,
      purchase_price: godownProduct.purchasePrice,
      gst_percent: godownProduct.gstPercent,
      current_stock: pullQty,
      min_threshold: godownProduct.minThreshold,
      unit: godownProduct.unit,
      is_weight_based: godownProduct.isWeightBased,
      store_id: localStoreId,
      is_active: true
    };
    
    const { data: insertedData, error: insertError } = await supabase
      .from('products')
      .insert([newLocalRow])
      .select('id')
      .single();
      
    if (insertError) throw new Error(insertError.message);
    
    return {
      ...godownProduct,
      id: insertedData.id,
      currentStock: pullQty
    };
  }
};
