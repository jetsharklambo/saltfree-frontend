interface CacheEntry {
  username: string | null;
  timestamp: number;
  loading?: boolean;
}

interface UsernameCache {
  [walletAddress: string]: CacheEntry;
}

class UsernameCacheManager {
  private cache: UsernameCache = {};
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;
  private loadingPromises: Map<string, Promise<string | null>> = new Map();

  private isExpired(entry: CacheEntry): boolean {
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

  getCachedUsername(walletAddress: string): string | null | undefined {
    if (!walletAddress) return null;
    
    const normalizedAddress = walletAddress.toLowerCase();
    const entry = this.cache[normalizedAddress];
    
    if (!entry) return undefined; // Not cached
    if (this.isExpired(entry)) {
      delete this.cache[normalizedAddress];
      return undefined; // Expired
    }
    
    return entry.username;
  }

  setCachedUsername(walletAddress: string, username: string | null): void {
    if (!walletAddress) return;
    
    const normalizedAddress = walletAddress.toLowerCase();
    this.cache[normalizedAddress] = {
      username,
      timestamp: Date.now(),
      loading: false
    };
    
    this.evictOldEntries();
  }

  async fetchUsername(
    walletAddress: string, 
    fetchFn: (address: string) => Promise<string | null>
  ): Promise<string | null> {
    if (!walletAddress) return null;
    
    const normalizedAddress = walletAddress.toLowerCase();
    
    // Check cache first
    const cached = this.getCachedUsername(walletAddress);
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
      username: null,
      timestamp: Date.now(),
      loading: true
    };
    
    // Create and cache the promise
    const promise = fetchFn(walletAddress)
      .then(username => {
        this.setCachedUsername(walletAddress, username);
        this.loadingPromises.delete(normalizedAddress);
        return username;
      })
      .catch(error => {
        console.warn(`Failed to fetch username for ${walletAddress}:`, error);
        // Cache null result to avoid repeated failed attempts
        this.setCachedUsername(walletAddress, null);
        this.loadingPromises.delete(normalizedAddress);
        return null;
      });
    
    this.loadingPromises.set(normalizedAddress, promise);
    return promise;
  }

  async batchFetchUsernames(
    walletAddresses: string[],
    batchFetchFn: (addresses: string[]) => Promise<Map<string, string | null>>
  ): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();
    const addressesToFetch: string[] = [];
    
    // Check cache for each address
    for (const address of walletAddresses) {
      if (!address) continue;
      
      const cached = this.getCachedUsername(address);
      if (cached !== undefined) {
        results.set(address, cached);
      } else {
        addressesToFetch.push(address);
      }
    }
    
    // Fetch missing usernames in batch
    if (addressesToFetch.length > 0) {
      try {
        const fetchedResults = await batchFetchFn(addressesToFetch);
        
        // Cache the results
        for (const [address, username] of fetchedResults) {
          this.setCachedUsername(address, username);
          results.set(address, username);
        }
      } catch (error) {
        console.warn('Batch username fetch failed:', error);
        // Set null for all failed addresses
        addressesToFetch.forEach(address => {
          this.setCachedUsername(address, null);
          results.set(address, null);
        });
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
            hasUsername: !!entry.username,
            age: Math.round((Date.now() - entry.timestamp) / 1000),
            loading: entry.loading
          }
        ])
      )
    };
  }
}

// Export singleton instance
export const usernameCache = new UsernameCacheManager();

// Helper function for components
export const getCachedUsernameOrFetch = async (
  walletAddress: string,
  fetchFn: (address: string) => Promise<string | null>
): Promise<string | null> => {
  return usernameCache.fetchUsername(walletAddress, fetchFn);
};