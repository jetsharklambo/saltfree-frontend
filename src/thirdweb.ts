import { createThirdwebClient, getContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import { getRequiredEnvVar } from "./utils/envUtils";

// Note: Don't re-export Thirdweb functions here as it breaks dynamic imports
// Import these functions directly from 'thirdweb' in components

// Safe imports to prevent circular dependency issues
let cachedContract: any = null;

// Synchronous exports for ThirdwebProvider (required for provider initialization)
export const client = createThirdwebClient({
  clientId: getRequiredEnvVar('REACT_APP_THIRDWEB_CLIENT_ID')
});

export const chain = sepolia;

// Async getter functions for components (safer for component-level usage)
export const getClient = async () => {
  return client;
};

export const getChain = async () => {
  return chain;
};

// Your deployed smart contract address - UP2.1 Contract
export const CONTRACT_ADDRESS = "0x6B3f229A0c7FBC5987f13e97A57EC467625a09bB";

// Contract ABI - UP2.1 Contract with new judge system and enhanced features
export const CONTRACT_ABI = [
  // View functions - Updated for new contract
  "function getGameInfo(string code) view returns (address host, uint256 buyIn, uint256 maxPlayers, uint256 playerCount, bool isLocked, uint256[] splits, address[] judges)",
  "function getPlayers(string code) view returns (address[] players)",
  "function getInGameJudges(string code) view returns (address[] judges)",
  "function getConfirmedWinners(string code) view returns (address[] winners)",
  "function codeIsAvailable(string code) view returns (bool)",
  "function isWinnerConfirmed(string code, address winner) view returns (bool)",
  
  // Write functions - Updated for new contract
  "function startGame(uint256 buyIn, uint256 maxPlayers, address[] judgeList) returns (string code)",
  "function joinGame(string code) payable",
  "function lockGame(string code)",
  "function setPrizeSplits(string code, uint256[] splits)",
  "function reportWinners(string code, address[] winners)",
  "function claimWinnings(string code)",
  "function addPot(string code) payable",
  "function rmGame(string code, address participant)",
  
  // Events - Updated for new contract
  "event GameStarted(string code, address indexed host, uint256 buyIn, uint256 maxPlayers, address[] judges)",
  "event JudgeSet(string code, address indexed judge)",
  "event PlayerJoined(string code, address indexed player)",
  "event PlayerRemoved(string code, address indexed participant)",
  "event GameLocked(string code)",
  "event PrizeSplitsSet(string code, uint256[] splits)",
  "event PotAdded(string code, address indexed sender, uint256 amount)",
  "event WinnersReported(string code, address indexed reporter, address[] winners)",
  "event WinnerSetConfirmed(string code, address[] winners)",
  "event WinningsClaimed(string code, address indexed winner, uint256 amount)",
] as const;

// Helper functions
export const formatAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatEth = (wei: string | bigint) => {
  const eth = Number(wei) / 1e18;
  return eth.toFixed(4);
};

// Helper functions for prize splits
export const formatPrizeSplit = (split: number | bigint) => {
  const splitNum = typeof split === 'bigint' ? Number(split) : split;
  return (splitNum / 10).toFixed(1) + '%';
};

export const calculatePrizeAmount = (totalPot: bigint, split: number) => {
  return (totalPot * BigInt(split)) / BigInt(1000);
};

export const validatePrizeSplits = (splits: number[]): string | null => {
  if (splits.length === 0) return null;
  if (splits.length > 3) return "Maximum 3 prize splits allowed";
  
  const sum = splits.reduce((acc, split) => acc + split, 0);
  if (sum !== 1000) return "Prize splits must sum to 100%";
  
  for (const split of splits) {
    if (split <= 0 || split >= 1000) return "Each prize split must be between 0.1% and 99.9%";
  }
  
  return null;
};

// Helper function to decode ABI-encoded string from hex data
export const decodeStringFromHex = (hexData: string): string | null => {
  try {
    // Remove 0x prefix if present
    const data = hexData.startsWith('0x') ? hexData.slice(2) : hexData;
    
    // ABI encoding for strings:
    // - First 32 bytes: offset to string data (usually 0x20 = 32)
    // - Next 32 bytes: length of string
    // - Following bytes: string data (padded to 32-byte chunks)
    
    if (data.length < 128) return null; // Need at least offset + length + some data
    
    // Parse offset (first 32 bytes = 64 hex chars)
    const offsetHex = data.slice(0, 64);
    const offset = parseInt(offsetHex, 16) * 2; // Convert to hex char position
    
    // Parse length (next 32 bytes = 64 hex chars)  
    const lengthHex = data.slice(64, 128);
    const length = parseInt(lengthHex, 16);
    
    if (length === 0 || length > 100) return null; // Sanity check
    
    // Extract string data starting from offset
    const stringStart = Math.max(128, offset); // Usually 128, but use offset if different
    const stringHex = data.slice(stringStart, stringStart + (length * 2));
    
    // Convert hex to ASCII
    let result = '';
    for (let i = 0; i < stringHex.length; i += 2) {
      const hex = stringHex.substr(i, 2);
      const charCode = parseInt(hex, 16);
      if (charCode === 0) break; // End of string
      result += String.fromCharCode(charCode);
    }
    
    return result;
  } catch (error) {
    // Silently fail for invalid hex strings - this is expected behavior
    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('Error decoding string from hex:', error);
    }
    return null;
  }
};

/**
 * Decode GameStarted event data containing multiple ABI-encoded parameters:
 * event GameStarted(string code, address indexed host, uint256 buyIn, uint256 maxPlayers, address[] judges)
 * 
 * The data field contains: code, buyIn, maxPlayers, judges (host is indexed and in topics)
 */
export const decodeGameStartedEvent = (hexData: string): { code: string; buyIn: string; maxPlayers: number; judges: string[] } | null => {
  try {
    const data = hexData.startsWith('0x') ? hexData.slice(2) : hexData;
    console.log('🔍 Decoding GameStarted event data:', hexData);
    console.log('📦 Raw hex length:', data.length);
    
    if (data.length < 256) {
      console.log('❌ Data too short for GameStarted event');
      return null;
    }
    
    // ABI encoding structure for GameStarted(string code, uint256 buyIn, uint256 maxPlayers, address[] judges):
    // The data section contains pointers and values for dynamic types
    
    // Read all the 32-byte chunks first
    const chunk0 = data.slice(0, 64);    // Offset to string code
    const chunk1 = data.slice(64, 128);  // buyIn value
    const chunk2 = data.slice(128, 192); // maxPlayers value  
    const chunk3 = data.slice(192, 256); // Offset to judges array
    
    console.log('📦 ABI chunks:');
    console.log('  Chunk 0 (string offset):', chunk0);
    console.log('  Chunk 1 (buyIn):', chunk1);
    console.log('  Chunk 2 (maxPlayers):', chunk2);
    console.log('  Chunk 3 (judges offset):', chunk3);
    
    // Decode buyIn
    const buyIn = BigInt('0x' + chunk1).toString();
    
    // Decode maxPlayers
    const maxPlayers = parseInt(chunk2, 16);
    
    // Decode string offset and find the actual string
    const stringOffset = parseInt(chunk0, 16) * 2; // Convert to hex char position
    console.log('📦 String offset in hex chars:', stringOffset);
    
    if (stringOffset >= data.length) {
      console.log('❌ String offset beyond data length');
      return null;
    }
    
    // Read string length at the offset
    const stringLengthHex = data.slice(stringOffset, stringOffset + 64);
    const stringLength = parseInt(stringLengthHex, 16);
    console.log('📦 String length:', stringLength);
    
    if (stringLength === 0 || stringLength > 50) {
      console.log('❌ Invalid string length:', stringLength);
      return null;
    }
    
    // Extract the string data
    const stringDataStart = stringOffset + 64;
    const stringHex = data.slice(stringDataStart, stringDataStart + (stringLength * 2));
    console.log('📦 String hex data:', stringHex);
    
    // Convert hex to ASCII for game code
    let code = '';
    for (let i = 0; i < stringHex.length; i += 2) {
      const hex = stringHex.substr(i, 2);
      const charCode = parseInt(hex, 16);
      if (charCode === 0) break;
      code += String.fromCharCode(charCode);
    }
    
    console.log('✅ Decoded GameStarted event:', { code, buyIn, maxPlayers });
    
    if (!code || code.length < 3) {
      console.log('❌ Invalid game code extracted:', code);
      return null;
    }
    
    return { code, buyIn, maxPlayers, judges: [] };
    
  } catch (error) {
    console.warn('❌ Failed to decode GameStarted event:', hexData, error);
    return null;
  }
};

/**
 * Decode PlayerJoined event data:
 * event PlayerJoined(string code, address indexed player)
 * 
 * The data field contains: code (player is indexed and in topics)
 */
export const decodePlayerJoinedEvent = (hexData: string): string | null => {
  try {
    const data = hexData.startsWith('0x') ? hexData.slice(2) : hexData;
    console.log('🔍 Decoding PlayerJoined event data:', hexData);
    
    if (data.length < 128) {
      console.log('❌ Data too short for PlayerJoined event');
      return null;
    }
    
    // PlayerJoined has simple structure: just the string code in data section
    // First 32 bytes: offset to string data (usually 0x20 = 32)
    // Next 32 bytes: length of string
    // Following bytes: string data
    
    const offsetHex = data.slice(0, 64);
    const offset = parseInt(offsetHex, 16) * 2;
    
    const lengthHex = data.slice(64, 128);
    const length = parseInt(lengthHex, 16);
    
    if (length === 0 || length > 50) {
      console.log('❌ Invalid string length:', length);
      return null;
    }
    
    const stringStart = Math.max(128, offset);
    const stringHex = data.slice(stringStart, stringStart + (length * 2));
    
    let code = '';
    for (let i = 0; i < stringHex.length; i += 2) {
      const hex = stringHex.substr(i, 2);
      const charCode = parseInt(hex, 16);
      if (charCode === 0) break;
      code += String.fromCharCode(charCode);
    }
    
    console.log('✅ Decoded PlayerJoined event code:', code);
    return code && code.length >= 3 ? code : null;
    
  } catch (error) {
    console.warn('❌ Failed to decode PlayerJoined event:', hexData, error);
    return null;
  }
};

/**
 * Decode GameLocked event data:
 * event GameLocked(string code)
 * 
 * Simple string-only event, can use existing decodeStringFromHex
 */
export const decodeGameLockedEvent = (hexData: string): string | null => {
  return decodeStringFromHex(hexData);
};

/**
 * Decode WinnersReported event data:
 * event WinnersReported(string code, address indexed reporter, address[] winners)
 * 
 * The data field contains: code, winners (reporter is indexed and in topics)
 */
export const decodeWinnersReportedEvent = (hexData: string): string | null => {
  try {
    const data = hexData.startsWith('0x') ? hexData.slice(2) : hexData;
    console.log('🔍 Decoding WinnersReported event data:', hexData);
    
    if (data.length < 128) {
      console.log('❌ Data too short for WinnersReported event');
      return null;
    }
    
    // WinnersReported structure: string code, address[] winners
    // Similar to GameStarted but simpler - just extract the string code
    
    const chunk0 = data.slice(0, 64);    // Offset to string code
    const chunk1 = data.slice(64, 128);  // Offset to winners array
    
    // Decode string offset and find the actual string
    const stringOffset = parseInt(chunk0, 16) * 2;
    console.log('📦 String offset in hex chars:', stringOffset);
    
    if (stringOffset >= data.length) {
      console.log('❌ String offset beyond data length');
      return null;
    }
    
    // Read string length at the offset
    const stringLengthHex = data.slice(stringOffset, stringOffset + 64);
    const stringLength = parseInt(stringLengthHex, 16);
    console.log('📦 String length:', stringLength);
    
    if (stringLength === 0 || stringLength > 50) {
      console.log('❌ Invalid string length:', stringLength);
      return null;
    }
    
    // Extract the string data
    const stringDataStart = stringOffset + 64;
    const stringHex = data.slice(stringDataStart, stringDataStart + (stringLength * 2));
    console.log('📦 String hex data:', stringHex);
    
    // Convert hex to ASCII for game code
    let code = '';
    for (let i = 0; i < stringHex.length; i += 2) {
      const hex = stringHex.substr(i, 2);
      const charCode = parseInt(hex, 16);
      if (charCode === 0) break;
      code += String.fromCharCode(charCode);
    }
    
    console.log('✅ Decoded WinnersReported event code:', code);
    return code && code.length >= 3 ? code : null;
    
  } catch (error) {
    console.warn('❌ Failed to decode WinnersReported event:', hexData, error);
    return null;
  }
};

// Helper to create contract instance (synchronous like working version)
export const getGameContract = () => {
  return getContract({
    client,
    chain,
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
  });
};

// Synchronous version for immediate use (keeping for backward compatibility)
export const gameContract = getContract({
  client,
  chain,
  address: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
});