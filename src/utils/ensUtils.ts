import { formatAddress, client } from '../thirdweb';
import { resolveName } from 'thirdweb/extensions/ens';
import { ethereum } from 'thirdweb/chains';

interface ENSCacheEntry {
  ensName: string | null;
  timestamp: number;
  loading?: boolean;
}

interface ENSCache {
  [walletAddress: string]: ENSCacheEntry;
}

class ENSCacheManager {
  private cache: ENSCache = {};
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 200;
  private loadingPromises: Map<string, Promise<string | null>> = new Map();

  private isExpired(entry: ENSCacheEntry): boolean {
    return Date.now() - entry.timestamp > this.CACHE_TTL;
  }

  private evictOldEntries(): void {
    const entries = Object.entries(this.cache)
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);
    
    if (entries.length > this.MAX_CACHE_SIZE) {
      const toRemove = entries.slice(0, entries.length - this.MAX_CACHE_SIZE);
      toRemove.forEach(([address]) => {
        delete this.cache[address];
      });
    }
  }

  private async resolveENSFromThirdweb(walletAddress: string): Promise<string | null> {
    try {
      // Defensive check for wallet address
      if (!walletAddress || typeof walletAddress !== 'string') {
        console.warn('Invalid wallet address for ENS resolution:', walletAddress);
        return null;
      }
      
      // Ensure address starts with 0x and has proper length
      if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
        console.warn('Invalid wallet address format for ENS resolution:', walletAddress);
        return null;
      }
      
      // Use Thirdweb's ENS resolution
      console.log(`🔍 Resolving ENS for ${walletAddress} using Thirdweb...`);
      const ensName = await resolveName({
        client,
        address: walletAddress as `0x${string}`,
        resolverChain: ethereum,
      });
      
      console.log(`✅ ENS resolution for ${walletAddress}: ${ensName || 'null'}`);
      return ensName || null;
    } catch (error) {
      console.warn(`ENS resolution failed for ${walletAddress}:`, error);
      return null;
    }
  }


  getCachedENS(walletAddress: string): string | null | undefined {
    if (!walletAddress) return null;
    
    const normalizedAddress = walletAddress.toLowerCase();
    const entry = this.cache[normalizedAddress];
    
    if (!entry) return undefined; // Not cached
    if (this.isExpired(entry)) {
      delete this.cache[normalizedAddress];
      return undefined; // Expired
    }
    
    return entry.ensName;
  }

  setCachedENS(walletAddress: string, ensName: string | null): void {
    if (!walletAddress) return;
    
    const normalizedAddress = walletAddress.toLowerCase();
    this.cache[normalizedAddress] = {
      ensName,
      timestamp: Date.now(),
      loading: false
    };
    
    this.evictOldEntries();
  }

  async resolveENS(walletAddress: string): Promise<string | null> {
    if (!walletAddress) return null;
    
    const normalizedAddress = walletAddress.toLowerCase();
    
    // Check cache first
    const cached = this.getCachedENS(walletAddress);
    if (cached !== undefined) {
      return cached;
    }
    
    // Check if already loading
    const existingPromise = this.loadingPromises.get(normalizedAddress);
    if (existingPromise) {
      return existingPromise;
    }
    
    // Set loading state
    this.cache[normalizedAddress] = {
      ensName: null,
      timestamp: Date.now(),
      loading: true
    };
    
    // Create and cache the promise
    const promise = this.resolveENSFromThirdweb(walletAddress)
      .then(ensName => {
        this.setCachedENS(walletAddress, ensName);
        this.loadingPromises.delete(normalizedAddress);
        return ensName;
      })
      .catch(error => {
        console.warn(`ENS resolution failed for ${walletAddress}:`, error);
        // Cache null result to avoid repeated failed attempts
        this.setCachedENS(walletAddress, null);
        this.loadingPromises.delete(normalizedAddress);
        return null;
      });
    
    this.loadingPromises.set(normalizedAddress, promise);
    return promise;
  }

  async batchResolveENS(walletAddresses: string[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();
    const addressesToResolve: string[] = [];
    
    // Check cache for each address
    for (const address of walletAddresses) {
      if (!address) continue;
      
      const cached = this.getCachedENS(address);
      if (cached !== undefined) {
        results.set(address, cached);
      } else {
        addressesToResolve.push(address);
      }
    }
    
    // Resolve missing ENS names (with rate limiting)
    if (addressesToResolve.length > 0) {
      // Process in small batches to avoid rate limiting
      const batchSize = 3;
      for (let i = 0; i < addressesToResolve.length; i += batchSize) {
        const batch = addressesToResolve.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (address) => {
          const ensName = await this.resolveENS(address);
          results.set(address, ensName);
          return { address, ensName };
        });
        
        await Promise.all(batchPromises);
        
        // Add delay between batches to be respectful to RPC
        if (i + batchSize < addressesToResolve.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    return results;
  }

  isLoading(walletAddress: string): boolean {
    if (!walletAddress) return false;
    
    const normalizedAddress = walletAddress.toLowerCase();
    const entry = this.cache[normalizedAddress];
    return entry?.loading === true || this.loadingPromises.has(normalizedAddress);
  }

  clearCache(): void {
    this.cache = {};
    this.loadingPromises.clear();
  }

  // Get cache stats for debugging
  getCacheStats() {
    return {
      size: Object.keys(this.cache).length,
      loading: this.loadingPromises.size,
      entries: Object.fromEntries(
        Object.entries(this.cache).map(([addr, entry]) => [
          addr,
          {
            hasENS: !!entry.ensName,
            ensName: entry.ensName,
            age: Math.round((Date.now() - entry.timestamp) / 1000),
            loading: entry.loading
          }
        ])
      )
    };
  }
}

// Export singleton instance
export const ensCache = new ENSCacheManager();

// Helper functions for components
export const getENSNameIfAvailable = async (walletAddress: string): Promise<string | null> => {
  return ensCache.resolveENS(walletAddress);
};

export const getBestDisplayName = async (
  walletAddress: string, 
  username?: string | null
): Promise<string> => {
  // Priority: 1. Database username, 2. ENS name, 3. Formatted address
  if (username) {
    return username;
  }
  
  const ensName = await getENSNameIfAvailable(walletAddress);
  if (ensName) {
    return ensName;
  }
  
  return formatAddress(walletAddress);
};

// Batch version for multiple addresses
export const getBestDisplayNames = async (
  addresses: Array<{ address: string; username?: string | null }>
): Promise<Map<string, string>> => {
  const results = new Map<string, string>();
  const addressesNeedingENS: string[] = [];
  
  // Defensive check for input
  if (!Array.isArray(addresses)) {
    console.warn('getBestDisplayNames called with non-array:', addresses);
    return results;
  }
  
  // First pass: handle addresses with usernames
  for (const item of addresses) {
    // Defensive checks for each item
    if (!item || typeof item !== 'object') {
      console.warn('Invalid item in getBestDisplayNames:', item);
      continue;
    }
    
    const { address, username } = item;
    
    // Check address validity
    if (!address || typeof address !== 'string') {
      console.warn('Invalid address in getBestDisplayNames:', address);
      continue;
    }
    if (username) {
      results.set(address, username);
    } else {
      addressesNeedingENS.push(address);
    }
  }
  
  // Second pass: resolve ENS for remaining addresses
  if (addressesNeedingENS.length > 0) {
    const ensResults = await ensCache.batchResolveENS(addressesNeedingENS);
    
    for (const address of addressesNeedingENS) {
      const ensName = ensResults.get(address);
      results.set(address, ensName || formatAddress(address));
    }
  }
  
  return results;
};