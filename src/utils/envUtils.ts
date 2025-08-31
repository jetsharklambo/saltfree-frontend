/**
 * Environment variable utilities for PU2-rc1
 * Provides runtime validation and type-safe access to environment variables
 */

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  thirdwebClientId: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * Gets a required environment variable, throwing an error if not found
 */
export function getRequiredEnvVar(key: string): string {
  const value = process.env[key];
  
  if (!value || value.trim() === '') {
    throw new Error(
      `❌ Missing required environment variable: ${key}\n` +
      `Please check your .env file and ensure ${key} is set.\n` +
      `See .env.example for reference.`
    );
  }
  
  return value.trim();
}

/**
 * Gets an optional environment variable with a default value
 */
export function getEnvVar(key: string, defaultValue: string = ''): string {
  const value = process.env[key];
  return value?.trim() || defaultValue;
}

/**
 * Validates all required environment variables on app startup
 */
export function validateEnvironment(): AppConfig {
  try {
    const config: AppConfig = {
      supabaseUrl: getRequiredEnvVar('REACT_APP_SUPABASE_URL'),
      supabaseAnonKey: getRequiredEnvVar('REACT_APP_SUPABASE_ANON_KEY'),
      thirdwebClientId: getRequiredEnvVar('REACT_APP_THIRDWEB_CLIENT_ID'),
      isDevelopment: process.env.NODE_ENV === 'development',
      isProduction: process.env.NODE_ENV === 'production',
    };

    // Validate URL format for Supabase
    try {
      new URL(config.supabaseUrl);
    } catch {
      throw new Error(`❌ Invalid REACT_APP_SUPABASE_URL format: ${config.supabaseUrl}`);
    }

    // Validate Thirdweb client ID format (should be 32 character hex string)
    if (!/^[a-f0-9]{32}$/.test(config.thirdwebClientId)) {
      console.warn('⚠️ Thirdweb client ID format may be invalid. Expected: 32 character hex string');
    }

    // Log successful validation (without sensitive values)
    console.log('✅ Environment validation successful');
    console.log(`📍 Environment: ${config.isDevelopment ? 'development' : 'production'}`);
    console.log(`🏗️ Supabase URL: ${config.supabaseUrl}`);
    console.log(`🔗 Thirdweb Client ID: ${config.thirdwebClientId.slice(0, 8)}...`);
    
    return config;

  } catch (error) {
    console.error('🚨 Environment validation failed:', error);
    
    // In production, fail hard. In development, show helpful error
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    
    console.log('\n📋 Required environment variables:');
    console.log('  REACT_APP_SUPABASE_URL=https://your-project.supabase.co');
    console.log('  REACT_APP_SUPABASE_ANON_KEY=your-anon-key');
    console.log('  REACT_APP_THIRDWEB_CLIENT_ID=your-client-id');
    console.log('\n📁 Copy .env.example to .env and fill in your values\n');
    
    throw error;
  }
}

/**
 * Get the validated app configuration
 * Call this after validateEnvironment() has been called
 */
let appConfig: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (!appConfig) {
    appConfig = validateEnvironment();
  }
  return appConfig;
}

/**
 * Input validation utilities
 */
export const validation = {
  /**
   * Validates a game code format (3-10 alphanumeric characters with dashes)
   */
  gameCode: (code: string): boolean => {
    return /^[A-Z0-9-]{3,10}$/i.test(code.trim());
  },

  /**
   * Validates an Ethereum address format
   */
  ethereumAddress: (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
  },

  /**
   * Sanitizes user input to prevent injection
   */
  sanitizeString: (input: string): string => {
    return input.trim().replace(/[<>\"'&]/g, '');
  },

  /**
   * Validates and sanitizes a game code
   */
  sanitizeGameCode: (code: string): string => {
    const sanitized = validation.sanitizeString(code).toUpperCase();
    if (!validation.gameCode(sanitized)) {
      throw new Error(`Invalid game code format: ${code}. Must be 3-10 alphanumeric characters.`);
    }
    return sanitized;
  },

  /**
   * Validates and sanitizes an Ethereum address
   */
  sanitizeAddress: (address: string): string => {
    const sanitized = validation.sanitizeString(address).toLowerCase();
    if (!validation.ethereumAddress(sanitized)) {
      throw new Error(`Invalid Ethereum address format: ${address}`);
    }
    return sanitized;
  }
};