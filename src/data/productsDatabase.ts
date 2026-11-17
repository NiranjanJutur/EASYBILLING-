import type { Product } from '../models/Product';

/**
 * PRODUCTION-READY PRODUCT DATABASE
 * All fields required by the Product model are present.
 * GST Percentages are set according to typical Indian tax categories:
 * - 0% (Rice, Wheat, Milk, Eggs)
 * - 5% (Oils, Sugar, Tea)
 * - 12% (Ghee, Butter, Fruit Juices)
 * - 18% (Biscuits, Detergent, Shampoo)
 */

export const productsDatabase: Product[] = [
  {
    id: 'basmati_001',
    name: 'Basmati Rice (Extra Long Aroma)',
    category: 'Staples',
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=200',
    price: 125,
    purchasePrice: 105,
    gstPercent: 0,
    currentStock: 250,
    minThreshold: 20,
    unit: 'kg',
    supplierId: 'sup_annapurna',
    supplierPhone: '+919876543210',
    isWeightBased: true,
    isActive: true,
    barcode: '8901234100018',
    sku: 'RIC-BAS-1KG'
  },
  {
    id: 'oil_002',
    name: 'Fortune Sunflower Oil (1L)',
    category: 'Groceries',
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbadcbaf?auto=format&fit=crop&q=80&w=200',
    price: 165,
    purchasePrice: 148,
    gstPercent: 5,
    currentStock: 120,
    minThreshold: 15,
    unit: 'L',
    supplierId: 'sup_adani',
    supplierPhone: '+919876543211',
    isWeightBased: false,
    isActive: true,
    barcode: '8901234100025',
    sku: 'OIL-SUN-1L'
  },
  {
    id: 'sugar_003',
    name: 'Pure White Sugar (Fine)',
    category: 'Staples',
    imageUrl: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&q=80&w=200',
    price: 48,
    purchasePrice: 42,
    gstPercent: 5,
    currentStock: 500,
    minThreshold: 50,
    unit: 'kg',
    supplierId: 'sup_local_mandi',
    supplierPhone: '+919876543212',
    isWeightBased: true,
    isActive: true,
    barcode: '8901234100032',
    sku: 'SUG-WHT-1KG'
  },
  {
    id: 'ghee_004',
    name: 'Amul Cow Ghee (500ml)',
    category: 'Dairy',
    imageUrl: 'https://images.unsplash.com/photo-1631773007559-00ef1f7063f6?auto=format&fit=crop&q=80&w=200',
    price: 320,
    purchasePrice: 295,
    gstPercent: 12,
    currentStock: 45,
    minThreshold: 10,
    unit: 'tin',
    supplierId: 'sup_amul_dist',
    supplierPhone: '+919876543213',
    isWeightBased: false,
    isActive: true,
    barcode: '8901234100049',
    sku: 'GHE-CV-500ML'
  },
  {
    id: 'biscuit_005',
    name: 'Parle-G Gold (Large)',
    category: 'Snacks',
    imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=200',
    price: 30,
    purchasePrice: 24,
    gstPercent: 18,
    currentStock: 200,
    minThreshold: 30,
    unit: 'pkt',
    supplierId: 'sup_parle_dist',
    supplierPhone: '+919876543214',
    isWeightBased: false,
    isActive: true,
    barcode: '8901234100056',
    sku: 'BSK-PG-GOLD'
  },
  {
    id: 'detergent_006',
    name: 'Surf Excel Quick Wash (1kg)',
    category: 'Household',
    imageUrl: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&q=80&w=200',
    price: 195,
    purchasePrice: 172,
    gstPercent: 18,
    currentStock: 80,
    minThreshold: 12,
    unit: 'pkt',
    supplierId: 'sup_hul',
    supplierPhone: '+919876543215',
    isWeightBased: false,
    isActive: true,
    barcode: '8901234100063',
    sku: 'DET-SX-1KG'
  },
  {
    id: 'milk_007',
    name: 'Mother Dairy Full Cream (1L)',
    category: 'Dairy',
    imageUrl: 'https://images.unsplash.com/photo-1550583724-125581fe2f8a?auto=format&fit=crop&q=80&w=200',
    price: 66,
    purchasePrice: 62,
    gstPercent: 0,
    currentStock: 50,
    minThreshold: 5,
    unit: 'pkt',
    supplierId: 'sup_md_dist',
    supplierPhone: '+919876543216',
    isWeightBased: false,
    isActive: true,
    barcode: '8901234100070',
    sku: 'MLK-FC-1L'
  },
  {
    id: 'tea_008',
    name: 'Taj Mahal Tea (250g)',
    category: 'Groceries',
    imageUrl: 'https://images.unsplash.com/photo-1594631252845-29fc45862080?auto=format&fit=crop&q=80&w=200',
    price: 145,
    purchasePrice: 128,
    gstPercent: 5,
    currentStock: 60,
    minThreshold: 10,
    unit: 'pkt',
    supplierId: 'sup_hul',
    supplierPhone: '+919876543215',
    isWeightBased: false,
    isActive: true,
    barcode: '8901234100087',
    sku: 'TEA-TM-250G'
  }
];

export const getProducts = () => productsDatabase;
