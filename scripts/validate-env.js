/**
 * Environment validation script for PU2-rc1
 * This runs before build to ensure all required environment variables are set
 */

// Load environment variables from .env file
require('dotenv').config();

console.log('🔍 Validating environment configuration...\n');

// Check required environment variables
const requiredVars = [
  'REACT_APP_SUPABASE_URL',
  'REACT_APP_SUPABASE_ANON_KEY', 
  'REACT_APP_THIRDWEB_CLIENT_ID'
];

let hasErrors = false;

// Validate each required variable
requiredVars.forEach(varName => {
  const value = process.env[varName];
  
  if (!value || value.trim() === '') {
    console.error(`❌ Missing required environment variable: ${varName}`);
    hasErrors = true;
  } else {
    console.log(`✅ ${varName}: ${value.slice(0, 20)}${value.length > 20 ? '...' : ''}`);
  }
});

// Validate URL format for Supabase
if (process.env.REACT_APP_SUPABASE_URL) {
  try {
    new URL(process.env.REACT_APP_SUPABASE_URL);
    console.log('✅ Supabase URL format valid');
  } catch {
    console.error(`❌ Invalid REACT_APP_SUPABASE_URL format: ${process.env.REACT_APP_SUPABASE_URL}`);
    hasErrors = true;
  }
}

// Validate Thirdweb client ID format (should be 32 character hex string)
if (process.env.REACT_APP_THIRDWEB_CLIENT_ID) {
  const clientId = process.env.REACT_APP_THIRDWEB_CLIENT_ID;
  if (!/^[a-f0-9]{32}$/.test(clientId)) {
    console.warn('⚠️  Thirdweb client ID format may be invalid. Expected: 32 character hex string');
  } else {
    console.log('✅ Thirdweb client ID format valid');
  }
}

// Check NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'development';
console.log(`📍 Environment: ${nodeEnv}`);

if (hasErrors) {
  console.error('\n🚨 Environment validation failed!');
  console.error('📋 Required environment variables:');
  requiredVars.forEach(varName => {
    console.error(`   ${varName}=your_${varName.toLowerCase()}_here`);
  });
  console.error('\n📁 Copy .env.example to .env and fill in your values\n');
  process.exit(1);
} else {
  console.log('\n✅ Environment validation successful!\n');
  process.exit(0);
}