/**
 * RPC Endpoint Manager
 * Handles dynamic block limits, health monitoring, and smart fallback for Base network RPC endpoints
 */

export interface RpcEndpointConfig {
  url: string;
  name: string;
  maxBlockRange: number;
  priority: number; // Lower = higher priority
  hasCorsBrowser: boolean; // Can be used from browser
  rateLimit?: {
    requestsPerSecond: number;
    burstLimit: number;
  };
  lastError?: {
    timestamp: number;
    error: string;
    consecutiveFailures: number;
  };
}

// Base network RPC endpoints with their actual limitations
export const BASE_RPC_ENDPOINTS: RpcEndpointConfig[] = [
  {
    url: 'https://mainnet.base.org',
    name: 'Base Official',
    maxBlockRange: 10000, // Conservative limit to avoid 503 errors
    priority: 1,
    hasCorsBrowser: true,
    rateLimit: {
      requestsPerSecond: 10,
      burstLimit: 20
    }
  },
  {
    url: 'https://base.publicnode.com',
    name: 'PublicNode',
    maxBlockRange: 50000, // Known limit from error logs
    priority: 2,
    hasCorsBrowser: true,
    rateLimit: {
      requestsPerSecond: 15,
      burstLimit: 30
    }
  },
  {
    url: 'https://base.llamarpc.com',
    name: 'LlamaRPC',
    maxBlockRange: 1000, // Known limit from error logs
    priority: 3,
    hasCorsBrowser: true,
    rateLimit: {
      requestsPerSecond: 20,
      burstLimit: 40
    }
  },
  {
    url: 'https://base-mainnet.g.alchemy.com/v2/demo',
    name: 'Alchemy Demo',
    maxBlockRange: 2000,
    priority: 4,
    hasCorsBrowser: false, // CORS issues in browser
    rateLimit: {
      requestsPerSecond: 5,
      burstLimit: 10
    }
  },
  {
    url: 'https://base.meowrpc.com',
    name: 'MeowRPC',
    maxBlockRange: 5000,
    priority: 5,
    hasCorsBrowser: false, // CORS issues in browser
    rateLimit: {
      requestsPerSecond: 10,
      burstLimit: 20
    }
  }
];

export class RpcManager {
  private endpoints: RpcEndpointConfig[];
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(endpoints: RpcEndpointConfig[] = BASE_RPC_ENDPOINTS) {
    this.endpoints = [...endpoints];
  }

  /**
   * Get the best available endpoints for a given block range
   */
  getBestEndpoints(blockRange: number, requireCorsBrowser: boolean = true): RpcEndpointConfig[] {
    const now = Date.now();
    const FAILURE_COOLDOWN = 60000; // 1 minute cooldown after failure

    return this.endpoints
      .filter(endpoint => {
        // Filter out CORS-blocked endpoints if running in browser
        if (requireCorsBrowser && !endpoint.hasCorsBrowser) {
          return false;
        }

        // Skip endpoints with recent failures
        if (endpoint.lastError && 
            endpoint.lastError.consecutiveFailures >= 3 &&
            now - endpoint.lastError.timestamp < FAILURE_COOLDOWN) {
          return false;
        }

        // Must support the required block range
        return endpoint.maxBlockRange >= blockRange;
      })
      .sort((a, b) => {
        // Sort by priority, then by max block range (higher = better)
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return b.maxBlockRange - a.maxBlockRange;
      });
  }

  /**
   * Check if we can make a request to this endpoint (rate limiting)
   */
  canMakeRequest(endpoint: RpcEndpointConfig): boolean {
    const now = Date.now();
    const requestInfo = this.requestCounts.get(endpoint.url);

    if (!requestInfo || now > requestInfo.resetTime) {
      // Reset the counter
      this.requestCounts.set(endpoint.url, {
        count: 1,
        resetTime: now + 1000 // Reset every second
      });
      return true;
    }

    if (!endpoint.rateLimit) {
      return true;
    }

    return requestInfo.count < endpoint.rateLimit.burstLimit;
  }

  /**
   * Record a request to update rate limiting
   */
  recordRequest(endpoint: RpcEndpointConfig): void {
    const now = Date.now();
    const requestInfo = this.requestCounts.get(endpoint.url);

    if (!requestInfo || now > requestInfo.resetTime) {
      this.requestCounts.set(endpoint.url, {
        count: 1,
        resetTime: now + 1000
      });
    } else {
      requestInfo.count++;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(endpoint: RpcEndpointConfig): void {
    const endpointConfig = this.endpoints.find(e => e.url === endpoint.url);
    if (endpointConfig && endpointConfig.lastError) {
      delete endpointConfig.lastError;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(endpoint: RpcEndpointConfig, error: string): void {
    const endpointConfig = this.endpoints.find(e => e.url === endpoint.url);
    if (endpointConfig) {
      const now = Date.now();
      if (endpointConfig.lastError) {
        endpointConfig.lastError.consecutiveFailures++;
        endpointConfig.lastError.timestamp = now;
        endpointConfig.lastError.error = error;
      } else {
        endpointConfig.lastError = {
          timestamp: now,
          error,
          consecutiveFailures: 1
        };
      }
    }
  }

  /**
   * Calculate optimal chunk size for a block range and endpoint
   */
  getOptimalChunkSize(totalBlocks: number, endpoint: RpcEndpointConfig): number {
    const maxChunk = Math.min(endpoint.maxBlockRange, totalBlocks);
    
    // Use smaller chunks for less reliable endpoints
    if (endpoint.priority >= 4) {
      return Math.min(maxChunk, 500);
    } else if (endpoint.priority >= 3) {
      return Math.min(maxChunk, 2000);
    } else {
      return maxChunk;
    }
  }

  /**
   * Split a block range into optimal chunks for processing
   */
  splitIntoChunks(fromBlock: number, toBlock: number, endpoint: RpcEndpointConfig): Array<{fromBlock: number, toBlock: number}> {
    const totalBlocks = toBlock - fromBlock + 1;
    const chunkSize = this.getOptimalChunkSize(totalBlocks, endpoint);
    
    const chunks: Array<{fromBlock: number, toBlock: number}> = [];
    let currentBlock = fromBlock;
    
    while (currentBlock <= toBlock) {
      const chunkEnd = Math.min(currentBlock + chunkSize - 1, toBlock);
      chunks.push({
        fromBlock: currentBlock,
        toBlock: chunkEnd
      });
      currentBlock = chunkEnd + 1;
    }
    
    return chunks;
  }

  /**
   * Get endpoint statistics for debugging
   */
  getEndpointStats(): any {
    return this.endpoints.map(endpoint => ({
      name: endpoint.name,
      url: endpoint.url,
      maxBlockRange: endpoint.maxBlockRange,
      priority: endpoint.priority,
      hasCorsBrowser: endpoint.hasCorsBrowser,
      lastError: endpoint.lastError,
      requestCount: this.requestCounts.get(endpoint.url),
      isHealthy: this.isEndpointHealthy(endpoint)
    }));
  }

  /**
   * Check if an endpoint is currently healthy
   */
  private isEndpointHealthy(endpoint: RpcEndpointConfig): boolean {
    const now = Date.now();
    const FAILURE_COOLDOWN = 60000; // 1 minute cooldown after failure
    
    if (endpoint.lastError && 
        endpoint.lastError.consecutiveFailures >= 3 &&
        now - endpoint.lastError.timestamp < FAILURE_COOLDOWN) {
      return false;
    }
    
    return true;
  }

  /**
   * Get health status of all endpoints
   */
  getHealthStatus(): { healthy: number; total: number; details: any[] } {
    const details = this.endpoints.map(endpoint => ({
      name: endpoint.name,
      healthy: this.isEndpointHealthy(endpoint),
      consecutiveFailures: endpoint.lastError?.consecutiveFailures || 0,
      lastError: endpoint.lastError?.error,
      lastErrorTime: endpoint.lastError?.timestamp
    }));
    
    const healthy = details.filter(d => d.healthy).length;
    
    return {
      healthy,
      total: this.endpoints.length,
      details
    };
  }

  /**
   * Reset error state for an endpoint (manual recovery)
   */
  resetEndpointErrors(endpointUrl: string): void {
    const endpoint = this.endpoints.find(e => e.url === endpointUrl);
    if (endpoint && endpoint.lastError) {
      delete endpoint.lastError;
    }
  }

  /**
   * Execute an RPC request with smart retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    requestFn: (endpoint: RpcEndpointConfig) => Promise<T>,
    blockRange: number,
    requireCorsBrowser: boolean = true,
    maxRetries: number = 3
  ): Promise<T> {
    const availableEndpoints = this.getBestEndpoints(blockRange, requireCorsBrowser);
    
    if (availableEndpoints.length === 0) {
      throw new Error(`No RPC endpoints available for block range ${blockRange}`);
    }

    let lastError: Error | null = null;
    
    // Try each endpoint
    for (let endpointIndex = 0; endpointIndex < availableEndpoints.length; endpointIndex++) {
      const endpoint = availableEndpoints[endpointIndex];
      
      // Check rate limiting
      if (!this.canMakeRequest(endpoint)) {
        console.log(`⏰ Rate limit hit for ${endpoint.name}, trying next endpoint`);
        continue;
      }
      
      // Retry logic for current endpoint
      for (let retryAttempt = 0; retryAttempt <= maxRetries; retryAttempt++) {
        try {
          // Calculate backoff delay (exponential: 0ms, 1s, 2s, 4s)
          if (retryAttempt > 0) {
            const delay = Math.min(1000 * Math.pow(2, retryAttempt - 1), 10000); // Max 10s
            console.log(`🔄 Retry ${retryAttempt}/${maxRetries} for ${endpoint.name} after ${delay}ms delay`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          this.recordRequest(endpoint);
          const result = await requestFn(endpoint);
          
          // Success - record it and return
          this.recordSuccess(endpoint);
          console.log(`✅ Request succeeded on ${endpoint.name} (attempt ${retryAttempt + 1})`);
          return result;
          
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.warn(`❌ Attempt ${retryAttempt + 1}/${maxRetries + 1} failed for ${endpoint.name}:`, lastError.message);
          
          // Record failure
          this.recordFailure(endpoint, lastError.message);
          
          // If this was the last retry for this endpoint, try next endpoint
          if (retryAttempt === maxRetries) {
            break;
          }
          
          // For certain errors, don't retry (block range too large, CORS)
          if (lastError.message.includes('exceed maximum block range') ||
              lastError.message.includes('too large') ||
              lastError.message.includes('CORS') ||
              lastError.message.includes('NetworkError')) {
            console.log(`🚫 Non-retryable error for ${endpoint.name}, moving to next endpoint`);
            break;
          }
        }
      }
    }
    
    // All endpoints and retries failed
    throw lastError || new Error('All RPC endpoints failed');
  }
}

// Singleton instance
export const rpcManager = new RpcManager();