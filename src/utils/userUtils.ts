import { formatAddress } from '../thirdweb';
import { Database } from '../lib/database.types';
import { userService } from '../services/databaseService';
import { usernameCache, getCachedUsernameOrFetch } from './usernameCache';
import { getBestDisplayName, getBestDisplayNames, ensCache } from './ensUtils';

type User = Database['public']['Tables']['users']['Row'];

/**
 * Gets the display name for a user, preferring username over wallet address
 */
export const getDisplayName = (user: User | null, walletAddress: string): string => {
  if (user?.username) {
    return user.username;
  }
  return formatAddress(walletAddress);
};

/**
 * Enhanced display name getter with ENS support
 * Priority: 1. Database username, 2. ENS name, 3. Formatted address
 */
export const getEnhancedDisplayName = async (
  user: User | null, 
  walletAddress: string
): Promise<string> => {
  if (user?.username) {
    return user.username;
  }
  
  return getBestDisplayName(walletAddress, user?.username);
};

/**
 * Gets display name when you only have a wallet address (for other players)
 * Now includes database lookup and ENS resolution
 */
export const getDisplayNameByAddress = async (walletAddress: string): Promise<string> => {
  // Defensive check
  if (!walletAddress || typeof walletAddress !== 'string') {
    return 'Unknown User';
  }
  
  try {
    // Try to get from cache first for immediate response
    const cachedUsername = usernameCache.getCachedUsername(walletAddress);
    if (cachedUsername !== undefined) {
      return getBestDisplayName(walletAddress, cachedUsername);
    }
    
    // Fetch username from database with caching
    const username = await getCachedUsernameOrFetch(
      walletAddress,
      async (address) => userService.getUsernameByWallet(address)
    );
    
    return getBestDisplayName(walletAddress, username);
  } catch (error) {
    console.warn(`Failed to get display name for ${walletAddress}:`, error);
    return formatAddress(walletAddress);
  }
};

/**
 * Synchronous version that returns cached results immediately
 * Priority: 1. Database username, 2. ENS name, 3. Formatted address
 */
export const getDisplayNameByAddressSync = (walletAddress: string): string => {
  // Defensive check
  if (!walletAddress || typeof walletAddress !== 'string') {
    return 'Unknown User';
  }
  
  // Try cached username first (highest priority)
  const cachedUsername = usernameCache.getCachedUsername(walletAddress);
  if (cachedUsername) {
    return cachedUsername;
  }
  
  // Try cached ENS name (second priority)
  const cachedENS = ensCache.getCachedENS(walletAddress);
  if (cachedENS) {
    return cachedENS;
  }
  
  // Return formatted address as final fallback
  return formatAddress(walletAddress);
};

/**
 * Batch version for getting multiple display names efficiently
 */
export const getDisplayNamesByAddresses = async (
  walletAddresses: string[]
): Promise<Map<string, string>> => {
  if (!Array.isArray(walletAddresses) || walletAddresses.length === 0) {
    return new Map();
  }
  
  // Filter out invalid addresses and log warnings
  const validAddresses = walletAddresses.filter(address => {
    if (typeof address !== 'string') {
      console.warn('Invalid address type in getDisplayNamesByAddresses:', typeof address, address);
      return false;
    }
    if (!address || address.length === 0) {
      console.warn('Empty address in getDisplayNamesByAddresses');
      return false;
    }
    return true;
  });
  
  if (validAddresses.length === 0) {
    return new Map();
  }
  
  try {
    // Get usernames from database with caching
    const usernameMap = await usernameCache.batchFetchUsernames(
      validAddresses,
      async (addresses) => userService.getUsernamesByWallets(addresses)
    );
    
    // Convert to display names with ENS support
    const addressUsernamePairs = validAddresses.map(address => ({
      address,
      username: usernameMap.get(address)
    }));
    
    return getBestDisplayNames(addressUsernamePairs);
  } catch (error) {
    console.warn('Failed to get batch display names:', error);
    // Fallback to formatted addresses
    const results = new Map<string, string>();
    walletAddresses.forEach(address => {
      results.set(address, formatAddress(address));
    });
    return results;
  }
};

/**
 * Preload usernames for addresses to warm the cache
 * Use this when you know you'll need display names soon
 */
export const preloadUsernames = async (walletAddresses: string[]): Promise<void> => {
  if (walletAddresses.length === 0) return;
  
  try {
    await usernameCache.batchFetchUsernames(
      walletAddresses,
      async (addresses) => userService.getUsernamesByWallets(addresses)
    );
  } catch (error) {
    console.warn('Failed to preload usernames:', error);
  }
};

/**
 * Preload display names (usernames AND ENS names) for addresses to warm the cache
 * Use this when you know you'll need display names soon and want ENS resolution
 */
export const preloadDisplayNames = async (walletAddresses: string[]): Promise<void> => {
  if (walletAddresses.length === 0) return;
  
  try {
    console.log(`🔄 Preloading display names for ${walletAddresses.length} addresses:`, walletAddresses);
    
    // This will fetch usernames AND resolve ENS names, caching both
    const displayNames = await getDisplayNamesByAddresses(walletAddresses);
    
    console.log(`✅ Preloaded ${displayNames.size} display names:`, 
      Array.from(displayNames.entries()).map(([addr, name]) => `${addr} -> ${name}`)
    );
  } catch (error) {
    console.warn('Failed to preload display names:', error);
  }
};

/**
 * Checks if a user has set a username
 */
export const hasUsername = (user: User | null): boolean => {
  return !!(user?.username && user.username.trim());
};

/**
 * Checks if an address is currently being loaded for username/ENS
 */
export const isDisplayNameLoading = (walletAddress: string): boolean => {
  return usernameCache.isLoading(walletAddress);
};

/**
 * Gets information about which display method is being used for an address
 */
export const getDisplayNameInfo = (walletAddress: string): {
  displayName: string;
  method: 'username' | 'ens' | 'address';
  canRemoveUsername: boolean;
} => {
  if (!walletAddress || typeof walletAddress !== 'string') {
    return {
      displayName: 'Unknown User',
      method: 'address',
      canRemoveUsername: false
    };
  }
  
  // Check username first
  const cachedUsername = usernameCache.getCachedUsername(walletAddress);
  if (cachedUsername) {
    return {
      displayName: cachedUsername,
      method: 'username',
      canRemoveUsername: true
    };
  }
  
  // Check ENS second
  const cachedENS = ensCache.getCachedENS(walletAddress);
  if (cachedENS) {
    return {
      displayName: cachedENS,
      method: 'ens',
      canRemoveUsername: false
    };
  }
  
  // Fallback to address
  return {
    displayName: formatAddress(walletAddress),
    method: 'address',
    canRemoveUsername: false
  };
};