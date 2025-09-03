import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useActiveAccount } from "thirdweb/react";
import { readContract, prepareContractCall, sendTransaction, waitForReceipt } from 'thirdweb';
import toast from 'react-hot-toast';
import { ArrowLeft, Users, Clock, Lock, Trophy, Share2, Coins, Scale, UserCheck, PlusCircle, UserMinus } from 'lucide-react';
import { getGameContract, formatEth, formatPrizeSplit } from '../thirdweb';
import { getDisplayNameByAddressSync, preloadDisplayNames, getDisplayNamesByAddresses } from '../utils/userUtils';
import { validation } from '../utils/envUtils';
import { logger, logGameAction } from '../utils/logger';
import { 
  GlassCard, 
  GlassButton, 
  FlexContainer, 
  LoadingSpinner 
} from '../styles/glass';
import styled from '@emotion/styled';
import GameDetailModal from '../components/GameDetailModal';

interface GameInfo {
  gameCode: string;
  host: string;
  buyIn: string;
  maxPlayers: number;
  playerCount: number;
  currentPlayers: number;
  players: string[];
  isLocked: boolean;
  isCompleted: boolean;
  winners: string[];
  prizeSplits?: number[];
  judges?: string[];
  autoLockTime?: number;
}

interface GameDetailPageProps {
  autoJoin?: boolean;
}

const PageContainer = styled.div`
  min-height: 100vh;
  padding: 2rem;
  background: transparent; /* Inherits from App gradient background */
  
  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const BackButton = styled(GlassButton)`
  margin-bottom: 2rem;
  
  &:hover {
    transform: translateX(-4px);
  }
`;

const GameCard = styled(GlassCard)`
  max-width: 800px;
  margin: 0 auto 2rem auto;
  padding: 2rem;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  
  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`;

const GameHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
  }
`;

const GameTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.98);
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
  
  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const GameStats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const StatCard = styled(GlassCard)`
  padding: 1.5rem;
  text-align: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 0 0 1px rgba(255, 255, 255, 0.05);
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 0.5rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
`;

const StatLabel = styled.div`
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const PlayersSection = styled.div`
  margin-top: 2rem;
`;

const PlayersList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
`;

const PlayerCard = styled(GlassCard)`
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1.5px solid rgba(255, 255, 255, 0.12);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.04);
`;

const ErrorMessage = styled.div`
  text-align: center;
  padding: 2rem;
  color: #ff6b6b;
  font-size: 1.1rem;
`;

const PrizeStructure = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  flex-wrap: wrap;
`;

const PrizeBadge = styled.span<{ color?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.4rem;
  background: ${props => props.color || 'rgba(255, 255, 255, 0.1)'};
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid ${props => 
    props.color === 'rgba(255, 215, 0, 0.1)' ? 'rgba(255, 215, 0, 0.3)' :
    props.color === 'rgba(192, 192, 192, 0.1)' ? 'rgba(192, 192, 192, 0.3)' :
    props.color === 'rgba(205, 127, 50, 0.1)' ? 'rgba(205, 127, 50, 0.3)' :
    'rgba(255, 255, 255, 0.2)'};
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  color: ${props => 
    props.color === 'rgba(255, 215, 0, 0.1)' ? '#FFD700' : 
    props.color === 'rgba(192, 192, 192, 0.1)' ? '#C0C0C0' :
    props.color === 'rgba(205, 127, 50, 0.1)' ? '#CD7F32' : 'rgba(255, 255, 255, 0.9)'};
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
`;

const WinnerTakeAllBadge = styled.span`
  padding: 0.2rem 0.5rem;
  background: rgba(255, 215, 0, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  color: #FFD700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
`;

const StatAction = styled(GlassButton)`
  padding: 0.4rem 0.8rem;
  font-size: 0.75rem;
  margin-top: 0.5rem;
  min-height: 32px;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const DecisionBadge = styled.div<{ type: 'players' | 'judges' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.4rem 0.8rem;
  margin-top: 0.5rem;
  min-height: 32px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: ${props => 
    props.type === 'judges' 
      ? 'rgba(255, 255, 255, 0.95)' 
      : 'rgba(255, 255, 255, 0.95)'};
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const JudgeBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.8rem;
  background: rgba(59, 130, 246, 0.3);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(59, 130, 246, 0.6);
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
  transition: all 0.2s ease;

  &:hover {
    background: rgba(59, 130, 246, 0.4);
    border-color: rgba(59, 130, 246, 0.8);
    transform: translateY(-1px);
  }
`;

const JudgesList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.5rem;
`;

const WinnerBadge = styled.div<{ variant: 'gold' | 'silver' | 'bronze' | 'other' }>`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  background: ${props => {
    switch (props.variant) {
      case 'gold': return 'rgba(255, 215, 0, 0.15)';
      case 'silver': return 'rgba(192, 192, 192, 0.15)';
      case 'bronze': return 'rgba(205, 127, 50, 0.15)';
      default: return 'rgba(255, 215, 0, 0.1)';
    }
  }};
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid ${props => {
    switch (props.variant) {
      case 'gold': return 'rgba(255, 215, 0, 0.4)';
      case 'silver': return 'rgba(192, 192, 192, 0.4)';
      case 'bronze': return 'rgba(205, 127, 50, 0.4)';
      default: return 'rgba(255, 215, 0, 0.3)';
    }
  }};
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: ${props => {
    switch (props.variant) {
      case 'gold': return '#ffd700';
      case 'silver': return '#c0c0c0';
      case 'bronze': return '#cd853f';
      default: return '#ffd700';
    }
  }};
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-top: 0.25rem;
`;

const StatCardContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export default function GameDetailPage({ autoJoin = false }: GameDetailPageProps) {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const account = useActiveAccount();
  
  const [game, setGame] = useState<GameInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(new Map());
  const [isShareCopied, setIsShareCopied] = useState(false);
  const [selectedWinners, setSelectedWinners] = useState<string[]>([]);

  const loadDisplayNames = async (gameData: GameInfo) => {
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
        console.log(`🔍 Loading display names for ${addressesToResolve.length} addresses`);
        
        // Pre-load display names (usernames + ENS) for faster sync access
        await preloadDisplayNames(addressesToResolve);
        
        // Get display names with ENS resolution
        const nameMap = await getDisplayNamesByAddresses(addressesToResolve);
        
        setDisplayNames(nameMap);
        console.log(`✅ Loaded ${nameMap.size} display names for GameDetailPage`);
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

  const renderPrizeStructure = (prizeSplits?: number[]) => {
    // Debug logging to see what we're getting
    console.log('🎯 Prize splits for render:', prizeSplits);
    
    // If no prize splits are defined, assume winner take all
    if (!prizeSplits || prizeSplits.length === 0) {
      return (
        <PrizeStructure>
          <WinnerTakeAllBadge>🏆 Winner Take All</WinnerTakeAllBadge>
        </PrizeStructure>
      );
    }

    // Check if it's winner take all (only one prize of 100%)
    if (prizeSplits.length === 1 && prizeSplits[0] === 100) {
      return (
        <PrizeStructure>
          <WinnerTakeAllBadge>🏆 Winner Take All</WinnerTakeAllBadge>
        </PrizeStructure>
      );
    }

    // Multiple prizes - show medal icons with percentages
    return (
      <PrizeStructure>
        {prizeSplits.slice(0, 3).map((split, index) => {
          const colors = [
            'rgba(255, 215, 0, 0.1)', // Gold glass
            'rgba(192, 192, 192, 0.1)', // Silver glass
            'rgba(205, 127, 50, 0.1)'  // Bronze glass
          ];
          const medals = ['🥇', '🥈', '🥉'];
          
          return (
            <PrizeBadge key={index} color={colors[index]}>
              {medals[index]} {formatPrizeSplit(split)}
            </PrizeBadge>
          );
        })}
        {prizeSplits.length > 3 && (
          <PrizeBadge>+{prizeSplits.length - 3} more</PrizeBadge>
        )}
      </PrizeStructure>
    );
  };

  const renderDecisionBadge = (game: GameInfo) => {
    // If there are judges, the judges decide
    if (game.judges && game.judges.length > 0) {
      return (
        <div>
          <DecisionBadge type="judges">
            <Scale size={14} />
            {game.judges.length === 1 ? 'Judge Decides' : `${game.judges.length} Judges Decide`}
          </DecisionBadge>
          <JudgesList>
            {game.judges.map((judge, index) => (
              <JudgeBadge key={index}>
                <Scale size={12} />
                {getDisplayNameForAddress(judge)}
              </JudgeBadge>
            ))}
          </JudgesList>
        </div>
      );
    }

    // If no judges, players decide by consensus (majority = more than half of joined players)
    const consensusNeeded = Math.floor(game.currentPlayers / 2) + 1;
    return (
      <DecisionBadge type="players">
        <UserCheck size={14} />
        Majority Rule: {consensusNeeded}
      </DecisionBadge>
    );
  };

  // Normalize game code to standard format - improved pattern matching
  const normalizeGameCode = (code: string): string[] => {
    if (!code) return [];
    
    const cleaned = code.toUpperCase().trim();
    const variations = [cleaned];
    
    // If has dash, try without it
    if (cleaned.includes('-')) {
      variations.push(cleaned.replace('-', ''));
    }
    
    // If no dash, try adding dashes at various positions
    if (!cleaned.includes('-') && cleaned.length >= 4) {
      // Find character type transitions (letter→number or number→letter)
      const transitions = [];
      for (let i = 1; i < cleaned.length; i++) {
        const prevIsLetter = /[A-Z]/.test(cleaned[i-1]);
        const currIsLetter = /[A-Z]/.test(cleaned[i]);
        
        // If character type changes, mark as potential dash position
        if (prevIsLetter !== currIsLetter) {
          transitions.push(i);
        }
      }
      
      // Try adding dashes at transition points
      for (const pos of transitions) {
        const withDash = cleaned.slice(0, pos) + '-' + cleaned.slice(pos);
        variations.push(withDash);
      }
      
      // Also try common patterns regardless of transitions
      const len = cleaned.length;
      
      // For 6-character codes, try splitting in half (position 3)
      if (len === 6) {
        variations.push(cleaned.slice(0, 3) + '-' + cleaned.slice(3));
      }
      
      // For 5-character codes, try 2-3 and 3-2 splits
      if (len === 5) {
        variations.push(cleaned.slice(0, 2) + '-' + cleaned.slice(2));
        variations.push(cleaned.slice(0, 3) + '-' + cleaned.slice(3));
      }
      
      // For 4-character codes, try splitting in half
      if (len === 4) {
        variations.push(cleaned.slice(0, 2) + '-' + cleaned.slice(2));
      }
      
      // Legacy patterns for backward compatibility
      if (cleaned.match(/^[A-Z]{3}[0-9]{3}$/)) {
        variations.push(cleaned.slice(0, 3) + '-' + cleaned.slice(3));
      }
      if (cleaned.match(/^[A-Z]{2}[0-9]{3}$/)) {
        variations.push(cleaned.slice(0, 2) + '-' + cleaned.slice(2));
      }
      if (cleaned.match(/^[A-Z]{4}[0-9]{2}$/)) {
        variations.push(cleaned.slice(0, 4) + '-' + cleaned.slice(4));
      }
    }
    
    console.log('🔄 Game code variations to try:', variations);
    return [...new Set(variations)]; // Remove duplicates
  };

  // Load game data from contract
  useEffect(() => {
    const loadGame = async () => {
      if (!gameCode) {
        setError('No game code provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const codeVariations = normalizeGameCode(gameCode);
        console.log('🎮 Loading game details for:', gameCode, 'trying variations:', codeVariations);

        const contract = getGameContract();
        let actualGameCode = '';
        let host = '';
        let buyIn: bigint = BigInt(0);
        let maxPlayers = BigInt(0);
        let playerCount = BigInt(0);
        let isLocked = false;
        let players: string[] = [];
        let prizeSplits: number[] = [];
        let judges: string[] = [];

        // Try each game code variation until we find one that works
        for (const codeVariation of codeVariations) {
          try {
            console.log('🔍 Trying game code:', codeVariation);
            
            // Fetch game info from contract - NEW FORMAT includes judges
            const gameInfo = await readContract({
              contract,
              method: "function getGameInfo(string code) view returns (address host, uint256 buyIn, uint256 maxPlayers, uint256 playerCount, bool isLocked, uint256[] splits, address[] judges)",
              params: [codeVariation],
            }) as [string, bigint, bigint, bigint, boolean, bigint[], string[]];

            const [gameHost, gameBuyIn, gameMaxPlayers, gamePlayerCount, gameIsLocked, prizeSplitsBigInt, gameJudges] = gameInfo;

            // Check if game exists (host would be zero address if not)
            if (gameHost !== '0x0000000000000000000000000000000000000000') {
              console.log('✅ Found game with code:', codeVariation);
              actualGameCode = codeVariation;
              host = gameHost;
              buyIn = gameBuyIn;
              maxPlayers = gameMaxPlayers;
              playerCount = gamePlayerCount;
              isLocked = gameIsLocked;
              prizeSplits = prizeSplitsBigInt.map(split => Number(split));
              judges = gameJudges || []; // Get judges directly from game info

              // Fetch players list
              players = await readContract({
                contract,
                method: "function getPlayers(string code) view returns (address[] players)",
                params: [codeVariation],
              }) as string[];

              break; // Found the game, stop trying variations
            }
          } catch (error) {
            console.log('❌ Game code not found:', codeVariation);
            // Continue to next variation
          }
        }

        // If no variation worked, show error
        if (!actualGameCode) {
          setError(`Game ${gameCode} not found`);
          setLoading(false);
          return;
        }

        // Get confirmed winners from the new contract method
        let isCompleted = false;
        let winners: string[] = [];
        
        try {
          console.log(`🏆 Getting confirmed winners for game: ${actualGameCode}`);
          winners = await readContract({
            contract,
            method: "function getConfirmedWinners(string code) view returns (address[] winners)",
            params: [actualGameCode],
          }) as string[];
          
          isCompleted = winners.length > 0;
          console.log('🏆 Confirmed winners loaded for GameDetailPage:', winners, 'isCompleted:', isCompleted);
        } catch (error) {
          console.log('No confirmed winners found (game likely not completed):', error);
          winners = [];
          isCompleted = false;
        }

        // Use players.length as fallback if playerCount is 0 or doesn't match reality
        const actualPlayerCount = Math.max(Number(playerCount), players.length);

        const gameData: GameInfo = {
          gameCode: actualGameCode, // Use the actual code that worked
          host,
          buyIn: buyIn.toString(),
          maxPlayers: Number(maxPlayers),
          playerCount: actualPlayerCount,
          currentPlayers: players.length, // Always use actual players array length
          players,
          isLocked,
          isCompleted,
          winners,
          prizeSplits,
          judges,
        };

        setGame(gameData);
        setError(null);
        setLoading(false);  // Allow page to render immediately

        // Load display names asynchronously (non-blocking)
        loadDisplayNames(gameData).catch(error => {
          console.warn('Display names loading failed:', error);
        });
        
        // Safely log the action
        try {
          logGameAction('Game detail page loaded', actualGameCode, {
            host,
            playerCount: Number(playerCount),
            isCompleted,
            originalUrl: gameCode, // Log what user typed vs what we found
          });
        } catch (logError) {
          console.warn('Failed to log game action:', logError);
        }

        // If autoJoin is true, show the modal
        if (autoJoin && account?.address) {
          setShowModal(true);
        }

      } catch (err) {
        console.error('Failed to load game:', err);
        setError(`Failed to load game ${gameCode}. Please check if the game exists.`);
        setLoading(false);
      } finally {
        // Loading state is managed in success and error cases above
      }
    };

    loadGame();
  }, [gameCode, autoJoin, account?.address]);

  // Handle errors with toast notifications instead of error page
  useEffect(() => {
    if (error) {
      toast.error(error, { duration: 5000 });
      // Redirect to dashboard after showing error
      const timer = setTimeout(() => {
        navigate('/');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [error, navigate]);

  // Handle joining the game
  const handleJoinGame = async () => {
    if (!game || !account?.address) return;
    
    setActionLoading(true);
    try {
      console.log('🎮 Joining game:', game.gameCode, 'with buy-in:', formatEth(game.buyIn), 'ETH');
      
      const contract = getGameContract();
      const transaction = prepareContractCall({
        contract,
        method: "function joinGame(string code) payable",
        params: [game.gameCode],
        value: BigInt(game.buyIn)
      });

      const receipt = await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Join game transaction sent:', receipt);
      
      // Wait for confirmation
      const confirmedReceipt = await waitForReceipt({
        client: contract.client,
        chain: contract.chain,
        transactionHash: receipt.transactionHash
      });

      console.log('✅ Join game confirmed:', confirmedReceipt);
      
      // Refresh game data to show updated state
      window.location.reload();
      
    } catch (error: any) {
      console.error('❌ Failed to join game:', error);
      setError(error.message || 'Failed to join game');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClaimWinnings = async () => {
    if (!game || !account?.address) return;
    
    setActionLoading(true);
    try {
      console.log('💰 Claiming winnings for game:', game.gameCode);
      
      const contract = getGameContract();
      const transaction = prepareContractCall({
        contract,
        method: "function claimWinnings(string code)",
        params: [game.gameCode]
      });

      const receipt = await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Claim winnings transaction sent:', receipt);
      
      // Wait for confirmation
      const confirmedReceipt = await waitForReceipt({
        client: contract.client,
        chain: contract.chain,
        transactionHash: receipt.transactionHash
      });

      console.log('✅ Claim winnings confirmed:', confirmedReceipt);
      
      // Refresh game data to show updated state
      window.location.reload();
      
    } catch (error: any) {
      console.error('❌ Failed to claim winnings:', error);
      setError(error.message || 'Failed to claim winnings');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/game/${gameCode}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      console.log('Game URL copied to clipboard:', shareUrl);
      setIsShareCopied(true);
      
      // Reset feedback after 2 seconds
      setTimeout(() => {
        setIsShareCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert(`Game URL: ${shareUrl}`);
    }
  };

  const handleToggleWinner = (playerAddress: string) => {
    setSelectedWinners(prev => {
      if (prev.includes(playerAddress)) {
        // Remove from winners list
        return prev.filter(addr => addr !== playerAddress);
      } else {
        // Add to end of winners list (next rank) - limit to 3 winners max
        if (prev.length >= 3) {
          return prev;
        }
        return [...prev, playerAddress];
      }
    });
  };

  const handleReportWinners = async () => {
    if (!account || selectedWinners.length === 0 || !game) return;
    
    try {
      setActionLoading(true);
      setError(null);
      
      console.log('🏆 Reporting winners in rank order:', selectedWinners, 'for game:', game.gameCode);
      
      // For winner-take-all games (no prize splits), ensure we only submit one winner
      let winnersToSubmit = selectedWinners;
      const isWinnerTakeAll = !game.prizeSplits || game.prizeSplits.length === 0 || 
                              (game.prizeSplits.length === 1 && game.prizeSplits[0] === 1000);
                              
      if (isWinnerTakeAll && selectedWinners.length > 0) {
        winnersToSubmit = [selectedWinners[0]]; // Only take the first winner for winner-take-all
        console.log('🏆 Winner-take-all game: submitting only first winner:', winnersToSubmit);
      }
      
      const contract = getGameContract();
      const transaction = prepareContractCall({
        contract,
        method: "function reportWinners(string code, address[] winners)",
        params: [game.gameCode, winnersToSubmit]
      });

      const receipt = await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Report winners transaction sent:', receipt);
      
      // Wait for confirmation
      const confirmedReceipt = await waitForReceipt({
        client: contract.client,
        chain: contract.chain,
        transactionHash: receipt.transactionHash
      });

      console.log('✅ Report winners confirmed:', confirmedReceipt);
      
      // Clear selected winners and refresh game data
      setSelectedWinners([]);
      window.location.reload();
      
    } catch (e: any) {
      console.error('❌ Failed to report winners:', e);
      setError(e.message || 'Failed to report winners');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLockGame = async () => {
    if (!game || !account?.address) return;
    
    setActionLoading(true);
    try {
      console.log('🔒 Locking game:', game.gameCode);
      
      const contract = getGameContract();
      const transaction = prepareContractCall({
        contract,
        method: "function lockGame(string code)",
        params: [game.gameCode]
      });

      const receipt = await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Lock game transaction sent:', receipt);
      
      // Wait for confirmation
      const confirmedReceipt = await waitForReceipt({
        client: contract.client,
        chain: contract.chain,
        transactionHash: receipt.transactionHash
      });

      console.log('✅ Lock game confirmed:', confirmedReceipt);
      
      // Refresh game data to show updated state
      window.location.reload();
      
    } catch (error: any) {
      console.error('❌ Failed to lock game:', error);
      setError(error.message || 'Failed to lock game');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddToPot = async (amount: string) => {
    if (!game || !account?.address || !amount || parseFloat(amount) <= 0) return;
    
    setActionLoading(true);
    try {
      console.log('💰 Adding to pot for game:', game.gameCode, 'amount:', amount, 'ETH');
      
      const contract = getGameContract();
      const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e18));
      
      const transaction = prepareContractCall({
        contract,
        method: "function addPot(string code) payable",
        params: [game.gameCode],
        value: amountWei
      });

      const receipt = await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Add to pot transaction sent:', receipt);
      
      // Wait for confirmation
      const confirmedReceipt = await waitForReceipt({
        client: contract.client,
        chain: contract.chain,
        transactionHash: receipt.transactionHash
      });

      console.log('✅ Add to pot confirmed:', confirmedReceipt);
      
      // Refresh game data to show updated pot
      window.location.reload();
      
    } catch (error: any) {
      console.error('❌ Failed to add to pot:', error);
      setError(error.message || 'Failed to add to pot');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemovePlayer = async (playerAddress: string) => {
    if (!game || !account?.address) return;
    
    setActionLoading(true);
    try {
      console.log('👤 Removing player from game:', game.gameCode, 'player:', playerAddress);
      
      const contract = getGameContract();
      const transaction = prepareContractCall({
        contract,
        method: "function rmGame(string code, address participant)",
        params: [game.gameCode, playerAddress]
      });

      const receipt = await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Remove player transaction sent:', receipt);
      
      // Wait for confirmation
      const confirmedReceipt = await waitForReceipt({
        client: contract.client,
        chain: contract.chain,
        transactionHash: receipt.transactionHash
      });

      console.log('✅ Remove player confirmed:', confirmedReceipt);
      
      // Refresh game data to show updated players
      window.location.reload();
      
    } catch (error: any) {
      console.error('❌ Failed to remove player:', error);
      setError(error.message || 'Failed to remove player');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <FlexContainer justify="center" align="center" style={{ minHeight: '50vh' }}>
          <LoadingSpinner size="lg" />
        </FlexContainer>
      </PageContainer>
    );
  }

  if (!game) {
    return (
      <PageContainer>
        <BackButton onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
          Back to Dashboard
        </BackButton>
        <ErrorMessage>Game data not available</ErrorMessage>
      </PageContainer>
    );
  }

  const shareUrl = `${window.location.origin}/game/${gameCode}`;
  const shareTitle = `Join game ${gameCode} on SaltFree - No Salt, Just Wins`;
  const shareDescription = `Buy-in: ${formatEth(game.buyIn)} ETH | Players: ${game.currentPlayers}/${game.maxPlayers}`;

  return (
    <>
      <Helmet>
        <title>{shareTitle}</title>
        <meta name="description" content={shareDescription} />
        <meta property="og:title" content={shareTitle} />
        <meta property="og:description" content={shareDescription} />
        <meta property="og:url" content={shareUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${window.location.origin}/saltfree-social.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={shareTitle} />
        <meta name="twitter:description" content={shareDescription} />
        <meta name="twitter:image" content={`${window.location.origin}/saltfree-social.png`} />
      </Helmet>
      
      <PageContainer>
        <FlexContainer justify="space-between" align="center" style={{ marginBottom: '2rem' }}>
          <BackButton onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
            Back to Dashboard
          </BackButton>
          
          <GlassButton onClick={handleShare}>
            <Share2 size={20} />
            Share Game
          </GlassButton>
        </FlexContainer>

        <GameCard>
          <GameHeader>
            <div>
              <GameTitle>{gameCode}</GameTitle>
              <p style={{ color: 'rgba(255, 255, 255, 0.9)', textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)', margin: '0.5rem 0 0 0' }}>
                Hosted by {getDisplayNameForAddress(game.host)}
              </p>
            </div>
            
            <FlexContainer direction="column" align="flex-end" gap="0.5rem">
              {game.isCompleted && (
                <div style={{ 
                  padding: '0.5rem 1rem', 
                  backgroundColor: 'rgba(34, 197, 94, 0.2)', 
                  borderRadius: '8px',
                  color: '#22c55e'
                }}>
                  COMPLETED
                </div>
              )}
              {!game.isCompleted && (
                game.isLocked ? (
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.5rem 1rem', 
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                  }}>
                    <Lock size={16} style={{ marginRight: '0.5rem' }} />
                    LOCKED
                  </div>
                ) : (
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.5rem 1rem', 
                    background: 'rgba(34, 197, 94, 0.1)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '8px',
                    color: 'rgba(34, 197, 94, 0.9)',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: '2px solid currentColor',
                      marginRight: '0.5rem',
                      position: 'relative'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '6px',
                        height: '6px',
                        backgroundColor: 'currentColor',
                        borderRadius: '50%'
                      }} />
                    </div>
                    OPEN
                  </div>
                )
              )}
            </FlexContainer>
          </GameHeader>

          <GameStats>
            <StatCard>
              <StatCardContainer>
                <StatValue>{formatEth(game.buyIn)} ETH</StatValue>
                <StatLabel>Buy-In Amount</StatLabel>
                {(() => {
                  if (!account?.address) {
                    // Not logged in
                    return (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.25rem 0.5rem',
                        marginTop: '0.5rem',
                        background: 'rgba(59, 130, 246, 0.1)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: '#60a5fa',
                        cursor: 'pointer',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                      }}>
                        Sign in to Join
                      </div>
                    );
                  }
                  
                  // User is logged in
                  const userAddress = account.address.toLowerCase();
                  const isHost = game.host.toLowerCase() === userAddress;
                  const hasJoined = game.players.some(p => p.toLowerCase() === userAddress);
                  const canJoin = !hasJoined && !game.isLocked && !game.isCompleted && game.currentPlayers < game.maxPlayers;
                  
                  // Debug logging
                  console.log('🔍 Join button logic:', {
                    userAddress,
                    isHost,
                    hasJoined,
                    isLocked: game.isLocked,
                    isCompleted: game.isCompleted,
                    currentPlayers: game.currentPlayers,
                    maxPlayers: game.maxPlayers,
                    canJoin
                  });
                  
                  if (canJoin) {
                    return (
                      <StatAction 
                        size="sm"
                        onClick={handleJoinGame}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <LoadingSpinner /> : <><Users size={14} />Join</>}
                      </StatAction>
                    );
                  }
                  
                  // Show status badge when can't join
                  let statusText = '';
                  let statusColor = 'rgba(255, 255, 255, 0.6)';
                  
                  if (game.isCompleted) {
                    statusText = 'Completed';
                    statusColor = 'rgba(34, 197, 94, 0.8)';
                  } else if (hasJoined) {
                    if (isHost) {
                      statusText = 'Host (Joined)';
                      statusColor = 'rgba(59, 130, 246, 0.8)';
                    } else {
                      statusText = 'Joined';
                      statusColor = 'rgba(59, 130, 246, 0.8)';
                    }
                  } else if (isHost) {
                    statusText = 'Host (Not Joined)';
                    statusColor = 'rgba(168, 85, 247, 0.8)';
                  } else if (game.isLocked) {
                    statusText = 'Locked';
                    statusColor = 'rgba(255, 255, 255, 0.6)';
                  } else if (game.currentPlayers >= game.maxPlayers) {
                    statusText = 'Full';
                    statusColor = 'rgba(239, 68, 68, 0.8)';
                  }
                  
                  return statusText && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.25rem 0.5rem',
                      marginTop: '0.5rem',
                      background: 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      color: statusColor
                    }}>
                      {statusText}
                    </div>
                  );
                })()}
              </StatCardContainer>
            </StatCard>
            
            <StatCard>
              <StatCardContainer>
                <StatValue>{game.currentPlayers}/{game.maxPlayers}</StatValue>
                <StatLabel>Players</StatLabel>
                {renderDecisionBadge(game)}
              </StatCardContainer>
            </StatCard>
            
            <StatCard>
              <StatCardContainer>
                <StatValue>
                  {formatEth((BigInt(game.buyIn) * BigInt(game.currentPlayers)).toString())} ETH
                </StatValue>
                <StatLabel>Total Pot</StatLabel>
                {renderPrizeStructure(game.prizeSplits)}
              </StatCardContainer>
            </StatCard>
            
          </GameStats>

          <FlexContainer justify="center" gap="1rem" style={{ marginBottom: '2rem' }}>
            {!account?.address ? (
              <GlassButton 
                size="lg"
                onClick={() => {/* TODO: Implement sign in logic */}}
              >
                Sign in to Join
              </GlassButton>
            ) : (() => {
              const userAddress = account.address.toLowerCase();
              const isHost = game.host.toLowerCase() === userAddress;
              const hasJoined = game.players.some(p => p.toLowerCase() === userAddress);
              const isWinner = hasJoined && game.winners.some(w => w.toLowerCase() === userAddress);
              const canJoin = !hasJoined && !game.isLocked && !game.isCompleted && game.currentPlayers < game.maxPlayers;
              const isJudge = game.judges && game.judges.some(j => j.toLowerCase() === userAddress);
              
              return (
                <>
                  {/* Join Game Button */}
                  {canJoin && (
                    <GlassButton 
                      size="lg"
                      onClick={handleJoinGame}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <LoadingSpinner /> : <><Users size={20} />Join Game</>}
                    </GlassButton>
                  )}
                  
                  {/* Claim Winnings Button */}
                  {isWinner && game.isCompleted && (
                    <GlassButton 
                      size="lg"
                      onClick={handleClaimWinnings}
                      disabled={actionLoading}
                      variant="secondary"
                    >
                      {actionLoading ? <LoadingSpinner /> : <><Trophy size={20} />Claim Winnings</>}
                    </GlassButton>
                  )}
                  
                  {/* Host Actions */}
                  {isHost && !game.isCompleted && (
                    <>
                      {!game.isLocked && (
                        <GlassButton 
                          size="lg"
                          onClick={handleLockGame}
                          variant="secondary"
                          disabled={actionLoading}
                        >
                          {actionLoading ? <LoadingSpinner /> : <><Lock size={20} />Lock Game</>}
                        </GlassButton>
                      )}
                      <GlassButton 
                        size="lg"
                        onClick={() => setShowModal(true)}
                        variant="secondary"
                      >
                        <Coins size={20} />
                        Set Prize Splits
                      </GlassButton>
                    </>
                  )}
                </>
              );
            })()}
          </FlexContainer>

          <PlayersSection>
            <h3 style={{ color: 'rgba(255, 255, 255, 0.9)', marginBottom: '1rem' }}>
              Players ({game.currentPlayers})
            </h3>
            
            {game.players.length > 0 ? (
              <PlayersList>
                {game.players.map((player, index) => {
                  // Check if current user can vote
                  const userAddress = account?.address?.toLowerCase();
                  const isHost = game.host.toLowerCase() === userAddress;
                  const hasJoined = game.players.some(p => p.toLowerCase() === userAddress);
                  const isJudge = game.judges && game.judges.some(j => j.toLowerCase() === userAddress);
                  const hasJudges = game.judges && game.judges.length > 0;
                  
                  // Can vote if: game is locked but not completed, and user is eligible to vote
                  const canVote = game.isLocked && !game.isCompleted && account?.address && (
                    hasJudges ? isJudge : hasJoined // Judge-decided: only judges can vote, Player-decided: players can vote
                  );
                  
                  return (
                    <PlayerCard key={player} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Users size={16} style={{ color: 'rgba(255, 255, 255, 0.9)' }} />
                        <div>
                          <div style={{ color: 'rgba(255, 255, 255, 0.95)', textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)' }}>
                            {getDisplayNameForAddress(player)}
                          </div>
                          {game.winners.includes(player) && (() => {
                            const winnerIndex = game.winners.indexOf(player);
                            const isWinnerTakeAll = !game.prizeSplits || game.prizeSplits.length === 0;
                            
                            let emoji = '';
                            let text = '';
                            let variant: 'gold' | 'silver' | 'bronze' | 'other' = 'other';
                            
                            if (isWinnerTakeAll) {
                              emoji = '🏆';
                              text = 'Winner';
                              variant = 'gold';
                            } else {
                              switch (winnerIndex) {
                                case 0:
                                  emoji = '🥇';
                                  text = '1st Place';
                                  variant = 'gold';
                                  break;
                                case 1:
                                  emoji = '🥈';
                                  text = '2nd Place';
                                  variant = 'silver';
                                  break;
                                case 2:
                                  emoji = '🥉';
                                  text = '3rd Place';
                                  variant = 'bronze';
                                  break;
                                default:
                                  emoji = '🏅';
                                  text = `${winnerIndex + 1}th Place`;
                                  variant = 'other';
                              }
                            }
                            
                            return (
                              <WinnerBadge variant={variant}>
                                {emoji}
                                {text}
                              </WinnerBadge>
                            );
                          })()}
                        </div>
                      </div>
                      
                      {/* Voting UI */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        {/* Remove Player Button */}
                        {!game.isLocked && account && (
                          (isHost || player.toLowerCase() === userAddress) && (
                            <button
                              onClick={() => handleRemovePlayer(player)}
                              disabled={actionLoading}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                border: '2px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: '6px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: '14px',
                                transition: 'all 0.2s ease'
                              }}
                              title={player.toLowerCase() === userAddress ? "Leave game" : "Remove player"}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                              }}
                            >
                              <UserMinus size={16} />
                            </button>
                          )
                        )}

                        {/* Winner Selection Button */}
                        {canVote && (
                          <button
                            onClick={() => handleToggleWinner(player)}
                            disabled={actionLoading}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '32px',
                              height: '32px',
                              border: selectedWinners.includes(player) 
                                ? '2px solid rgba(255, 215, 0, 0.8)' 
                                : '2px solid rgba(255, 255, 255, 0.3)',
                              borderRadius: '6px',
                              background: selectedWinners.includes(player)
                                ? 'rgba(255, 215, 0, 0.2)'
                                : 'rgba(255, 255, 255, 0.1)',
                              backdropFilter: 'blur(8px)',
                              WebkitBackdropFilter: 'blur(8px)',
                              color: selectedWinners.includes(player) 
                                ? 'rgba(255, 215, 0, 1)' 
                                : 'rgba(255, 255, 255, 0.7)',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              transition: 'all 0.2s ease'
                            }}
                            title={selectedWinners.includes(player) 
                              ? `Selected as #${selectedWinners.indexOf(player) + 1} winner`
                              : "Select as winner"
                            }
                          >
                            {selectedWinners.includes(player) ? (
                              selectedWinners.indexOf(player) + 1 === 1 ? '🥇' : 
                              selectedWinners.indexOf(player) + 1 === 2 ? '🥈' : '🥉'
                            ) : (
                              '+'
                            )}
                          </button>
                        )}
                      </div>
                    </PlayerCard>
                  );
                })}
              </PlayersList>
            ) : (
              <p style={{ color: 'rgba(255, 255, 255, 0.9)', textAlign: 'center', padding: '2rem', textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)' }}>
                No players joined yet
              </p>
            )}
            
            {/* Report Winners Button */}
            {account?.address && (() => {
              const userAddress = account.address.toLowerCase();
              const isHost = game.host.toLowerCase() === userAddress;
              const hasJoined = game.players.some(p => p.toLowerCase() === userAddress);
              const isJudge = game.judges && game.judges.some(j => j.toLowerCase() === userAddress);
              const hasJudges = game.judges && game.judges.length > 0;
              
              // Can vote if: game is locked but not completed, and user is eligible to vote
              const canVote = game.isLocked && !game.isCompleted && (
                hasJudges ? isJudge : hasJoined // Judge-decided: only judges can vote, Player-decided: players can vote
              );
              
              return canVote && selectedWinners.length > 0 && (
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                  <GlassButton
                    size="lg"
                    onClick={handleReportWinners}
                    disabled={actionLoading}
                    variant="primary"
                  >
                    {actionLoading ? <LoadingSpinner /> : (
                      <>
                        <Trophy size={20} />
                        Report Winners ({selectedWinners.length})
                      </>
                    )}
                  </GlassButton>
                </div>
              );
            })()}
          </PlayersSection>
        </GameCard>

        {showModal && (
          <GameDetailModal
            game={{
              code: game.gameCode,
              host: game.host,
              buyIn: game.buyIn,
              maxPlayers: game.maxPlayers,
              playerCount: game.currentPlayers,
              userRole: 'unknown' as const
            }}
            onClose={() => setShowModal(false)}
            onRefresh={() => window.location.reload()}
          />
        )}
      </PageContainer>
    </>
  );
}