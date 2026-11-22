import { isWeakPin, buildRegistration } from '../src/services/local/registrationService';
import { isValidGSTIN, getStateCodeFromGSTIN } from '../src/config/indianStates';
import type { PartialRegistration } from '../src/models/Registration';

describe('Registration — PIN Security', () => {
  test('rejects 1234, 4321, 0000, 1111', () => {
    expect(isWeakPin('1234')).toBe(true);
    expect(isWeakPin('4321')).toBe(true);
    expect(isWeakPin('0000')).toBe(true);
    expect(isWeakPin('1111')).toBe(true);
    expect(isWeakPin('9999')).toBe(true);
  });

  test('rejects sequential ascending and descending PINs', () => {
    expect(isWeakPin('2345')).toBe(true);
    expect(isWeakPin('6789')).toBe(true);
    expect(isWeakPin('5432')).toBe(true);
  });

  test('rejects birth/calendar years (1900-2099)', () => {
    expect(isWeakPin('1990')).toBe(true);
    expect(isWeakPin('1985')).toBe(true);
    expect(isWeakPin('2001')).toBe(true);
    expect(isWeakPin('2024')).toBe(true);
  });

  test('rejects invalid lengths', () => {
    expect(isWeakPin('123')).toBe(true);
    expect(isWeakPin('12345')).toBe(true);
  });

  test('accepts strong 4-digit PINs', () => {
    expect(isWeakPin('8391')).toBe(false);
    expect(isWeakPin('4817')).toBe(false);
    expect(isWeakPin('9264')).toBe(false);
    expect(isWeakPin('3719')).toBe(false);
  });
});

describe('Registration — GSTIN validation', () => {
  test('validates 15-character GSTIN with valid state code', () => {
    expect(isValidGSTIN('29ABCDE1234F1Z5')).toBe(true);
    expect(getStateCodeFromGSTIN('29ABCDE1234F1Z5')).toBe('29');
  });

  test('rejects malformed or invalid GSTINs', () => {
    expect(isValidGSTIN('123')).toBe(false);
    expect(isValidGSTIN('99ABCDE1234F1Z5')).toBe(false); // 99 is not an Indian state code
    expect(isValidGSTIN('29ABCDE1234F155')).toBe(false); // missing 'Z' at 14th char
  });
});

describe('Registration — Build registration object', () => {
  test('throws error if required fields are missing', () => {
    const invalid: PartialRegistration = {
      shopName: '',
      ownerName: 'Owner',
      phone: '9876543210',
    };
    expect(() => buildRegistration(invalid)).toThrow('Missing required fields');
  });

  test('builds full registration object with hashed PIN and metadata', () => {
    const valid: PartialRegistration = {
      shopName: 'Sri Raghavendra Stores',
      ownerName: 'Raghavendra',
      phone: '9876543210',
      address: 'Near Temple Road',
      city: 'Hubballi',
      state: 'Karnataka',
      stateCode: '29',
      language: 'kn',
      ownerPin: '8391',
      gstRegistered: true,
      gstin: '29ABCDE1234F1Z5',
      gstScheme: 'composition',
      upiId: 'raghavendra@upi',
    };

    const result = buildRegistration(valid);
    expect(result.shopName).toBe('Sri Raghavendra Stores');
    expect(result.ownerName).toBe('Raghavendra');
    expect(result.phone).toBe('9876543210');
    expect(result.city).toBe('Hubballi');
    expect(result.stateCode).toBe('29');
    expect(result.language).toBe('kn');
    expect(result.gstScheme).toBe('composition');
    expect(result.upiId).toBe('raghavendra@upi');
    expect(result.ownerPinHash).toBeDefined();
    expect(result.ownerPinHash).not.toBe('8391'); // Must be hashed!
    expect(result.registeredAt).toBeDefined();
  });
});
