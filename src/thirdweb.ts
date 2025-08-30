import { createThirdwebClient, getContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";

// Note: Don't re-export Thirdweb functions here as it breaks dynamic imports
// Import these functions directly from 'thirdweb' in components

// Safe imports to prevent circular dependency issues
let cachedContract: any = null;

// Synchronous exports for ThirdwebProvider (required for provider initialization)
export const client = createThirdwebClient({
  clientId: "fd75897568b8f195b5886be4710e306d"
});

export const chain = sepolia;

// Async getter functions for components (safer for component-level usage)
export const getClient = async () => {
  return client;
};

export const getChain = async () => {
  return chain;
};

// Your deployed smart contract address - PU2 Contract
export const CONTRACT_ADDRESS = "0x5dB94ea6159a8B90887637B82464BD04D9B2961b";

// Contract ABI - PU2 Contract with enhanced features
export const CONTRACT_ABI = [
  // View functions - Updated getGameInfo returns isLocked and prizeSplits
  "function getGameInfo(string code) view returns (address host, uint256 buyIn, uint256 maxPlayers, uint256 playerCount, bool isLocked, uint256[] splits)",
  "function getPlayers(string code) view returns (address[] players)",
  "function getInGameJudges(string code) view returns (address[] judges)",
  "function getUnanimousJudges(string code) view returns (address[] judges)",
  "function judges(address player) view returns (address[] judges)",
  "function codeIsAvailable(string code) view returns (bool)",
  "function isWinnerConfirmed(string code, address winner) view returns (bool)",
  
  // Write functions - Original + New PU2 functions
  "function startGame(uint256 buyIn, uint256 maxPlayers) returns (string code)",
  "function joinGame(string code) payable",
  "function setJudges(address[] judgeList)",
  "function addJudge(string code, address judge)",
  "function lockGame(string code)",
  "function setPrizeSplits(string code, uint256[] splits)",
  "function reportWinners(string code, address[] winners)",
  "function approveWinner(string code, address winner)",
  "function claimWinnings(string code)",
  
  // Events - Original + New PU2 events
  "event GameStarted(string code, address indexed host, uint256 buyIn, uint256 maxPlayers)",
  "event PlayerJoined(string code, address indexed player)",
  "event JudgeAdded(string code, address indexed judge)",
  "event GameLocked(string code)",
  "event PrizeSplitsSet(string code, uint256[] splits)",
  "event WinnersReported(string code, address indexed reporter, address[] winners)",
  "event WinnerApproved(string code, address indexed voter, address winner)",
  "event WinnerConfirmed(string code, address winner)",
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
    console.log('Error decoding string from hex:', error);
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