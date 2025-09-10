import React, { createContext, useContext, useState, useCallback } from 'react';
import { getGameContract, decodeStringFromHex, decodeGameStartedEvent, decodePlayerJoinedEvent, decodeGameLockedEvent, decodeWinnersReportedEvent, CONTRACT_ADDRESS } from '../thirdweb';
import { logBuyInInfo } from '../utils/buyInUtils';
import { databaseService } from '../services/databaseService';
import { useUser } from './UserContext';
import { logger, logGameAction, logContractCall, logPerformance } from '../utils/logger';
import { rpcManager } from '../utils/rpcManager';
import { validation } from '../utils/envUtils';
import { pollForRecentGames } from '../utils/gamePolling';

import { readContract, getContractEvents, getRpcClient, eth_blockNumber, prepareEvent, eth_getLogs } from 'thirdweb';

// Prepared events for efficient querying - Updated for UP2.1 contract
const gameStartedEvent = prepareEvent({
  signature: "event GameStarted(string code, address indexed host, address token, uint256 buyIn, uint256 maxPlayers, address[] judges)"
});

const judgeSetEvent = prepareEvent({
  signature: "event JudgeSet(string code, address indexed judge)"
});

const playerJoinedEvent = prepareEvent({
  signature: "event PlayerJoined(string code, address indexed player, address token, uint256 amount)"
});

const playerRemovedEvent = prepareEvent({
  signature: "event PlayerRemoved(string code, address indexed participant)"
});

const gameLockedEvent = prepareEvent({
  signature: "event GameLocked(string code)"
});

const prizeSplitsSetEvent = prepareEvent({
  signature: "event PrizeSplitsSet(string code, uint256[] splits)"
});

const potAddedEvent = prepareEvent({
  signature: "event PotAdded(string code, address indexed sender, uint256 amount)"
});

const winnersReportedEvent = prepareEvent({
  signature: "event WinnersReported(string code, address indexed reporter, address[] winners)"
});

const winnerSetConfirmedEvent = prepareEvent({
  signature: "event WinnerSetConfirmed(string code, address[] winners)"
});

const winningsClaimedEvent = prepareEvent({
  signature: "event WinningsClaimed(string code, address indexed winner, uint256 amount)"
});

// Constants for blockchain searching
const BLOCKS_IN_6_DAYS = 43200; // Approximately 6 days worth of blocks (assuming ~12 second blocks)

// All events array for comprehensive searching - Updated for UP2.1 contract
const allGameEvents = [
  gameStartedEvent,
  judgeSetEvent,
  playerJoinedEvent,
  playerRemovedEvent,
  gameLockedEvent,
  prizeSplitsSetEvent,
  potAddedEvent,
  winnersReportedEvent,
  winnerSetConfirmedEvent,
  winningsClaimedEvent
];

// Direct RPC function using Thirdweb client with chunking (replaces getContractEvents)
async function getEventsViaRPC({
  contract,
  fromBlock,
  toBlock,
  userAddress,
}: {
  contract: any;
  fromBlock: number;
  toBlock: number;
  userAddress?: string;
}): Promise<any[]> {
  const totalBlocks = toBlock - fromBlock + 1;
  
  // Skip Thirdweb for large ranges to avoid 1000-block limit error
  if (totalBlocks > 1000) {
    logger.debug(`Large range detected (${totalBlocks} blocks), using direct RPC`, {
      component: 'GameDataContext',
      totalBlocks,
      fromBlock,
      toBlock
    });
    return await getEventsFromDirectRPC({
      contractAddress: contract.address,
      fromBlock,
      toBlock,
      userAddress,
    });
  }
  
  // For small ranges, try Thirdweb first
  try {
    const rpcClient = getRpcClient({ 
      client: contract.client, 
      chain: contract.chain 
    });
    
    logger.debug(`Using Thirdweb RPC client`, {
      component: 'GameDataContext',
      fromBlock,
      toBlock,
      totalBlocks
    });
    
    // Since we're only using Thirdweb for small ranges now, make single request
    {
      const filter: any = {
        address: contract.address,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock),
      };
      
      // If userAddress provided, add topic filter for user involvement
      if (userAddress) {
        const userTopic = `0x000000000000000000000000${userAddress.slice(2).toLowerCase()}`;
        filter.topics = [
          null, // Any event signature
          userTopic // User address in indexed parameters
        ];
      }
      
      const logs = await eth_getLogs(rpcClient, filter);
      logger.debug(`Thirdweb request completed`, {
        component: 'GameDataContext',
        logsFound: logs.length
      });
      return logs;
    }
    
  } catch (error) {
    logger.warn('Thirdweb RPC failed, falling back to direct RPC', {
      component: 'GameDataContext',
      error: error instanceof Error ? error.message : String(error),
      fromBlock,
      toBlock
    });
    // Fallback to direct RPC calls
    return await getEventsFromDirectRPC({
      contractAddress: contract.address,
      fromBlock,
      toBlock,
      userAddress,
    });
  }
}

// Direct RPC implementation with dynamic chunking and smart endpoint selection
async function getEventsFromDirectRPC({
  contractAddress,
  fromBlock,
  toBlock,
  userAddress,
}: {
  contractAddress: string;
  fromBlock: number;
  toBlock: number;
  userAddress?: string;
}): Promise<any[]> {
  const totalBlocks = toBlock - fromBlock + 1;
  
  // Get best endpoints that can handle this range
  const availableEndpoints = rpcManager.getBestEndpoints(totalBlocks, true);
  
  if (availableEndpoints.length === 0) {
    throw new Error(`No RPC endpoints available for block range ${totalBlocks}`);
  }
  
  // If userAddress provided, we need to search in multiple indexed positions
  const buildSearchQueries = (fromBlock: number, toBlock: number) => {
    const baseParams = {
      address: contractAddress,
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`,
    };
    
    if (userAddress) {
      const userTopic = `0x000000000000000000000000${userAddress.slice(2).toLowerCase()}`;
      return [
        { ...baseParams, topics: [null, userTopic] },           // User in 1st indexed position
        { ...baseParams, topics: [null, null, userTopic] },     // User in 2nd indexed position  
        { ...baseParams, topics: [null, null, null, userTopic] } // User in 3rd indexed position
      ];
    } else {
      return [{ ...baseParams }]; // All events
    }
  };
  
  // Try each endpoint in priority order
  for (let i = 0; i < availableEndpoints.length; i++) {
    const endpoint = availableEndpoints[i];
    
    try {
      console.log(`🌐 Trying direct RPC endpoint ${i + 1}/${availableEndpoints.length}: ${endpoint.name}`);
      
      // Check rate limiting
      if (!rpcManager.canMakeRequest(endpoint)) {
        console.log(`⏰ Rate limit hit for ${endpoint.name}, trying next endpoint`);
        continue;
      }
      
      let allLogs: any[] = [];
      
      // Split into optimal chunks for this endpoint
      const chunks = rpcManager.splitIntoChunks(fromBlock, toBlock, endpoint);
      console.log(`📊 Split ${totalBlocks} blocks into ${chunks.length} chunks for ${endpoint.name}`);
      
      // Process each chunk
      for (const chunk of chunks) {
        const searchQueries = buildSearchQueries(chunk.fromBlock, chunk.toBlock);
        
        // Execute all search queries for this chunk
        for (let queryIdx = 0; queryIdx < searchQueries.length; queryIdx++) {
          // Record the request for rate limiting
          rpcManager.recordRequest(endpoint);
          
          const response = await fetch(endpoint.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getLogs',
              params: [searchQueries[queryIdx]],
              id: Date.now() + queryIdx,
            }),
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (data.error) {
            throw new Error(`RPC Error: ${data.error.message}`);
          }
          
          const logs = data.result || [];
          console.log(`📊 Query ${queryIdx + 1}/${searchQueries.length} found ${logs.length} events (chunk ${chunk.fromBlock}-${chunk.toBlock})`);
          allLogs.push(...logs);
          
          // Small delay between requests to respect rate limits
          if (queryIdx < searchQueries.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
      
      // Remove duplicates by block number + transaction index + log index
      const uniqueLogs = allLogs.filter((log, index, self) => 
        index === self.findIndex(l => 
          l.blockNumber === log.blockNumber && 
          l.transactionIndex === log.transactionIndex && 
          l.logIndex === log.logIndex
        )
      );
      
      console.log(`✅ Successfully got ${uniqueLogs.length} unique events from ${endpoint.name}`);
      
      // Record success
      rpcManager.recordSuccess(endpoint);
      
      return uniqueLogs;
      
    } catch (error) {
      console.warn(`❌ Direct RPC endpoint ${endpoint.name} failed:`, error);
      
      // Record failure
      rpcManager.recordFailure(endpoint, error instanceof Error ? error.message : String(error));
      
      // If this is the last endpoint, throw the error
      if (i === availableEndpoints.length - 1) {
        logger.error('All direct RPC endpoints failed', error instanceof Error ? error : new Error(String(error)), {
          component: 'GameDataContext',
          contractAddress,
          fromBlock,
          toBlock,
          error: error
        });
        throw error;
      }
      
      // Add delay before trying next endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return [];
}

// Helper function to get event name from signature (copied from pony-upv4)
function getEventName(signature?: string): string | null {
  if (!signature) return null;
  
  const eventMap: Record<string, string> = {
    '0xf38f031a0916124649a52ef62ca68c773c22f2386d78bb4aed755a298c7b18d3': 'GameStarted', // Calculated from GameStarted(string,address,address,uint256,uint256,address[])
    '0x651823ece9ef08ab9d5d4e19bebb603e316362fb41f7ee2e03e7f1684c1852b4': 'PlayerJoined', // Calculated from PlayerJoined(string,address,address,uint256)
    '0xf8ff7b65f89533529cfb22afeca74e7a0a22760b35258fa00cf0388cd2c13bb3': 'WinnersReported',
    '0xe3574ea7f4f8590b62692642ffda0055801ec44f42c76bcaa9c45453da24319f': 'GameLocked',
    '0x7175967b5ddee4d7986318165167133a8c193aa59b05f411ec131d4f124a3f3d': 'WinningsClaimed',
    '0x8a3f510bd40a2bff6e6502777e1359083e910aef0aa28a765f4fa8d84871ba67': 'PrizeSplitsSet'
  };
  
  return eventMap[signature.toLowerCase()] || null;
}

// Ultra-efficient wallet-based transaction finder using RpcManager
async function findLastContractInteraction(
  userAddress: string, 
  contractAddress: string,
  currentBlock: number
): Promise<number | null> {
  console.log(`💎 Scanning wallet ${userAddress} for last interaction with ${contractAddress}`);

  // Strategy: Progressive search through recent blocks to find last transaction to our contract
  const SEARCH_RANGES = [10000, 50000, 100000]; // Progressive search ranges
  
  for (const range of SEARCH_RANGES) {
    const fromBlock = Math.max(0, currentBlock - range);
    const toBlock = currentBlock;
    
    console.log(`🔍 Checking wallet transactions in range ${fromBlock} to ${toBlock} (${range} blocks)`);
    
    // Get best endpoints for this range
    const availableEndpoints = rpcManager.getBestEndpoints(range, true);
    
    for (const endpoint of availableEndpoints) {
      try {
        console.log(`🌐 Trying endpoint ${endpoint.name} for wallet scan`);
        
        // Check rate limiting
        if (!rpcManager.canMakeRequest(endpoint)) {
          console.log(`⏰ Rate limit hit for ${endpoint.name}, trying next endpoint`);
          continue;
        }
        
        // Split into chunks if needed
        const chunks = rpcManager.splitIntoChunks(fromBlock, toBlock, endpoint);
        let allLogs: any[] = [];
        
        for (const chunk of chunks) {
          // Make 3 separate queries to search user in different indexed positions
          const userTopic = `0x000000000000000000000000${userAddress.slice(2).toLowerCase()}`;
          const searchQueries = [
            { topics: [null, userTopic] },     // User in 1st indexed position
            { topics: [null, null, userTopic] }, // User in 2nd indexed position
            { topics: [null, null, null, userTopic] }, // User in 3rd indexed position
          ];
          
          for (let i = 0; i < searchQueries.length; i++) {
            rpcManager.recordRequest(endpoint);
            
            const response = await fetch(endpoint.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_getLogs',
                params: [{
                  fromBlock: `0x${chunk.fromBlock.toString(16)}`,
                  toBlock: `0x${chunk.toBlock.toString(16)}`,
                  address: contractAddress,
                  ...searchQueries[i]
                }],
                id: Date.now() + i,
              }),
            });

            if (!response.ok) continue;
            
            const data = await response.json();
            if (data.error) continue;

            const logs = data.result || [];
            console.log(`📊 Query ${i+1}/3 found ${logs.length} events (user in position ${i+1})`);
            allLogs.push(...logs);
            
            // Small delay between requests
            if (i < searchQueries.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }
        
        console.log(`📊 Found ${allLogs.length} total events in ${range}-block range`);
        
        if (allLogs.length > 0) {
          // Find the most recent transaction
          const sortedLogs = allLogs.sort((a: any, b: any) => {
            return parseInt(b.blockNumber, 16) - parseInt(a.blockNumber, 16);
          });
          
          const lastBlock = parseInt(sortedLogs[0].blockNumber, 16);
          console.log(`🎯 Last wallet interaction found at block ${lastBlock} via ${endpoint.name}`);
          
          // Record success
          rpcManager.recordSuccess(endpoint);
          
          return lastBlock;
        }
        
        break; // Try next range
        
      } catch (error) {
        console.warn(`❌ Wallet scan failed on ${endpoint.name}:`, error);
        rpcManager.recordFailure(endpoint, error instanceof Error ? error.message : String(error));
        continue;
      }
    }
  }
  
  console.log('📭 No wallet interactions found with contract');
  return null;
}

// Smart function to find user's last interaction with contract (LEGACY - keeping for fallback)
async function findLastUserTransaction(
  contract: any,
  userAddress: string,
  currentBlock: number
): Promise<number | null> {
  const SEARCH_CHUNK = 5000; // Increased from 1000 to 5000 for faster discovery
  const MAX_SEARCH_ITERATIONS = 20; // Increased to cover more history with larger chunks
  
  console.log(`🔍 Finding last interaction for ${userAddress} starting from block ${currentBlock}`);
  
  // Search backwards from current block in 5000-block chunks
  for (let i = 0; i < MAX_SEARCH_ITERATIONS; i++) {
    const toBlock = currentBlock - (i * SEARCH_CHUNK);
    const fromBlock = Math.max(0, toBlock - SEARCH_CHUNK + 1);
    
    if (fromBlock >= toBlock || fromBlock < 0) break;
    
    console.log(`🔎 Searching chunk ${i + 1}: blocks ${fromBlock} to ${toBlock} (${SEARCH_CHUNK} blocks)`);
    
    try {
      const logs = await getEventsViaRPC({
        contract,
        fromBlock,
        toBlock,
        userAddress
      });
      
      if (logs.length > 0) {
        // Found activity! Return the most recent block number
        const mostRecentBlock = Math.max(...logs.map((log: any) => parseInt(log.blockNumber, 16)));
        console.log(`✅ Found last user transaction at block ${mostRecentBlock}`);
        return mostRecentBlock;
      }
      
      console.log(`📭 No activity found in blocks ${fromBlock} to ${toBlock}`);
      
    } catch (error) {
      console.error(`❌ Error searching blocks ${fromBlock} to ${toBlock}:`, error);
      continue; // Try next chunk
    }
  }
  
  console.log(`📭 No recent activity found for ${userAddress} after ${MAX_SEARCH_ITERATIONS} chunks`);
  return null;
}

// Helper function to check if user is involved in a Thirdweb event
function checkIfUserInvolvedInEvent(event: any, userAddress: string): boolean {
  if (!event.args) return false;
  
  const userAddressLower = userAddress.toLowerCase();
  
  // Check all event arguments for user address
  for (const [key, value] of Object.entries(event.args)) {
    if (typeof value === 'string' && value.toLowerCase() === userAddressLower) {
      return true;
    }
  }
  
  // Check common indexed parameters that might contain user address
  const commonUserFields = ['host', 'player', 'winner', 'user', 'from', 'to'];
  for (const field of commonUserFields) {
    if (event.args[field] && 
        typeof event.args[field] === 'string' && 
        event.args[field].toLowerCase() === userAddressLower) {
      return true;
    }
  }
  
  return false;
}

// Safe Thirdweb function wrapper to prevent crashes
const safeReadContract = async (options: any) => {
  try {
    return await readContract(options);
  } catch (error) {
    console.warn('readContract failed, using fallback:', error);
    throw error;
  }
};

// Winner status utility functions
const checkUserWinnerStatus = async (
  contract: any, 
  gameCode: string, 
  userAddress: string,
  prizeSplits?: number[]
): Promise<{ isWinner: boolean; isConfirmed: boolean; hasClaimed: boolean; hasActualPrize?: boolean; winnerPosition?: number }> => {
  try {
    // Check if user is a confirmed winner
    const isConfirmed = await safeReadContract({
      contract,
      method: "function isWinnerConfirmed(string code, address winner) view returns (bool)",
      params: [gameCode, userAddress]
    }) as boolean;

    let hasActualPrize = false;
    let winnerPosition: number | undefined;

    // If user is confirmed as winner, check their position and if that position has a prize
    if (isConfirmed) {
      try {
        // Get the winners array to find user's position
        const winners = await safeReadContract({
          contract,
          method: "function getWinners(string code) view returns (address[] winners)",
          params: [gameCode]
        }) as string[];

        // Find user's position in winners array (1-based indexing for display)
        const userIndex = winners.findIndex(addr => addr.toLowerCase() === userAddress.toLowerCase());
        if (userIndex >= 0) {
          winnerPosition = userIndex + 1; // 1-based position (1st, 2nd, 3rd)
          
          // Check if this position has an actual prize
          if (prizeSplits && prizeSplits.length > userIndex) {
            hasActualPrize = true;
          } else if (!prizeSplits || prizeSplits.length === 0) {
            // Winner-take-all game, only 1st place gets prize
            hasActualPrize = userIndex === 0;
          }
        }
      } catch (error) {
        console.warn('Could not get winner position:', error);
        // If we can't get position info, assume they have a prize to be safe
        hasActualPrize = true;
      }
    }

    return {
      isWinner: isConfirmed && hasActualPrize, // Only true if they actually get a prize
      isConfirmed,
      hasActualPrize,
      winnerPosition,
      hasClaimed: false // We'll check this via events if needed
    };
  } catch (error) {
    console.warn(`Failed to check winner status for ${gameCode}:`, error);
    return {
      isWinner: false,
      isConfirmed: false,
      hasClaimed: false
    };
  }
};

// Check if any winnings have been claimed from the game via events
const checkWinningsClaimedStatus = async (
  gameCode: string
): Promise<{ totalClaimed: string; claimedAddresses: string[] }> => {
  try {
    // Note: This would require event querying which is complex
    // For now, return default values - can be enhanced later
    return {
      totalClaimed: '0',
      claimedAddresses: []
    };
  } catch (error) {
    console.warn(`Failed to check claimed winnings for ${gameCode}:`, error);
    return {
      totalClaimed: '0',
      claimedAddresses: []
    };
  }
};

// Contract returns values directly as: [host, buyIn, maxPlayers, playerCount]
// No smart detection needed - use values as returned by contract

// Contract will be initialized dynamically

export interface GameData {
  code: string;
  host?: string;
  buyIn?: string;
  maxPlayers?: number;
  playerCount?: number;
  players?: string[];
  userRole?: 'host' | 'player' | 'unknown';
  // New PU2 fields
  isLocked?: boolean;
  prizeSplits?: number[];
  // Winner status fields
  isWinnerConfirmed?: boolean;
  winningsClaimed?: boolean;
  winningsAmount?: string;
  winnerAddresses?: string[];
  isUserWinner?: boolean;
  hasUserClaimedWinnings?: boolean;
  // Winner position and prize info
  userWinnerPosition?: number;
  userHasActualPrize?: boolean;
  // Game completion status
  isCompleted?: boolean;
  totalWinningsClaimed?: string;
}

interface GameDataContextType {
  games: GameData[];
  loading: boolean;
  error: string | null;
  fetchRecentGames: (userAddress?: string, displayLimit?: number) => Promise<void>;
  addFoundGame: (gameCode: string, userAddress?: string) => Promise<GameData>;
  recordGameJoin: (gameCode: string, buyInAmount: string, gameType?: string) => Promise<void>;
  updateGameResult: (gameCode: string, result: 'won' | 'lost', winnings?: string) => Promise<void>;
}

const GameDataContext = createContext<GameDataContextType | undefined>(undefined);

export const GameDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [games, setGames] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();

  const fetchRecentGames = useCallback(async (userAddress?: string, displayLimit: number = 3) => {
    if (!userAddress) {
      setGames([]);
      setLoading(false);
      return;
    }

    // Don't block UI - keep current games and show loading for manual refresh only
    setLoading(true);
    setError(null);

    // Add timeout to prevent indefinite loading
    const timeoutId = setTimeout(() => {
      console.log('⏰ Background game fetching timed out (30s), continuing with manual search');
      setLoading(false);
    }, 30000);

    // Keep track of when this search started (for finding newer games)
    const searchStartTime = Date.now();

    try {
      console.log('🔍 Finding games for wallet:', userAddress);
      
      const gameCodesSet = new Set<string>();
      
      console.log('🚀 Smart search strategy: Find last transaction, then search around it');
      
      // Get current block number first
      const currentBlock = await getCurrentBlock();
      console.log(`📊 Current block: ${currentBlock}`);
      
      try {
        // ENHANCED APPROACH: First check for very recent games, then use wallet-based search  
        const contract = await getGameContract();
        
        // Step 1: Check for new games in the last 5000 blocks (most recent activity)
        console.log('🔍 First checking for very recent games in last 5000 blocks...');
        const recentFromBlock = Math.max(0, currentBlock - 5000);
        
        const recentEvents = await getEventsViaRPC({
          contract,
          fromBlock: recentFromBlock,
          toBlock: currentBlock,
          userAddress: userAddress,
        });
        
        console.log(`📊 Found ${recentEvents.length} recent events in last 5000 blocks`);
        
        // Step 2: Find last wallet interaction for broader historical search
        const lastInteractionBlock = await findLastContractInteraction(userAddress, contract.address, currentBlock);
        
        let historicalEvents: any[] = [];
        if (lastInteractionBlock) {
          console.log(`🎯 Last wallet interaction at block ${lastInteractionBlock}, searching focused range`);
          
          // Step 3: Focused search around the last interaction (much smaller range)
          const searchRadius = 10000; // 20k total blocks (10k before + 10k after)  
          const searchFromBlock = Math.max(0, lastInteractionBlock - searchRadius);
          const searchToBlock = Math.min(lastInteractionBlock + searchRadius, Math.max(recentFromBlock - 1, lastInteractionBlock)); // Don't overlap with recent search
          
          if (searchToBlock > searchFromBlock) {
            console.log(`🔍 Historical search: blocks ${searchFromBlock} to ${searchToBlock} (±${searchRadius}, ~20k total)`);
            
            historicalEvents = await getEventsViaRPC({
              contract,
              fromBlock: searchFromBlock,
              toBlock: searchToBlock,
              userAddress: userAddress,
            });
            
            console.log(`👤 Found ${historicalEvents.length} historical events involving user`);
          }
        } else {
          console.log('📭 No wallet interactions found with contract, using fallback search');
        }
        
        // Combine recent and historical events
        const userInvolvedEvents = [...recentEvents, ...historicalEvents];
        console.log(`👤 Found ${userInvolvedEvents.length} total events involving user (${recentEvents.length} recent + ${historicalEvents.length} historical)`);
        
        // NEW: Try polling for very recent games first (last 50 blocks)
        console.log('🔄 Trying polling for very recent games...');
        try {
          const polledGames = await pollForRecentGames(userAddress, currentBlock, 50);
          if (polledGames.length > 0) {
            console.log(`🎯 Polling found ${polledGames.length} very recent games:`, polledGames);
            polledGames.forEach(gameCode => {
              if (gameCodesSet.size < displayLimit) {
                gameCodesSet.add(gameCode);
                console.log(`✨ Added game from polling: ${gameCode}`);
              }
            });
          }
        } catch (error) {
          console.warn('⚠️ Polling failed, continuing with event processing:', error);
        }
        
        // Sort events by block number (newest first)
        const sortedEvents = userInvolvedEvents.sort((a: any, b: any) => {
          const blockA = parseInt(a.blockNumber, 16);
          const blockB = parseInt(b.blockNumber, 16);
          return blockB - blockA;
        });
        
        // Process events to extract game codes (skip if we already have enough from polling)
        if (gameCodesSet.size < displayLimit) {
          sortedEvents.forEach((event: any) => {
            if (gameCodesSet.size >= displayLimit) return; // Stop once we have enough
            
            let gameCode = null;
            const eventSignature = event.topics?.[0];
            const eventName = getEventName(eventSignature);
            
            // Use appropriate decoder based on event type
            if (event.data && event.data.length > 2) {
              switch (eventSignature) {
                case '0xf38f031a0916124649a52ef62ca68c773c22f2386d78bb4aed755a298c7b18d3': // GameStarted
                  const gameStartedData = decodeGameStartedEvent(event.data);
                  gameCode = gameStartedData?.code || null;
                  break;
                case '0x651823ece9ef08ab9d5d4e19bebb603e316362fb41f7ee2e03e7f1684c1852b4': // PlayerJoined
                  gameCode = decodePlayerJoinedEvent(event.data);
                  break;
                case '0xe3574ea7f4f8590b62692642ffda0055801ec44f42c76bcaa9c45453da24319f': // GameLocked
                  gameCode = decodeGameLockedEvent(event.data);
                  break;
                case '0xf8ff7b65f89533529cfb22afeca74e7a0a22760b35258fa00cf0388cd2c13bb3': // WinnersReported
                  gameCode = decodeWinnersReportedEvent(event.data);
                  break;
                case '0x7175967b5ddee4d7986318165167133a8c193aa59b05f411ec131d4f124a3f3d': // WinningsClaimed
                case '0x8a3f510bd40a2bff6e6502777e1359083e910aef0aa28a765f4fa8d84871ba67': // PrizeSplitsSet
                  gameCode = decodeStringFromHex(event.data); // Fallback for simple events
                  break;
                default:
                  console.log(`🔍 Unknown event signature: ${eventSignature}, using fallback decoder`);
                  gameCode = decodeStringFromHex(event.data);
                  break;
              }
            }
            
            if (gameCode && gameCode.length >= 3 && gameCode.length <= 10 && /^[A-Z0-9-]+$/i.test(gameCode)) {
              gameCodesSet.add(gameCode);
              console.log(`✨ Added game from ${eventName || 'unknown'} event: ${gameCode}`);
            }
          });
        }
        
      } catch (error) {
        console.error('❌ Smart search failed:', error);
        setGames([]);
        return;
      }
      
      const gameCodes = Array.from(gameCodesSet);
      console.log(`🏁 Smart search completed: Found ${gameCodes.length} games: [${gameCodes.join(', ')}]`);
      
      if (gameCodes.length === 0) {
        console.log('📭 No games found with enhanced search strategy, trying extended fallback...');
        
        // Extended Fallback: Search last 10 days with emphasis on recent blocks
        try {
          console.log('🔄 Extended fallback: Searching last 10 days with recent block emphasis...');
          const extendedBlocks = Math.floor(BLOCKS_IN_6_DAYS * 1.67); // ~10 days
          const fallbackFromBlock = Math.max(0, currentBlock - extendedBlocks);
          const fallbackContract = await getGameContract();
          
          const fallbackEvents = await getEventsViaRPC({
            contract: fallbackContract,
            fromBlock: fallbackFromBlock,
            toBlock: currentBlock,
            userAddress: userAddress,
          });
          
          console.log(`📦 Extended fallback found ${fallbackEvents.length} events in last 10 days`);
          
          const fallbackGameCodes = new Set<string>();
          fallbackEvents.forEach((event: any) => {
            let gameCode = null;
            const eventSignature = event.topics?.[0];
            const eventName = getEventName(eventSignature);
            
            // Use appropriate decoder based on event type
            if (event.data && event.data.length > 2) {
              switch (eventSignature) {
                case '0xf38f031a0916124649a52ef62ca68c773c22f2386d78bb4aed755a298c7b18d3': // GameStarted
                  const gameStartedData = decodeGameStartedEvent(event.data);
                  gameCode = gameStartedData?.code || null;
                  break;
                case '0x651823ece9ef08ab9d5d4e19bebb603e316362fb41f7ee2e03e7f1684c1852b4': // PlayerJoined
                  gameCode = decodePlayerJoinedEvent(event.data);
                  break;
                case '0xe3574ea7f4f8590b62692642ffda0055801ec44f42c76bcaa9c45453da24319f': // GameLocked
                  gameCode = decodeGameLockedEvent(event.data);
                  break;
                case '0xf8ff7b65f89533529cfb22afeca74e7a0a22760b35258fa00cf0388cd2c13bb3': // WinnersReported
                  gameCode = decodeWinnersReportedEvent(event.data);
                  break;
                case '0x7175967b5ddee4d7986318165167133a8c193aa59b05f411ec131d4f124a3f3d': // WinningsClaimed
                case '0x8a3f510bd40a2bff6e6502777e1359083e910aef0aa28a765f4fa8d84871ba67': // PrizeSplitsSet
                  gameCode = decodeStringFromHex(event.data); // Fallback for simple events
                  break;
                default:
                  console.log(`🔍 Fallback: Unknown event signature: ${eventSignature}, using fallback decoder`);
                  gameCode = decodeStringFromHex(event.data);
                  break;
              }
            }
            
            if (gameCode && gameCode.length >= 3 && gameCode.length <= 10 && /^[A-Z0-9-]+$/i.test(gameCode)) {
              fallbackGameCodes.add(gameCode);
              console.log(`✨ Fallback found game from ${eventName || 'unknown'} event: ${gameCode}`);
            }
          });
          
          if (fallbackGameCodes.size > 0) {
            const fallbackGames = Array.from(fallbackGameCodes).slice(0, displayLimit).map(gameCode => ({
              code: gameCode,
              userRole: 'unknown' as const
            }));
            console.log(`🎯 Fallback successful: Found ${fallbackGames.length} games`);
            setGames(fallbackGames);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error('❌ Fallback search failed:', error);
        }
        
        console.log('📭 No games found even with fallback search');
        setGames([]);
        setLoading(false);
        return;
      }
      
      // Create minimal game objects - let GameDashboard load details when needed
      // gameCodes is already in the order we want (newest first from sorted events)
      const gamePromises = gameCodes.map(async (gameCode) => {
        try {
          return {
            code: gameCode,
            userRole: 'unknown' as const
          };
        } catch (error) {
          console.error(`Failed to create game for ${gameCode}:`, error);
          return null;
        }
      });

      const results = await Promise.all(gamePromises);
      const activeGames = results.filter((game) => game !== null) as GameData[];
      
      // Take the first games (which are the newest due to our sorting)
      const recentGames = activeGames.slice(0, displayLimit);
      
      console.log(`Returning ${recentGames.length} newest games for display`);
      console.log(`🏆 Displaying games: [${recentGames.map(g => g.code).join(', ')}]`);
      setGames(recentGames);
      
    } catch (error) {
      console.error('❌ Background game fetching failed:', error);
      setError('Background game loading failed - you can still search manually');
      console.log('💡 Users can continue with manual game search');
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  const addFoundGame = useCallback(async (gameCode: string, userAddress?: string) => {
    try {
      // Validate and sanitize inputs
      const sanitizedGameCode = validation.sanitizeGameCode(gameCode);
      const sanitizedUserAddress = userAddress ? validation.sanitizeAddress(userAddress) : undefined;
      
      logGameAction('Searching for game', sanitizedGameCode, {
        userAddress: sanitizedUserAddress
      });
      
      // Check if game already exists
      const existingGame = games.find(g => g.code === sanitizedGameCode);
      if (existingGame) {
        throw new Error(`Game ${sanitizedGameCode} is already in your list`);
      }

      // Fetch game info from actual deployed contract (returns [host, buyIn, maxPlayers, playerCount, isLocked, splits, judges])
      const contract = await getGameContract();
      const [host, token, buyIn, maxPlayers, playerCount, isLocked, splits, judges] = await safeReadContract({
        contract,
        method: "function getGameInfo(string code) view returns (address host, address token, uint256 buyIn, uint256 maxPlayers, uint256 playerCount, bool isLocked, uint256[] splits, address[] judges)",
        params: [sanitizedGameCode]
      }) as [string, string, bigint, bigint, bigint, boolean, bigint[], string[]];

      logger.debug(`Game info retrieved`, {
        component: 'GameDataContext',
        gameCode: sanitizedGameCode,
        buyIn: buyIn.toString(),
        maxPlayers: maxPlayers.toString()
      });
      
      // Validate the returned data
      if (host === "0x0000000000000000000000000000000000000000") {
        throw new Error(`Game ${sanitizedGameCode} has invalid host address - game may not exist`);
      }

      // Also try to get players list
      let players: string[] = [];
      try {
        players = await safeReadContract({
          contract,
          method: "function getPlayers(string code) view returns (address[] players)",
          params: [sanitizedGameCode]
        }) as string[];
      } catch (playerError) {
        console.log(`⚠️ Could not fetch players for ${gameCode}:`, playerError);
      }

      // Log final buy-in info for debugging
      logBuyInInfo('GameDataContext detected', gameCode, buyIn, 'direct contract return');

      // Create game data using contract values directly
      // Use players.length as fallback if playerCount is 0 or missing
      const actualPlayerCount = Number(playerCount) > 0 ? Number(playerCount) : (players?.length || 0);
      
      const gameData: GameData = {
        code: gameCode,
        host: host,
        buyIn: buyIn.toString(), // Keep as wei string
        maxPlayers: Number(maxPlayers),
        playerCount: actualPlayerCount,
        players: players || [],
        userRole: 'unknown'
      };

      // Determine user role if user address is provided
      if (userAddress) {
        if (userAddress.toLowerCase() === gameData.host?.toLowerCase()) {
          gameData.userRole = 'host';
        } else if (players.some(player => player.toLowerCase() === userAddress.toLowerCase())) {
          gameData.userRole = 'player';
        }

        // Check winner status for user if they're involved in the game
        if (gameData.userRole !== 'unknown') {
          try {
            const winnerStatus = await checkUserWinnerStatus(contract, gameCode, userAddress, gameData.prizeSplits);
            gameData.isUserWinner = winnerStatus.isWinner;
            gameData.isWinnerConfirmed = winnerStatus.isConfirmed;
            gameData.hasUserClaimedWinnings = winnerStatus.hasClaimed;
            gameData.userWinnerPosition = winnerStatus.winnerPosition;
            gameData.userHasActualPrize = winnerStatus.hasActualPrize;
            
            if (winnerStatus.isWinner) {
              console.log(`🏆 User is confirmed winner for game ${gameCode}`);
            }
          } catch (error) {
            console.warn(`Could not check winner status for ${gameCode}:`, error);
          }
        }
      }

      // Check general winnings claimed status
      try {
        const claimedStatus = await checkWinningsClaimedStatus(gameCode);
        gameData.totalWinningsClaimed = claimedStatus.totalClaimed;
        gameData.winningsClaimed = claimedStatus.claimedAddresses.length > 0;
        gameData.winnerAddresses = claimedStatus.claimedAddresses;
        
        // Mark game as completed if winnings have been claimed
        gameData.isCompleted = gameData.winningsClaimed;
      } catch (error) {
        console.warn(`Could not check claimed status for ${gameCode}:`, error);
      }

      // Add to games list (prepend to show at top)
      setGames(currentGames => {
        const newGames = [gameData, ...currentGames];
        console.log(`🎯 Context setGames called, new games array:`, newGames);
        return newGames;
      });
      
      console.log(`✅ Added game ${gameCode} to dashboard:`, gameData);
      return gameData;

    } catch (error) {
      console.error(`❌ Failed to find game ${gameCode}:`, error);
      throw error;
    }
  }, [games]);

  const recordGameJoin = useCallback(async (gameCode: string, buyInAmount: string, gameType: string = 'standard') => {
    if (!user?.id) {
      console.warn('No user ID available, skipping database record');
      return;
    }

    try {
      console.log(`💾 Recording game join: ${gameCode} with buy-in: ${buyInAmount}`);
      await databaseService.gameHistory.addGameHistory({
        user_id: user.id,
        game_code: gameCode,
        game_type: gameType,
        buy_in_amount: buyInAmount,
        result: 'active',
        winnings: null,
      });
      console.log('✅ Game join recorded successfully');
    } catch (error) {
      console.error('❌ Failed to record game join:', error);
    }
  }, [user?.id]);

  const updateGameResult = useCallback(async (gameCode: string, result: 'won' | 'lost', winnings?: string) => {
    if (!user?.id) {
      console.warn('No user ID available, skipping result update');
      return;
    }

    try {
      console.log(`🎯 Updating game result: ${gameCode} -> ${result}`, winnings ? `Winnings: ${winnings}` : '');
      await databaseService.gameHistory.updateGameResult(gameCode, user.id, result, winnings);
      console.log('✅ Game result updated successfully');
    } catch (error) {
      console.error('❌ Failed to update game result:', error);
    }
  }, [user?.id]);

  return (
    <GameDataContext.Provider value={{ 
      games, 
      loading, 
      error, 
      fetchRecentGames, 
      addFoundGame, 
      recordGameJoin, 
      updateGameResult 
    }}>
      {children}
    </GameDataContext.Provider>
  );
};

export const useGameData = () => {
  const context = useContext(GameDataContext);
  if (context === undefined) {
    throw new Error('useGameData must be used within a GameDataProvider');
  }
  return context;
};


// This function is no longer needed - using Thirdweb event handling instead

// This function is no longer needed - using Thirdweb getContractEvents instead

// Simplified progressive search - no longer need to find specific transactions

// This function is no longer needed - using simplified progressive search

// Helper function to get current block number using Thirdweb
async function getCurrentBlock(): Promise<number> {
  const rpcEndpoints = [
    'https://mainnet.base.org',
    'https://base-mainnet.g.alchemy.com/v2/demo',
    'https://base.publicnode.com',
    'https://base.meowrpc.com',
    'https://base.llamarpc.com'
  ];
  
  for (const endpoint of rpcEndpoints) {
    try {
      console.log(`🔢 Getting current block from ${endpoint.split('/')[2]}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`RPC Error: ${data.error.message}`);
      }
      
      const blockNumber = parseInt(data.result, 16);
      console.log(`📊 Current block number: ${blockNumber} from ${endpoint.split('/')[2]}`);
      return blockNumber;
      
    } catch (error) {
      console.warn(`❌ Failed to get block number from ${endpoint.split('/')[2]}:`, error);
    }
  }
  
  console.error('🚨 All RPC endpoints failed for getCurrentBlock, using fallback');
  return 10000000; // Conservative fallback block number for Base mainnet
}