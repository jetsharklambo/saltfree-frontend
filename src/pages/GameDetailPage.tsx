import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useActiveAccount } from "thirdweb/react";
import { readContract, prepareContractCall, sendTransaction, waitForReceipt } from 'thirdweb';
import toast from 'react-hot-toast';
import { ArrowLeft, Users, Clock, Lock, Trophy, Share2, Coins, Scale, UserCheck, PlusCircle, UserMinus } from 'lucide-react';
import { getGameContract, formatEth, formatPrizeSplit, formatTokenDisplay, ensureTokenApproval, isETH } from '../thirdweb';
import { getDisplayNameByAddressSync, preloadDisplayNames, getDisplayNamesByAddresses } from '../utils/userUtils';
import { validation } from '../utils/envUtils';
import { logger, logGameAction } from '../utils/logger';
import { 
  Block,
  BlockButton, 
  FlexBlock,
  blockTheme,
  mediumShadow
} from '../styles/blocks';
import { SimpleRetroLoader } from '../components/RetroLoader';
import styled from '@emotion/styled';
import GameDetailModal from '../components/GameDetailModal';
import FindGameModal from '../components/FindGameModal';
import JoinGameModal from '../components/JoinGameModal';
import PrizeSplitsModal from '../components/PrizeSplitsModal';

interface GameInfo {
  gameCode: string;
  host: string;
  buyIn: string;
  buyInToken?: string;
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

const BackButton = styled(BlockButton)`
  margin-bottom: 2rem;
  background: ${blockTheme.pastelBlue};
  
  &:hover {
    transform: translate(-6px, -2px);
    box-shadow: 10px 10px 0px ${blockTheme.shadowDark};
  }
`;

const GameCard = styled(Block)`
  max-width: 800px;
  margin: 0 auto 2rem auto;
  padding: 2rem;
  background: ${blockTheme.pastelYellow};
  border: 4px solid ${blockTheme.darkText};
  border-radius: 20px;
  box-shadow: 8px 8px 0px ${blockTheme.shadowDark};
  
  @media (max-width: 768px) {
    padding: 1.5rem;
    margin: 0 auto 1.5rem auto;
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
  color: ${blockTheme.darkText};
  margin: 0;
  font-family: 'Monaco', 'Menlo', monospace;
  letter-spacing: 2px;
  
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

const StatCard = styled(Block)`
  padding: 1.5rem;
  text-align: center;
  background: ${blockTheme.pastelMint};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 16px;
  box-shadow: 6px 6px 0px ${blockTheme.shadowDark};
  transition: all 0.2s ease;
  
  &:hover {
    transform: translate(-2px, -2px);
    box-shadow: 8px 8px 0px ${blockTheme.shadowDark};
  }
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${blockTheme.darkText};
  margin-bottom: 0.5rem;
  font-family: 'Monaco', 'Menlo', monospace;
`;

const StatLabel = styled.div`
  font-size: 0.9rem;
  color: ${blockTheme.darkText};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  opacity: 0.8;
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

const PlayerCard = styled(Block)`
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: ${blockTheme.pastelPink};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  transition: all 0.2s ease;
  
  &:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px ${blockTheme.shadowDark};
  }
`;

const ErrorMessage = styled.div`
  text-align: center;
  padding: 2rem;
  color: ${blockTheme.error};
  font-size: 1.1rem;
  font-weight: 600;
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
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  border: 3px solid ${blockTheme.darkText};
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  color: ${blockTheme.darkText};
  transition: all 0.2s ease;
  ${mediumShadow}
  
  background: ${props => {
    if (props.color === 'rgba(255, 215, 0, 0.1)') return blockTheme.pastelYellow;
    if (props.color === 'rgba(192, 192, 192, 0.1)') return blockTheme.pastelPink;
    if (props.color === 'rgba(205, 127, 50, 0.1)') return blockTheme.pastelPeach;
    return blockTheme.pastelMint;
  }};
  
  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0px ${blockTheme.shadowDark};
  }
`;

const WinnerTakeAllBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  background: ${blockTheme.warning};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  color: ${blockTheme.darkText};
  transition: all 0.2s ease;
  ${mediumShadow}
  
  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0px ${blockTheme.shadowDark};
  }
`;

const StatAction = styled(BlockButton)`
  padding: 0.4rem 0.8rem;
  font-size: 0.75rem;
  margin-top: 0.5rem;
  min-height: 32px;
  background: ${blockTheme.pastelBlue};
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: 2px 2px 0px ${blockTheme.shadowMedium} !important;
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
  background: ${blockTheme.pastelLavender};
  border: 3px solid ${blockTheme.darkText};
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: ${blockTheme.darkText};
  font-weight: 700;
`;

const JudgeBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.8rem;
  background: ${blockTheme.info};
  border: 3px solid ${blockTheme.darkText};
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: ${blockTheme.darkText};
  font-weight: 700;
  transition: all 0.2s ease;

  &:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px ${blockTheme.shadowDark};
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
  padding: 0.4rem 0.8rem;
  border: 3px solid ${blockTheme.darkText};
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${blockTheme.darkText};
  margin-top: 0.25rem;
  transition: all 0.2s ease;
  ${mediumShadow}
  
  background: ${props => {
    switch (props.variant) {
      case 'gold': return blockTheme.warning;
      case 'silver': return blockTheme.pastelBlue;
      case 'bronze': return blockTheme.pastelPeach;
      default: return blockTheme.pastelYellow;
    }
  }};
  
  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0px ${blockTheme.shadowDark};
  }
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
  const [showFindModal, setShowFindModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(autoJoin);
  const [showPrizeSplitsModal, setShowPrizeSplitsModal] = useState(false);
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
              method: "function getGameInfo(string code) view returns (address host, address token, uint256 buyIn, uint256 maxPlayers, uint256 playerCount, bool isLocked, uint256[] splits, address[] judges)",
              params: [codeVariation],
            }) as [string, bigint, bigint, bigint, boolean, bigint[], string[]];

            const [gameHost, gameToken, gameBuyIn, gameMaxPlayers, gamePlayerCount, gameIsLocked, prizeSplitsBigInt, gameJudges] = gameInfo;

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
          buyInToken: gameToken,
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

        // If autoJoin is true, show the join modal with pre-filled code
        if (autoJoin && account?.address) {
          setShowJoinModal(true);
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
      const buyInWei = BigInt(game.buyIn);
      const tokenAddress = game.buyInToken || "0x0000000000000000000000000000000000000000";
      const isEthPayment = isETH(tokenAddress);
      
      console.log('🎮 GameDetailPage joining game:', game.gameCode);
      console.log('🔧 Payment info:', {
        buyIn: buyInWei.toString(),
        token: tokenAddress,
        isEth: isEthPayment,
        display: isEthPayment 
          ? formatEth(game.buyIn) + ' ETH'
          : formatTokenDisplay(game.buyIn, tokenAddress)
      });

      const contract = getGameContract();

      // Handle ERC20 token approval if needed
      if (!isEthPayment && buyInWei > 0) {
        console.log('🔐 ERC20 token game detected, checking approval...');
        toast.loading('Checking token approval...', { id: 'join-game-page' });
        
        try {
          const approvalResult = await ensureTokenApproval(
            tokenAddress,
            account.address,
            contract.address,
            buyInWei,
            account
          );

          if (approvalResult.needsApproval) {
            toast.success('Token approval completed!', { id: 'join-game-page' });
            console.log('✅ Token approval completed, proceeding to join game...');
          } else {
            console.log('✅ Token already approved, proceeding to join game...');
          }
        } catch (approvalError: any) {
          console.error('❌ Token approval failed:', approvalError);
          throw new Error(`Token approval failed: ${approvalError.message}`);
        }

        toast.loading('Joining game...', { id: 'join-game-page' });
      }
      
      // Prepare transaction based on payment type
      const transaction = prepareContractCall({
        contract,
        method: "function joinGame(string code) payable",
        params: [game.gameCode],
        value: isEthPayment ? buyInWei : 0n, // Only send ETH for ETH payments
      });

      console.log('🚀 Sending join transaction:', {
        method: 'joinGame',
        gameCode: game.gameCode,
        value: (isEthPayment ? buyInWei : 0n).toString(),
        isEthPayment,
        tokenAddress
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
      
      // Show success toast
      const paymentDisplay = isEthPayment 
        ? formatEth(buyInWei.toString()) + ' ETH'
        : formatTokenDisplay(buyInWei.toString(), tokenAddress);

      toast.success(`Successfully joined game ${game.gameCode}!`, {
        duration: 3000,
        icon: '🎮',
        id: 'join-game-page'
      });
      
      // Refresh game data to show updated state
      window.location.reload();
      
    } catch (error: any) {
      console.error('❌ Failed to join game:', error);
      
      let errorMessage = 'Failed to join game';
      
      if (error.message?.includes('Token approval failed')) {
        errorMessage = error.message;
      } else if (error.message?.includes('transfer amount exceeds allowance')) {
        errorMessage = 'Token approval insufficient. Please try again.';
      } else if (error.message?.includes('user rejected')) {
        errorMessage = 'Transaction cancelled by user';
      } else if (error.message?.includes('insufficient funds')) {
        const tokenName = isETH(game.buyInToken || '') ? 'ETH' : 'tokens';
        errorMessage = `Insufficient ${tokenName} balance or gas fees.`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      toast.error(errorMessage, { id: 'join-game-page' });
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
        // Determine maximum winners based on prize splits
        const isWinnerTakeAll = !game?.prizeSplits || game.prizeSplits.length === 0 || 
                                (game.prizeSplits.length === 1 && game.prizeSplits[0] === 1000);
        const maxWinners = isWinnerTakeAll ? 1 : game?.prizeSplits?.length || 3;
        
        // Check if we've reached the maximum number of winners
        if (prev.length >= maxWinners) {
          const prizeText = maxWinners === 1 ? 'Winner-take-all game' : `Only ${maxWinners} prize${maxWinners > 1 ? 's' : ''} available`;
          toast.error(`${prizeText} - maximum ${maxWinners} winner${maxWinners > 1 ? 's' : ''} allowed`);
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
      
      // Validate winner count matches prize distribution
      const isWinnerTakeAll = !game.prizeSplits || game.prizeSplits.length === 0 || 
                              (game.prizeSplits.length === 1 && game.prizeSplits[0] === 1000);
      const requiredWinners = isWinnerTakeAll ? 1 : game.prizeSplits?.length || 1;
      
      if (selectedWinners.length !== requiredWinners) {
        const prizeText = isWinnerTakeAll ? 'winner-take-all' : `${requiredWinners} prize${requiredWinners > 1 ? 's' : ''}`;
        toast.error(`Must select exactly ${requiredWinners} winner${requiredWinners > 1 ? 's' : ''} for this ${prizeText} game. Only winners with available prizes will receive winnings.`);
        setActionLoading(false);
        return;
      }
      
      // For winner-take-all games (no prize splits), ensure we only submit one winner
      let winnersToSubmit = selectedWinners;
                              
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
        <FlexBlock justify="center" align="center" style={{ minHeight: '50vh' }}>
          <SimpleRetroLoader />
        </FlexBlock>
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
  const shareDescription = `Buy-in: ${game.buyInToken ? formatTokenDisplay(game.buyIn, game.buyInToken) : formatEth(game.buyIn) + ' ETH'} | Players: ${game.currentPlayers}/${game.maxPlayers}`;

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
        <FlexBlock justify="space-between" align="center" style={{ marginBottom: '2rem' }}>
          <BackButton onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
            Back to Dashboard
          </BackButton>
          
          <BlockButton color="pastelPeach" onClick={handleShare}>
            <Share2 size={20} />
            Share Game
          </BlockButton>
        </FlexBlock>

        <GameCard>
          <GameHeader>
            <div>
              <GameTitle>{gameCode}</GameTitle>
              <p style={{ color: blockTheme.darkText, margin: '0.5rem 0 0 0', fontWeight: '600', opacity: '0.8' }}>
                Hosted by {getDisplayNameForAddress(game.host)}
              </p>
            </div>
            
            <FlexBlock direction="column" align="flex-end" gap="0.5rem">
              {game.isCompleted && (
                <div style={{ 
                  padding: '0.5rem 1rem', 
                  backgroundColor: blockTheme.success, 
                  border: `3px solid ${blockTheme.darkText}`,
                  borderRadius: '12px',
                  color: blockTheme.darkText,
                  fontWeight: '700',
                  boxShadow: `4px 4px 0px ${blockTheme.shadowDark}`
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
                    background: blockTheme.pastelCoral,
                    border: `3px solid ${blockTheme.darkText}`,
                    borderRadius: '12px',
                    color: blockTheme.lightText,
                    fontSize: '0.875rem',
                    fontWeight: '700',
                    boxShadow: `4px 4px 0px ${blockTheme.shadowDark}`
                  }}>
                    <Lock size={16} style={{ marginRight: '0.5rem' }} />
                    LOCKED
                  </div>
                ) : (
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.5rem 1rem', 
                    background: blockTheme.success,
                    border: `3px solid ${blockTheme.darkText}`,
                    borderRadius: '12px',
                    color: blockTheme.darkText,
                    fontSize: '0.875rem',
                    fontWeight: '700',
                    boxShadow: `4px 4px 0px ${blockTheme.shadowDark}`
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
            </FlexBlock>
          </GameHeader>

          <GameStats>
            <StatCard>
              <StatCardContainer>
                <StatValue>{game.buyInToken ? formatTokenDisplay(game.buyIn, game.buyInToken) : formatEth(game.buyIn) + ' ETH'}</StatValue>
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
                        background: blockTheme.info,
                        border: `3px solid ${blockTheme.darkText}`,
                        boxShadow: `4px 4px 0px ${blockTheme.shadowDark}`,
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: blockTheme.darkText,
                        cursor: 'pointer',
                        fontWeight: '700'
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
                        {actionLoading ? <SimpleRetroLoader /> : <><Users size={14} />Join</>}
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
                      padding: '0.4rem 0.6rem',
                      marginTop: '0.5rem',
                      background: blockTheme.pastelCoral,
                      border: `3px solid ${blockTheme.darkText}`,
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      color: blockTheme.darkText,
                      boxShadow: `4px 4px 0px ${blockTheme.shadowDark}`,
                      transition: 'all 0.2s ease'
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
                  {game.buyInToken ? formatTokenDisplay((BigInt(game.buyIn) * BigInt(game.currentPlayers)).toString(), game.buyInToken) : formatEth((BigInt(game.buyIn) * BigInt(game.currentPlayers)).toString()) + ' ETH'}
                </StatValue>
                <StatLabel>Total Pot</StatLabel>
                {renderPrizeStructure(game.prizeSplits)}
              </StatCardContainer>
            </StatCard>
            
          </GameStats>

          <FlexBlock justify="center" gap="1rem" style={{ marginBottom: '2rem' }}>
            {!account?.address ? (
              <BlockButton 
                color="pastelBlue"
                size="lg"
                onClick={() => {/* TODO: Implement sign in logic */}}
              >
                Sign in to Join
              </BlockButton>
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
                    <BlockButton 
                      color="pastelPink"
                      size="lg"
                      onClick={handleJoinGame}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <SimpleRetroLoader /> : <><Users size={20} />Join Game</>}
                    </BlockButton>
                  )}
                  
                  {/* Claim Winnings Button */}
                  {isWinner && game.isCompleted && (
                    <BlockButton 
                      color="warning"
                      size="lg"
                      onClick={handleClaimWinnings}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <SimpleRetroLoader /> : <><Trophy size={20} />Claim Winnings</>}
                    </BlockButton>
                  )}
                  
                  {/* Host Actions */}
                  {isHost && !game.isCompleted && (
                    <>
                      {!game.isLocked && (
                        <BlockButton 
                          color="pastelLavender"
                          size="lg"
                          onClick={handleLockGame}
                          disabled={actionLoading}
                        >
                          {actionLoading ? <SimpleRetroLoader /> : <><Lock size={20} />Lock Game</>}
                        </BlockButton>
                      )}
                      <BlockButton 
                        color="pastelPeach"
                        size="lg"
                        onClick={() => setShowPrizeSplitsModal(true)}
                      >
                        <Coins size={20} />
                        Set Prize Splits
                      </BlockButton>
                    </>
                  )}
                </>
              );
            })()}
          </FlexBlock>

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
                                border: `3px solid ${blockTheme.darkText}`,
                                borderRadius: '8px',
                                background: blockTheme.error,
                                color: blockTheme.darkText,
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '700',
                                boxShadow: `2px 2px 0px ${blockTheme.shadowDark}`,
                                transition: 'all 0.2s ease'
                              }}
                              title={player.toLowerCase() === userAddress ? "Leave game" : "Remove player"}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translate(-1px, -1px)';
                                e.currentTarget.style.boxShadow = `3px 3px 0px ${blockTheme.shadowDark}`;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translate(0px, 0px)';
                                e.currentTarget.style.boxShadow = `2px 2px 0px ${blockTheme.shadowDark}`;
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
                              border: `3px solid ${blockTheme.darkText}`,
                              borderRadius: '8px',
                              background: selectedWinners.includes(player)
                                ? blockTheme.warning
                                : blockTheme.pastelBlue,
                              color: blockTheme.darkText,
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '700',
                              boxShadow: `2px 2px 0px ${blockTheme.shadowDark}`,
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
              
              const isWinnerTakeAll = !game.prizeSplits || game.prizeSplits.length === 0 || 
                                      (game.prizeSplits.length === 1 && game.prizeSplits[0] === 1000);
              const requiredWinners = isWinnerTakeAll ? 1 : game.prizeSplits?.length || 1;
              const hasCorrectWinnerCount = selectedWinners.length === requiredWinners;

              return canVote && selectedWinners.length > 0 && (
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                  <BlockButton
                    color="warning"
                    size="lg"
                    onClick={handleReportWinners}
                    disabled={actionLoading || !hasCorrectWinnerCount}
                  >
                    {actionLoading ? <SimpleRetroLoader /> : (
                      <>
                        <Trophy size={20} />
                        Report Winners ({selectedWinners.length}/{requiredWinners})
                      </>
                    )}
                  </BlockButton>
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
        
        {showFindModal && (
          <FindGameModal
            onClose={() => setShowFindModal(false)}
            onSuccess={() => {
              setShowFindModal(false);
              // Refresh the page to show the updated game state
              window.location.reload();
            }}
            initialCode={gameCode}
            autoSearch={autoJoin}
          />
        )}
        
        {showJoinModal && (
          <JoinGameModal
            onClose={() => setShowJoinModal(false)}
            onSuccess={() => {
              setShowJoinModal(false);
              // Refresh the page to show the updated game state
              window.location.reload();
            }}
            initialGameCode={gameCode}
          />
        )}

        {showPrizeSplitsModal && game && (
          <PrizeSplitsModal
            gameCode={game.gameCode}
            currentSplits={game.prizeSplits || []}
            onClose={() => setShowPrizeSplitsModal(false)}
            onSuccess={(newSplits) => {
              setGame(prev => prev ? { ...prev, prizeSplits: newSplits } : null);
              setShowPrizeSplitsModal(false);
            }}
          />
        )}
      </PageContainer>
    </>
  );
}