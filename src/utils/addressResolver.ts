import { resolveName, resolveAddress } from 'thirdweb/extensions/ens';
import { ethereum } from 'thirdweb/chains';
import { client } from '../thirdweb';
import { userService } from '../services/databaseService';
import { ensCache } from './ensUtils';

export interface ResolvedAddress {
  address: string;
  displayName: string;
  method: 'wallet' | 'ens' | 'username';
  error?: string;
}

/**
 * Validates if a string is a valid Ethereum wallet address
 */
function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Checks if a string looks like an ENS name
 */
function isENSName(name: string): boolean {
  return name.includes('.eth') || name.includes('.xyz') || name.includes('.com');
}

/**
 * Resolves an ENS name to wallet address using Thirdweb
 */
async function resolveENSName(ensName: string): Promise<string | null> {
  try {
    console.log(`🔍 Resolving ENS name: ${ensName}`);
    
    const address = await resolveAddress({
      client,
      name: ensName,
      resolverChain: ethereum,
    });
    
    console.log(`✅ ENS resolution for ${ensName}: ${address || 'null'}`);
    return address || null;
  } catch (error) {
    console.warn(`ENS resolution failed for ${ensName}:`, error);
    return null;
  }
}

/**
 * Resolves a username to wallet address by searching the database
 */
async function resolveUsername(username: string): Promise<string | null> {
  try {
    console.log(`🔍 Resolving username: ${username}`);
    
    // Query database for user with this username
    const user = await userService.getUserByUsername(username);
    
    if (user?.wallet_address) {
      console.log(`✅ Username resolution for ${username}: ${user.wallet_address}`);
      return user.wallet_address;
    }
    
    console.log(`❌ No user found with username: ${username}`);
    return null;
  } catch (error) {
    console.warn(`Username resolution failed for ${username}:`, error);
    return null;
  }
}

/**
 * Main resolver function that handles username, ENS, or wallet address input
 * Returns a ResolvedAddress object with address, display name, and resolution method
 */
export async function resolveToWalletAddress(input: string): Promise<ResolvedAddress> {
  if (!input || typeof input !== 'string') {
    return {
      address: '',
      displayName: '',
      method: 'wallet',
      error: 'Invalid input'
    };
  }

  const trimmedInput = input.trim();
  
  // Case 1: Already a valid wallet address
  if (isValidWalletAddress(trimmedInput)) {
    // Try to get a better display name (ENS or username)
    let displayName = trimmedInput;
    try {
      const ensName = await ensCache.resolveENS(trimmedInput);
      if (ensName) {
        displayName = ensName;
      } else {
        const username = await userService.getUsernameByWallet(trimmedInput);
        if (username) {
          displayName = username;
        }
      }
    } catch (error) {
      console.warn('Failed to get display name for wallet address:', error);
    }
    
    return {
      address: trimmedInput,
      displayName,
      method: 'wallet'
    };
  }
  
  // Case 2: ENS name
  if (isENSName(trimmedInput)) {
    const resolvedAddress = await resolveENSName(trimmedInput);
    
    if (resolvedAddress) {
      return {
        address: resolvedAddress,
        displayName: trimmedInput,
        method: 'ens'
      };
    } else {
      return {
        address: '',
        displayName: trimmedInput,
        method: 'ens',
        error: 'ENS name not found or resolution failed'
      };
    }
  }
  
  // Case 3: Username
  const resolvedAddress = await resolveUsername(trimmedInput);
  
  if (resolvedAddress) {
    return {
      address: resolvedAddress,
      displayName: trimmedInput,
      method: 'username'
    };
  } else {
    return {
      address: '',
      displayName: trimmedInput,
      method: 'username',
      error: 'Username not found'
    };
  }
}

/**
 * Batch resolver for multiple inputs
 */
export async function resolveMultipleAddresses(inputs: string[]): Promise<ResolvedAddress[]> {
  const promises = inputs.map(input => resolveToWalletAddress(input));
  return Promise.all(promises);
}

/**
 * Helper function to format resolution results for display
 */
export function formatResolvedAddress(resolved: ResolvedAddress): string {
  if (resolved.error) {
    return `❌ ${resolved.displayName} (${resolved.error})`;
  }
  
  const shortAddress = `${resolved.address.slice(0, 6)}...${resolved.address.slice(-4)}`;
  
  switch (resolved.method) {
    case 'ens':
      return `🏷️ ${resolved.displayName} → ${shortAddress}`;
    case 'username':
      return `👤 ${resolved.displayName} → ${shortAddress}`;
    case 'wallet':
      return resolved.displayName === resolved.address 
        ? `📋 ${shortAddress}`
        : `📋 ${resolved.displayName} (${shortAddress})`;
    default:
      return shortAddress;
  }
}