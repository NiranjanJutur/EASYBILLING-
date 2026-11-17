// Jest setup for React Native native-module mocks

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('./src/services/firebase/firestoreService', () => ({
  getProducts: jest.fn(async () => []),
  addProduct: jest.fn(async () => 'mock-product-id'),
  updateProduct: jest.fn(async () => {}),
  updateStock: jest.fn(async () => {}),
  deleteProduct: jest.fn(async () => {}),
  getCustomers: jest.fn(async () => []),
  getCustomer: jest.fn(async () => null),
  addCustomer: jest.fn(async () => 'mock-customer-id'),
  updateCustomer: jest.fn(async () => {}),
  updateCustomerBalance: jest.fn(async () => {}),
  getTransactions: jest.fn(async () => []),
  getCustomerTransactions: jest.fn(async () => []),
  addTransaction: jest.fn(async () => 'mock-transaction-id'),
}));

