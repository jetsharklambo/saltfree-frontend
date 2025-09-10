import React, { useState, useEffect, useMemo } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, waitForReceipt, readContract } from 'thirdweb';
import toast from 'react-hot-toast';
import { X, Users, Coins, Clock, Crown, Trophy, AlertCircle, Scale, Lock, Unlock, Copy, Share2, ExternalLink, Check } from 'lucide-react';
import { getGameContract, formatAddress, formatEth, decodeStringFromHex, formatPrizeSplit, formatTokenDisplay, ensureTokenApproval, isETH } from '../thirdweb';
import { logBuyInInfo, formatBuyInForDisplay } from '../utils/buyInUtils';
import { getDisplayNameByAddressSync, preloadUsernames, preloadDisplayNames, getDisplayNamesByAddresses, getDisplayNameInfo } from '../utils/userUtils';
import { useUser } from '../contexts/UserContext';
import { 
  BlockModal, 
  BlockModalContent, 
  BlockButton, 
  FlexBlock,
  blockTheme,
  PixelText
} from '../styles/blocks';
import { SimpleRetroLoader } from './RetroLoader';
import styled from '@emotion/styled';
import { GameData } from '../contexts/GameDataContext';
import PrizeSplitsModal from './PrizeSplitsModal';

interface GameDetailModalProps {
  game: GameData;
  onClose: () => void;
  onRefresh: () => void;
}

interface DetailedGameData extends GameData {
  host?: string;
  buyIn?: string;
  buyInToken?: string;
  maxPlayers?: number;
  playerCount?: number;
  players?: string[];
  judges?: string[];
  isWinnerConfirmed?: boolean;
  isLocked?: boolean;
  prizeSplits?: number[];
}

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const ModalTitle = styled.h2`
  font-size: 1.75rem;
  font-weight: 700;
  color: ${blockTheme.text};
  margin: 0;
  font-family: 'Monaco', 'Menlo', monospace;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  
  &:hover {
    color: ${blockTheme.accent};
    transform: scale(1.02);
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

const CloseButton = styled.button`
  background: ${blockTheme.pastelCoral};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${blockTheme.darkText};
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  font-weight: bold;
  
  &:hover {
    background: ${blockTheme.error};
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px ${blockTheme.shadowDark};
  }
  
  &:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0px ${blockTheme.shadowDark};
  }
`;

const GameStats = styled.div`
  text-align: center;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: ${blockTheme.pastelBlue};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 16px;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
`;

const PotSize = styled.div`
  font-size: 2.5rem;
  font-weight: 700;
  color: ${blockTheme.accent};
  margin-bottom: 0.5rem;
  text-shadow: 0 0 20px rgba(120, 119, 198, 0.5);
  
  .currency {
    font-size: 1.5rem;
    color: ${blockTheme.text};
    opacity: 0.8;
  }
`;

const PlayerStats = styled.div`
  font-size: 1.25rem;
  color: ${blockTheme.text};
  margin-bottom: 1rem;
  
  .current {
    color: ${blockTheme.accent};
    font-weight: 600;
  }
  
  .max {
    opacity: 0.7;
  }
`;

const RoleDisplay = styled.div<{ role: 'host' | 'player' | 'unknown' }>`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: 3px solid ${blockTheme.darkText};
  color: ${blockTheme.darkText};
  transition: all 0.2s ease;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  
  background: ${({ role }) => {
    if (role === 'host') return blockTheme.warning;
    if (role === 'player') return blockTheme.success;
    return blockTheme.pastelPink;
  }};
  
  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0px ${blockTheme.shadowDark};
  }
`;

const InfoSection = styled.div`
  background: ${blockTheme.pastelMint};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const InfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  
  .icon {
    color: ${blockTheme.accent};
    opacity: 0.8;
  }
  
  .label {
    color: ${blockTheme.textMuted};
    min-width: 80px;
  }
  
  .value {
    color: ${blockTheme.text};
    font-weight: 500;
  }
`;

const ActionSection = styled.div`
  margin-top: 2rem;
  
  h3 {
    font-size: 1.25rem;
    color: ${blockTheme.text};
    margin: 0 0 1rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
`;

const PlayersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
  
  @media (max-width: 768px) {
    max-height: 300px;
  }
`;

const PlayerCard = styled.div<{ isSelected?: boolean; isWinner?: boolean; hasClaimed?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: ${({ isSelected, isWinner, hasClaimed }) => {
    if (isSelected) return blockTheme.pastelLavender;
    if (isWinner && hasClaimed) return blockTheme.success; // Green for claimed
    if (isWinner) return blockTheme.warning; // Gold for winner
    return blockTheme.lightText; // Default
  }};
  border: 3px solid ${({ isSelected, isWinner, hasClaimed }) => {
    if (isSelected) return blockTheme.accent;
    if (isWinner && hasClaimed) return blockTheme.success;
    if (isWinner) return blockTheme.warning;
    return blockTheme.darkText;
  }};
  border-radius: 12px;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  box-shadow: 2px 2px 0px ${blockTheme.shadowDark};
  
  &:hover {
    transform: translate(-2px, -2px);
    box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  }
  
  @media (max-width: 768px) {
    padding: 0.75rem;
    font-size: 0.8rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
`;

const PlayerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0; /* Allow text to truncate on mobile */
  
  .position {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    font-size: 0.75rem;
    font-weight: 500;
    flex-shrink: 0;
  }
  
  .address {
    font-family: 'Monaco', 'Menlo', monospace;
    color: ${blockTheme.text};
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-width: 0;
    
    @media (max-width: 768px) {
      font-size: 0.8rem;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
  }
  
  .you {
    color: ${blockTheme.darkText};
    font-weight: 700;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: ${blockTheme.accent};
    border: 2px solid ${blockTheme.darkText};
    border-radius: 8px;
    box-shadow: 2px 2px 0px ${blockTheme.shadowDark};
    white-space: nowrap;
    
    @media (max-width: 768px) {
      font-size: 0.7rem;
      padding: 0.2rem 0.4rem;
    }
  }
  
  @media (max-width: 768px) {
    gap: 0.5rem;
  }
`;

const PlayerActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ActionIcon = styled.button<{ active?: boolean; variant?: 'winner' | 'judge' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 3px solid;
  background: ${({ active, variant }) => {
    if (active) {
      return variant === 'winner' 
        ? blockTheme.warning 
        : blockTheme.accent;
    }
    return blockTheme.pastelPink;
  }};
  border-color: ${blockTheme.darkText};
  color: ${({ active, variant }) => {
    if (active) {
      return blockTheme.darkText;
    }
    return blockTheme.textSecondary;
  }};
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  box-shadow: 2px 2px 0px ${blockTheme.shadowDark};
  
  &:active {
    transform: translate(1px, 1px);
    box-shadow: 1px 1px 0px ${blockTheme.shadowDark};
  }
  
  &:hover {
    background: ${({ variant }) => 
      variant === 'winner' 
        ? blockTheme.warning 
        : blockTheme.pastelPeach};
    transform: translate(-2px, -2px);
    box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: 2px 2px 0px ${blockTheme.shadowMedium};
  }
`;

// Removed unused FormGroup style

const StatusMessage = styled.div<{ variant: 'info' | 'success' | 'warning' | 'error' }>`
  padding: 1rem;
  border-radius: 12px;
  font-size: 0.875rem;
  margin-bottom: 1rem;
  border: 3px solid ${blockTheme.darkText};
  font-weight: 600;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  
  ${({ variant }) => {
    const styles = {
      info: `
        background: ${blockTheme.info};
        color: ${blockTheme.darkText};
      `,
      success: `
        background: ${blockTheme.success};
        color: ${blockTheme.darkText};
      `,
      warning: `
        background: ${blockTheme.warning};
        color: ${blockTheme.darkText};
      `,
      error: `
        background: ${blockTheme.error};
        color: ${blockTheme.lightText};
      `
    };
    return styles[variant];
  }}
`;


// Winner badge component with block styling
const WinnerBadge = () => (
  <span style={{
    background: blockTheme.warning,
    border: `2px solid ${blockTheme.darkText}`,
    color: blockTheme.darkText,
    padding: '0.2rem 0.4rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    marginLeft: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: '700',
    boxShadow: `2px 2px 0px ${blockTheme.shadowDark}`,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  }}>
    🏆 Winner
  </span>
);

// Claimed badge component  
const ClaimedBadge = () => (
  <span style={{
    background: blockTheme.success,
    color: blockTheme.darkText,
    padding: '0.2rem 0.4rem',
    border: `2px solid ${blockTheme.darkText}`,
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: '700',
    marginLeft: '4px',
    boxShadow: `2px 2px 0px ${blockTheme.shadowDark}`,
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: 500
  }}>
    💵
  </span>
);

// Game status indicator component
const GameStatusIndicator = styled.div<{ $hasWinners: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  margin: 0.5rem 0 1rem 0;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.9rem;
  background: ${({ $hasWinners }) => 
    $hasWinners 
      ? blockTheme.warning 
      : blockTheme.success
  };
  border: 3px solid ${blockTheme.darkText};
  color: ${blockTheme.darkText};
  transition: all 0.3s ease;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  
  ${({ $hasWinners }) => $hasWinners && `
    animation: subtle-pulse 2s ease-in-out infinite;
    
    @keyframes subtle-pulse {
      0%, 100% { 
        transform: scale(1); 
        box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
      }
      50% { 
        transform: scale(1.02); 
        box-shadow: 6px 6px 0px ${blockTheme.shadowDark};
      }
    }
  `}
`;

const LockStatusIndicator = styled.div<{ $isLocked: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  margin: 0.5rem 0;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.875rem;
  background: ${({ $isLocked }) => 
    $isLocked 
      ? blockTheme.error 
      : blockTheme.success
  };
  border: 3px solid ${blockTheme.darkText};
  color: ${({ $isLocked }) => 
    $isLocked 
      ? blockTheme.lightText 
      : blockTheme.darkText
  };
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
`;

// WinningsClaimed event signature (keccak256 of "WinningsClaimed(string,address,uint256)")
const WINNINGS_CLAIMED_SIGNATURE = '0x7175967b5ddee4d7986318165167133a8c193aa59b05f411ec131d4f124a3f3d';

// Helper to decode WinningsClaimed event data: (string code, uint256 amount)
const decodeWinningsClaimedData = (hexData: string): { code: string, amount: string } | null => {
  try {
    // Remove 0x prefix if present
    const data = hexData.startsWith('0x') ? hexData.slice(2) : hexData;
    
    if (data.length < 192) return null; // Need at least 96 bytes (192 hex chars)
    
    // Bytes 0-31: offset to string (should be 0x40 = 64)
    const offsetHex = data.slice(0, 64);
    const offset = parseInt(offsetHex, 16);
    
    // Bytes 32-63: amount (uint256)
    const amountHex = data.slice(64, 128);
    const amount = parseInt(amountHex, 16).toString();
    
    // String starts at the offset position (in bytes, not hex chars)
    const stringStartHex = offset * 2; // Convert bytes to hex chars
    
    // String length is at the offset position
    const lengthHex = data.slice(stringStartHex, stringStartHex + 64);
    const length = parseInt(lengthHex, 16);
    
    if (length === 0 || length > 100) return null; // Sanity check
    
    // String data starts right after the length
    const stringDataHex = data.slice(stringStartHex + 64, stringStartHex + 64 + (length * 2));
    
    // Convert hex to ASCII
    let code = '';
    for (let i = 0; i < stringDataHex.length; i += 2) {
      const hex = stringDataHex.substr(i, 2);
      const charCode = parseInt(hex, 16);
      if (charCode === 0) break;
      code += String.fromCharCode(charCode);
    }
    
    return { code, amount };
  } catch (error) {
    console.warn('Error decoding WinningsClaimed data:', error);
    return null;
  }
};

// Helper to get current block number
const getCurrentBlockNumber = async (): Promise<number> => {
  const rpcEndpoint = 'https://mainnet.base.org';
  try {
    const response = await fetch(rpcEndpoint, {
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
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message}`);
    }
    
    return parseInt(data.result, 16);
  } catch (error) {
    console.warn('Failed to get current block number:', error);
    return 10000000; // Fallback to high number
  }
};

const GameDetailModal: React.FC<GameDetailModalProps> = ({ game, onClose, onRefresh }) => {
  const account = useActiveAccount();
  const { user } = useUser();
  const [detailedGame, setDetailedGame] = useState<DetailedGameData>(game);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedWinners, setSelectedWinners] = useState<string[]>([]);
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(new Map());
  const [winnerStatuses, setWinnerStatuses] = useState<Map<string, boolean>>(new Map());
  const [claimedStatuses, setClaimedStatuses] = useState<Set<string>>(new Set());
  const [showPrizeSplitsModal, setShowPrizeSplitsModal] = useState(false);
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [isShareCopied, setIsShareCopied] = useState(false);
  
  const contract = getGameContract();

  // Load initial display names immediately when modal opens
  useEffect(() => {
    loadInitialDisplayNames(game);
  }, [game.code]);

  useEffect(() => {
    loadGameDetails();
  }, [game.code]);

  const loadInitialDisplayNames = async (gameData: GameData) => {
    const allAddresses = new Set<string>();
    
    // Add host address
    if (gameData.host) {
      allAddresses.add(gameData.host);
    }
    
    // Add player addresses
    if (gameData.players) {
      gameData.players.forEach(player => allAddresses.add(player));
    }
    
    // Add judge addresses
    if (gameData.judges) {
      gameData.judges.forEach(judge => allAddresses.add(judge));
    }
    
    // Convert to array
    const addressesToResolve = Array.from(allAddresses);
    
    if (addressesToResolve.length > 0) {
      try {
        console.log(`🔍 Loading initial display names for ${addressesToResolve.length} addresses`);
        
        // Pre-load display names (usernames + ENS) for faster sync access
        await preloadDisplayNames(addressesToResolve);
        
        // Get display names with ENS resolution
        const nameMap = await getDisplayNamesByAddresses(addressesToResolve);
        
        setDisplayNames(nameMap);
        console.log(`✅ Loaded ${nameMap.size} initial display names:`, Object.fromEntries(nameMap));
      } catch (error) {
        console.warn('Failed to load initial display names:', error);
      }
    }
  };

  const loadDisplayNames = async (gameData: DetailedGameData) => {
    const allAddresses = new Set<string>();
    
    // Add host address
    if (gameData.host) {
      allAddresses.add(gameData.host);
    }
    
    // Add player addresses
    if (gameData.players) {
      gameData.players.forEach(player => allAddresses.add(player));
    }
    
    // Add judge addresses
    if (gameData.judges) {
      gameData.judges.forEach(judge => allAddresses.add(judge));
    }
    
    // Convert to array - include ALL addresses to ensure ENS resolution for everyone
    const addressesToResolve = Array.from(allAddresses);
    
    if (addressesToResolve.length > 0) {
      try {
        console.log(`🔍 Loading display names for ${addressesToResolve.length} addresses`);
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Display names loading timeout')), 8000)
        );
        
        const loadingPromise = (async () => {
          // Pre-load display names (usernames + ENS) for faster sync access
          await preloadDisplayNames(addressesToResolve);
          
          // Get display names with ENS resolution
          const nameMap = await getDisplayNamesByAddresses(addressesToResolve);
          
          setDisplayNames(nameMap);
          console.log(`✅ Loaded ${nameMap.size} display names:`, Object.fromEntries(nameMap));
        })();
        
        await Promise.race([loadingPromise, timeoutPromise]);
        
      } catch (error) {
        console.warn('Failed to load display names (non-critical):', error);
        // Don't throw - this is now non-blocking
      }
    }
  };

  const getDisplayNameForAddress = useMemo(() => {
    return (address: string): string => {
      // For current user, use the same sync function that handles proper priority (username → ENS → address)
      if (account && address.toLowerCase() === account.address.toLowerCase()) {
        return getDisplayNameByAddressSync(address);
      }
      
      // Use loaded display names
      const loadedName = displayNames.get(address);
      if (loadedName) {
        return loadedName;
      }
      
      // Fallback to sync version (might have cached data)
      return getDisplayNameByAddressSync(address);
    };
  }, [displayNames, account]);

  const loadGameDetails = async () => {
    try {
      setLoading(true);
      setError('');

      console.log(`🔍 Loading detailed data for game: ${game.code}`);
      
      // Load comprehensive game data with actual deployed contract method signatures
      const [gameInfo, players, judges] = await Promise.allSettled([
        readContract({
          contract,
          method: "function getGameInfo(string code) view returns (address host, address token, uint256 buyIn, uint256 maxPlayers, uint256 playerCount, bool isLocked, uint256[] splits, address[] judges)",
          params: [game.code]
        }),
        readContract({
          contract,
          method: "function getPlayers(string code) view returns (address[] players)",
          params: [game.code]
        }),
        readContract({
          contract,
          method: "function getInGameJudges(string code) view returns (address[] judges)",
          params: [game.code]
        })
      ]);

      let updatedGame: DetailedGameData = { 
        ...game,
        players: [], // Initialize with empty array
        judges: []   // Initialize with empty array
      };

      // Enhanced logging and robust field mapping
      console.log(`📊 Contract call results for ${game.code}:`, {
        gameInfo: gameInfo.status,
        players: players.status,
        judges: judges.status
      });

      if (gameInfo.status === 'fulfilled') {
        const [host, token, buyIn, maxPlayers, playerCount, isLocked, prizeSplitsBigInt, inGameJudgesFromGameInfo] = gameInfo.value as [string, string, bigint, bigint, bigint, boolean, bigint[], string[]];
        const prizeSplits = prizeSplitsBigInt.map(split => Number(split));
        
        console.log(`🔍 GameDetailModal for ${game.code}: buyIn=${buyIn.toString()}, maxPlayers=${maxPlayers.toString()}, isLocked=${isLocked}, prizeSplits=${prizeSplits}`);
        
        // Log the contract data for debugging
        logBuyInInfo('GameDetailModal loadGameDetails', game.code, buyIn, 'direct contract return');
        
        updatedGame = {
          ...updatedGame,
          host: host,
          buyIn: buyIn.toString(),
          buyInToken: token,
          maxPlayers: Number(maxPlayers),
          playerCount: Number(playerCount),
          isLocked: isLocked,
          prizeSplits: prizeSplits
        };
      } else if (gameInfo.status === 'rejected') {
        console.error(`❌ Failed to load gameInfo for ${game.code}:`, gameInfo.reason);
      }

      if (players.status === 'fulfilled') {
        updatedGame.players = players.value as string[];
        
        // Use players.length as fallback if playerCount seems incorrect
        if (updatedGame.playerCount !== undefined && updatedGame.players) {
          const actualPlayerCount = Math.max(updatedGame.playerCount || 0, updatedGame.players.length);
          if (actualPlayerCount !== updatedGame.playerCount) {
            console.log(`📊 Correcting player count from ${updatedGame.playerCount} to ${actualPlayerCount} based on players array`);
            updatedGame.playerCount = actualPlayerCount;
          }
        }
        console.log(`✅ Loaded ${updatedGame.players.length} players for ${game.code}:`, updatedGame.players);
      } else if (players.status === 'rejected') {
        console.error(`❌ Failed to load players for ${game.code}:`, players.reason);
      }

      if (judges.status === 'fulfilled') {
        updatedGame.judges = judges.value as string[];
        console.log(`✅ Loaded ${updatedGame.judges.length} judges for ${game.code}:`, updatedGame.judges);
      } else if (judges.status === 'rejected') {
        console.error(`❌ Failed to load judges for ${game.code}:`, judges.reason);
      }


      // Check winner confirmation status for all players
      if (updatedGame.players && updatedGame.players.length > 0) {
        try {
          console.log(`🏆 Checking winner status for ${updatedGame.players.length} players...`);
          
          const winnerChecks = await Promise.allSettled(
            updatedGame.players.map(async (playerAddress) => {
              try {
                const isConfirmed = await readContract({
                  contract,
                  method: "function isWinnerConfirmed(string code, address winner) view returns (bool)",
                  params: [game.code, playerAddress]
                });
                return { address: playerAddress, isWinner: isConfirmed as boolean };
              } catch (err) {
                console.log(`Could not check winner status for ${playerAddress}`);
                return { address: playerAddress, isWinner: false };
              }
            })
          );

          const newWinnerStatuses = new Map<string, boolean>();
          const newClaimedStatuses = new Set<string>();

          winnerChecks.forEach((result) => {
            if (result.status === 'fulfilled') {
              const { address, isWinner } = result.value;
              newWinnerStatuses.set(address, isWinner);
            }
          });

          // Check claim status for winners by looking for WinningsClaimed events
          const winners = Array.from(newWinnerStatuses.entries())
            .filter(([_, isWinner]) => isWinner)
            .map(([address]) => address);

          if (winners.length > 0) {
            console.log(`💰 Checking claim status for ${winners.length} winners with 50k block limit...`);
            
            // Get current block and calculate search range (last 50k blocks)
            const currentBlock = await getCurrentBlockNumber();
            const fromBlock = Math.max(0, currentBlock - 50000);
            
            console.log(`📊 Block range: ${fromBlock} to ${currentBlock} (${currentBlock - fromBlock} blocks)`);
            
            // Check each winner individually for claim events
            const claimCheckPromises = winners.map(async (winnerAddress) => {
              try {
                const userTopic = `0x000000000000000000000000${winnerAddress.slice(2).toLowerCase()}`;
                
                console.log(`🔍 Checking claims for winner: ${winnerAddress}`);
                
                const response = await fetch('https://mainnet.base.org', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getLogs',
                    params: [{
                      address: contract.address,
                      topics: [
                        WINNINGS_CLAIMED_SIGNATURE, // WinningsClaimed event signature
                        userTopic // winner address (indexed at position 1)
                      ],
                      fromBlock: `0x${fromBlock.toString(16)}`,
                      toBlock: `0x${currentBlock.toString(16)}`
                    }],
                    id: 1
                  })
                });
                
                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}`);
                }
                
                const data = await response.json();
                if (data.error) {
                  throw new Error(`RPC Error: ${data.error.message}`);
                }
                
                const events = data.result || [];
                    console.log(`📝 Found ${events.length} claim events for ${winnerAddress} in last 50k blocks`);
                    
                    // Check if any event matches this game code
                    const hasClaimed = events.some(event => {
                  try {
                    const decoded = decodeWinningsClaimedData(event.data);
                    if (!decoded) {
                      console.warn(`   ❌ Failed to decode event data: ${event.data.slice(0, 100)}...`);
                      return false;
                    }
                    
                    console.log(`   📋 Event decoded: code="${decoded.code}", amount=${decoded.amount} (looking for "${game.code}")`);
                    const match = decoded.code === game.code;
                    if (match) {
                      console.log(`✅ Found matching claim event for ${winnerAddress} in game ${game.code} (amount: ${decoded.amount})`);
                    }
                    return match;
                  } catch (err) {
                    console.warn('Failed to decode event data:', err);
                    return false;
                  }
                });
                
                console.log(`💵 ${winnerAddress}: claimed=${hasClaimed}`);
                return { address: winnerAddress, hasClaimed };
                
              } catch (err) {
                console.warn(`Failed to check claim status for ${winnerAddress}:`, err);
                return { address: winnerAddress, hasClaimed: false };
              }
            });
            
            try {
              const claimResults = await Promise.all(claimCheckPromises);
              claimResults.forEach(({ address, hasClaimed }) => {
                if (hasClaimed) {
                  newClaimedStatuses.add(address);
                }
              });
              
              console.log(`✅ Claim status check completed for ${claimResults.length} winners`);
              
            } catch (err) {
              console.error('Failed to check claim statuses:', err);
              // Don't add any addresses to claimed set on error
            }
          }

          setWinnerStatuses(newWinnerStatuses);
          setClaimedStatuses(newClaimedStatuses);
          
          console.log(`✅ Winner status loaded:`, Array.from(newWinnerStatuses.entries()));
          
          // Set legacy field for current user if applicable
          if (account && updatedGame.players.includes(account.address)) {
            updatedGame.isWinnerConfirmed = newWinnerStatuses.get(account.address) || false;
          }
        } catch (err) {
          console.error('Failed to load winner statuses:', err);
        }
      }

      setDetailedGame(updatedGame);
      console.log('✅ Game details loaded:', updatedGame);
      console.log('🔍 Players array check:', {
        playersExists: !!updatedGame.players,
        playersLength: updatedGame.players?.length,
        playersData: updatedGame.players
      });
      
      // Set loading to false immediately so modal can render
      setLoading(false);
      
      // Load display names asynchronously without blocking modal render
      loadDisplayNames(updatedGame).catch(error => {
        console.warn('Display names loading failed (non-blocking):', error);
        // Don't set error state - this is non-critical
      });

    } catch (err: any) {
      console.error('Failed to load game details:', err);
      setError('Failed to load game details. The game may no longer exist.');
      setLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!account || !detailedGame.buyIn) return;
    
    let buyInWei: bigint = BigInt(0); // Initialize with 0 for error handling access
    
    try {
      setActionLoading(true);
      setError('');

      console.log('🎯 GameDetailModal joining game:', game.code);
      console.log('🔍 Current game data:', detailedGame);
      
      // Validate game state before joining
      if ((detailedGame.playerCount || 0) >= (detailedGame.maxPlayers || 0)) {
        throw new Error(`Game is full (${detailedGame.playerCount}/${detailedGame.maxPlayers} players)`);
      }

      // Use the buy-in value from detailedGame which has the correct value loaded from contract
      buyInWei = BigInt(detailedGame.buyIn || '0');
      const tokenAddress = detailedGame.buyInToken || "0x0000000000000000000000000000000000000000";
      const isEthPayment = isETH(tokenAddress);
      
      console.log('🔧 GameDetailModal Debug - Payment Info:');
      console.log(`  - Game Code: "${game.code}"`);
      console.log(`  - Buy-in Amount: ${buyInWei.toString()}`);
      console.log(`  - Token Address: ${tokenAddress}`);
      console.log(`  - Is ETH Payment: ${isEthPayment}`);
      console.log(`  - Contract Address: ${contract.address}`);
      console.log(`  - Account: ${account.address}`);

      // Handle ERC20 token approval if needed
      if (!isEthPayment && buyInWei > 0) {
        console.log('🔐 ERC20 token game detected, checking approval...');
        toast.loading('Checking token approval...', { id: 'join-game' });
        
        try {
          const approvalResult = await ensureTokenApproval(
            tokenAddress,
            account.address,
            contract.address,
            buyInWei,
            account
          );

          if (approvalResult.needsApproval) {
            toast.success('Token approval completed!', { id: 'join-game' });
            console.log('✅ Token approval completed, proceeding to join game...');
          } else {
            console.log('✅ Token already approved, proceeding to join game...');
          }
        } catch (approvalError: any) {
          console.error('❌ Token approval failed:', approvalError);
          throw new Error(`Token approval failed: ${approvalError.message}`);
        }

        toast.loading('Joining game...', { id: 'join-game' });
      }
      
      // Prepare transaction based on payment type
      const transaction = prepareContractCall({
        contract,
        method: "function joinGame(string code) payable",
        params: [game.code],
        value: isEthPayment ? buyInWei : 0n, // Only send ETH for ETH payments
      });
      
      console.log('🔧 GameDetailModal Debug - Transaction Prepared:');
      console.log(`  - Method: "function joinGame(string code) payable"`);
      console.log(`  - Params: [${JSON.stringify(game.code)}]`);
      console.log(`  - Value: ${isEthPayment ? buyInWei.toString() : '0'} wei`);

      console.log('📤 GameDetailModal transaction prepared:', {
        method: 'joinGame',
        gameCode: game.code,
        value: (isEthPayment ? buyInWei : 0n).toString(),
        isEthPayment,
        tokenAddress,
        account: account.address
      });

      // Helper function to process successful transaction
      const processSuccessfulTransaction = async (result: any) => {
        const paymentDisplay = isEthPayment 
          ? formatEth(buyInWei.toString()) + ' ETH'
          : formatTokenDisplay(buyInWei.toString(), tokenAddress);

        console.log('✅ GameDetailModal transaction sent:', {
          hash: result.transactionHash,
          gameCode: game.code,
          payment: paymentDisplay
        });

        await waitForReceipt({
          client: contract.client,
          chain: contract.chain,
          transactionHash: result.transactionHash,
        });

        console.log('Successfully joined game!');
        
        // Show success toast
        toast.success(`Successfully joined game ${game.code}!`, {
          duration: 3000,
          icon: '🎮',
          id: 'join-game'
        });
        
        await loadGameDetails();
        onRefresh();
      };

      console.log('🚀 Sending join game transaction from detail modal...');
      try {
        const result = await sendTransaction({
          transaction,
          account,
        });
        
        console.log('✅ Primary transaction succeeded!');
        await processSuccessfulTransaction(result);
        return;
      } catch (primaryError: any) {
        console.error('❌ Primary transaction failed, trying fallback with gas limit:', primaryError);
        
        // Fallback: try with explicit gas limit
        const fallbackTransaction = prepareContractCall({
          contract,
          method: "function joinGame(string code) payable",
          params: [game.code],
          value: isEthPayment ? buyInWei : 0n,
          gas: BigInt(200000),
        });
        
        console.log('🔄 Attempting fallback with explicit gas limit...');
        const result = await sendTransaction({
          transaction: fallbackTransaction,
          account,
        });
        
        console.log('✅ Fallback transaction with gas limit succeeded!');
        await processSuccessfulTransaction(result);
      }

    } catch (err: any) {
      console.error('❌ GameDetailModal join failed:', err);
      console.error('❌ GameDetailModal error details:', {
        message: err.message,
        code: err.code,
        data: err.data,
        stack: err.stack?.slice(0, 200)
      });
      
      let errorMessage = 'Failed to join game';
      
      if (err.message?.includes('Token approval failed')) {
        errorMessage = err.message;
      } else if (err.message?.includes('transfer amount exceeds allowance')) {
        errorMessage = 'Token approval insufficient. Please try again.';
      } else if (err.message?.includes('Incorrect buy-in')) {
        errorMessage = `Contract rejected: Incorrect buy-in amount. You may be set as a judge for this game (judges join for free).`;
      } else if (err.message?.includes('execution reverted')) {
        // Extract the revert reason if available
        const revertMatch = err.message.match(/execution reverted:?\s*([^"\n]+)/);
        if (revertMatch && revertMatch[1]) {
          errorMessage = `Contract error: ${revertMatch[1].trim()}`;
        } else {
          errorMessage = `Transaction rejected by contract. Game may be full (${detailedGame.playerCount}/${detailedGame.maxPlayers}) or you may have already joined.`;
        }
      } else if (err.message?.includes('insufficient funds')) {
        const tokenName = isETH(detailedGame.buyInToken || '') ? 'ETH' : 'tokens';
        errorMessage = `Insufficient ${tokenName} balance or gas fees.`;
      } else if (err.message?.includes('user rejected')) {
        errorMessage = 'Transaction cancelled by user';
      } else if (err.message?.includes('replacement fee too low')) {
        errorMessage = 'Transaction fee too low, try increasing gas price';
      } else if (err.message?.includes('network')) {
        errorMessage = 'Network error - please try again or check RPC connection';
      } else if (err.message) {
        // Use the original error message from MetaMask/contract
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      toast.error(errorMessage, { id: 'join-game' });
    } finally {
      setActionLoading(false);
    }
  };


  const handleToggleWinner = (playerAddress: string) => {
    setSelectedWinners(prev => {
      if (prev.includes(playerAddress)) {
        // Remove from winners list
        return prev.filter(addr => addr !== playerAddress);
      } else {
        // Determine maximum winners based on prize splits
        const isWinnerTakeAll = !detailedGame.prizeSplits || detailedGame.prizeSplits.length === 0 || 
                                (detailedGame.prizeSplits.length === 1 && detailedGame.prizeSplits[0] === 1000);
        const maxWinners = isWinnerTakeAll ? 1 : detailedGame.prizeSplits?.length || 3;
        
        // Check if we've reached the maximum number of winners
        if (prev.length >= maxWinners) {
          const prizeText = maxWinners === 1 ? 'Winner-take-all game' : `Only ${maxWinners} prizes available`;
          setError(`${prizeText} - maximum ${maxWinners} winner${maxWinners > 1 ? 's' : ''} allowed`);
          return prev;
        }
        return [...prev, playerAddress];
      }
    });
  };



  const handleReportWinners = async () => {
    if (!account || selectedWinners.length === 0) return;
    
    // Check if game is locked first (required in PU2)
    if (!detailedGame.isLocked) {
      setError('Game must be locked before reporting winners. Lock the game first.');
      return;
    }

    // Validate winner count matches prize distribution
    const isWinnerTakeAll = !detailedGame.prizeSplits || detailedGame.prizeSplits.length === 0 || 
                            (detailedGame.prizeSplits.length === 1 && detailedGame.prizeSplits[0] === 1000);
    const requiredWinners = isWinnerTakeAll ? 1 : detailedGame.prizeSplits?.length || 1;
    
    if (selectedWinners.length !== requiredWinners) {
      const prizeText = isWinnerTakeAll ? 'winner-take-all' : `${requiredWinners} prize${requiredWinners > 1 ? 's' : ''}`;
      setError(`Must select exactly ${requiredWinners} winner${requiredWinners > 1 ? 's' : ''} for this ${prizeText} game. Only winners with available prizes will receive winnings.`);
      return;
    }
    
    try {
      setActionLoading(true);
      setError('');

      let winnersToSubmit = selectedWinners;
      
      console.log('Reporting winners in rank order:', winnersToSubmit);
      
      const transaction = prepareContractCall({
        contract,
        method: "function reportWinners(string code, address[] winners)",
        params: [game.code, winnersToSubmit],
      });

      const result = await sendTransaction({
        transaction,
        account,
      });

      await waitForReceipt({
        client: contract.client,
        chain: contract.chain,
        transactionHash: result.transactionHash,
      });

      console.log('Successfully reported winners!');
      setSelectedWinners([]);
      await loadGameDetails();
      onRefresh();

    } catch (err: any) {
      console.error('Failed to report winners:', err);
      setError('Failed to report winners. Make sure game is locked and you selected valid players.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClaimWinnings = async () => {
    if (!account) return;
    
    try {
      setActionLoading(true);
      setError('');

      const transaction = prepareContractCall({
        contract,
        method: "function claimWinnings(string code)",
        params: [game.code],
      });

      const result = await sendTransaction({
        transaction,
        account,
      });

      await waitForReceipt({
        client: contract.client,
        chain: contract.chain,
        transactionHash: result.transactionHash,
      });

      console.log('Successfully claimed winnings!');
      await loadGameDetails();
      onRefresh();

    } catch (err: any) {
      console.error('Failed to claim winnings:', err);
      setError('Failed to claim winnings. You may not be a confirmed winner.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLockGame = async () => {
    if (!account) return;
    
    try {
      setActionLoading(true);
      setError('');

      const transaction = prepareContractCall({
        contract,
        method: "function lockGame(string code)",
        params: [game.code],
      });

      const result = await sendTransaction({
        transaction,
        account,
      });

      await waitForReceipt({
        client: contract.client,
        chain: contract.chain,
        transactionHash: result.transactionHash,
      });

      console.log('Successfully locked game!');
      await loadGameDetails();
      onRefresh();

    } catch (err: any) {
      console.error('Failed to lock game:', err);
      setError('Failed to lock game. Only the host can lock games.');
    } finally {
      setActionLoading(false);
    }
  };

  // Copy and share handlers
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(game.code);
      setIsCodeCopied(true);
      toast.success('Game code copied!', {
        duration: 2000,
        icon: '📋'
      });
      setTimeout(() => {
        setIsCodeCopied(false);
      }, 1500);
    } catch (err) {
      console.error('Failed to copy game code:', err);
      toast.error('Failed to copy game code');
    }
  };

  const handleShareGame = async () => {
    const shareUrl = `${window.location.origin}/game/${game.code}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsShareCopied(true);
      toast.success('Game link copied!', {
        duration: 2000,
        icon: '🔗'
      });
      setTimeout(() => {
        setIsShareCopied(false);
      }, 1500);
    } catch (err) {
      console.error('Failed to copy game URL:', err);
      toast.error('Failed to copy game link');
      alert(`Game URL: ${shareUrl}`);
    }
  };

  const handleOpenNewTab = () => {
    window.open(`/game/${game.code}`, '_blank');
  };

  const isHost = account && detailedGame.host && account.address.toLowerCase() === detailedGame.host.toLowerCase();
  const isPlayer = account && detailedGame.players?.some(p => p.toLowerCase() === account.address.toLowerCase());
  const isJudge = account && detailedGame.judges?.some(j => j.toLowerCase() === account.address.toLowerCase());
  const hasJudges = detailedGame.judges && detailedGame.judges.length > 0;
  const canJoin = account && !isPlayer && !detailedGame.isLocked && (detailedGame.playerCount || 0) < (detailedGame.maxPlayers || 0);
  
  // Can vote if: game is locked but not completed, and user is eligible to vote
  const canVote = detailedGame.isLocked && !detailedGame.isCompleted && account && (
    hasJudges ? isJudge : isPlayer // Judge-decided: only judges can vote, Player-decided: players can vote
  );

  return (
    <>
      <BlockModal onClick={onClose}>
      <BlockModalContent onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
        <ModalHeader>
          <ModalTitle 
            onClick={handleCopyCode}
            title={isCodeCopied ? "Code copied!" : "Click to copy game code"}
            style={{
              color: isCodeCopied ? blockTheme.success : undefined
            }}
          >
            {isCodeCopied ? (
              <>
                <Check size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
                {game.code}
              </>
            ) : (
              game.code
            )}
          </ModalTitle>
          <FlexBlock align="center" gap="0.5rem">
            {/* Share URL Icon */}
            <BlockButton
              color={isShareCopied ? 'success' : 'pastelBlue'}
              onClick={handleShareGame}
              style={{
                padding: '0.75rem',
                fontSize: '0.875rem',
                minWidth: 'auto'
              }}
              title="Copy game page URL"
            >
              {isShareCopied ? <Check size={16} /> : <Share2 size={16} />}
            </BlockButton>

            {/* Open New Tab Icon */}
            <BlockButton
              color="pastelMint"
              onClick={handleOpenNewTab}
              style={{
                padding: '0.75rem',
                fontSize: '0.875rem',
                minWidth: 'auto'
              }}
              title="Open game page in new tab"
            >
              <ExternalLink size={16} />
            </BlockButton>

            <CloseButton onClick={onClose}>
              <X size={20} />
            </CloseButton>
          </FlexBlock>
        </ModalHeader>

        {/* Prominent Game Stats at Top */}
        <GameStats>
          <PotSize>
            {detailedGame.buyIn && detailedGame.playerCount && detailedGame.buyInToken ? (
              <>
                {formatTokenDisplay((BigInt(detailedGame.buyIn) * BigInt(detailedGame.playerCount)).toString(), detailedGame.buyInToken)}
              </>
            ) : (
              <>0.000<span className="currency"> ETH</span></>
            )}
          </PotSize>
          
          <PlayerStats>
            <span className="current">{detailedGame.playerCount || 0}</span>
            <span> / </span>
            <span className="max">{detailedGame.maxPlayers || 0}</span>
            <span> players</span>
          </PlayerStats>
          
          <RoleDisplay role={game.userRole || 'unknown'}>
            {game.userRole === 'host' && <><Crown size={16} />Your Game</>}
            {game.userRole === 'player' && <><Users size={16} />You Joined</>}
            {game.userRole === 'unknown' && <><AlertCircle size={16} />Available Game</>}
          </RoleDisplay>
        </GameStats>

        {/* Judge Badge */}
        {detailedGame.judges && detailedGame.judges.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: '16px 0',
            padding: '12px 16px',
            background: blockTheme.pastelLavender,
            border: `3px solid ${blockTheme.darkText}`,
            borderRadius: '12px',
            fontSize: '0.875rem',
            color: blockTheme.darkText,
            boxShadow: `4px 4px 0px ${blockTheme.shadowDark}`,
            fontWeight: 600
          }}>
            <Scale size={16} />
            <span>Judge Decides: </span>
            <span style={{ 
              color: blockTheme.darkText, 
              fontWeight: '700',
              background: blockTheme.lightText,
              padding: '4px 8px',
              borderRadius: '8px',
              border: `2px solid ${blockTheme.darkText}`,
              boxShadow: `2px 2px 0px ${blockTheme.shadowDark}`
            }}>
              {displayNames.get(detailedGame.judges[0].toLowerCase()) || formatAddress(detailedGame.judges[0])}
            </span>
            {detailedGame.judges.length > 1 && (
              <span style={{ color: blockTheme.textMuted, fontSize: '0.8rem', fontWeight: 600 }}>
                +{detailedGame.judges.length - 1} more
              </span>
            )}
          </div>
        )}

        {/* Game Status Indicator */}
        <GameStatusIndicator $hasWinners={Array.from(winnerStatuses.values()).some(Boolean)}>
          {Array.from(winnerStatuses.values()).some(Boolean) ? (
            <>🏆 GAME ENDED - Winners Confirmed</>
          ) : (
            <>🎮 ACTIVE GAME</>
          )}
        </GameStatusIndicator>

        {/* Lock Status Indicator */}
        <LockStatusIndicator $isLocked={detailedGame.isLocked || false}>
          {detailedGame.isLocked ? (
            <><Lock size={16} />Game Locked - No new players can join</>
          ) : (
            <><Unlock size={16} />Game Open - Players can join</>
          )}
        </LockStatusIndicator>

        {error && (
          <StatusMessage variant="error">
            {error}
          </StatusMessage>
        )}

        {loading ? (
          <FlexBlock justify="center" style={{ padding: '2rem' }}>
            <SimpleRetroLoader />
          </FlexBlock>
        ) : (
          <>
            <InfoSection>
              <h3 style={{ margin: '0 0 1rem 0', color: blockTheme.text }}>Game Information</h3>
              <InfoGrid>
                {detailedGame.buyIn && (
                  <InfoItem>
                    <Coins size={16} className="icon" />
                    <span className="label">Buy-in:</span>
                    <span className="value">{detailedGame.buyInToken ? formatTokenDisplay(detailedGame.buyIn, detailedGame.buyInToken) : formatEth(detailedGame.buyIn) + ' ETH'}</span>
                  </InfoItem>
                )}
                
                {detailedGame.maxPlayers && (
                  <InfoItem>
                    <Users size={16} className="icon" />
                    <span className="label">Players:</span>
                    <span className="value">{detailedGame.playerCount}/{detailedGame.maxPlayers}</span>
                  </InfoItem>
                )}
                
                {detailedGame.host && (
                  <InfoItem>
                    <Crown size={16} className="icon" />
                    <span className="label">Host:</span>
                    <span className="value">
                      {getDisplayNameForAddress(detailedGame.host)}
                    </span>
                  </InfoItem>
                )}
                
                {/* Prize Distribution Display */}
                {detailedGame.prizeSplits && detailedGame.prizeSplits.length > 0 && (
                  <InfoItem>
                    <Trophy size={16} className="icon" />
                    <span className="label">Prize Distribution:</span>
                    <div className="value" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                      {detailedGame.prizeSplits.map((split, index) => {
                        const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                        const color = colors[index] || '#666';
                        
                        return (
                          <div
                            key={index}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.25rem 0.5rem',
                              background: `${color}15`,
                              border: `1px solid ${color}30`,
                              borderRadius: '8px',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              color: color
                            }}
                          >
                            <span>{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                            <span>{formatPrizeSplit(split)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </InfoItem>
                )}
                
                {(game as any).blockNumber && (
                  <InfoItem>
                    <Clock size={16} className="icon" />
                    <span className="label">Block:</span>
                    <span className="value">#{(game as any).blockNumber}</span>
                  </InfoItem>
                )}
              </InfoGrid>
            </InfoSection>

            {detailedGame.players && detailedGame.players.length > 0 && (
              <InfoSection>
                <h3 style={{ margin: '0 0 1rem 0', color: blockTheme.text }}>
                  <Users size={20} />Players ({detailedGame.players.length})
                </h3>
                <PlayersList>
                  {detailedGame.players.map((player, index) => {
                    const isWinner = winnerStatuses.get(player) || false;
                    const hasClaimed = claimedStatuses.has(player);
                    
                    return (
                      <PlayerCard 
                        key={`${player}-${displayNames.size}`}
                        isWinner={isWinner}
                        hasClaimed={hasClaimed}
                      >
                        <PlayerInfo>
                          <div className="position">{index + 1}</div>
                          <div className="address">
                            {getDisplayNameForAddress(player)}
                            {isWinner && <WinnerBadge />}
                            {isWinner && hasClaimed && <ClaimedBadge />}
                          </div>
                          {account && player.toLowerCase() === account.address.toLowerCase() && (
                            <div className="you">You</div>
                          )}
                        </PlayerInfo>
                        
                        {/* Action Icons - Only show for eligible voters */}
                        {canVote && (
                          <PlayerActions>
                            <ActionIcon
                              variant="winner"
                              active={selectedWinners.includes(player)}
                              onClick={() => handleToggleWinner(player)}
                              disabled={actionLoading}
                              title={selectedWinners.includes(player) 
                                ? `Selected as #${selectedWinners.indexOf(player) + 1} winner`
                                : "Select as winner"
                              }
                            >
                              {selectedWinners.includes(player) ? (
                                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                                  {selectedWinners.indexOf(player) + 1 === 1 ? '🥇' : 
                                   selectedWinners.indexOf(player) + 1 === 2 ? '🥈' : '🥉'}
                                </span>
                              ) : (
                                <Trophy size={14} />
                              )}
                            </ActionIcon>
                          </PlayerActions>
                        )}
                      </PlayerCard>
                    );
                  })}
                </PlayersList>
              </InfoSection>
            )}

            {/* Actions */}
            <ActionSection>
              <h3><Crown size={20} />Actions</h3>
              
                {/* Start Game Button (Host Only) */}
                {isHost && !detailedGame.isLocked && (
                  <BlockButton
                    color="pastelLavender"
                    onClick={() => {
                      const confirmed = window.confirm('Ready to start the game? This will prevent new players from joining.');
                      if (confirmed) handleLockGame();
                    }}
                    disabled={actionLoading}
                    fullWidth
                    style={{ 
                      marginBottom: '1rem'
                    }}
                  >
                    {actionLoading ? <SimpleRetroLoader /> : (
                      <>
                        <Lock size={16} />
                        Lock Game
                      </>
                    )}
                  </BlockButton>
                )}
                
                {/* Set Prize Distribution Button (Host Only, unlocked games) */}
                {isHost && !detailedGame.isLocked && (
                  <BlockButton
                    color="pastelPeach"
                    onClick={() => setShowPrizeSplitsModal(true)}
                    disabled={actionLoading}
                    fullWidth
                    style={{ 
                      marginBottom: '1rem'
                    }}
                  >
                    <Trophy size={16} />
                    Set Prize Distribution
                  </BlockButton>
                )}
                

                {canVote && (
                  <>
                    <StatusMessage variant="info">
                      {(() => {
                        const isWinnerTakeAll = !detailedGame.prizeSplits || detailedGame.prizeSplits.length === 0 || 
                                                (detailedGame.prizeSplits.length === 1 && detailedGame.prizeSplits[0] === 1000);
                        const requiredWinners = isWinnerTakeAll ? 1 : detailedGame.prizeSplits?.length || 1;
                        
                        return (
                          <>
                            Select exactly <strong>{requiredWinners}</strong> winner{requiredWinners > 1 ? 's' : ''} using the <Trophy size={14} style={{ display: 'inline' }} /> icon. Winners are ranked by selection order (🥇🥈🥉). Only winners with available prize positions receive winnings.
                            {detailedGame.prizeSplits && detailedGame.prizeSplits.length > 0 && !isWinnerTakeAll && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                                Prize distribution: {detailedGame.prizeSplits.map((split, idx) => 
                                  `${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} ${(split / 10).toFixed(1)}%`
                                ).join(' • ')}
                              </div>
                            )}
                            {isWinnerTakeAll && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                                Winner-take-all: 🥇 100%
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </StatusMessage>

                    <FlexBlock justify="center">
                      <BlockButton
                        color="warning"
                        onClick={handleReportWinners}
                        disabled={actionLoading || (() => {
                          const isWinnerTakeAll = !detailedGame.prizeSplits || detailedGame.prizeSplits.length === 0 || 
                                                  (detailedGame.prizeSplits.length === 1 && detailedGame.prizeSplits[0] === 1000);
                          const requiredWinners = isWinnerTakeAll ? 1 : detailedGame.prizeSplits?.length || 1;
                          return selectedWinners.length !== requiredWinners;
                        })()}
                        size="lg"
                      >
                        {actionLoading ? <SimpleRetroLoader /> : (
                          <>
                            <Trophy size={16} />
                            Report Winners ({selectedWinners.length}/{(() => {
                              const isWinnerTakeAll = !detailedGame.prizeSplits || detailedGame.prizeSplits.length === 0 || 
                                                      (detailedGame.prizeSplits.length === 1 && detailedGame.prizeSplits[0] === 1000);
                              return isWinnerTakeAll ? 1 : detailedGame.prizeSplits?.length || 1;
                            })()})
                          </>
                        )}
                      </BlockButton>
                    </FlexBlock>
                  </>
                )}
                
                {/* Claim Winnings Button (Players who are confirmed winners) */}
                {isPlayer && Array.from(winnerStatuses.entries()).some(([addr, isWinner]) => 
                  addr.toLowerCase() === account?.address?.toLowerCase() && isWinner
                ) && (
                  <BlockButton
                    color={account?.address && claimedStatuses.has(account.address.toLowerCase()) ? 'success' : 'warning'}
                    onClick={handleClaimWinnings}
                    disabled={actionLoading || (account?.address && claimedStatuses.has(account.address.toLowerCase()))}
                    fullWidth
                    style={{ 
                      marginBottom: '1rem'
                    }}
                  >
                    {actionLoading ? <SimpleRetroLoader /> : (
                      account?.address && claimedStatuses.has(account.address.toLowerCase()) ? (
                        <>✅ Winnings Claimed</>
                      ) : (
                        <><Trophy size={16} />Claim Your Winnings</>
                      )
                    )}
                  </BlockButton>
                )}
            </ActionSection>

            {/* Join Game Action */}
            {canJoin && (
              <ActionSection>
                <h3><AlertCircle size={20} />Available Actions</h3>
                
                <StatusMessage variant="info">
                  You can join this game for {detailedGame.buyIn && detailedGame.buyInToken ? formatTokenDisplay(detailedGame.buyIn, detailedGame.buyInToken) : detailedGame.buyIn ? formatEth(detailedGame.buyIn) + ' ETH' : '?'}
                </StatusMessage>
                
                <BlockButton
                  color="pastelPink"
                  onClick={handleJoinGame}
                  disabled={actionLoading}
                  fullWidth
                >
                  {actionLoading ? <SimpleRetroLoader /> : <><Users size={16} />Join Game</>}
                </BlockButton>
              </ActionSection>
            )}
            
            {/* Information for Players Not Yet Winners */}
            {isPlayer && !Array.from(winnerStatuses.entries()).some(([addr, isWinner]) => 
              addr.toLowerCase() === account?.address?.toLowerCase() && isWinner
            ) && (
              <StatusMessage variant="info">
                🎲 Game in progress - waiting for results to be reported.
              </StatusMessage>
            )}

            {/* No actions available */}
            {!isHost && !isPlayer && !canJoin && (
              <StatusMessage variant="warning">
                {detailedGame.isLocked 
                  ? "Game is locked - no new players can join." 
                  : "Game is full or you're not eligible to join."
                }
              </StatusMessage>
            )}
          </>
        )}
      </BlockModalContent>
      </BlockModal>
      
      {/* Prize Splits Modal - Rendered outside GameDetailModal */}
      {showPrizeSplitsModal && (
        <PrizeSplitsModal
          gameCode={detailedGame.code}
          currentSplits={detailedGame.prizeSplits || []}
          onClose={() => setShowPrizeSplitsModal(false)}
          onSuccess={(splits) => {
            setShowPrizeSplitsModal(false);
            // Refresh game details to show updated splits
            loadGameDetails();
            onRefresh();
          }}
        />
      )}
    </>
  );
};

export default GameDetailModal;