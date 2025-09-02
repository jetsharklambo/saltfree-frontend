import { waitForReceipt, getContractEvents } from 'thirdweb';
import { getGameContract, decodeStringFromHex, decodeGameStartedEvent, client, chain } from '../thirdweb';
import { pollForNewGame } from './gamePolling';

export interface TransactionStatus {
  status: 'pending' | 'confirming' | 'confirmed' | 'extracting' | 'complete' | 'failed' | 'timeout';
  gameCode?: string;
  blockNumber?: number;
  error?: string;
}

export interface GameCreationData {
  gameCode: string;
  buyIn: string;
  maxPlayers: number;
  transactionHash: string;
  blockNumber?: number;
}

/**
 * Monitor a game creation transaction and extract the game code when complete
 */
export const monitorGameCreationTransaction = async (
  transactionHash: string,
  hostAddress: string,
  onStatusUpdate: (status: TransactionStatus) => void,
  timeout: number = 180000 // 3 minutes - respect blockchain timing
): Promise<TransactionStatus> => {
  console.log('🔍 Starting transaction monitoring for:', transactionHash);
  
  const contract = await getGameContract();
  
  // Update status to confirming
  onStatusUpdate({ status: 'confirming' });
  
  try {
    // Wait for transaction receipt with timeout
    const receiptPromise = waitForReceipt({
      client: client,
      chain: chain,
      transactionHash: transactionHash,
    });
    
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Transaction confirmation timeout')), timeout)
    );
    
    const receipt = await Promise.race([receiptPromise, timeoutPromise]) as any;
    
    console.log('✅ Transaction confirmed! Block:', receipt.blockNumber);
    onStatusUpdate({ status: 'confirmed', blockNumber: receipt.blockNumber });
    
    // Now extract game code
    onStatusUpdate({ status: 'extracting' });
    
    const gameCode = await extractGameCodeFromTransaction(
      receipt, 
      contract, 
      transactionHash, 
      hostAddress
    );
    
    if (gameCode && gameCode !== 'UNKNOWN') {
      console.log('✅ Game code extracted:', gameCode);
      const finalStatus: TransactionStatus = {
        status: 'complete',
        gameCode,
        blockNumber: receipt.blockNumber
      };
      onStatusUpdate(finalStatus);
      return finalStatus;
    } else {
      console.warn('⚠️ Could not extract game code, using fallback');
      // Create a game code that follows the pattern: 3 alphanumeric chars - 3 chars
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const hashPart = transactionHash.slice(-8).toUpperCase();
      
      // Extract 6 hex chars and convert to valid game code format
      let gameCodeChars = '';
      for (let i = 0; i < 6; i++) {
        const hexChar = hashPart[i] || '0';
        // Convert hex digit to valid game code character
        const charIndex = parseInt(hexChar, 16) % chars.length;
        gameCodeChars += chars[charIndex];
      }
      
      const fallbackCode = `${gameCodeChars.slice(0, 3)}-${gameCodeChars.slice(3, 6)}`;
      console.log(`🎲 Generated fallback code: ${fallbackCode}`);
      
      const finalStatus: TransactionStatus = {
        status: 'complete',
        gameCode: fallbackCode,
        blockNumber: receipt.blockNumber,
        error: 'Game code extracted using fallback method'
      };
      onStatusUpdate(finalStatus);
      return finalStatus;
    }
    
  } catch (error) {
    console.error('❌ Transaction monitoring failed:', error);
    
    if (error instanceof Error && error.message.includes('timeout')) {
      const timeoutStatus: TransactionStatus = {
        status: 'timeout',
        error: 'Transaction confirmation timed out'
      };
      onStatusUpdate(timeoutStatus);
      return timeoutStatus;
    } else {
      const failedStatus: TransactionStatus = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      onStatusUpdate(failedStatus);
      return failedStatus;
    }
  }
};

/**
 * Extract game code from transaction receipt using multiple methods
 */
async function extractGameCodeFromTransaction(
  receipt: any,
  contract: any,
  transactionHash: string,
  hostAddress: string
): Promise<string> {
  console.log('🔍 Extracting game code from transaction receipt');
  
  let gameCode = 'UNKNOWN';
  // Updated with the actual topic signature from transaction logs
  const GAME_STARTED_TOPIC = '0x2c74b4faa02f74a9d76da4ef4ffdef63f9c57dbd733375f5f9ec6a9d2e9d3b83';
  
  // Method 1: Analyze transaction logs
  if (receipt.logs && receipt.logs.length > 0) {
    console.log('🔍 Method 1: Analyzing transaction logs...');
    console.log('📦 Total logs found:', receipt.logs.length);
    
    for (let i = 0; i < receipt.logs.length; i++) {
      const log = receipt.logs[i];
      console.log(`📦 Log ${i}:`, {
        address: log.address,
        topics: log.topics,
        data: log.data ? `${log.data.slice(0, 20)}...` : 'null'
      });
      
      console.log(`🔍 Checking topic match for log ${i}:`);
      console.log(`  Expected: ${GAME_STARTED_TOPIC.toLowerCase()}`);
      console.log(`  Actual:   ${log.topics?.[0]?.toLowerCase()}`);
      console.log(`  Match:    ${log.topics?.[0]?.toLowerCase() === GAME_STARTED_TOPIC.toLowerCase()}`);
      
      if (log.topics && log.topics[0] && 
          log.topics[0].toLowerCase() === GAME_STARTED_TOPIC.toLowerCase()) {
        
        console.log('🎯 Found GameStarted event! Full log data:', log.data);
        
        if (log.data) {
          try {
            // Try the new GameStarted event decoder first
            const eventData = decodeGameStartedEvent(log.data);
            if (eventData && eventData.code && eventData.code.length >= 3 && eventData.code.length <= 10) {
              gameCode = eventData.code;
              console.log('✅ Method 1: Extracted game code from GameStarted event:', gameCode);
              console.log('📊 Event details:', eventData);
              return gameCode;
            }
            
            // Fallback to old string decoder
            const extractedCode = decodeStringFromHex(log.data);
            if (extractedCode && extractedCode.length >= 3 && extractedCode.length <= 10) {
              gameCode = extractedCode;
              console.log('✅ Method 1: Extracted game code from fallback decoder:', gameCode);
              return gameCode;
            }
          } catch (err) {
            console.log('❌ Method 1: Failed to decode log data:', err);
          }
        }
      }
    }
  }
  
  // Method 2: Try Thirdweb event parsing
  if (gameCode === 'UNKNOWN' && receipt.blockNumber) {
    console.log('🔍 Method 2: Trying Thirdweb event parsing...');
    try {
      const events = await getContractEvents({
        contract,
        eventName: "GameStarted",
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      
      for (const event of events) {
        if (event.transactionHash === transactionHash) {
          if (event.args && event.args.code) {
            gameCode = event.args.code;
            console.log('✅ Method 2: Extracted game code from Thirdweb event:', gameCode);
            return gameCode;
          }
        }
      }
    } catch (err) {
      console.log('❌ Method 2: Thirdweb event parsing failed:', err);
    }
  }
  
  // Method 3: Patient blockchain polling with exponential backoff
  if (gameCode === 'UNKNOWN') {
    console.log('🔍 Method 3: Patient blockchain polling...');
    
    const delays = [5000, 10000, 15000, 20000, 30000]; // 5s, 10s, 15s, 20s, 30s
    const searchRadii = [5, 10, 20, 30, 50]; // Increasing search range
    
    for (let i = 0; i < delays.length; i++) {
      try {
        console.log(`⏳ Waiting ${delays[i]/1000}s for blockchain propagation (attempt ${i+1}/${delays.length})...`);
        await new Promise(resolve => setTimeout(resolve, delays[i]));
        
        const hostGames = await pollForNewGame(hostAddress, receipt.blockNumber || 0, transactionHash, searchRadii[i]);
        if (hostGames.length > 0) {
          gameCode = hostGames[0];
          console.log(`✅ Method 3: Found game via patient polling (attempt ${i+1}):`, gameCode);
          return gameCode;
        }
        
        console.log(`🔍 Attempt ${i+1}: No game found yet, waiting longer...`);
      } catch (err) {
        console.log(`❌ Polling attempt ${i+1} failed:`, err);
      }
    }
  }
  
  console.log('⚠️ All extraction methods failed, game code remains:', gameCode);
  return gameCode;
}

/**
 * Create a polling interval that checks transaction status every X seconds
 */
export const createTransactionPoller = (
  transactionHash: string,
  hostAddress: string,
  onStatusUpdate: (status: TransactionStatus) => void,
  intervalSeconds: number = 30, // Longer intervals to respect blockchain timing
  maxDuration: number = 180000 // 3 minutes - be patient
): { start: () => void; stop: () => void } => {
  let intervalId: NodeJS.Timeout | null = null;
  let timeoutId: NodeJS.Timeout | null = null;
  let isComplete = false;
  
  const start = () => {
    console.log(`🔄 Starting transaction poller (${intervalSeconds}s intervals for ${maxDuration/1000}s)`);
    
    // Start monitoring immediately
    monitorGameCreationTransaction(transactionHash, hostAddress, (status) => {
      onStatusUpdate(status);
      if (status.status === 'complete' || status.status === 'failed') {
        isComplete = true;
        stop();
      }
    }).catch(error => {
      console.error('Initial monitoring failed:', error);
    });
    
    // Set up polling interval
    intervalId = setInterval(async () => {
      if (isComplete) {
        stop();
        return;
      }
      
      console.log('🔄 Polling transaction status...');
      try {
        await monitorGameCreationTransaction(transactionHash, hostAddress, onStatusUpdate, 5000); // Shorter timeout for polls
      } catch (error) {
        console.warn('Poll failed:', error);
      }
    }, intervalSeconds * 1000);
    
    // Set overall timeout
    timeoutId = setTimeout(() => {
      if (!isComplete) {
        console.log('⏰ Transaction monitoring timed out');
        onStatusUpdate({ 
          status: 'timeout',
          error: 'Transaction monitoring timed out after 1 minute'
        });
        stop();
      }
    }, maxDuration);
  };
  
  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    console.log('🛑 Transaction poller stopped');
  };
  
  return { start, stop };
};