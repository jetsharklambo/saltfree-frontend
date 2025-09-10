/**
 * Tests for environment utilities
 */

import { getRequiredEnvVar, validateEnvironment, validation } from '../envUtils';

// Mock process.env
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('getRequiredEnvVar', () => {
  test('should return value when env var exists', () => {
    process.env.TEST_VAR = 'test-value';
    expect(getRequiredEnvVar('TEST_VAR')).toBe('test-value');
  });

  test('should throw error when env var missing', () => {
    delete process.env.TEST_VAR;
    expect(() => getRequiredEnvVar('TEST_VAR')).toThrow();
  });

  test('should throw error when env var empty', () => {
    process.env.TEST_VAR = '';
    expect(() => getRequiredEnvVar('TEST_VAR')).toThrow();
  });

  test('should trim whitespace', () => {
    process.env.TEST_VAR = '  test-value  ';
    expect(getRequiredEnvVar('TEST_VAR')).toBe('test-value');
  });
});

describe('validateEnvironment', () => {
  test('should validate all required env vars', () => {
    process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
    process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-key';
    process.env.REACT_APP_THIRDWEB_CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'; // Mock 32-char hex
    
    expect(() => validateEnvironment()).not.toThrow();
  });

  test('should throw when Supabase URL missing', () => {
    delete process.env.REACT_APP_SUPABASE_URL;
    process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-key';
    process.env.REACT_APP_THIRDWEB_CLIENT_ID = 'test-client-id';
    
    expect(() => validateEnvironment()).toThrow();
  });

  test('should throw when Supabase URL invalid', () => {
    process.env.REACT_APP_SUPABASE_URL = 'not-a-url';
    process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-key';
    process.env.REACT_APP_THIRDWEB_CLIENT_ID = 'test-client-id';
    
    expect(() => validateEnvironment()).toThrow();
  });
});

describe('validation', () => {
  describe('gameCode', () => {
    test('should accept valid game codes', () => {
      expect(validation.gameCode('ABC')).toBe(true);
      expect(validation.gameCode('ABC-123')).toBe(true);
      expect(validation.gameCode('GAME123')).toBe(true);
      expect(validation.gameCode('A1B2C3D4E5')).toBe(true);
    });

    test('should reject invalid game codes', () => {
      expect(validation.gameCode('AB')).toBe(false); // Too short
      expect(validation.gameCode('ABCDEFGHIJK')).toBe(false); // Too long
      expect(validation.gameCode('ABC@123')).toBe(false); // Invalid character
      expect(validation.gameCode('')).toBe(false); // Empty
    });
  });

  describe('ethereumAddress', () => {
    test('should accept valid addresses', () => {
      expect(validation.ethereumAddress('0x742d35Cc6634C0532925a3b8D0C7CfcbD2C74B63')).toBe(true);
      expect(validation.ethereumAddress('0x0000000000000000000000000000000000000000')).toBe(true);
    });

    test('should reject invalid addresses', () => {
      expect(validation.ethereumAddress('742d35Cc6634C0532925a3b8D0C7CfcbD2C74B63')).toBe(false); // No 0x
      expect(validation.ethereumAddress('0x742d35Cc6634C0532925a3b8D0C7CfcbD2C74B6')).toBe(false); // Too short
      expect(validation.ethereumAddress('0x742d35Cc6634C0532925a3b8D0C7CfcbD2C74B63X')).toBe(false); // Invalid char
      expect(validation.ethereumAddress('')).toBe(false); // Empty
    });
  });

  describe('sanitizeString', () => {
    test('should remove dangerous characters', () => {
      expect(validation.sanitizeString('Hello<script>')).toBe('Helloscript');
      expect(validation.sanitizeString('Test"ing')).toBe('Testing');
      expect(validation.sanitizeString("Test'ing")).toBe('Testing');
      expect(validation.sanitizeString('Test&ing')).toBe('Testing');
    });

    test('should trim whitespace', () => {
      expect(validation.sanitizeString('  hello  ')).toBe('hello');
    });
  });

  describe('sanitizeGameCode', () => {
    test('should sanitize and validate game codes', () => {
      expect(validation.sanitizeGameCode('abc-123')).toBe('ABC-123');
      expect(validation.sanitizeGameCode('  game  ')).toBe('GAME');
    });

    test('should throw for invalid game codes', () => {
      expect(() => validation.sanitizeGameCode('AB')).toThrow();
      expect(() => validation.sanitizeGameCode('ABC@123')).toThrow();
    });
  });

  describe('sanitizeAddress', () => {
    test('should sanitize and validate addresses', () => {
      const address = '0X742D35CC6634C0532925A3B8D0C7CFCBD2C74B63';
      expect(validation.sanitizeAddress(address)).toBe('0x742d35cc6634c0532925a3b8d0c7cfcbd2c74b63');
    });

    test('should throw for invalid addresses', () => {
      expect(() => validation.sanitizeAddress('invalid')).toThrow();
      expect(() => validation.sanitizeAddress('742d35Cc6634C0532925a3b8D0C7CfcbD2C74B63')).toThrow();
    });
  });
});