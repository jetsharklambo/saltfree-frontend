import React, { useState, useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall } from 'thirdweb';
import { sendTransaction } from 'thirdweb';
import { waitForReceipt } from 'thirdweb';
import { readContract } from 'thirdweb';
import { X, Users, Coins, Clock, Crown, Trophy, AlertCircle, Scale, Lock, Unlock } from 'lucide-react';
import { getGameContract, formatAddress, formatEth, decodeStringFromHex, formatPrizeSplit } from '../thirdweb';
import { logBuyInInfo, formatBuyInForDisplay } from '../utils/buyInUtils';
import { getDisplayNameByAddressSync, preloadUsernames, preloadDisplayNames, getDisplayNamesByAddresses, getDisplayNameInfo } from '../utils/userUtils';
import { useUser } from '../contexts/UserContext';
import { 
  GlassModal, 
  GlassModalContent, 
  GlassButton, 
  
  FlexContainer, 
  LoadingSpinner,
  glassTheme 
} from '../styles/glass';
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
  color: ${glassTheme.text};
  margin: 0;
  font-family: 'Monaco', 'Menlo', monospace;
  letter-spacing: 1px;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.9);
    transform: scale(1.05);
  }
`;

const GameStats = styled.div`
  text-align: center;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
`;

const PotSize = styled.div`
  font-size: 2.5rem;
  font-weight: 700;
  color: ${glassTheme.accent};
  margin-bottom: 0.5rem;
  text-shadow: 0 0 20px rgba(120, 119, 198, 0.5);
  
  .currency {
    font-size: 1.5rem;
    color: ${glassTheme.text};
    opacity: 0.8;
  }
`;

const PlayerStats = styled.div`
  font-size: 1.25rem;
  color: ${glassTheme.text};
  margin-bottom: 1rem;
  
  .current {
    color: ${glassTheme.accent};
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
  border-radius: 25px;
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  ${({ role }) => {
    if (role === 'host') {
      return `
        background: rgba(255, 193, 7, 0.2);
        color: rgba(255, 193, 7, 1);
        border: 1px solid rgba(255, 193, 7, 0.4);
      `;
    } else if (role === 'player') {
      return `
        background: rgba(34, 197, 94, 0.2);
        color: rgba(34, 197, 94, 1);
        border: 1px solid rgba(34, 197, 94, 0.4);
      `;
    } else {
      return `
        background: rgba(156, 163, 175, 0.2);
        color: rgba(156, 163, 175, 1);
        border: 1px solid rgba(156, 163, 175, 0.4);
      `;
    }
  }}
`;

const InfoSection = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
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
    color: ${glassTheme.accent};
    opacity: 0.8;
  }
  
  .label {
    color: ${glassTheme.textMuted};
    min-width: 80px;
  }
  
  .value {
    color: ${glassTheme.text};
    font-weight: 500;
  }
`;

const ActionSection = styled.div`
  margin-top: 2rem;
  
  h3 {
    font-size: 1.25rem;
    color: ${glassTheme.text};
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
  max-height: 200px;
  overflow-y: auto;
`;

const PlayerCard = styled.div<{ isSelected?: boolean; isWinner?: boolean; hasClaimed?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: ${({ isSelected, isWinner, hasClaimed }) => {
    if (isSelected) return 'rgba(120, 119, 198, 0.2)';
    if (isWinner && hasClaimed) return 'rgba(34, 197, 94, 0.15)'; // Green for claimed
    if (isWinner) return 'rgba(255, 193, 7, 0.15)'; // Gold for winner
    return 'rgba(255, 255, 255, 0.05)'; // Default
  }};
  border: 1px solid ${({ isSelected, isWinner, hasClaimed }) => {
    if (isSelected) return 'rgba(120, 119, 198, 0.4)';
    if (isWinner && hasClaimed) return 'rgba(34, 197, 94, 0.4)';
    if (isWinner) return 'rgba(255, 193, 7, 0.4)';
    return 'rgba(255, 255, 255, 0.1)';
  }};
  border-radius: 12px;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${({ isWinner, hasClaimed }) => {
      if (isWinner && hasClaimed) return 'rgba(34, 197, 94, 0.2)';
      if (isWinner) return 'rgba(255, 193, 7, 0.2)';
      return 'rgba(255, 255, 255, 0.1)';
    }};
    transform: translateY(-1px);
  }
`;

const PlayerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  
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
  }
  
  .address {
    font-family: 'Monaco', 'Menlo', monospace;
    color: ${glassTheme.text};
    font-size: 0.9rem;
  }
  
  .you {
    color: ${glassTheme.accent};
    font-weight: 500;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: rgba(120, 119, 198, 0.2);
    border-radius: 12px;
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
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid;
  background: ${({ active, variant }) => {
    if (active) {
      return variant === 'winner' 
        ? 'rgba(255, 193, 7, 0.3)' 
        : 'rgba(120, 119, 198, 0.3)';
    }
    return 'rgba(255, 255, 255, 0.1)';
  }};
  border-color: ${({ active, variant }) => {
    if (active) {
      return variant === 'winner' 
        ? 'rgba(255, 193, 7, 0.6)' 
        : 'rgba(120, 119, 198, 0.6)';
    }
    return 'rgba(255, 255, 255, 0.2)';
  }};
  color: ${({ active, variant }) => {
    if (active) {
      return variant === 'winner' 
        ? 'rgba(255, 193, 7, 1)' 
        : 'rgba(120, 119, 198, 1)';
    }
    return glassTheme.textSecondary;
  }};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${({ variant }) => 
      variant === 'winner' 
        ? 'rgba(255, 193, 7, 0.2)' 
        : 'rgba(120, 119, 198, 0.2)'};
    border-color: ${({ variant }) => 
      variant === 'winner' 
        ? 'rgba(255, 193, 7, 0.5)' 
        : 'rgba(120, 119, 198, 0.5)'};
    transform: scale(1.1);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

// Removed unused FormGroup style

const StatusMessage = styled.div<{ variant: 'info' | 'success' | 'warning' | 'error' }>`
  padding: 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  margin-bottom: 1rem;
  border: 1px solid;
  
  ${({ variant }) => {
    const styles = {
      info: `
        background: rgba(59, 130, 246, 0.1);
        color: rgba(147, 197, 253, 1);
        border-color: rgba(59, 130, 246, 0.3);
      `,
      success: `
        background: rgba(34, 197, 94, 0.1);
        color: rgba(134, 239, 172, 1);
        border-color: rgba(34, 197, 94, 0.3);
      `,
      warning: `
        background: rgba(245, 158, 11, 0.1);
        color: rgba(251, 191, 36, 1);
        border-color: rgba(245, 158, 11, 0.3);
      `,
      error: `
        background: rgba(239, 68, 68, 0.1);
        color: rgba(248, 113, 113, 1);
        border-color: rgba(239, 68, 68, 0.3);
      `
    };
    return styles[variant];
  }}
`;


// Winner badge component
const WinnerBadge = () => (
  <span style={{
    background: 'rgba(255, 193, 7, 0.2)',
    color: '#ffc107',
    padding: '2px 4px',
    borderRadius: '4px',
    fontSize: '0.8rem',
    marginLeft: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: 500
  }}>
    🏆
  </span>
);

// Claimed badge component  
const ClaimedBadge = () => (
  <span style={{
    background: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
    padding: '2px 4px',
    borderRadius: '4px',
    fontSize: '0.8rem',
    marginLeft: '4px',
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
  font-weight: 600;
  font-size: 0.9rem;
  background: ${({ $hasWinners }) => 
    $hasWinners 
      ? 'rgba(255, 193, 7, 0.15)' 
      : 'rgba(34, 197, 94, 0.15)'
  };
  border: 1px solid ${({ $hasWinners }) => 
    $hasWinners 
      ? 'rgba(255, 193, 7, 0.3)' 
      : 'rgba(34, 197, 94, 0.3)'
  };
  color: ${({ $hasWinners }) => 
    $hasWinners 
      ? '#ffc107' 
      : '#22c55e'
  };
  transition: all 0.3s ease;
  
  ${({ $hasWinners }) => $hasWinners && `
    animation: subtle-pulse 2s ease-in-out infinite;
    
    @keyframes subtle-pulse {
      0%, 100% { 
        opacity: 1; 
        transform: scale(1); 
      }
      50% { 
        opacity: 0.9; 
        transform: scale(1.01); 
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
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  background: ${({ $isLocked }) => 
    $isLocked 
      ? 'rgba(239, 68, 68, 0.15)' 
      : 'rgba(34, 197, 94, 0.15)'
  };
  border: 1px solid ${({ $isLocked }) => 
    $isLocked 
      ? 'rgba(239, 68, 68, 0.3)' 
      : 'rgba(34, 197, 94, 0.3)'
  };
  color: ${({ $isLocked }) => 
    $isLocked 
      ? '#ef4444' 
      : '#22c55e'
  };
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
  const rpcEndpoint = 'https://ethereum-sepolia.publicnode.com';
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
  const [selectedJudges, setSelectedJudges] = useState<Set<string>>(new Set());
  const [selectedWinners, setSelectedWinners] = useState<string[]>([]);
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(new Map());
  const [winnerStatuses, setWinnerStatuses] = useState<Map<string, boolean>>(new Map());
  const [claimedStatuses, setClaimedStatuses] = useState<Set<string>>(new Set());
  const [unanimousJudges, setUnanimousJudges] = useState<string[]>([]);
  const [showPrizeSplitsModal, setShowPrizeSplitsModal] = useState(false);
  
  const contract = getGameContract();

  useEffect(() => {
    loadGameDetails();
  }, [game.code]);

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
    
    // Convert to array - include ALL addresses to ensure ENS resolution for everyone
    const addressesToResolve = Array.from(allAddresses);
    
    if (addressesToResolve.length > 0) {
      try {
        console.log(`🔍 Loading display names for ${addressesToResolve.length} addresses`);
        
        // Pre-load display names (usernames + ENS) for faster sync access
        await preloadDisplayNames(addressesToResolve);
        
        // Get display names with ENS resolution
        const nameMap = await getDisplayNamesByAddresses(addressesToResolve);
        
        setDisplayNames(nameMap);
        console.log(`✅ Loaded ${nameMap.size} display names`);
      } catch (error) {
        console.warn('Failed to load display names:', error);
      }
    }
  };

  const getDisplayNameForAddress = (address: string): string => {
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

  const loadGameDetails = async () => {
    try {
      setLoading(true);
      setError('');

      console.log(`🔍 Loading detailed data for game: ${game.code}`);
      
      // Load comprehensive game data with actual deployed contract method signatures
      const [gameInfo, players, judges, unanimousJudgesResult] = await Promise.allSettled([
        readContract({
          contract,
          method: "function getGameInfo(string code) view returns (address host, uint256 buyIn, uint256 maxPlayers, uint256 playerCount, bool isLocked, uint256[] splits)",
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
        }),
        readContract({
          contract,
          method: "function getUnanimousJudges(string code) view returns (address[] judges)",
          params: [game.code]
        })
      ]);

      let updatedGame: DetailedGameData = { ...game };

      // Enhanced logging and robust field mapping
      console.log(`📊 Contract call results for ${game.code}:`, {
        gameInfo: gameInfo.status,
        players: players.status,
        judges: judges.status,
        unanimousJudges: unanimousJudgesResult.status
      });

      if (gameInfo.status === 'fulfilled') {
        const [host, buyIn, maxPlayers, playerCount, isLocked, prizeSplitsBigInt] = gameInfo.value as [string, bigint, bigint, number, boolean, bigint[]];
        const prizeSplits = prizeSplitsBigInt.map(split => Number(split));
        
        console.log(`🔍 GameDetailModal for ${game.code}: buyIn=${buyIn.toString()}, maxPlayers=${maxPlayers.toString()}, isLocked=${isLocked}, prizeSplits=${prizeSplits}`);
        
        // Log the contract data for debugging
        logBuyInInfo('GameDetailModal loadGameDetails', game.code, buyIn, 'direct contract return');
        
        updatedGame = {
          ...updatedGame,
          host: host,
          buyIn: buyIn.toString(),
          maxPlayers: Number(maxPlayers),
          playerCount: playerCount,
          isLocked: isLocked,
          prizeSplits: prizeSplits
        };
      } else if (gameInfo.status === 'rejected') {
        console.error(`❌ Failed to load gameInfo for ${game.code}:`, gameInfo.reason);
      }

      if (players.status === 'fulfilled') {
        updatedGame.players = players.value as string[];
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

      if (unanimousJudgesResult.status === 'fulfilled') {
        const judges = unanimousJudgesResult.value as string[];
        setUnanimousJudges(judges);
        console.log(`✅ Loaded ${judges.length} unanimous judges for ${game.code}:`, judges);
      } else if (unanimousJudgesResult.status === 'rejected') {
        console.error(`❌ Failed to load unanimous judges for ${game.code}:`, unanimousJudgesResult.reason);
        setUnanimousJudges([]);
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
                
                const response = await fetch('https://ethereum-sepolia.publicnode.com', {
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
      
      // Load display names for all addresses
      await loadDisplayNames(updatedGame);

    } catch (err: any) {
      console.error('Failed to load game details:', err);
      setError('Failed to load game details. The game may no longer exist.');
    } finally {
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

      // Use consistent buy-in from GameDataContext (no fresh fetching needed)
      console.log(`🎯 Using GameDataContext buy-in for ${game.code}: ${game.buyIn} wei`);

      // Use the buy-in value already validated and stored in GameDataContext
      buyInWei = BigInt(game.buyIn || '0');
      
      // Enhanced debugging: log all transaction parameters
      console.log('🔧 GameDetailModal Debug - Before Preparation:');
      console.log(`  - Game Code: "${game.code}"`);
      console.log(`  - Buy-in Wei: ${buyInWei.toString()}`);
      console.log(`  - Buy-in ETH: ${formatBuyInForDisplay(buyInWei)}`);
      console.log(`  - Contract Address: ${contract.address}`);
      console.log(`  - Account: ${account.address}`);
      
      // Log transaction details for debugging
      logBuyInInfo('GameDetailModal transaction', game.code, buyInWei, 'GameDataContext');
      
      const transaction = prepareContractCall({
        contract,
        method: "function joinGame(string code) payable",
        params: [game.code],
        value: buyInWei,
      });
      
      // Enhanced debugging: log prepared transaction details
      console.log('🔧 GameDetailModal Debug - After Preparation:');
      console.log(`  - Transaction object:`, transaction);
      console.log(`  - Method: "function joinGame(string code) payable"`);
      console.log(`  - Params: [${JSON.stringify(game.code)}]`);
      console.log(`  - Value: ${buyInWei.toString()} wei`);

      console.log('📤 GameDetailModal transaction prepared:', {
        method: 'joinGame',
        gameCode: game.code,
        value: buyInWei.toString(),
        valueInEth: formatEth(buyInWei.toString()),
        account: account.address
      });

      // Helper function to process successful transaction
      const processSuccessfulTransaction = async (result: any) => {
        console.log('✅ GameDetailModal transaction sent:', {
          hash: result.transactionHash,
          gameCode: game.code,
          buyIn: formatEth(buyInWei.toString()) + ' ETH'
        });

        await waitForReceipt({
          client: contract.client,
          chain: contract.chain,
          transactionHash: result.transactionHash,
        });

        console.log('Successfully joined game!');
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
          value: buyInWei,
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
      
      if (err.message?.includes('Incorrect buy-in')) {
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
        errorMessage = `Insufficient ETH balance. Need ${buyInWei ? formatEth(buyInWei.toString()) : 'Unknown'} ETH plus gas fees.`;
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
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleJudge = (playerAddress: string) => {
    setSelectedJudges(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerAddress)) {
        newSet.delete(playerAddress);
      } else {
        newSet.add(playerAddress);
      }
      return newSet;
    });
  };

  const handleToggleWinner = (playerAddress: string) => {
    setSelectedWinners(prev => {
      if (prev.includes(playerAddress)) {
        // Remove from winners list
        return prev.filter(addr => addr !== playerAddress);
      } else {
        // Add to end of winners list (next rank) - limit to 3 winners max
        if (prev.length >= 3) {
          setError('Maximum 3 winners allowed');
          return prev;
        }
        return [...prev, playerAddress];
      }
    });
  };

  const handleSetJudges = async () => {
    if (!account || selectedJudges.size === 0) return;
    
    try {
      setActionLoading(true);
      setError('');

      const judges = Array.from(selectedJudges);
      
      const transaction = prepareContractCall({
        contract,
        method: "function setJudges(address[] judgeList)",
        params: [judges],
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

      console.log('Successfully set judges!');
      setSelectedJudges(new Set());
      await loadGameDetails();

    } catch (err: any) {
      console.error('Failed to set judges:', err);
      setError('Failed to set judges. Make sure you selected valid players.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddJudge = async (judgeAddress: string) => {
    if (!account) return;
    
    try {
      setActionLoading(true);
      setError('');

      console.log('Adding judge to game:', judgeAddress);
      
      const transaction = prepareContractCall({
        contract,
        method: "function addJudge(string code, address judge)",
        params: [game.code, judgeAddress],
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

      console.log('Successfully added judge!');
      await loadGameDetails();
      onRefresh();

    } catch (err: any) {
      console.error('Failed to add judge:', err);
      setError('Failed to add judge. Judge must be trusted by all players and game must be unlocked.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportWinners = async () => {
    if (!account || selectedWinners.length === 0) return;
    
    // Check if game is locked first (required in PU2)
    if (!detailedGame.isLocked) {
      setError('Game must be locked before reporting winners. Lock the game first.');
      return;
    }
    
    try {
      setActionLoading(true);
      setError('');

      // Winners are already in rank order from the selectedWinners array
      const winners = selectedWinners;
      
      console.log('Reporting winners in rank order:', winners);
      
      const transaction = prepareContractCall({
        contract,
        method: "function reportWinners(string code, address[] winners)",
        params: [game.code, winners],
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

  const isHost = account && detailedGame.host && account.address.toLowerCase() === detailedGame.host.toLowerCase();
  const isPlayer = account && detailedGame.players?.some(p => p.toLowerCase() === account.address.toLowerCase());
  const canJoin = account && !isPlayer && !detailedGame.isLocked && (detailedGame.playerCount || 0) < (detailedGame.maxPlayers || 0);

  return (
    <>
      <GlassModal onClick={onClose}>
      <GlassModalContent onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
        <ModalHeader>
          <ModalTitle>{game.code}</ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        {/* Prominent Game Stats at Top */}
        <GameStats>
          <PotSize>
            {detailedGame.buyIn && detailedGame.playerCount ? (
              <>
                {formatEth((BigInt(detailedGame.buyIn) * BigInt(detailedGame.playerCount)).toString())}
                <span className="currency"> ETH</span>
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
            background: 'rgba(156, 163, 175, 0.1)',
            border: '1px solid rgba(156, 163, 175, 0.2)',
            borderRadius: '12px',
            fontSize: '0.875rem',
            color: '#9ca3af'
          }}>
            <Scale size={16} />
            <span>Judge Decides: </span>
            <span style={{ 
              color: '#ffffff', 
              fontWeight: '600',
              background: 'rgba(156, 163, 175, 0.2)',
              padding: '2px 8px',
              borderRadius: '6px'
            }}>
              {getDisplayNameByAddressSync(detailedGame.judges[0]) || formatAddress(detailedGame.judges[0])}
            </span>
            {detailedGame.judges.length > 1 && (
              <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
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
          <FlexContainer justify="center" style={{ padding: '2rem' }}>
            <LoadingSpinner />
          </FlexContainer>
        ) : (
          <>
            <InfoSection>
              <h3 style={{ margin: '0 0 1rem 0', color: glassTheme.text }}>Game Information</h3>
              <InfoGrid>
                {detailedGame.buyIn && (
                  <InfoItem>
                    <Coins size={16} className="icon" />
                    <span className="label">Buy-in:</span>
                    <span className="value">{formatEth(detailedGame.buyIn)} ETH</span>
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
                    <span className="value" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {detailedGame.prizeSplits.map((split, index) => (
                        <span key={index} style={{ fontSize: '0.875rem' }}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} {index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : 'rd'} Place: {formatPrizeSplit(split)}
                        </span>
                      ))}
                    </span>
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
                <h3 style={{ margin: '0 0 1rem 0', color: glassTheme.text }}>
                  <Users size={20} />Players ({detailedGame.players.length})
                </h3>
                <PlayersList>
                  {detailedGame.players.map((player, index) => {
                    const isWinner = winnerStatuses.get(player) || false;
                    const hasClaimed = claimedStatuses.has(player);
                    
                    return (
                      <PlayerCard 
                        key={player}
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
                        
                        {/* Action Icons */}
                        <PlayerActions>
                          <ActionIcon
                            variant="judge"
                            active={selectedJudges.has(player)}
                            onClick={() => handleToggleJudge(player)}
                            disabled={actionLoading}
                            title="Toggle Judge"
                          >
                            <Scale size={14} />
                          </ActionIcon>
                          
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
                      </PlayerCard>
                    );
                  })}
                </PlayersList>
              </InfoSection>
            )}

            {/* Actions */}
            <ActionSection>
              <h3><Crown size={20} />Actions</h3>
              
                {/* Lock Game Button (Host Only) */}
                {isHost && !detailedGame.isLocked && (
                  <GlassButton
                    variant="secondary"
                    onClick={handleLockGame}
                    disabled={actionLoading}
                    style={{ 
                      width: '100%', 
                      marginBottom: '1rem',
                      background: 'rgba(239, 68, 68, 0.1)',
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                      color: '#ef4444'
                    }}
                  >
                    {actionLoading ? <LoadingSpinner /> : (
                      <>
                        <Lock size={16} />
                        Lock Game (Prevent new players from joining)
                      </>
                    )}
                  </GlassButton>
                )}
                
                {/* Set Prize Distribution Button (Host Only, unlocked games) */}
                {isHost && !detailedGame.isLocked && (
                  <GlassButton
                    variant="secondary"
                    onClick={() => setShowPrizeSplitsModal(true)}
                    disabled={actionLoading}
                    style={{ 
                      width: '100%', 
                      marginBottom: '1rem',
                      background: 'rgba(120, 119, 198, 0.1)',
                      borderColor: 'rgba(120, 119, 198, 0.3)',
                      color: '#7877c6'
                    }}
                  >
                    <Trophy size={16} />
                    Set Prize Distribution
                  </GlassButton>
                )}
                
                {/* Add Judge Section (Players only, unlocked games) */}
                {isPlayer && !isHost && !detailedGame.isLocked && unanimousJudges.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <StatusMessage variant="info">
                      <strong>Add Trusted Judges:</strong> You can add judges from your trusted list.
                    </StatusMessage>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      {unanimousJudges
                        .filter(judge => !detailedGame.judges?.includes(judge))
                        .map(judge => (
                          <GlassButton
                            key={judge}
                            onClick={() => handleAddJudge(judge)}
                            disabled={actionLoading}
                            style={{
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.75rem',
                              background: 'rgba(34, 197, 94, 0.1)',
                              borderColor: 'rgba(34, 197, 94, 0.3)',
                              color: '#22c55e'
                            }}
                          >
                            + {getDisplayNameForAddress(judge)}
                          </GlassButton>
                        ))
                      }
                    </div>
                  </div>
                )}

                <StatusMessage variant="info">
                  Select players above using the <Scale size={14} style={{ display: 'inline' }} /> (judge) and <Trophy size={14} style={{ display: 'inline' }} /> (winner) icons. Winners are ranked by selection order (🥇🥈🥉).
                  {detailedGame.prizeSplits && detailedGame.prizeSplits.length > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                      Prize splits: {detailedGame.prizeSplits.map((split, idx) => 
                        `${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} ${(split / 10).toFixed(1)}%`
                      ).join(' • ')}
                    </div>
                  )}
                  {!detailedGame.isLocked && (
                    <div style={{ marginTop: '0.5rem', color: '#ef4444', fontSize: '0.875rem' }}>
                      ⚠️ Game must be locked before reporting winners.
                    </div>
                  )}
                </StatusMessage>

                <FlexContainer gap="1rem">
                  <GlassButton
                    variant="secondary"
                    onClick={handleSetJudges}
                    disabled={actionLoading || selectedJudges.size === 0}
                    style={{ flex: 1 }}
                  >
                    {actionLoading ? <LoadingSpinner /> : (
                      <>
                        <Scale size={16} />
                        Set Judges ({selectedJudges.size})
                      </>
                    )}
                  </GlassButton>

                  <GlassButton
                    variant="primary"
                    onClick={handleReportWinners}
                    disabled={actionLoading || selectedWinners.length === 0}
                    style={{ flex: 1 }}
                  >
                    {actionLoading ? <LoadingSpinner /> : (
                      <>
                        <Trophy size={16} />
                        Report Winners ({selectedWinners.length})
                      </>
                    )}
                  </GlassButton>
                </FlexContainer>
            </ActionSection>

            {/* Claim Winnings Action */}
            {isPlayer && (
              <ActionSection>
                <h3><Users size={20} />Claim Winnings</h3>
                
                {detailedGame.isWinnerConfirmed ? (
                  <StatusMessage variant="success">
                    🎉 Congratulations! You've been confirmed as a winner.
                  </StatusMessage>
                ) : (
                  <StatusMessage variant="info">
                    Waiting for game results and judge confirmations.
                  </StatusMessage>
                )}
                
                <GlassButton
                  variant="primary"
                  onClick={handleClaimWinnings}
                  disabled={actionLoading}
                  style={{ width: '100%' }}
                >
                  {actionLoading ? <LoadingSpinner /> : <><Trophy size={16} />Claim Winnings</>}
                </GlassButton>
              </ActionSection>
            )}

            {/* Join Game Action */}
            {canJoin && (
              <ActionSection>
                <h3><AlertCircle size={20} />Available Actions</h3>
                
                <StatusMessage variant="info">
                  You can join this game for {detailedGame.buyIn ? formatEth(detailedGame.buyIn) : '?'} ETH
                </StatusMessage>
                
                <GlassButton
                  variant="primary"
                  onClick={handleJoinGame}
                  disabled={actionLoading}
                  style={{ width: '100%' }}
                >
                  {actionLoading ? <LoadingSpinner /> : <><Users size={16} />Join Game</>}
                </GlassButton>
              </ActionSection>
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
      </GlassModalContent>
      </GlassModal>
      
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