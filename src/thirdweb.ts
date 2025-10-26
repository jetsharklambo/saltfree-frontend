import { createThirdwebClient, getContract, prepareContractCall, sendTransaction, waitForReceipt, readContract } from "thirdweb";
import { base, ethereum } from "thirdweb/chains";
import { getRequiredEnvVar } from "./utils/envUtils";

// Note: Don't re-export Thirdweb functions here as it breaks dynamic imports
// Import these functions directly from 'thirdweb' in components

// Safe imports to prevent circular dependency issues
let cachedContract: any = null;

// Synchronous exports for ThirdwebProvider (required for provider initialization)
export const client = createThirdwebClient({
  clientId: getRequiredEnvVar('REACT_APP_THIRDWEB_CLIENT_ID')
});

// Available chains
export const supportedChains = {
  base,
  ethereum
};

// Default chain (Base)
export const chain = base;

// Export both chains for network switching
export { base, ethereum };

// Async getter functions for components (safer for component-level usage)
export const getClient = async () => {
  return client;
};

export const getChain = async () => {
  return chain;
};

// OpenPoolsV36 with ERC2771 Gasless Support - Base Mainnet
export const CONTRACT_ADDRESS = "0xEE39bFE97e165fd15C2B0c75D96ddFfa816DDD11";

// MinimalForwarder for ERC2771 meta-transactions
export const FORWARDER_ADDRESS = "0x4FFAE8a0818FFd17284674004ABf1e4340B89691";

// Relay API URL for gasless transactions
export const RELAY_API_URL = process.env.REACT_APP_RELAY_API_URL || "http://localhost:3001/api/gasless";

// Contract ABI - OpenPoolsV36 with ERC2771 support
export const CONTRACT_ABI = [
  // Write functions
  "function createGame(uint256 buyIn, address token, uint256 maxPlayers, address[] judges, uint256[] splits) returns (string)",
  "function joinGame(string code) payable",
  "function reportWinners(string code, address[] winners)",
  "function claimWinnings(string code)",
  "function lockGame(string code)",

  // View functions
  "function getGameInfo(string code) view returns (address host, address token, uint256 buyIn, uint256 maxPlayers, uint256 playerCount, bool locked, uint256[] splits, address[] judges)",
  "function getPlayers(string code) view returns (address[])",
  "function getConfirmedWinners(string code) view returns (address[])",
  "function isWinnerConfirmed(string code, address winner) view returns (bool)",
  "function codeIsAvailable(string code) view returns (bool)",
  "function getTotalPrize(string code) view returns (uint256)",
  "function isTrustedForwarder(address forwarder) view returns (bool)",

  // Events
  "event GameStarted(string indexed code, address indexed host, address token, uint256 buyIn, uint256 maxPlayers)",
  "event PlayerJoined(string indexed code, address indexed player, uint256 playerCount)",
  "event GameLocked(string indexed code)",
  "event WinnersReported(string indexed code, address[] winners)",
  "event WinningsClaimed(string indexed code, address indexed winner, address token, uint256 amount)",
  "event WinningsClaimedViaUI(string indexed code, address indexed winner, address token, uint256 userPayout, uint256 uiFee, uint256 feeRate)"
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

// Common Base tokens
export const BASE_TOKENS = {
  ETH: {
    address: "0x0000000000000000000000000000000000000000", // ETH represented as zero address
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2MjdFRUEiLz4KPHBhdGggZD0iTTE1Ljk5OTggNC41VjEzLjUxMjVMMjMuMTI0OCAxNi4wMDI1TDE1Ljk5OTggNC41WiIgZmlsbD0iI0ZGRkZGRiIgZmlsbC1vcGFjaXR5PSIwLjYiLz4KPHBhdGggZD0iTTE1Ljk5OTggNC41TDguODc0NzkgMTYuMDAyNUwxNS45OTk4IDEzLjUxMjVWNC41WiIgZmlsbD0iI0ZGRkZGRiIvPgo8cGF0aCBkPSJNMTUuOTk5OCAxOS4wODc1VjI3LjVMMjMuMTI5OCAxNy4yNUwxNS45OTk4IDE5LjA4NzVaIiBmaWxsPSIjRkZGRkZGIiBmaWxsLW9wYWNpdHk9IjAuNiIvPgo8cGF0aCBkPSJNMTUuOTk5OCAyNy41VjE5LjA4NzVMOC44NzQ3OSAxNy4yNUwxNS45OTk4IDI3LjVaIiBmaWxsPSIjRkZGRkZGIi8+Cjwvc3ZnPgo="
  },
  USDC: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMyNzc1Q0EiLz4KPHBhdGggZD0iTTE2IDI4QzIyLjYyNzQgMjggMjggMjIuNjI3NCAyOCAxNkMyOCA5LjM3MjU4IDIyLjYyNzQgNCAxNiA0QzkuMzcyNTggNCE0IDkuMzcyNTggNCA2VjE2QzQgMjIuNjI3NCA5LjM3MjU4IDI4IDE2IDI4WiIgZmlsbD0iIzI3NzVDQSIvPgo8cGF0aCBkPSJNMTYuMTQxIDE4LjY2N0MxNS4zOTggMTguNjY3IDE0LjczMiAxOC41OSAxNC4xNDMgMTguNDM4VjE0LjE3N0MxNC43MzkgMTQuMDI1IDE1LjM5OSAxMy45NDkgMTYuMTQxIDEzLjk0OUMxNy42MjUgMTMuOTQ5IDE4LjM2NyAxNC41NjQgMTguMzY3IDE1Ljc5NUMxOC4zNjcgMTYuOTQ5IDE3LjY0MSAxNy41MjYgMTYuMTg5IDE3LjUyNkMxNi4xNzMgMTcuNTI2IDE2LjE1NyAxNy41MjYgMTYuMTQxIDE3LjUyNlYxOC42NjdaTTE2LjE0MSAyMi4wNTNDMTcuODY5IDIyLjA1MyAxOS4yNjcgMjEuMzQ0IDE5LjI2NyAxOS40NDNDMTkuMjY3IDE4LjAyMSAxOC4zNTEgMTcuMjYgMTYuNTY1IDE3LjA2VjE2LjA5M0MxNy4xODUgMTUuOTQxIDE3LjYyNSAxNS41MzEgMTcuNjI1IDE0Ljk5NUMxNy42MjUgMTQuMjM2IDE3LjA5NyAxMy44NTggMTUuNDMzIDEzLjg1OEMxNC4xNTkgMTMuODU4IDEyLjcxMyAxNC4yMzYgMTIuNzEzIDE0LjIzNlY5LjU5NEMxMi43MTMgOS41OTQgMTQuMTQ3IDkuMTUzIDEzLjkyNSA5LjE1M0MxNy40ODkgOS4xNTMgMTkuNzE3IDEwLjk0OSAxOS43MTcgMTMuNTMxQzE5LjcxNyAxNS42IDI4LjE2MSAxNi4wOTMgMTkuMjY3IDE3LjE0MkMxOS4yNjcgMTkuMDgxIDE3Ljc1MyAyMi44ODUgMTYuMTg5IDIyLjg4NUMxNi4xNzMgMjIuODg1IDE2LjE1NyAyMi44ODUgMTYuMTQxIDIyLjg4NVoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo="
  },
  USDT: {
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM1MEFGOTUiLz4KPHBhdGggZD0iTTE3LjggMTAuNEgyMy4yVjguOEgxNy44VjEwLjRaTTE3LjggMTMuMkgyMy4yVjExLjZIMTcuOFYxMy4yWk0xNy44IDE2SDIzLjJWMTQuNEgxNy44VjE2Wk0xNy44IDE4LjhIMjMuMlYxNy4ySDdz3LjhWMTguOFpNMTcuOCAyMS42SDIzLjJWMjBIMTcuOFYyMS42Wk0xNy44IDI0LjRIMjMuMlYyMi44SDE3LjhWMjQuNFoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo="
  },
  DAI: {
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiNGQkIwNDMiLz4KPHBhdGggZD0iTTE2IDI4QzIyLjYyNzQgMjggMjggMjIuNjI3NCAyOCAxNkMyOCA5LjM3MjU4IDIyLjYyNzQgNCAxNiA0QzkuMzcyNTggNCE0IDkuMzcyNTggNCA2VjE2QzQgMjIuNjI3NCA5LjM3MjU4IDI4IDE2IDI4WiIgZmlsbD0iI0ZCQjA0MyIvPgo8cGF0aCBkPSJNOSAyM0wxMi41IDE3TDE2IDE5LjVMMTkuNSAxN0wyMyAyM0gxNkgxMEg5WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cgo="
  }
} as const;

// Token utility functions
export const formatTokenAmount = (amount: string | bigint, decimals: number = 18, displayDecimals: number = 4) => {
  const value = Number(amount) / Math.pow(10, decimals);
  return value.toFixed(displayDecimals);
};

export const parseTokenAmount = (amount: string, decimals: number = 18): bigint => {
  const value = parseFloat(amount);
  return BigInt(Math.floor(value * Math.pow(10, decimals)));
};

export const getTokenByAddress = (address: string) => {
  return Object.values(BASE_TOKENS).find(token => 
    token.address.toLowerCase() === address.toLowerCase()
  );
};

export const isETH = (tokenAddress: string): boolean => {
  return tokenAddress === "0x0000000000000000000000000000000000000000" || tokenAddress === "";
};

export const formatTokenDisplay = (amount: string | bigint, tokenAddress: string): string => {
  const token = getTokenByAddress(tokenAddress);
  if (!token) return `${formatTokenAmount(amount, 18)} Unknown`;
  
  return `${formatTokenAmount(amount, token.decimals)} ${token.symbol}`;
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
 * Decode GameStarted event data for multi-token contract:
 * event GameStarted(string code, address indexed host, address token, uint256 buyIn, uint256 maxPlayers, address[] judges)
 * 
 * The data field contains: code, token, buyIn, maxPlayers, judges (host is indexed and in topics)
 */
export const decodeGameStartedEvent = (hexData: string): { code: string; token: string; buyIn: string; maxPlayers: number; judges: string[] } | null => {
  try {
    const data = hexData.startsWith('0x') ? hexData.slice(2) : hexData;
    console.log('🔍 Decoding GameStarted event data:', hexData);
    console.log('📦 Raw hex length:', data.length);
    
    if (data.length < 320) {
      console.log('❌ Data too short for GameStarted event');
      return null;
    }
    
    // ABI encoding structure for GameStarted(string code, uint256 buyIn, uint256 maxPlayers, address[] judges):
    // The data section contains pointers and values for dynamic types
    
    // Read all the 32-byte chunks first
    const chunk0 = data.slice(0, 64);    // Offset to string code
    const chunk1 = data.slice(64, 128);  // token address
    const chunk2 = data.slice(128, 192); // buyIn value
    const chunk3 = data.slice(192, 256); // maxPlayers value  
    const chunk4 = data.slice(256, 320); // Offset to judges array
    
    console.log('📦 ABI chunks:');
    console.log('  Chunk 0 (string offset):', chunk0);
    console.log('  Chunk 1 (token):', chunk1);
    console.log('  Chunk 2 (buyIn):', chunk2);
    console.log('  Chunk 3 (maxPlayers):', chunk3);
    console.log('  Chunk 4 (judges offset):', chunk4);
    
    // Decode token address
    const token = '0x' + chunk1.slice(-40); // Last 20 bytes as address
    
    // Decode buyIn
    const buyIn = BigInt('0x' + chunk2).toString();
    
    // Decode maxPlayers
    const maxPlayers = parseInt(chunk3, 16);
    
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
    
    console.log('✅ Decoded GameStarted event:', { code, token, buyIn, maxPlayers });
    
    if (!code || code.length < 3) {
      console.log('❌ Invalid game code extracted:', code);
      return null;
    }
    
    return { code, token, buyIn, maxPlayers, judges: [] };
    
  } catch (error) {
    console.warn('❌ Failed to decode GameStarted event:', hexData, error);
    return null;
  }
};

/**
 * Decode PlayerJoined event data for multi-token contract:
 * event PlayerJoined(string code, address indexed player, address token, uint256 amount)
 * 
 * The data field contains: code, token, amount (player is indexed and in topics)
 */
/**
 * Decode bytes32 indexed game code from event topics
 * For events where game code is indexed (in topics, not data)
 */
export const decodeGameCodeFromTopic = (topicHash: string): string | null => {
  try {
    if (!topicHash || topicHash.length < 10) return null;

    // Remove 0x prefix
    const hash = topicHash.startsWith('0x') ? topicHash.slice(2) : topicHash;

    // Convert hex to ASCII, stopping at null byte
    let code = '';
    for (let i = 0; i < hash.length && code.length < 20; i += 2) {
      const charCode = parseInt(hash.substr(i, 2), 16);
      if (charCode === 0) break; // Stop at null terminator
      if (charCode >= 32 && charCode <= 126) { // Printable ASCII only
        code += String.fromCharCode(charCode);
      }
    }

    // Validate game code format (3-10 alphanumeric chars with optional dash)
    if (code.length >= 3 && code.length <= 10 && /^[A-Z0-9-]+$/i.test(code)) {
      return code;
    }

    return null;
  } catch (error) {
    return null;
  }
};

export const decodePlayerJoinedEvent = (topics: string[]): string | null => {
  try {
    // PlayerJoined(bytes32 indexed code, address indexed player, uint256 amount)
    // topics[0] = event signature
    // topics[1] = game code (bytes32)
    // topics[2] = player address
    // data = amount

    if (!topics || topics.length < 2) {
      console.log('❌ PlayerJoined event missing topics');
      return null;
    }

    const gameCode = decodeGameCodeFromTopic(topics[1]);
    console.log('✅ Decoded PlayerJoined game code from topics[1]:', gameCode);
    return gameCode;

  } catch (error) {
    console.warn('❌ Failed to decode PlayerJoined event:', error);
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

// MinimalForwarder contract for ERC2771 gasless transactions
export const getForwarderContract = () => {
  return getContract({
    client,
    chain,
    address: FORWARDER_ADDRESS,
    abi: [
      "function execute((address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data) request, bytes signature) payable returns (bool, bytes)",
      "function getNonce(address from) view returns (uint256)"
    ]
  });
};

// ERC20 Token Approval Helpers
export const getERC20Contract = (tokenAddress: string) => {
  return getContract({
    client,
    chain,
    address: tokenAddress,
    abi: [
      // ERC20 standard functions we need
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
      "function name() view returns (string)"
    ]
  });
};

export const checkTokenAllowance = async (
  tokenAddress: string, 
  ownerAddress: string, 
  spenderAddress: string
): Promise<bigint> => {
  const tokenContract = getERC20Contract(tokenAddress);
  return await readContract({
    contract: tokenContract,
    method: "function allowance(address owner, address spender) view returns (uint256)",
    params: [ownerAddress, spenderAddress]
  }) as bigint;
};

export const approveToken = async (
  tokenAddress: string,
  spenderAddress: string,
  amount: bigint,
  account: any
): Promise<any> => {
  const tokenContract = getERC20Contract(tokenAddress);
  const transaction = prepareContractCall({
    contract: tokenContract,
    method: "function approve(address spender, uint256 amount) returns (bool)",
    params: [spenderAddress, amount]
  });

  return await sendTransaction({
    transaction,
    account
  });
};

export const ensureTokenApproval = async (
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  requiredAmount: bigint,
  account: any
): Promise<{ needsApproval: boolean; approvalTxHash?: string }> => {
  // Check current allowance
  const currentAllowance = await checkTokenAllowance(tokenAddress, ownerAddress, spenderAddress);
  
  console.log(`🔍 Token approval check:`, {
    token: tokenAddress,
    owner: ownerAddress,
    spender: spenderAddress,
    required: requiredAmount.toString(),
    current: currentAllowance.toString(),
    needsApproval: currentAllowance < requiredAmount
  });

  // If allowance is sufficient, no approval needed
  if (currentAllowance >= requiredAmount) {
    return { needsApproval: false };
  }

  // Need to approve - request approval for the exact amount
  console.log(`📝 Requesting token approval for ${requiredAmount.toString()}`);
  const approvalResult = await approveToken(tokenAddress, spenderAddress, requiredAmount, account);
  
  // Wait for approval transaction to be mined
  await waitForReceipt({
    client,
    chain,
    transactionHash: approvalResult.transactionHash,
  });

  console.log(`✅ Token approval completed: ${approvalResult.transactionHash}`);
  return { needsApproval: true, approvalTxHash: approvalResult.transactionHash };
};