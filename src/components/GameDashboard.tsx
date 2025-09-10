import React, { useState, useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { readContract } from 'thirdweb';
import toast from 'react-hot-toast';
import { Plus, Users, Clock, Lock, RefreshCw, Search, Trophy, Share2, Copy, Check, ExternalLink } from 'lucide-react';
import { getGameContract, formatAddress, formatEth, decodeStringFromHex } from '../thirdweb';
import { getDisplayNameByAddress, getDisplayNameByAddressSync, preloadUsernames, preloadDisplayNames } from '../utils/userUtils';
import { ensCache } from '../utils/ensUtils';
import { 
  Block, 
  BlockButton, 
  BlockInput,
  FlexBlock, 
  blockTheme,
  blockMedia,
  BlockGrid,
  PixelText,
  mediumShadow
} from '../styles/blocks';
import { SimpleRetroLoader } from './RetroLoader';
import { generateCompactASCII, generateRetroFrame } from '../utils/asciiArt';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameData } from '../contexts/GameDataContext';
import { useUser } from '../contexts/UserContext';
import CreateGameModal from './CreateGameModal';
import JoinGameModal from './JoinGameModal';
import FindGameModal from './FindGameModal';
import GameDetailModal from './GameDetailModal';
import { UsernameModal } from './UsernameModal';
import { GameListsModal } from './GameListsModal';
import { GameHistoryModal } from './GameHistoryModal';
import UserDropdown from './UserDropdown';
import { ErrorBoundarySection } from './GracefulErrorBoundary';
import { validation } from '../utils/envUtils';
import { logger, logGameAction } from '../utils/logger';
import WinnerBadge, { TrophyBadge, CrownBadge } from './WinnerBadge';
import ClaimedWinningsBadge, { CrossedOutPot } from './ClaimedWinningsBadge';
import { createTransactionPoller, TransactionStatus } from '../utils/transactionMonitor';

interface GameDashboardProps {
  filter?: 'active' | 'mine';
  view?: 'leaderboard';
}

// Safe imports to prevent crashes
const safeThirdwebFunctions = {
  readContract: async (options: any) => {
    try {
      return await readContract(options);
    } catch (error) {
      console.warn('readContract failed:', error);
      throw error;
    }
  }
};

interface GameInfo {
  gameCode: string;
  host: string;
  buyIn: string;
  maxPlayers: number;
  playerCount: number;
  players?: string[];
  inGameJudges?: string[];
  isActive?: boolean;
  isLocked?: boolean;
  autoLockTime?: number;
  prizeSplits?: number[];
}

const DashboardContainer = styled.div`
  min-height: 100vh;
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
`;

const WelcomeSection = styled(Block)`
  text-align: center;
  margin-bottom: 2.5rem;
  background: ${blockTheme.pastelBlue};
`;

// CRT Marquee Display Components
const CRTContainer = styled.div`
  width: 100%;
  max-width: 1200px;
  margin: 0 auto 2rem auto;
  padding: 0 2rem;
`;

const CRTDisplay = styled.div`
  background: ${blockTheme.pastelLavender};
  border: 8px solid ${blockTheme.darkText};
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 
    inset 0 0 20px rgba(0, 0, 0, 0.1),
    0 4px 20px rgba(0, 0, 0, 0.2),
    8px 8px 0px ${blockTheme.shadowDark};
  position: relative;
  
  /* CRT bezel styling with pastel colors */
  &::before {
    content: '';
    position: absolute;
    top: -4px;
    left: -4px;
    right: -4px;
    bottom: -4px;
    background: linear-gradient(145deg, ${blockTheme.pastelPeach}, ${blockTheme.pastelPink});
    border-radius: 24px;
    z-index: -1;
  }
`;

const CRTScreen = styled.div`
  background: #0a0a0a;
  border: 4px solid ${blockTheme.darkText};
  border-radius: 12px;
  height: 160px;
  position: relative;
  overflow: hidden;
  
  /* CRT screen curvature effect */
  transform: perspective(800px) rotateX(2deg);
  
  /* Screen glow */
  box-shadow: 
    inset 0 0 30px rgba(0, 255, 65, 0.1),
    0 0 20px rgba(0, 255, 65, 0.05);
  
  /* Scan lines */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 255, 65, 0.03) 2px,
      rgba(0, 255, 65, 0.03) 4px
    );
    pointer-events: none;
    z-index: 2;
  }
  
  /* CRT flicker animation */
  animation: crt-flicker 3s infinite;
  
  @keyframes crt-flicker {
    0%, 96%, 100% { 
      opacity: 1; 
      filter: brightness(1);
    }
    97% { 
      opacity: 0.98; 
      filter: brightness(0.95);
    }
    98% {
      opacity: 0.99;
      filter: brightness(1.02);
    }
    99% { 
      opacity: 0.97; 
      filter: brightness(0.98);
    }
  }
`;

const ScrollingContent = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  text-align: center;
  
  animation: scroll-back-forth 8s ease-in-out infinite alternate;
  
  @keyframes scroll-back-forth {
    0% {
      transform: translate(-50%, -50%) translateX(-50%);
    }
    100% {
      transform: translate(-50%, -50%) translateX(50%);
    }
  }
`;

const ScrollingTitle = styled.div`
  font-family: 'Roboto Mono', 'Droid Sans Mono', 'Monaco', 'Consolas', 'Courier New', monospace;
  font-weight: bold;
  font-size: 0.9rem;
  white-space: pre;
  line-height: 1.1;
  letter-spacing: 0.02em;
  
  @media (max-width: 768px) {
    font-size: 0.8rem;
    line-height: 1.2;
    letter-spacing: 0.03em;
  }
  
  /* Rainbow color animation */
  background: linear-gradient(
    90deg,
    #ff0080 0%,
    #ff8000 16.66%,
    #ffff00 33.33%,
    #80ff00 50%,
    #00ff80 66.66%,
    #0080ff 83.33%,
    #8000ff 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  
  /* Constantly changing rainbow animation */
  animation: rainbow-flow 3s linear infinite;
  
  /* Glowing text shadow with rainbow effect */
  filter: drop-shadow(0 0 8px #ff0080) 
          drop-shadow(0 0 12px #00ff80) 
          drop-shadow(0 0 16px #0080ff);
  
  @keyframes rainbow-flow {
    0% { background-position: 0% 50%; }
    100% { background-position: 200% 50%; }
  }
`;

const ScrollingSubtitle = styled.div`
  font-family: 'Roboto Mono', 'Droid Sans Mono', 'Monaco', 'Consolas', 'Courier New', monospace;
  font-weight: normal;
  font-size: 1.3rem;
  white-space: nowrap;
  opacity: 0.85;
  letter-spacing: 1px;
  text-align: center;
  
  @media (max-width: 768px) {
    font-size: 1.1rem;
    letter-spacing: 0.8px;
  }
  
  /* Subtle rainbow effect for subtitle */
  background: linear-gradient(
    90deg,
    #8000ff 0%,
    #0080ff 25%,
    #00ff80 50%,
    #ff8000 75%,
    #ff0080 100%
  );
  background-size: 150% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  
  /* Slower rainbow animation for contrast */
  animation: rainbow-flow-slow 4s linear infinite;
  
  /* Subtle glow */
  filter: drop-shadow(0 0 4px #0080ff) 
          drop-shadow(0 0 6px #ff0080);
  
  @keyframes rainbow-flow-slow {
    0% { background-position: 0% 50%; }
    100% { background-position: 150% 50%; }
  }
`;

const GamesGrid = styled(BlockGrid)`
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  padding: 1rem 0;
  gap: 2rem;
  width: 100%;
  overflow: hidden;
  
  /* Ensure each grid item is properly constrained */
  & > * {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }
`;

const PagerDevice = styled(motion.div, {
  shouldForwardProp: (prop) => !['$isWinner', '$isCompleted', '$isUserHost'].includes(prop),
})<{ 
  $isWinner?: boolean; 
  $isCompleted?: boolean;
  $isUserHost?: boolean;
}>`
  background: linear-gradient(145deg, #e6e6e6, #b8b8b8);
  border: 4px solid ${blockTheme.darkText};
  border-radius: 12px;
  padding: 0.75rem;
  padding-bottom: 1rem; /* Extra space for button shadows */
  box-shadow: 8px 8px 0px ${blockTheme.shadowDark};
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  color: ${blockTheme.darkText};
  font-weight: 600;
  overflow: hidden;
  width: 100%;
  min-width: 0;
  
  ${({ $isWinner }) => $isWinner && `
    background: linear-gradient(145deg, #fff3cd, #d1a827);
    animation: winner-glow 2s ease-in-out infinite;
    
    @keyframes winner-glow {
      0%, 100% { 
        box-shadow: 8px 8px 0px ${blockTheme.shadowDark}, 0 0 20px ${blockTheme.success};
      }
      50% { 
        box-shadow: 8px 8px 0px ${blockTheme.shadowDark}, 0 0 30px ${blockTheme.success};
      }
    }
  `}
  
  &:hover {
    transform: translate(-2px, -2px);
    box-shadow: 10px 10px 0px ${blockTheme.shadowDark};
    background: linear-gradient(145deg, #f0f0f0, #c8c8c8);
  }
  
  &:active {
    transform: translate(2px, 2px);
    box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  }
  
  @media (max-width: 768px) {
    padding: 0.625rem;
    padding-bottom: 0.875rem; /* Extra space for button shadows */
    border-radius: 10px;
  }
`;

const GameHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  position: relative;
  
  /* Left content (pager + buttons) takes main space */
  & > *:first-child {
    flex: 1;
    min-width: 0;
    margin-right: 1rem;
  }
  
  /* Right content (badges) stays compact */
  & > *:last-child {
    flex-shrink: 0;
    max-width: 30%;
  }
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
    
    & > *:last-child {
      max-width: 100%;
      align-self: flex-end;
    }
    
    & > *:first-child {
      margin-right: 0;
    }
  }
`;

const GameCodeTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
  
  &:hover {
    color: ${blockTheme.retroBlue};
  }
`;

const GameStats = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
`;

const GameBadge = styled.div<{ variant: 'host' | 'player' }>`
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  border: 3px solid ${blockTheme.darkText};
  color: ${blockTheme.darkText};
  transition: all 0.2s ease;
  ${mediumShadow}
  
  background: ${({ variant }) => {
    switch (variant) {
      case 'host':
        return blockTheme.pastelLavender;
      case 'player':
        return blockTheme.pastelMint;
      default:
        return blockTheme.pastelMint;
    }
  }};
  
  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0px ${blockTheme.shadowDark};
  }
`;

const SectionHeader = styled.div`
  margin-bottom: 2rem;
  text-align: center;
`;

const SectionTitle = styled.h2`
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: ${blockTheme.retroPurple};
  text-shadow: 2px 2px 0px ${blockTheme.shadowDark};
`;

const EmptyState = styled(Block)`
  text-align: center;
  padding: 3rem 2rem;
  background: ${blockTheme.pastelMint};
  
  .emoji {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.8;
  }
  
  h3 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: ${blockTheme.darkText};
  }
  
  p {
    color: ${blockTheme.darkText};
    font-size: 1rem;
    opacity: 0.8;
  }
`;


const PagerDisplay = styled.div`
  font-family: 'Roboto Mono', 'Droid Sans Mono', 'Monaco', 'Consolas', 'Courier New', monospace;
  font-weight: bold;
  line-height: 1.2;
  text-align: center;
  margin: 0;
  padding: 1rem;
  background: #000;
  border: 3px solid ${blockTheme.darkText};
  border-radius: 8px;
  white-space: pre;
  font-size: 0.7rem;
  letter-spacing: 0.02em;
  color: #00ff41;
  overflow: visible;
  cursor: pointer;
  transition: all 0.2s ease;
  
  @media (max-width: 768px) {
    font-size: 0.65rem;
    line-height: 1.3;
    letter-spacing: 0.03em;
    padding: 0.75rem;
  }
  box-shadow: 
    inset 0 0 10px rgba(0, 255, 65, 0.3),
    0 2px 4px rgba(0, 0, 0, 0.5);
  position: relative;
  min-height: 2.5rem;
  
  /* Pager LCD scan lines */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 1px,
      rgba(0, 255, 65, 0.08) 1px,
      rgba(0, 255, 65, 0.08) 2px
    );
    pointer-events: none;
    z-index: 1;
  }
  
  /* Message received animation */
  animation: messageReceived 3s ease-in-out infinite;
  
  @keyframes messageReceived {
    0%, 85% { 
      color: #00ff41;
      text-shadow: 0 0 5px #00ff41;
    }
    86%, 90% { 
      color: #00ff88;
      text-shadow: 0 0 10px #00ff88;
    }
    91%, 95% { 
      color: #00ff41;
      text-shadow: 0 0 5px #00ff41;
    }
    96%, 100% { 
      color: #00ff88;
      text-shadow: 0 0 10px #00ff88;
    }
  }
  
  &:hover {
    animation-play-state: paused;
    color: #00ff88;
    box-shadow: 
      inset 0 0 15px rgba(0, 255, 65, 0.4),
      0 2px 8px rgba(0, 0, 0, 0.6);
  }
  
  &:active {
    color: #00cc33;
  }
  
  ${blockMedia.mobile} {
    font-size: 0.45rem;
    padding: 1.25rem 0.75rem;
    min-height: 4rem;
  }
`;



// Generate "SALT FREE" ASCII art using seven-segment display (custom for longer text)
const generateSaltFreeASCII = (): string => {
  // Seven segment display characters (like digital clock/pager)
  const displayLetters: { [key: string]: string[] } = {
    'S': [
      ' ████',
      '█    ',
      ' ███ ',
      '    █',
      '████ '
    ],
    'A': [
      ' ███ ',
      '█   █',
      '█████',
      '█   █',
      '█   █'
    ],
    'L': [
      '█    ',
      '█    ',
      '█    ',
      '█    ',
      '█████'
    ],
    'T': [
      '█████',
      '  █  ',
      '  █  ',
      '  █  ',
      '  █  '
    ],
    'F': [
      '█████',
      '█    ',
      '████ ',
      '█    ',
      '█    '
    ],
    'R': [
      '████ ',
      '█   █',
      '████ ',
      '█  █ ',
      '█   █'
    ],
    'E': [
      '█████',
      '█    ',
      '████ ',
      '█    ',
      '█████'
    ],
    ' ': [
      '     ',
      '     ',
      '     ',
      '     ',
      '     '
    ]
  };

  const text = 'SALT FREE';
  const characters = text.split('');
  const lines: string[] = ['', '', '', '', ''];
  
  characters.forEach((char, index) => {
    const asciiChar = displayLetters[char] || displayLetters[' '];
    asciiChar.forEach((line, lineIndex) => {
      lines[lineIndex] += line + (index < characters.length - 1 ? '  ' : '');
    });
  });
  
  return lines.join('\n');
};

const GameDashboard: React.FC<GameDashboardProps> = ({ 
  filter, 
  view
}) => {
  const account = useActiveAccount();
  const navigate = useNavigate();
  const { games, loading, error, fetchRecentGames, addFoundGame } = useGameData();
  const { user } = useUser();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showFindModal, setShowFindModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null);
  const [joinGameCode, setJoinGameCode] = useState<string>('');
  
  // New modal states for database features
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showGameListsModal, setShowGameListsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [joinAsJudge, setJoinAsJudge] = useState(false);
  const [isShareDashboardCopied, setIsShareDashboardCopied] = useState(false);

  // Filter games and deduplicate by game code
  const filteredGames = games
    .filter(game => {
      // Apply URL-based filter first
      if (filter === 'active') {
        // Active games are: not locked, not completed, and not full
        return !game.isLocked && !game.isCompleted && game.playerCount < game.maxPlayers;
      }
      if (filter === 'mine' && account?.address) {
        // User's games are where they are host or player
        const userAddress = account.address.toLowerCase();
        return game.host?.toLowerCase() === userAddress ||
               game.players?.some(p => p?.toLowerCase() === userAddress);
      }
      
      return true; // Show all games by default
    })
    // Remove duplicates by game code, keep the most recent one
    .reduce((unique: any[], game: any) => {
      const existingIndex = unique.findIndex(g => g.code === game.code);
      if (existingIndex === -1) {
        unique.push(game);
      } else {
        // Keep the one with the higher block number (more recent)
        if (game.blockNumber > unique[existingIndex].blockNumber) {
          unique[existingIndex] = game;
        }
      }
      return unique;
    }, []);

  // Debug: log games state changes and fetch judges for new games - force reload
  useEffect(() => {
    console.log(`GameDashboard games state updated:`, games);
    console.log(`Games count: ${games.length}`);
    
  }, [games]);

  // URL parameters are now handled by dedicated GameDetailPage component

  // Pre-load ENS name when user connects wallet
  useEffect(() => {
    if (account?.address) {
      // Background ENS resolution for better UX
      ensCache.resolveENS(account.address).catch(() => {
        // Silently handle ENS resolution failures
      });
    }
  }, [account?.address]);

  // Removed automatic game fetching - users now manually trigger it
  // useEffect(() => {
  //   if (account) {
  //     fetchRecentGames(account.address);
  //   }
  // }, [account, fetchRecentGames]);

  const handleGameClick = (game: any) => {
    setSelectedGame(game);
  };

  const handleJoinGame = (gameCode: string) => {
    setJoinGameCode(gameCode);
    setJoinAsJudge(false); // Always join as player
    setShowJoinModal(true);
  };

  const handleShareDashboard = async () => {
    // Get top 5 games from filtered games
    const top5Games = filteredGames.slice(0, 5);
    if (top5Games.length === 0) {
      return; // No games to share
    }
    
    const gameCodes = top5Games.map(game => game.code || game.gameCode).filter(code => code);
    const shareUrl = `${window.location.origin}/game/${gameCodes.join('/')}/`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      
      // Visual feedback for dashboard share
      setIsShareDashboardCopied(true);
      setTimeout(() => {
        setIsShareDashboardCopied(false);
      }, 1500);
      
      toast.success('Dashboard link copied!');
    } catch (err) {
      console.error('Failed to copy dashboard URL:', err);
      toast.error('Failed to copy dashboard link');
    }
  };



  const handleGameCreated = async (gameData: { 
    gameCode: string; 
    buyIn: string; 
    maxPlayers: number; 
    transactionHash?: string; 
    blockNumber?: number 
  }) => {
    setShowCreateModal(false);
    console.log('Game created successfully:', {
      gameCode: gameData.gameCode,
      buyIn: gameData.buyIn,
      maxPlayers: gameData.maxPlayers,
      transactionHash: gameData.transactionHash,
      blockNumber: gameData.blockNumber
    });
    
    // Handle pending transactions with background monitoring
    if (gameData.gameCode === 'PENDING' && gameData.transactionHash && account?.address) {
      console.log('🔄 Starting background transaction monitoring for:', gameData.transactionHash);
      
      // Show persistent toast with transaction monitoring
      const TransactionMonitoringToast: React.FC<{ toastId: string }> = ({ toastId }) => {
        const [status, setStatus] = React.useState<TransactionStatus>({ status: 'pending' });
        
        // Start monitoring when component mounts
        React.useEffect(() => {
            const poller = createTransactionPoller(
              gameData.transactionHash!,
              account.address,
              (newStatus) => {
                console.log('📊 Transaction status update:', newStatus);
                setStatus(newStatus);
                
                if (newStatus.status === 'complete' && newStatus.gameCode) {
                  // Transaction completed successfully
                  toast.dismiss(toastId);
                  
                  // Add completed game to dashboard
                  addFoundGame(newStatus.gameCode, account.address)
                    .then(() => {
                      toast.success(
                        `Game ${newStatus.gameCode} added to dashboard!`,
                        { duration: 5000 }
                      );
                    })
                    .catch(() => {
                      toast.success(
                        `Game ${newStatus.gameCode} is ready! Use "Find Game" to add it.`,
                        { duration: 8000 }
                      );
                    });
                } else if (newStatus.status === 'timeout' || newStatus.status === 'failed') {
                  // Transaction failed or timed out
                  toast.dismiss(toastId);
                  
                  toast.error(
                    (errorT) => (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontWeight: '600' }}>
                          ⏰ Transaction {newStatus.status === 'timeout' ? 'Took Too Long' : 'Failed'}
                        </div>
                        <div style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                          {newStatus.error || 'Transaction monitoring exceeded 3 minutes. It may still complete - check Etherscan.'}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://basescan.org/tx/${gameData.transactionHash}`, '_blank');
                              toast.dismiss(errorT.id);
                            }}
                            style={{
                              background: 'rgba(34, 197, 94, 0.3)',
                              border: '1px solid rgba(34, 197, 94, 0.5)',
                              borderRadius: '6px',
                              color: 'rgba(255, 255, 255, 0.9)',
                              padding: '6px 12px',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            🔍 Check Transaction Status
                          </button>
                        </div>
                      </div>
                    ),
                    { duration: 15000 }
                  );
                }
              },
              30, // Check every 30 seconds - be patient
              180000 // Timeout after 3 minutes
            );
            
            poller.start();
            
          return () => {
            poller.stop();
          };
        }, []);
        
        const getStatusEmoji = () => {
          switch (status.status) {
            case 'pending': return '[...]';
            case 'confirming': return '[~]';
            case 'confirmed': return '[✓]';
            case 'extracting': return '[?]';
            case 'complete': return '[•]';
            case 'failed': return '[X]';
            case 'timeout': return '[T]';
            default: return '[.]';
          }
        };
        
        const getStatusText = () => {
          switch (status.status) {
            case 'pending': return 'Submitting transaction...';
            case 'confirming': return 'Waiting for confirmation...';
            case 'confirmed': return 'Transaction confirmed!';
            case 'extracting': return 'Finding your game (this may take 1-3 minutes)...';
            case 'complete': return `Game ${status.gameCode} ready!`;
            case 'failed': return 'Transaction failed';
            case 'timeout': return 'Taking longer than expected';
            default: return 'Processing...';
          }
        };
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>{getStatusEmoji()}</span>
              <div style={{ fontWeight: '600' }}>
                {getStatusText()}
              </div>
            </div>
            <div style={{ 
              fontFamily: 'Monaco, monospace', 
              fontSize: '0.9rem',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '4px'
            }}>
              {gameData.transactionHash?.slice(0, 10)}...{gameData.transactionHash?.slice(-8)}
            </div>
            {status.blockNumber && (
              <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                Block: {status.blockNumber}
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://basescan.org/tx/${gameData.transactionHash}`, '_blank');
              }}
              style={{
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.9)',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              🔍 View Transaction
            </button>
          </div>
        );
      };
      
      const monitoringToast = toast(
        (t) => <TransactionMonitoringToast toastId={t.id} />,
        {
          duration: Infinity, // Keep toast open until dismissed
          style: {
            maxWidth: '400px',
          }
        }
      );
      
      return; // Exit early for pending transactions
    }
    
    // Handle completed transactions (original logic)
    const copyGameCode = () => {
      navigator.clipboard.writeText(gameData.gameCode)
        .then(() => toast.success('Game code copied!'))
        .catch(() => toast.error('Failed to copy game code'));
    };
    
    const addToDashboard = async () => {
      try {
        if (account?.address) {
          await addFoundGame(gameData.gameCode, account.address);
          toast.success('Game added to dashboard!');
        }
      } catch (error) {
        toast.error('Failed to add game to dashboard');
      }
    };
    
    // Custom toast with action buttons for completed games
    toast.success(
      (t) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>
            Game Created!
          </div>
          <div style={{ 
            fontFamily: 'Monaco, monospace', 
            fontSize: '1.1rem',
            fontWeight: '700',
            color: '#7877C6',
            letterSpacing: '1px',
            marginBottom: '8px'
          }}>
            {gameData.gameCode}
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.85rem' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyGameCode();
              }}
              style={{
                background: 'rgba(120, 119, 198, 0.2)',
                border: '1px solid rgba(120, 119, 198, 0.4)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.9)',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              📋 Copy Code
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/game/${gameData.gameCode}`);
                toast.dismiss(t.id);
              }}
              style={{
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.9)',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              🔗 Open Game
            </button>
          </div>
        </div>
      ),
      {
        duration: 8000,
        style: {
          maxWidth: '320px',
        }
      }
    );
    
    // Note: Game auto-add is now handled by background transaction monitoring
    // The TransactionMonitoringToast (above) automatically adds completed games
    // No need for duplicate auto-add logic here since all new games use PENDING flow
  };

  const handleGameJoined = (gameData?: { gameCode: string; buyIn: string; maxPlayers: number }) => {
    setShowJoinModal(false);
    setJoinGameCode('');
    // Game will be automatically refreshed only when user clicks refresh
    console.log('Game joined:', gameData?.gameCode);
  };

  if (!account) {
    return (
      <DashboardContainer>
        <WelcomeSection>
          <SectionTitle>Welcome to SaltFree! 🧂</SectionTitle>
          <p style={{ fontSize: '1.1rem', marginBottom: '2rem', color: 'rgba(255, 255, 255, 0.8)' }}>
            Connect your wallet for salt-free gaming and payouts.
          </p>
          <div className="emoji">
            ◆ ♠ ♥ ♦ ♣
          </div>
        </WelcomeSection>
      </DashboardContainer>
    );
  }


  // Create meta data for current dashboard view
  const shareUrl = window.location.origin + window.location.pathname;
  const shareTitle = filter === 'active' ? 'Active Games on SaltFree!' 
    : filter === 'mine' ? 'My Salt-Free Games'
    : view === 'leaderboard' ? 'SaltFree Leaderboard'
    : 'SaltFree - Salt-Free Gaming & Payouts';
  const shareDescription = 'Play games, win money, zero salt. The degen way to settle bets.';

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
      
      {/* CRT Marquee Display */}
      <CRTContainer>
        <CRTDisplay>
          <CRTScreen>
            <ScrollingContent>
              <ScrollingTitle>
                {generateSaltFreeASCII()}
              </ScrollingTitle>
              <ScrollingSubtitle>
                don't let salty degens get you down
              </ScrollingSubtitle>
            </ScrollingContent>
          </CRTScreen>
        </CRTDisplay>
      </CRTContainer>
      
      <DashboardContainer>
      {/* Welcome Section */}
      <WelcomeSection>
        <SectionTitle>
          {user?.username ? `Welcome back, ${user.username}!` : 'Welcome back!'}
        </SectionTitle>
        <FlexBlock direction="column" align="center" gap="0.5rem" style={{ marginBottom: '2rem' }}>
          {user?.username ? (
            <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
              Connected as {getDisplayNameByAddressSync(account.address)}
            </p>
          ) : (
            <p style={{ fontSize: '1rem', color: 'rgba(255, 255, 255, 0.7)', margin: 0 }}>
              Connected as {getDisplayNameByAddressSync(account.address)}
            </p>
          )}
        </FlexBlock>
        <FlexBlock justify="center" gap="1rem" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <BlockButton 
            onClick={() => setShowFindModal(true)}
            size="lg"
          >
            <Search size={20} />
            Find
          </BlockButton>
          <BlockButton 
            variant="secondary"
            onClick={() => setShowCreateModal(true)}
            size="lg"
          >
            <Plus size={20} />
            Create Game
          </BlockButton>
          <BlockButton 
            variant="secondary"
            onClick={() => setShowJoinModal(true)}
            size="lg"
          >
            <Users size={20} />
            Join with Code
          </BlockButton>
          <BlockButton 
            variant="secondary"
            onClick={() => account && fetchRecentGames(account.address)}
            $loading={loading}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Load My Games
          </BlockButton>
        </FlexBlock>
        
        {/* User Dropdown Menu - Positioned as part of the main actions */}
        <FlexBlock justify="center">
          <UserDropdown
            onEditUsername={() => setShowUsernameModal(true)}
            onGameLists={() => setShowGameListsModal(true)}
            onGameHistory={() => setShowHistoryModal(true)}
            walletAddress={account.address}
          />
        </FlexBlock>
      </WelcomeSection>

      {error && (
        <div style={{ 
          background: 'rgba(239, 68, 68, 0.15)', 
          border: '1.5px solid rgba(239, 68, 68, 0.4)', 
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          boxShadow: '0 8px 32px rgba(239, 68, 68, 0.1)'
        }}>
          <p style={{ color: '#ff6b6b', margin: 0, fontWeight: '500' }}>{error}</p>
        </div>
      )}

      {/* Games Section */}
      <SectionHeader>
        <SectionTitle>My Games ({games.length})</SectionTitle>
        <p style={{ fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.6)', margin: '0 0 1rem 0' }}>
          {loading ? 'Loading your games...' : 'Games you\'ve created or joined (click "Load My Games" to refresh)'}
        </p>
        
        {/* Share Games Button */}
        <FlexBlock justify="center" gap="0.5rem" style={{ marginBottom: '1rem' }}>
          <BlockButton
            variant="secondary"
            onClick={handleShareDashboard}
            disabled={games.length === 0}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: isShareDashboardCopied ? blockTheme.success : blockTheme.pastelLavender
            }}
            title={`Share top ${Math.min(5, games.length)} games`}
          >
            {isShareDashboardCopied ? (
              <>
                <Check size={14} />
                Link Copied!
              </>
            ) : (
              <>
                <Share2 size={14} />
                Share Games
              </>
            )}
          </BlockButton>
        </FlexBlock>
      </SectionHeader>
      
      {loading ? (
        <Block style={{ textAlign: 'center', padding: '3rem' }}>
          <SimpleRetroLoader />
          <p style={{ marginTop: '1rem', color: 'rgba(255, 255, 255, 0.8)' }}>Loading games...</p>
        </Block>
      ) : (() => {
        console.log(`RENDER: filteredGames.length = ${filteredGames.length}, filteredGames =`, filteredGames);
        return filteredGames.length === 0;
      })() ? (
        <EmptyState>
          <div className="emoji">{games.length === 0 ? '[?]' : '[•]'}</div>
          <h3>{games.length === 0 ? 'No games loaded yet' : `No ${gameFilter === 'all' ? '' : gameFilter} games found`}</h3>
          <p>{games.length === 0 ? 'Start by searching for a game to join, or create your own game!' : `You don't have any ${gameFilter === 'all' ? '' : gameFilter} games. Try a different filter or create a new game.`}</p>
          <FlexBlock justify="center" gap="1rem" style={{ marginTop: '1.5rem' }}>
            <BlockButton onClick={() => setShowFindModal(true)}>
              <Search size={16} />
              Find Game
            </BlockButton>
            <BlockButton variant="secondary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              Create Game
            </BlockButton>
          </FlexBlock>
        </EmptyState>
      ) : (
        <GamesGrid>
          <AnimatePresence>
            {filteredGames.map((game, index) => (
              <ErrorBoundarySection key={`section-${game.code}`}>
                <ModernGameCard 
                  key={game.code} 
                  game={game} 
                  currentUser={account?.address || ''}
                  onClick={() => handleGameClick(game)}
                  onJoinGame={handleJoinGame}
                  index={index}
                  account={account}
                  user={user}
                />
              </ErrorBoundarySection>
            ))}
          </AnimatePresence>
        </GamesGrid>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateGameModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleGameCreated}
          />
        )}
        
        {showJoinModal && (
          <JoinGameModal
            onClose={() => {
              setShowJoinModal(false);
              setJoinGameCode('');
              setJoinAsJudge(false);
            }}
            onSuccess={handleGameJoined}
            initialGameCode={joinGameCode}
            joinAsJudge={joinAsJudge}
          />
        )}

        {showFindModal && (
          <FindGameModal
            onClose={() => setShowFindModal(false)}
            onSuccess={() => {
              // Game is already added by FindGameModal, no need to refresh
              console.log('Game found and added to dashboard');
            }}
          />
        )}

        {/* New Database Feature Modals */}
        {showUsernameModal && (
          <UsernameModal
            isOpen={showUsernameModal}
            onClose={() => setShowUsernameModal(false)}
          />
        )}

        {showGameListsModal && (
          <GameListsModal
            isOpen={showGameListsModal}
            onClose={() => setShowGameListsModal(false)}
          />
        )}

        {showHistoryModal && (
          <GameHistoryModal
            isOpen={showHistoryModal}
            onClose={() => setShowHistoryModal(false)}
          />
        )}


        {selectedGame && (
          <GameDetailModal 
            game={{
              code: selectedGame.gameCode || selectedGame.code,
              host: selectedGame.host,
              buyIn: selectedGame.buyIn,
              maxPlayers: selectedGame.maxPlayers,
              playerCount: selectedGame.playerCount,
              userRole: 'unknown' as const
            }} 
            onClose={() => setSelectedGame(null)}
            onRefresh={() => account && fetchRecentGames(account.address)}
          />
        )}
      </AnimatePresence>
    </DashboardContainer>
    </>
  );
};

const ModernGameCard: React.FC<{
  game: any; // Using any for now to handle both GameInfo and GameData
  currentUser: string;
  onClick: () => void;
  onJoinGame?: (gameCode: string) => void;
  index: number;
  account?: any;
  user?: any;
}> = ({ game, currentUser, onClick, onJoinGame, index, account, user }) => {
  const [isShareCopied, setIsShareCopied] = useState(false);
  // Preload display names for host and players if not current user
  React.useEffect(() => {
    if (!game) return; // Early exit if no game
    
    const addressesToPreload: string[] = [];
    
    // Add host if not current user
    if (game.host && game.host !== currentUser) {
      addressesToPreload.push(game.host);
    }
    
    // Add players if not current user
    if (game.players && Array.isArray(game.players)) {
      game.players.forEach((player: string) => {
        if (player && player !== currentUser) {
          addressesToPreload.push(player);
        }
      });
    }
    
    // Preload if we have addresses
    if (addressesToPreload.length > 0) {
      preloadDisplayNames(addressesToPreload);
    }
  }, [game, currentUser]);

  // Defensive checks to prevent errors
  if (!game) {
    return null;
  }
  
  const gameCode = game.gameCode || game.code || 'UNKNOWN'; // Handle both formats
  const isHost = game.host && currentUser ? game.host.toLowerCase() === currentUser.toLowerCase() : false;
  const hasJoined = game.players?.some((p: string) => 
    currentUser && p && p.toLowerCase() === currentUser.toLowerCase()
  ) || false;
  const canJoin = !isHost && !hasJoined && 
                  (game.playerCount || 0) < (game.maxPlayers || 0) && onJoinGame;

  // Winner status checks - only show as winner if they actually have a prize
  const isUserWinner = (game.isUserWinner && game.userHasActualPrize !== false) || false;
  const winningsClaimed = game.winningsClaimed || game.hasUserClaimedWinnings || false;
  const isCompleted = game.isCompleted || winningsClaimed;

  const handleCopyGameCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(gameCode);
      toast.success('Game code copied!');
    } catch (err) {
      console.error('Failed to copy game code:', err);
      toast.error('Failed to copy game code');
    }
  };

  const handleJoinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onJoinGame) {
      onJoinGame(gameCode); // Always join as player
    }
  };

  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/game/${gameCode}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      
      // Visual feedback for share button
      setIsShareCopied(true);
      setTimeout(() => {
        setIsShareCopied(false);
      }, 1500);
      
      toast.success('Game link copied!');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      toast.error('Failed to copy game link');
    }
  };

  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/game/${gameCode}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };


  return (
    <PagerDevice
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: isUserWinner ? -10 : -8 }}
      whileTap={{ scale: 0.98 }}
      $isWinner={isUserWinner}
      $isCompleted={isCompleted}
      $isUserHost={isHost}
    >
      
      <GameHeader>
        <FlexBlock align="center" gap="1rem" style={{ width: '100%' }}>
          {/* Pager section with screen, action buttons, and details button */}
          <FlexBlock direction="column" gap="0.5rem" align="center" style={{ width: '100%' }}>
            {/* ASCII Art Game Code */}
            <PagerDisplay 
              onClick={handleCopyGameCode}
              title="Click to copy game code"
            >
              {generateCompactASCII(gameCode)}
            </PagerDisplay>
            
            {/* Action buttons row */}
            <FlexBlock gap="0.5rem" justify="center" align="center">
              {isShareCopied ? (
                <BlockButton
                  size="sm"
                  onClick={handleShareClick}
                  title="Link copied!"
                  style={{ 
                    backgroundColor: blockTheme.success,
                    minWidth: '60px',
                    flex: 1
                  }}
                >
                  <Check size={14} />
                  COPIED
                </BlockButton>
              ) : (
                <BlockButton
                  size="sm"
                  onClick={handleShareClick}
                  title="Share game link"
                  style={{ minWidth: '60px', flex: 1 }}
                >
                  <Share2 size={14} />
                  SHARE
                </BlockButton>
              )}
              <BlockButton
                size="sm"
                onClick={handleOpenInNewTab}
                title="Open in new tab"
                style={{ minWidth: '60px', flex: 1 }}
              >
                <ExternalLink size={14} />
                OPEN
              </BlockButton>
            </FlexBlock>
            
            {/* Full-width Details button */}
            <BlockButton
              size="sm"
              onClick={onClick}
              title="View game details"
              style={{ 
                width: '100%',
                padding: '0.375rem 0.75rem'
              }}
            >
              DETAILS
            </BlockButton>
          </FlexBlock>
        </FlexBlock>
        
        <FlexBlock direction="column" align="center" gap="0.5rem">
          {/* Winner badges - highest priority */}
          {isUserWinner && !winningsClaimed && (
            <TrophyBadge size="sm" showSparkles={true}>
              WINNER!
            </TrophyBadge>
          )}
          {isUserWinner && winningsClaimed && (
            <ClaimedWinningsBadge 
              variant="success" 
              size="sm"
              amount={game.winningsAmount}
              showAmount={!!game.winningsAmount}
            />
          )}
          {isCompleted && !isUserWinner && (
            <ClaimedWinningsBadge variant="subtle" size="sm">
              COMPLETE
            </ClaimedWinningsBadge>
          )}
          
          {/* Role badges */}
          {isHost && !isUserWinner && (
            <GameBadge variant="host">HOST</GameBadge>
          )}
          {hasJoined && !isHost && !isUserWinner && (
            <GameBadge variant="player">JOINED</GameBadge>
          )}
          
        </FlexBlock>
      </GameHeader>
    </PagerDevice>
  );
};

// Helper function to get current block number
async function getCurrentBlock(): Promise<number> {
  try {
    const response = await fetch('https://mainnet.base.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
    });
    const data = await response.json();
    return parseInt(data.result, 16);
  } catch (error) {
    console.warn('Failed to get current block number:', error);
    return 0;
  }
}

export default GameDashboard;