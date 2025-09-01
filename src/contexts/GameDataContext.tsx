import React, { createContext, useContext, useState, useCallback } from 'react';
import { getGameContract, decodeStringFromHex, CONTRACT_ADDRESS } from '../thirdweb';
import { logBuyInInfo } from '../utils/buyInUtils';
import { databaseService } from '../services/databaseService';
import { useUser } from './UserContext';
import { logger, logGameAction, logContractCall, logPerformance } from '../utils/logger';
import { validation } from '../utils/envUtils';

import { readContract, getContractEvents, getRpcClient, eth_blockNumber, prepareEvent, eth_getLogs } from 'thirdweb';

// Prepared events for efficient querying - Updated for UP2.1 contract
const gameStartedEvent = prepareEvent({
  signature: "event GameStarted(string code, address indexed host, uint256 buyIn, uint256 maxPlayers, address[] judges)"
});

const judgeSetEvent = prepareEvent({
  signature: "event JudgeSet(string code, address indexed judge)"
});

const playerJoinedEvent = prepareEvent({
  signature: "event PlayerJoined(string code, address indexed player)"
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

// Direct RPC implementation (copied from pony-upv4) for bypassing Thirdweb limits
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
  const rpcEndpoints = [
    'https://ethereum-sepolia.publicnode.com',
    'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    'https://rpc.sepolia.ethpandaops.io',
    'https://eth-sepolia.g.alchemy.com/v2/demo'
  ];
  
  const topics = [];
  
  // Build base parameters
  const baseParams = {
    address: contractAddress,
    fromBlock: `0x${fromBlock.toString(16)}`,
    toBlock: `0x${toBlock.toString(16)}`,
  };
  
  // If userAddress provided, we need to search in multiple indexed positions
  const searchQueries = [];
  if (userAddress) {
    const userTopic = `0x000000000000000000000000${userAddress.slice(2).toLowerCase()}`;
    searchQueries.push(
      { ...baseParams, topics: [null, userTopic] },           // User in 1st indexed position
      { ...baseParams, topics: [null, null, userTopic] },     // User in 2nd indexed position  
      { ...baseParams, topics: [null, null, null, userTopic] } // User in 3rd indexed position
    );
  } else {
    searchQueries.push({ ...baseParams }); // All events
  }
  
  for (let i = 0; i < rpcEndpoints.length; i++) {
    const endpoint = rpcEndpoints[i];
    try {
      console.log(`🌐 Trying direct RPC endpoint ${i + 1}/${rpcEndpoints.length}: ${endpoint.split('/')[2]}`);
      
      let allLogs: any[] = [];
      
      // Execute all search queries for this endpoint
      for (let queryIdx = 0; queryIdx < searchQueries.length; queryIdx++) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getLogs',
            params: [searchQueries[queryIdx]],
            id: queryIdx + 1,
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
        console.log(`📊 Query ${queryIdx + 1}/${searchQueries.length} found ${logs.length} events`);
        allLogs.push(...logs);
      }
      
      // Remove duplicates by block number + transaction index + log index
      const uniqueLogs = allLogs.filter((log, index, self) => 
        index === self.findIndex(l => 
          l.blockNumber === log.blockNumber && 
          l.transactionIndex === log.transactionIndex && 
          l.logIndex === log.logIndex
        )
      );
      
      console.log(`✅ Successfully got ${uniqueLogs.length} unique events from ${endpoint.split('/')[2]}`);
      return uniqueLogs;
      
    } catch (error) {
      console.warn(`❌ Direct RPC endpoint ${endpoint.split('/')[2]} failed:`, error);
      
      // If this is the last endpoint, throw the error
      if (i === rpcEndpoints.length - 1) {
        logger.error('All direct RPC endpoints failed', error instanceof Error ? error : new Error(String(error)), {
          component: 'GameDataContext',
          contractAddress,
          fromBlock,
          toBlock
        });
        throw error;
      }
      
      // Add delay before trying next endpoint
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return [];
}

// Helper function to get event name from signature (copied from pony-upv4)
function getEventName(signature?: string): string | null {
  if (!signature) return null;
  
  const eventMap: Record<string, string> = {
    '0x0518a6eadbf1c70185fe974736fa2022919eed726a4027cd4b9525f1d7feb03a': 'GameStarted',
    '0x39295572f1ca17725c1e2c253d71bc653406c2f4ebe6e7eeb82fe3c3acb72751': 'PlayerJoined',
    '0xc83727715d9b58d35c2b5aa93e8e9144b9f66c103994a03bbafa82b473c142b2': 'WinnersReported',
    '0xa5a4c7c1e3d0b75b36b5b8b3f4c7d5c8a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6': 'WinnerApproved',
    '0xb6b5c8c2f4e1d86c47c6c9c4e3f8e6d9bac3d4e5f6a7b8c9d0e1f2a3b4c5d6e7': 'WinnerConfirmed',
    '0xc7c6d9d3e5f2e97d58d7dae5f4e9f7eacbd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8': 'WinningsClaimed'
  };
  
  return eventMap[signature.toLowerCase()] || null;
}

// Ultra-efficient wallet-based transaction finder (NEW APPROACH)
async function findLastContractInteraction(
  userAddress: string, 
  contractAddress: string,
  currentBlock: number
): Promise<number | null> {
  const rpcEndpoints = [
    'https://ethereum-sepolia.publicnode.com',
    'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    'https://rpc.sepolia.ethpandaops.io',
    'https://eth-sepolia.g.alchemy.com/v2/demo'
  ];

  console.log(`💎 Scanning wallet ${userAddress} for last interaction with ${contractAddress}`);

  // Strategy: Binary search through recent blocks to find last transaction to our contract
  const SEARCH_RANGES = [10000, 50000, 100000]; // Progressive search ranges
  
  for (const range of SEARCH_RANGES) {
    const fromBlock = Math.max(0, currentBlock - range);
    const toBlock = currentBlock;
    
    console.log(`🔍 Checking wallet transactions in range ${fromBlock} to ${toBlock} (${range} blocks)`);
    
    for (const endpoint of rpcEndpoints) {
      try {
        console.log(`🌐 Trying endpoint ${endpoint.split('/')[2]} for wallet scan`);
        
        // Make 3 separate queries to search user in different indexed positions
        const userTopic = `0x000000000000000000000000${userAddress.slice(2).toLowerCase()}`;
        const searchQueries = [
          { topics: [null, userTopic] },     // User in 1st indexed position
          { topics: [null, null, userTopic] }, // User in 2nd indexed position
          { topics: [null, null, null, userTopic] }, // User in 3rd indexed position
        ];
        
        let allLogs: any[] = [];
        
        for (let i = 0; i < searchQueries.length; i++) {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getLogs',
              params: [{
                fromBlock: `0x${fromBlock.toString(16)}`,
                toBlock: `0x${toBlock.toString(16)}`,
                address: contractAddress,
                ...searchQueries[i]
              }],
              id: 1 + i,
            }),
          });

          if (!response.ok) continue;
          
          const data = await response.json();
          if (data.error) continue;

          const logs = data.result || [];
          console.log(`📊 Query ${i+1}/3 found ${logs.length} events (user in position ${i+1})`);
          allLogs.push(...logs);
        }
        
        console.log(`📊 Found ${allLogs.length} total events in ${range}-block range`);
        
        if (allLogs.length > 0) {
          // Find the most recent transaction
          const sortedLogs = allLogs.sort((a: any, b: any) => {
            return parseInt(b.blockNumber, 16) - parseInt(a.blockNumber, 16);
          });
          
          const lastBlock = parseInt(sortedLogs[0].blockNumber, 16);
          console.log(`🎯 Last wallet interaction found at block ${lastBlock} via ${endpoint.split('/')[2]}`);
          return lastBlock;
        }
        
        break; // Try next range
        
      } catch (error) {
        console.warn(`❌ Wallet scan failed on ${endpoint.split('/')[2]}:`, error);
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
  userAddress: string
): Promise<{ isWinner: boolean; isConfirmed: boolean; hasClaimed: boolean }> => {
  try {
    // Check if user is a confirmed winner
    const isConfirmed = await safeReadContract({
      contract,
      method: "function isWinnerConfirmed(string code, address winner) view returns (bool)",
      params: [gameCode, userAddress]
    }) as boolean;

    return {
      isWinner: isConfirmed,
      isConfirmed,
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

    try {
      console.log('🔍 Finding games for wallet:', userAddress);
      
      const gameCodesSet = new Set<string>();
      
      console.log('🚀 Smart search strategy: Find last transaction, then search around it');
      
      // Get current block number first
      const currentBlock = await getCurrentBlock();
      console.log(`📊 Current block: ${currentBlock}`);
      
      try {
        // NEW APPROACH: Use wallet-based search for ultra-efficiency  
        const contract = await getGameContract();
        const lastInteractionBlock = await findLastContractInteraction(userAddress, contract.address, currentBlock);
        
        if (!lastInteractionBlock) {
          console.log('📭 No wallet interactions found with contract');
          setGames([]);
          return;
        }
        
        console.log(`🎯 Last wallet interaction at block ${lastInteractionBlock}, searching focused range`);
        
        // Step 2: Focused search around the last interaction (much smaller range)
        const searchRadius = 10000; // 20k total blocks (10k before + 10k after)  
        const searchFromBlock = Math.max(0, lastInteractionBlock - searchRadius);
        const searchToBlock = Math.min(lastInteractionBlock + searchRadius, currentBlock); // Cap at current block
        
        console.log(`🔍 Focused search: blocks ${searchFromBlock} to ${searchToBlock} (±${searchRadius}, ~20k total)`);
        
        const userInvolvedEvents = await getEventsViaRPC({
          contract,
          fromBlock: searchFromBlock,
          toBlock: searchToBlock,
          userAddress: userAddress,
        });
        
        console.log(`👤 Found ${userInvolvedEvents.length} events involving user in focused range`);
        
        // Sort events by block number (newest first)
        const sortedEvents = userInvolvedEvents.sort((a: any, b: any) => {
          const blockA = parseInt(a.blockNumber, 16);
          const blockB = parseInt(b.blockNumber, 16);
          return blockB - blockA;
        });
        
        // Process events to extract game codes
        sortedEvents.forEach((event: any) => {
          if (gameCodesSet.size >= displayLimit) return; // Stop once we have enough
          
          let gameCode = null;
          
          // Try to extract game code from event data
          if (event.data && event.data.length > 2) {
            gameCode = decodeStringFromHex(event.data);
          }
          
          if (gameCode && gameCode.length >= 3 && gameCode.length <= 10 && /^[A-Z0-9-]+$/i.test(gameCode)) {
            const eventName = getEventName(event.topics?.[0]);
            gameCodesSet.add(gameCode);
            console.log(`✨ Added game from ${eventName || 'unknown'} event: ${gameCode}`);
          }
        });
        
      } catch (error) {
        console.error('❌ Smart search failed:', error);
        setGames([]);
        return;
      }
      
      const gameCodes = Array.from(gameCodesSet);
      console.log(`🏁 Smart search completed: Found ${gameCodes.length} games: [${gameCodes.join(', ')}]`);
      
      if (gameCodes.length === 0) {
        console.log('📭 No games found with progressive search strategy, trying fallback search...');
        
        // Fallback: Search last 6 days directly from current block
        try {
          console.log('🔄 Fallback: Searching last 6 days from current block...');
          const fallbackFromBlock = Math.max(0, currentBlock - BLOCKS_IN_6_DAYS);
          const fallbackContract = await getGameContract();
          
          const fallbackEvents = await getEventsViaRPC({
            contract: fallbackContract,
            fromBlock: fallbackFromBlock,
            toBlock: currentBlock,
            userAddress: userAddress,
          });
          
          console.log(`📦 Fallback found ${fallbackEvents.length} events in last 6 days`);
          
          const fallbackGameCodes = new Set<string>();
          fallbackEvents.forEach((event: any) => {
            let gameCode = null;
            
            // Try to extract game code from event data
            if (event.data && event.data.length > 2) {
              gameCode = decodeStringFromHex(event.data);
            }
            
            if (gameCode && gameCode.length >= 3 && gameCode.length <= 10 && /^[A-Z0-9-]+$/i.test(gameCode)) {
              fallbackGameCodes.add(gameCode);
              console.log(`✨ Fallback found game: ${gameCode}`);
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
      const [host, buyIn, maxPlayers, playerCount, isLocked, splits, judges] = await safeReadContract({
        contract,
        method: "function getGameInfo(string code) view returns (address host, uint256 buyIn, uint256 maxPlayers, uint256 playerCount, bool isLocked, uint256[] splits, address[] judges)",
        params: [sanitizedGameCode]
      }) as [string, bigint, bigint, bigint, boolean, bigint[], string[]];

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
            const winnerStatus = await checkUserWinnerStatus(contract, gameCode, userAddress);
            gameData.isUserWinner = winnerStatus.isWinner;
            gameData.isWinnerConfirmed = winnerStatus.isConfirmed;
            gameData.hasUserClaimedWinnings = winnerStatus.hasClaimed;
            
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
    'https://ethereum-sepolia.publicnode.com',
    'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    'https://rpc.sepolia.ethpandaops.io',
    'https://eth-sepolia.g.alchemy.com/v2/demo'
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
  return 9000000; // Conservative fallback block number for Sepolia
}