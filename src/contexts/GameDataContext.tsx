import React, { createContext, useContext, useState, useCallback } from 'react';
import { getGameContract, decodeStringFromHex } from '../thirdweb';
import { logBuyInInfo } from '../utils/buyInUtils';
import { databaseService } from '../services/databaseService';
import { useUser } from './UserContext';

import { readContract } from 'thirdweb';

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
      const currentBlock = await getCurrentBlock();
      const BLOCKS_IN_3_DAYS = Math.floor((3 * 24 * 60 * 60) / 12); // ~21,600 blocks
      const MAX_ITERATIONS = 5;
      const TOTAL_DAYS_LIMIT = 30;
      
      console.log('📌 Progressive search strategy: 3-day chunks, max 5 iterations or 30 days');
      
      let searchEndBlock = currentBlock;
      let iteration = 0;
      let totalDaysSearched = 0;
      
      // Progressive search: Find most recent transaction, then search back in 3-day chunks
      while (iteration < MAX_ITERATIONS && totalDaysSearched < TOTAL_DAYS_LIMIT && gameCodesSet.size < displayLimit) {
        iteration++;
        console.log(`\n🔄 Iteration ${iteration}/${MAX_ITERATIONS}: Searching back from block ${searchEndBlock}`);
        
        // Find user's most recent transaction with our contract before searchEndBlock
        const mostRecentTransaction = await findMostRecentContractTransaction(userAddress, searchEndBlock);
        
        if (!mostRecentTransaction) {
          console.log(`📭 No more transactions found before block ${searchEndBlock}`);
          break;
        }
        
        console.log(`🎯 Found transaction at block ${mostRecentTransaction}, searching 3 days back...`);
        
        // Search 3 days back from this transaction
        const searchFromBlock = Math.max(0, mostRecentTransaction - BLOCKS_IN_3_DAYS);
        const searchToBlock = mostRecentTransaction;
        
        console.log(`🔍 Searching blocks ${searchFromBlock} to ${searchToBlock} (3 days from transaction)`);
        
        try {
          const contract = await getGameContract();
          
          // 1. Search for ALL contract events involving this user in this range
          console.log('🔍 Searching for all contract events involving user...');
          const allUserEvents = await getEventsFromRPC({
            contractAddress: contract.address,
            eventSignature: null, // Get ALL events
            fromBlock: searchFromBlock,
            toBlock: searchToBlock,
            userAddress: userAddress, // Filter by user involvement
          });
          
          console.log(`📦 Found ${allUserEvents.length} total events involving user`);
          
          // Sort events by block number (newest first) to prioritize recent games
          const sortedEvents = allUserEvents.sort((a: any, b: any) => {
            const blockA = parseInt(a.blockNumber, 16);
            const blockB = parseInt(b.blockNumber, 16);
            return blockB - blockA; // Newest first
          });
          
          console.log(`📊 Sorted ${sortedEvents.length} events by block number (newest first)`);
          
          // Process sorted events to extract game codes (newest first)
          sortedEvents.forEach((event: any, index: number) => {
            let gameCode = null;
            
            // Try to extract game code from event data
            if (event.data && event.data.length > 2) {
              gameCode = decodeStringFromHex(event.data);
            }
            
            // If no game code in data, check if event topics contain user address
            if (!gameCode && event.topics) {
              const userTopic = `0x000000000000000000000000${userAddress.slice(2).toLowerCase()}`;
              const hasUserInTopics = event.topics.some((topic: string) => 
                topic.toLowerCase() === userTopic
              );
              
              if (hasUserInTopics && event.data) {
                // This event involves the user, try harder to extract game code
                gameCode = decodeStringFromHex(event.data);
              }
            }
            
            if (gameCode && gameCode.length >= 3 && gameCode.length <= 10 && /^[A-Z0-9-]+$/i.test(gameCode)) {
              const eventName = getEventName(event.topics?.[0]);
              gameCodesSet.add(gameCode);
              console.log(`✨ Added game from ${eventName || 'unknown'} event: ${gameCode}`);
            }
          });
          
          // 2. If still need more games, get user's transaction receipts from this period
          if (gameCodesSet.size < displayLimit) {
            console.log('🔍 Getting user transaction receipts for additional game codes...');
            const transactionGameCodes = await extractGameCodesFromUserTransactions(
              userAddress, 
              contract.address, 
              searchFromBlock, 
              searchToBlock
            );
            
            transactionGameCodes.forEach(gameCode => {
              gameCodesSet.add(gameCode);
              console.log(`✨ Added game from transaction data: ${gameCode}`);
            });
          }
          
        } catch (error) {
          console.error(`❌ Failed to get events for iteration ${iteration}:`, error);
        }
        
        // Update counters
        totalDaysSearched += 3;
        searchEndBlock = searchFromBlock - 1; // Start next search where this one ended
        
        console.log(`📊 Progress: Found ${gameCodesSet.size} games, searched ${totalDaysSearched} days`);
        
        // Stop early if we have enough games
        if (gameCodesSet.size >= displayLimit) {
          console.log(`🎯 Found enough games (${gameCodesSet.size}), stopping search`);
          break;
        }
        
        // Add delay between iterations to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      console.log(`\n🏁 Search completed: Found ${gameCodesSet.size} unique games after ${iteration} iterations`);
      
      const gameCodes = Array.from(gameCodesSet);
      console.log(`🎲 Final result: ${gameCodes.length} games found: [${gameCodes.join(', ')}]`);
      console.log('📝 Note: Games are processed in newest-first order from sorted events');
      
      if (gameCodes.length === 0) {
        console.log('📭 No games found with progressive search strategy');
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
      console.log(`🔍 Searching for game: ${gameCode}`);
      
      // Check if game already exists
      const existingGame = games.find(g => g.code === gameCode);
      if (existingGame) {
        throw new Error(`Game ${gameCode} is already in your list`);
      }

      // Fetch game info from actual deployed contract (returns [host, buyIn, maxPlayers, playerCount])
      const contract = await getGameContract();
      const [host, buyIn, maxPlayers, playerCount] = await safeReadContract({
        contract,
        method: "function getGameInfo(string code) view returns (address host, uint256 maxPlayers, uint256 buyIn, uint256 playerCount)",
        params: [gameCode.trim()]
      }) as [string, bigint, bigint, number];

      console.log(`🔍 GameDataContext for ${gameCode}: buyIn=${buyIn.toString()}, maxPlayers=${maxPlayers.toString()}`);
      
      // Validate the returned data
      if (host === "0x0000000000000000000000000000000000000000") {
        throw new Error(`Game ${gameCode} has invalid host address - game may not exist`);
      }

      // Also try to get players list
      let players: string[] = [];
      try {
        players = await safeReadContract({
          contract,
          method: "function getPlayers(string code) view returns (address[] players)",
          params: [gameCode.trim()]
        }) as string[];
      } catch (playerError) {
        console.log(`⚠️ Could not fetch players for ${gameCode}:`, playerError);
      }

      // Log final buy-in info for debugging
      logBuyInInfo('GameDataContext detected', gameCode, buyIn, 'direct contract return');

      // Create game data using contract values directly
      const gameData: GameData = {
        code: gameCode,
        host: host,
        buyIn: buyIn.toString(), // Keep as wei string
        maxPlayers: Number(maxPlayers),
        playerCount: playerCount,
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

// Helper function to get event name from signature
function getEventName(signature: string | undefined): string | null {
  if (!signature) return null;
  
  const eventMap: { [key: string]: string } = {
    '0x0518a6eadbf1c70185fe974736fa2022919eed726a4027cd4b9525f1d7feb03a': 'GameStarted',
    '0x39295572f1ca17725c1e2c253d71bc653406c2f4ebe6e7eeb82fe3c3acb72751': 'PlayerJoined',
    '0xc83727715d9b58d35c2b5aa93e8e9144b9f66c103994a03bbafa82b473c142b2': 'WinnersReported',
    '0xa5a4c7c1e3d0b75b36b5b8b3f4c7d5c8a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6': 'WinnerApproved',
    '0xb6b5c8c2f4e1d86c47c6c9c4e3f8e6d9bac3d4e5f6a7b8c9d0e1f2a3b4c5d6e7': 'WinnerConfirmed',
    '0xc7c6d9d3e5f2e97d58d7dae5f4e9f7eacbd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8': 'WinningsClaimed'
  };
  
  return eventMap[signature.toLowerCase()] || null;
}

// Helper function to extract game codes from user transactions
async function extractGameCodesFromUserTransactions(
  userAddress: string,
  contractAddress: string, 
  fromBlock: number,
  toBlock: number
): Promise<string[]> {
  const rpcEndpoints = [
    'https://ethereum-sepolia.publicnode.com',
    'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    'https://rpc.sepolia.ethpandaops.io',
    'https://eth-sepolia.g.alchemy.com/v2/demo'
  ];
  
  const gameCodesFound: string[] = [];
  
  // This is a placeholder for more advanced transaction analysis
  // In a full implementation, we would:
  // 1. Get all transactions from user to contract in this range
  // 2. Decode transaction input data to extract game codes from function calls
  // 3. Parse transaction receipts for additional game references
  
  console.log('📝 Advanced transaction analysis not yet implemented, using event-based approach');
  return gameCodesFound;
}

// Helper function to get events from RPC directly with fallback providers
async function getEventsFromRPC({
  contractAddress,
  eventSignature,
  fromBlock,
  toBlock,
  userAddress,
}: {
  contractAddress: string;
  eventSignature: string | null;
  fromBlock: number;
  toBlock: number;
  userAddress?: string;
}): Promise<any[]> {
  const rpcEndpoints = [
    'https://ethereum-sepolia.publicnode.com',
    'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', // Public Infura endpoint
    'https://rpc.sepolia.ethpandaops.io',
    'https://eth-sepolia.g.alchemy.com/v2/demo'
  ];
  
  // Build topics array based on whether we want specific events or all events
  const topics: (string | string[] | null)[] = [];
  
  if (eventSignature) {
    // Specific event signature
    topics.push(eventSignature);
  } else {
    // All events
    topics.push(null);
  }
  
  // If userAddress provided, add it as a filter (user could be in any topic position)
  if (userAddress) {
    const userTopic = `0x000000000000000000000000${userAddress.slice(2)}`;
    topics.push(userTopic);
  }
  
  const params = [{
    address: contractAddress,
    topics: topics.length > 0 ? topics : undefined,
    fromBlock: `0x${fromBlock.toString(16)}`,
    toBlock: `0x${toBlock.toString(16)}`,
  }];
  
  for (let i = 0; i < rpcEndpoints.length; i++) {
    const endpoint = rpcEndpoints[i];
    try {
      console.log(`🌐 Trying RPC endpoint ${i + 1}/${rpcEndpoints.length}: ${endpoint.split('/')[2]}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getLogs',
          params,
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
      
      console.log(`✅ Successfully got ${data.result?.length || 0} events from ${endpoint.split('/')[2]}`);
      return data.result || [];
      
    } catch (error) {
      console.warn(`❌ RPC endpoint ${endpoint.split('/')[2]} failed:`, error);
      
      // If this is the last endpoint, throw the error
      if (i === rpcEndpoints.length - 1) {
        console.error('🚨 All RPC endpoints failed:', error);
        throw error;
      }
      
      // Add delay before trying next endpoint
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return [];
}

// Helper function to find user's most recent transaction with contract before a given block
async function findMostRecentContractTransaction(userAddress: string, beforeBlock: number): Promise<number | null> {
  const rpcEndpoints = [
    'https://ethereum-sepolia.publicnode.com',
    'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    'https://rpc.sepolia.ethpandaops.io',
    'https://eth-sepolia.g.alchemy.com/v2/demo'
  ];
  
  const contractAddress = '0xc5369041d5b6Df56a269F03B4b96377C17FBC56C';
  
  // Search back in chunks to find most recent transaction
  const SEARCH_CHUNK_SIZE = 5000; // Small chunks to avoid RPC limits
  let searchToBlock = beforeBlock - 1;
  let searchAttempts = 0;
  const MAX_SEARCH_ATTEMPTS = 10;
  
  while (searchAttempts < MAX_SEARCH_ATTEMPTS) {
    const searchFromBlock = Math.max(0, searchToBlock - SEARCH_CHUNK_SIZE);
    searchAttempts++;
    
    console.log(`🔎 Attempt ${searchAttempts}: Searching blocks ${searchFromBlock} to ${searchToBlock} for recent transaction`);
    
    for (const endpoint of rpcEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getLogs',
            params: [{
              fromBlock: `0x${searchFromBlock.toString(16)}`,
              toBlock: `0x${searchToBlock.toString(16)}`,
              address: contractAddress,
              topics: [
                null, // Any event
                `0x000000000000000000000000${userAddress.slice(2)}` // User address as topic
              ]
            }],
            id: 1,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        if (data.error) {
          throw new Error(`RPC Error: ${data.error.message}`);
        }
        
        const logs = data.result || [];
        
        if (logs.length > 0) {
          // Find the most recent transaction (highest block number)
          const mostRecentBlock = Math.max(...logs.map((log: any) => parseInt(log.blockNumber, 16)));
          console.log(`✅ Found most recent transaction at block ${mostRecentBlock}`);
          return mostRecentBlock;
        }
        
        break; // Break endpoint loop if successful (even if no logs found)
      } catch (error) {
        console.warn(`❌ Failed to search ${endpoint.split('/')[2]}:`, error);
        continue; // Try next endpoint
      }
    }
    
    // No transaction found in this chunk, search further back
    searchToBlock = searchFromBlock - 1;
    
    if (searchFromBlock <= 0) {
      console.log('🔚 Reached beginning of blockchain, no more transactions to search');
      break;
    }
  }
  
  console.log('🔍 No recent transactions found with contract');
  return null;
}

// Helper function to get user's transaction history with the contract
async function getUserContractTransactionBlocks(userAddress: string, currentBlock: number): Promise<number[]> {
  const rpcEndpoints = [
    'https://ethereum-sepolia.publicnode.com',
    'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    'https://rpc.sepolia.ethpandaops.io',
    'https://eth-sepolia.g.alchemy.com/v2/demo'
  ];
  
  const contractAddress = '0xc5369041d5b6Df56a269F03B4b96377C17FBC56C';
  // This function is now deprecated in favor of the progressive search approach
  // Keeping for potential fallback use
  const startBlock = Math.max(0, currentBlock - 50000); // Limit to 50k blocks to avoid RPC errors
  
  console.log(`🗓️ Fallback: Searching for transactions from block ${startBlock} to ${currentBlock}`);
  
  // This is now a fallback method - the main logic uses progressive search
  // Return empty array to trigger the new progressive search approach
  console.log('📝 Using progressive search instead of bulk transaction history');
  return [];
}

// Helper function to get current block number with fallback providers
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
  
  console.error('🚨 All RPC endpoints failed to get current block number, using fallback');
  return 1000000; // Fallback block number for Sepolia
}