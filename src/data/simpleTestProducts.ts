import type { Product } from '../models/Product';

export const SIMPLE_TEST_PRODUCTS: Partial<Product>[] = [
  {
    id: 'rice_basmati',
    name: 'Basmati Rice',
    price: 110,
  },
  {
    id: 'rice_regular',
    name: 'Regular Rice',
    price: 45,
  },
  {
    id: 'rice_type2',
    name: 'Type 2 Rice',
    price: 60,
  },
  {
    id: 'eggs',
    name: 'Eggs (Dozen)',
    price: 80,
  },
  {
    id: 'milk',
    name: 'Milk (1L)',
    price: 50,
  },
  {
    id: 'bread',
    name: 'Bread',
    price: 30,
  },
];