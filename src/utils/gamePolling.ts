import { decodeStringFromHex } from '../thirdweb';

/**
 * Poll contract for newly created games using direct RPC calls
 * This is useful when log parsing fails or games don't show up immediately
 */
export const pollForNewGame = async (
  hostAddress: string, 
  blockNumber: number | bigint, 
  transactionHash?: string,
  searchRadius: number = 5
): Promise<string[]> => {
  console.log('🔍 Polling for games created by:', hostAddress, 'around block:', blockNumber);
  
  // Try to find games by checking recent event logs directly
  const rpcEndpoint = 'https://mainnet.base.org';
  const contractAddress = '0x6a242970f55e050CB54DA489751d562083abD4B7';
  
  try {
    // Convert BigInt to number if needed
    const blockNum = typeof blockNumber === 'bigint' ? Number(blockNumber) : blockNumber;
    
    // Search blocks around the specified block number
    const fromBlock = Math.max(0, blockNum - searchRadius);
    const toBlock = blockNum + searchRadius;
    
    console.log(`📊 Polling blocks ${fromBlock} to ${toBlock} (±${searchRadius} from ${blockNumber})`);
    
    const response = await fetch(rpcEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          address: contractAddress,
          topics: [
            '0xf38f031a0916124649a52ef62ca68c773c22f2386d78bb4aed755a298c7b18d3', // GameStarted event signature calculated from GameStarted(string,address,address,uint256,uint256,address[])
            `0x000000000000000000000000${hostAddress.slice(2).toLowerCase()}` // Host address in indexed position
          ],
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${toBlock.toString(16)}`
        }],
        id: 1,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`RPC error: ${response.status}`);
    }
    
    const data = await response.json();
    const logs = data.result || [];
    
    console.log('📊 Polling found', logs.length, 'GameStarted events for host');
    
    const gameCodes: string[] = [];
    
    for (const log of logs) {
      // If transactionHash is provided, only look for that specific transaction
      if (transactionHash && log.transactionHash !== transactionHash) {
        continue;
      }
      
      console.log('✅ Processing log from transaction:', log.transactionHash);
      
      // Try to extract game code from log data
      if (log.data && log.data.length > 2) {
        const gameCode = decodeStringFromHex(log.data);
        if (gameCode && gameCode.length >= 3 && gameCode.length <= 10) {
          gameCodes.push(gameCode);
          console.log('✅ Extracted game code via polling:', gameCode);
        }
      }
    }
    
    return gameCodes;
  } catch (error) {
    console.error('❌ Polling failed:', error);
    return [];
  }
};

/**
 * Poll for recent games created by a host in the last few blocks
 * Useful for Load My Games to find very recent games
 */
export const pollForRecentGames = async (
  hostAddress: string,
  currentBlock: number,
  blocksToSearch: number = 100
): Promise<string[]> => {
  console.log('🔍 Polling for recent games by:', hostAddress, 'in last', blocksToSearch, 'blocks');
  
  const fromBlock = Math.max(0, currentBlock - blocksToSearch);
  const toBlock = currentBlock;
  
  return await pollForNewGame(hostAddress, currentBlock, undefined, blocksToSearch);
};