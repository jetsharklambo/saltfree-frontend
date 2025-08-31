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