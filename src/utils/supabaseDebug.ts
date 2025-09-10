import { supabase } from '../lib/supabase';
import { databaseService } from '../services/databaseService';

export interface SupabaseHealthCheck {
  connection: boolean;
  authentication: boolean;
  userTableAccess: boolean;
  userCreation: boolean;
  userUpdate: boolean;
  errors: string[];
}

/**
 * Comprehensive Supabase health check and debugging utility
 */
export const runSupabaseHealthCheck = async (walletAddress?: string): Promise<SupabaseHealthCheck> => {
  const result: SupabaseHealthCheck = {
    connection: false,
    authentication: false,
    userTableAccess: false,
    userCreation: false,
    userUpdate: false,
    errors: []
  };

  console.log('🔍 Starting Supabase Health Check...');

  // 1. Test basic connection
  try {
    console.log('📡 Testing Supabase connection...');
    const { data, error } = await supabase.from('users').select('count(*)').limit(1);
    
    if (error) {
      result.errors.push(`Connection failed: ${error.message}`);
      console.error('❌ Connection test failed:', error);
    } else {
      result.connection = true;
      console.log('✅ Connection successful');
    }
  } catch (error: any) {
    result.errors.push(`Connection error: ${error.message}`);
    console.error('❌ Connection error:', error);
  }

  // 2. Test authentication context
  try {
    console.log('🔐 Testing authentication context...');
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error && error.message !== 'Auth session missing!') {
      result.errors.push(`Auth error: ${error.message}`);
      console.error('❌ Auth test failed:', error);
    } else {
      result.authentication = true;
      console.log('✅ Auth context available (anonymous)');
    }
  } catch (error: any) {
    result.errors.push(`Auth error: ${error.message}`);
    console.error('❌ Auth error:', error);
  }

  // 3. Test user table access (read)
  try {
    console.log('📖 Testing user table read access...');
    const { data, error } = await supabase
      .from('users')
      .select('id, wallet_address, username')
      .limit(1);
    
    if (error) {
      result.errors.push(`Read access failed: ${error.message}`);
      console.error('❌ Read access failed:', error);
    } else {
      result.userTableAccess = true;
      console.log('✅ User table read access successful');
    }
  } catch (error: any) {
    result.errors.push(`Read access error: ${error.message}`);
    console.error('❌ Read access error:', error);
  }

  // 4. Test user creation (if wallet address provided)
  if (walletAddress && result.userTableAccess) {
    try {
      console.log(`👤 Testing user creation for wallet: ${walletAddress}...`);
      
      // First check if user already exists
      const existingUser = await databaseService.user.getUserByWallet(walletAddress);
      
      if (existingUser) {
        console.log('ℹ️ User already exists, skipping creation test');
        result.userCreation = true;
      } else {
        // Try to create user
        const newUser = await databaseService.user.createUser({
          wallet_address: walletAddress,
          username: null
        });
        
        if (newUser) {
          result.userCreation = true;
          console.log('✅ User creation successful');
          
          // 5. Test user update
          try {
            console.log('📝 Testing user update...');
            const testUsername = `test_${Date.now()}`;
            const updatedUser = await databaseService.user.updateUser(newUser.id, {
              username: testUsername
            });
            
            if (updatedUser && updatedUser.username === testUsername) {
              result.userUpdate = true;
              console.log('✅ User update successful');
              
              // Clean up test username
              await databaseService.user.updateUser(newUser.id, { username: null });
            } else {
              result.errors.push('User update failed: No updated data returned');
              console.error('❌ User update failed: No updated data returned');
            }
          } catch (error: any) {
            result.errors.push(`User update error: ${error.message}`);
            console.error('❌ User update error:', error);
          }
        } else {
          result.errors.push('User creation failed: No user data returned');
          console.error('❌ User creation failed');
        }
      }
    } catch (error: any) {
      result.errors.push(`User creation error: ${error.message}`);
      console.error('❌ User creation error:', error);
    }
  }

  // 6. Test RLS policies specifically
  if (walletAddress && result.connection) {
    try {
      console.log('🛡️ Testing RLS policies...');
      
      // Try direct update with RLS
      const { data, error } = await supabase
        .from('users')
        .update({ updated_at: new Date().toISOString() })
        .eq('wallet_address', walletAddress)
        .select();
      
      if (error) {
        result.errors.push(`RLS policy issue: ${error.message}`);
        console.error('❌ RLS policy test failed:', error);
      } else {
        console.log('✅ RLS policies allow updates');
      }
    } catch (error: any) {
      result.errors.push(`RLS test error: ${error.message}`);
      console.error('❌ RLS test error:', error);
    }
  }

  console.log('🏁 Supabase Health Check Complete');
  console.log('📊 Results:', result);
  
  return result;
};

/**
 * Test specific username update functionality
 */
export const testUsernameUpdate = async (walletAddress: string, testUsername: string): Promise<{
  success: boolean;
  error?: string;
  steps: string[];
}> => {
  const steps: string[] = [];
  
  try {
    steps.push('1. Getting or creating user...');
    const user = await databaseService.user.getOrCreateUser(walletAddress);
    
    if (!user) {
      return {
        success: false,
        error: 'Failed to get or create user',
        steps
      };
    }
    
    steps.push(`2. User found/created with ID: ${user.id}`);
    
    steps.push('3. Attempting username update...');
    const updatedUser = await databaseService.user.updateUser(user.id, {
      username: testUsername
    });
    
    if (!updatedUser) {
      return {
        success: false,
        error: 'UpdateUser returned null',
        steps
      };
    }
    
    steps.push(`4. Update returned user with username: ${updatedUser.username}`);
    
    if (updatedUser.username === testUsername) {
      steps.push('5. ✅ Username update successful');
      return {
        success: true,
        steps
      };
    } else {
      return {
        success: false,
        error: `Expected username '${testUsername}', got '${updatedUser.username}'`,
        steps
      };
    }
    
  } catch (error: any) {
    steps.push(`ERROR: ${error.message}`);
    return {
      success: false,
      error: error.message,
      steps
    };
  }
};

/**
 * Get detailed database information
 */
export const getDatabaseInfo = async (): Promise<{
  supabaseUrl: string;
  hasAnonymousKey: boolean;
  tablesAccessible: string[];
  connectionTime: number;
}> => {
  const startTime = Date.now();
  const info = {
    supabaseUrl: process.env.REACT_APP_SUPABASE_URL || 'Not configured',
    hasAnonymousKey: !!(process.env.REACT_APP_SUPABASE_ANON_KEY),
    tablesAccessible: [] as string[],
    connectionTime: 0
  };

  // Test access to each table
  const tables = ['users', 'game_history', 'game_lists'];
  
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (!error) {
        info.tablesAccessible.push(table);
      }
    } catch (e) {
      // Table not accessible
    }
  }
  
  info.connectionTime = Date.now() - startTime;
  return info;
};