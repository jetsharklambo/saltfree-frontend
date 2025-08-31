import React, { useState, useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { readContract } from 'thirdweb';
import { Plus, Users, Clock, Lock, RefreshCw, Search, Trophy, Share2, Copy, Check } from 'lucide-react';
import { getGameContract, formatAddress, formatEth, decodeStringFromHex } from '../thirdweb';
import { getDisplayNameByAddress, getDisplayNameByAddressSync, preloadUsernames, preloadDisplayNames } from '../utils/userUtils';
import { ensCache } from '../utils/ensUtils';
import { 
  GlassCard, 
  GlassButton, 
  GlassInput,
  FlexContainer, 
  LoadingSpinner,
  glassTheme 
} from '../styles/glass';
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
import JoinDropdown from './JoinDropdown';
import { ErrorBoundarySection } from './GracefulErrorBoundary';
import { validation } from '../utils/envUtils';
import { logger, logGameAction } from '../utils/logger';
import WinnerBadge, { TrophyBadge, CrownBadge } from './WinnerBadge';
import ClaimedWinningsBadge, { CrossedOutPot } from './ClaimedWinningsBadge';

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
  unanimousJudges?: string[];
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

const WelcomeSection = styled.div`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 2rem;
  text-align: center;
  margin-bottom: 2.5rem;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
`;

const GamesGrid = styled.div`
  display: grid;
  gap: 2rem;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  padding: 1rem 0;
  
  @media (max-width: 768px) {
    gap: 1.5rem;
    grid-template-columns: 1fr;
  }
`;

const GameCard = styled(motion.div)<{ 
  $isWinner?: boolean; 
  $isCompleted?: boolean;
  $isUserHost?: boolean;
}>`
  background: ${({ $isWinner, $isCompleted }) => {
    if ($isWinner) return 'rgba(255, 215, 0, 0.12)';
    if ($isCompleted) return 'rgba(156, 163, 175, 0.08)';
    return 'rgba(255, 255, 255, 0.1)';
  }};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1.5px solid ${({ $isWinner, $isCompleted }) => {
    if ($isWinner) return 'rgba(255, 215, 0, 0.4)';
    if ($isCompleted) return 'rgba(156, 163, 175, 0.3)';
    return 'rgba(255, 255, 255, 0.2)';
  }};
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: ${({ $isWinner, $isCompleted }) => {
    if ($isWinner) return `
      0 8px 32px rgba(255, 215, 0, 0.2),
      0 0 40px rgba(255, 215, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.3)
    `;
    if ($isCompleted) return `
      0 8px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1)
    `;
    return `
      0 8px 32px rgba(0, 0, 0, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.2)
    `;
  }};
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  
  ${({ $isWinner }) => $isWinner && `
    animation: winner-glow 4s ease-in-out infinite;
    
    @keyframes winner-glow {
      0%, 100% { 
        box-shadow: 
          0 8px 32px rgba(255, 215, 0, 0.2),
          0 0 40px rgba(255, 215, 0, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.3);
      }
      50% { 
        box-shadow: 
          0 12px 40px rgba(255, 215, 0, 0.3),
          0 0 60px rgba(255, 215, 0, 0.15),
          inset 0 1px 0 rgba(255, 255, 255, 0.4);
      }
    }
  `}
  
  &:hover {
    transform: ${({ $isWinner }) => $isWinner ? 'translateY(-6px) scale(1.02)' : 'translateY(-4px)'};
    background: ${({ $isWinner, $isCompleted }) => {
      if ($isWinner) return 'rgba(255, 215, 0, 0.18)';
      if ($isCompleted) return 'rgba(156, 163, 175, 0.12)';
      return 'rgba(255, 255, 255, 0.15)';
    }};
    border-color: ${({ $isWinner, $isCompleted }) => {
      if ($isWinner) return 'rgba(255, 215, 0, 0.6)';
      if ($isCompleted) return 'rgba(156, 163, 175, 0.4)';
      return 'rgba(255, 255, 255, 0.3)';
    }};
    box-shadow: ${({ $isWinner, $isCompleted }) => {
      if ($isWinner) return `
        0 20px 60px rgba(255, 215, 0, 0.3),
        0 0 80px rgba(255, 215, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.4)
      `;
      if ($isCompleted) return `
        0 16px 48px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.2)
      `;
      return `
        0 16px 48px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.3)
      `;
    }};
  }
  
  @media (max-width: 768px) {
    padding: 1rem;
    border-radius: 12px;
  }
`;

const GameHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
`;

const GameCodeTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
  
  &:hover {
    color: ${glassTheme.primary};
  }
`;

const GameStats = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
`;

const GameBadge = styled.div<{ variant: 'host' | 'player' | 'judge-eligible' }>`
  background: ${({ variant }) => {
    switch (variant) {
      case 'host':
        return 'linear-gradient(135deg, rgba(102, 126, 234, 0.9), rgba(118, 75, 162, 0.9))';
      case 'player':
        return 'linear-gradient(135deg, rgba(81, 207, 102, 0.9), rgba(64, 192, 87, 0.9))';
      case 'judge-eligible':
        return 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))';
      default:
        return 'linear-gradient(135deg, rgba(81, 207, 102, 0.9), rgba(64, 192, 87, 0.9))';
    }
  }};
  color: white;
  padding: 0.4rem 0.9rem;
  border-radius: 14px;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
`;

const SectionHeader = styled.div`
  margin-bottom: 2rem;
  text-align: center;
`;

const SectionTitle = styled.h2`
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), ${glassTheme.primary});
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const EmptyState = styled.div`
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  text-align: center;
  padding: 3rem 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  
  .emoji {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.8;
  }
  
  h3 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: rgba(255, 255, 255, 0.9);
  }
  
  p {
    color: rgba(255, 255, 255, 0.6);
    font-size: 1rem;
  }
`;

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
  const [unanimousJudgesCache, setUnanimousJudgesCache] = useState<Map<string, string[]>>(new Map());
  const [gameFilter, setGameFilter] = useState<'all' | 'locked' | 'unlocked'>('all');

  // Filter games based on lock status
  const filteredGames = games.filter(game => {
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
    
    // Apply local gameFilter (from filter buttons)
    if (gameFilter === 'locked') return game.isLocked;
    if (gameFilter === 'unlocked') return !game.isLocked;
    return true; // 'all'
  });

  // Debug: log games state changes and fetch judges for new games
  useEffect(() => {
    console.log(`🎮 GameDashboard games state updated:`, games);
    console.log(`🎮 Games count: ${games.length}`);
    
    // Fetch unanimous judges for new games
    games.forEach(game => {
      if (game.code && !unanimousJudgesCache.has(game.code)) {
        fetchUnanimousJudges(game.code);
      }
    });
  }, [games, unanimousJudgesCache]);

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

  const handleJoinGame = (gameCode: string, joinAsJudge: boolean = false) => {
    setJoinGameCode(gameCode);
    setJoinAsJudge(joinAsJudge);
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
    } catch (err) {
      console.error('Failed to copy dashboard URL:', err);
      // Fallback: show URL in an alert
      alert(`Dashboard URL: ${shareUrl}`);
    }
  };


  // Function to fetch unanimous judges for a game
  const fetchUnanimousJudges = async (gameCode: string) => {
    try {
      const contract = getGameContract();
      const judges = await readContract({
        contract,
        method: "function getUnanimousJudges(string code) view returns (address[] judges)",
        params: [gameCode],
      }) as string[];
      
      console.log(`🏛️ Unanimous judges for ${gameCode}:`, judges);
      
      // Update cache
      setUnanimousJudgesCache(prev => new Map(prev.set(gameCode, judges || [])));
      return judges || [];
    } catch (error) {
      console.warn(`Failed to fetch unanimous judges for ${gameCode}:`, error);
      return [];
    }
  };

  // Check if current user is eligible to be judge for a game
  const isUserEligibleJudge = (gameCode: string, userAddress: string): boolean => {
    const judges = unanimousJudgesCache.get(gameCode) || [];
    return judges.some(judge => judge.toLowerCase() === userAddress.toLowerCase());
  };

  const handleGameCreated = async (gameData: { gameCode: string; buyIn: string; maxPlayers: number }) => {
    setShowCreateModal(false);
    console.log('Game created:', gameData.gameCode);
    
    // Automatically add the created game to the dashboard
    try {
      if (account?.address) {
        console.log('🎯 Auto-adding created game to dashboard:', gameData.gameCode);
        await addFoundGame(gameData.gameCode, account.address);
        console.log('✅ Successfully added created game to dashboard');
      }
    } catch (error) {
      console.error('❌ Failed to add created game to dashboard:', error);
      // Don't show error to user since the game was created successfully
    }
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
          <SectionTitle>Welcome to Pony Up! 🐎</SectionTitle>
          <p style={{ fontSize: '1.1rem', marginBottom: '2rem', color: 'rgba(255, 255, 255, 0.8)' }}>
            Connect your wallet to start playing poker games on the blockchain.
          </p>
          <div className="emoji">
            🎲🃏♠️♥️
          </div>
        </WelcomeSection>
      </DashboardContainer>
    );
  }


  // Create meta data for current dashboard view
  const shareUrl = window.location.origin + window.location.pathname;
  const shareTitle = filter === 'active' ? 'Active Games on Pony Up!' 
    : filter === 'mine' ? 'My Games on Pony Up!'
    : view === 'leaderboard' ? 'Pony Up! Leaderboard'
    : 'Pony Up! - Blockchain Poker Games';
  const shareDescription = 'Join poker games on the blockchain. Connect your wallet and start playing!';

  return (
    <>
      <Helmet>
        <title>{shareTitle}</title>
        <meta name="description" content={shareDescription} />
        <meta property="og:title" content={shareTitle} />
        <meta property="og:description" content={shareDescription} />
        <meta property="og:url" content={shareUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${window.location.origin}/pony-up-social.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={shareTitle} />
        <meta name="twitter:description" content={shareDescription} />
        <meta name="twitter:image" content={`${window.location.origin}/pony-up-social.png`} />
      </Helmet>
      <DashboardContainer>
      {/* Welcome Section */}
      <WelcomeSection>
        <SectionTitle>
          {user?.username ? `Welcome back, ${user.username}! 🎉` : 'Welcome back! 🎉'}
        </SectionTitle>
        <FlexContainer direction="column" align="center" gap="0.5rem" style={{ marginBottom: '2rem' }}>
          {user?.username ? (
            <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
              Connected as {getDisplayNameByAddressSync(account.address)}
            </p>
          ) : (
            <p style={{ fontSize: '1rem', color: 'rgba(255, 255, 255, 0.7)', margin: 0 }}>
              Connected as {getDisplayNameByAddressSync(account.address)}
            </p>
          )}
        </FlexContainer>
        <FlexContainer justify="center" gap="1rem" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <GlassButton 
            onClick={() => setShowFindModal(true)}
            size="lg"
          >
            <Search size={20} />
            Find
          </GlassButton>
          <GlassButton 
            variant="secondary"
            onClick={() => setShowCreateModal(true)}
            size="lg"
          >
            <Plus size={20} />
            Create Game
          </GlassButton>
          <GlassButton 
            variant="secondary"
            onClick={() => setShowJoinModal(true)}
            size="lg"
          >
            <Users size={20} />
            Join with Code
          </GlassButton>
          <GlassButton 
            variant="secondary"
            onClick={() => account && fetchRecentGames(account.address)}
            $loading={loading}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Load My Games
          </GlassButton>
        </FlexContainer>
        
        {/* User Dropdown Menu - Positioned as part of the main actions */}
        <FlexContainer justify="center">
          <UserDropdown
            onEditUsername={() => setShowUsernameModal(true)}
            onGameLists={() => setShowGameListsModal(true)}
            onGameHistory={() => setShowHistoryModal(true)}
            walletAddress={account.address}
          />
        </FlexContainer>
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
          {loading ? 'Loading your games from blockchain...' : 'Games you\'ve created or joined (click "Load My Games" to refresh)'}
        </p>
        
        {/* Filter Controls */}
        <FlexContainer justify="center" gap="0.5rem" style={{ marginBottom: '1rem' }}>
          <GlassButton
            variant={gameFilter === 'all' ? 'primary' : 'secondary'}
            onClick={() => setGameFilter('all')}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: gameFilter === 'all' ? '#7877c6' : 'rgba(255, 255, 255, 0.05)'
            }}
          >
            All ({games.length})
          </GlassButton>
          <GlassButton
            variant={gameFilter === 'unlocked' ? 'primary' : 'secondary'}
            onClick={() => setGameFilter('unlocked')}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: gameFilter === 'unlocked' ? '#22c55e' : 'rgba(255, 255, 255, 0.05)'
            }}
          >
            Open ({games.filter(g => !g.isLocked).length})
          </GlassButton>
          <GlassButton
            variant={gameFilter === 'locked' ? 'primary' : 'secondary'}
            onClick={() => setGameFilter('locked')}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: gameFilter === 'locked' ? '#ef4444' : 'rgba(255, 255, 255, 0.05)'
            }}
          >
            Locked ({games.filter(g => g.isLocked).length})
          </GlassButton>
          
          {/* Share Games Button */}
          <GlassButton
            variant="secondary"
            onClick={handleShareDashboard}
            disabled={filteredGames.length === 0}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: isShareDashboardCopied ? glassTheme.success : 'rgba(255, 255, 255, 0.05)',
              marginLeft: '1rem'
            }}
            title={`Share top ${Math.min(5, filteredGames.length)} games`}
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
          </GlassButton>
        </FlexContainer>
      </SectionHeader>
      
      {loading ? (
        <GlassCard style={{ textAlign: 'center', padding: '3rem' }}>
          <LoadingSpinner />
          <p style={{ marginTop: '1rem', color: 'rgba(255, 255, 255, 0.8)' }}>Loading games...</p>
        </GlassCard>
      ) : (() => {
        console.log(`🎮 RENDER: filteredGames.length = ${filteredGames.length}, filteredGames =`, filteredGames);
        return filteredGames.length === 0;
      })() ? (
        <EmptyState>
          <div className="emoji">{games.length === 0 ? '🔍' : '🎯'}</div>
          <h3>{games.length === 0 ? 'No games loaded yet' : `No ${gameFilter === 'all' ? '' : gameFilter} games found`}</h3>
          <p>{games.length === 0 ? 'Start by searching for a game to join, or create your own game!' : `You don't have any ${gameFilter === 'all' ? '' : gameFilter} games. Try a different filter or create a new game.`}</p>
          <FlexContainer justify="center" gap="1rem" style={{ marginTop: '1.5rem' }}>
            <GlassButton onClick={() => setShowFindModal(true)}>
              <Search size={16} />
              Find Game
            </GlassButton>
            <GlassButton variant="secondary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              Create Game
            </GlassButton>
          </FlexContainer>
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
                  isUserEligibleJudge={isUserEligibleJudge}
                  onEligibilityCheck={fetchUnanimousJudges}
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
  onJoinGame?: (gameCode: string, joinAsJudge?: boolean) => void;
  index: number;
  account?: any;
  user?: any;
  isUserEligibleJudge: (gameCode: string, userAddress: string) => boolean;
  onEligibilityCheck: (gameCode: string) => void;
}> = ({ game, currentUser, onClick, onJoinGame, index, account, user, isUserEligibleJudge, onEligibilityCheck }) => {
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

  // Winner status checks
  const isUserWinner = game.isUserWinner || false;
  const winningsClaimed = game.winningsClaimed || game.hasUserClaimedWinnings || false;
  const isCompleted = game.isCompleted || winningsClaimed;

  const handleCopyGameCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(gameCode);
      // Simple visual feedback
      const element = e.currentTarget as HTMLElement;
      const originalText = element.innerHTML;
      element.innerHTML = '✓ Copied!';
      element.style.color = glassTheme.success;
      setTimeout(() => {
        element.innerHTML = originalText;
        element.style.color = '';
      }, 1500);
    } catch (err) {
      console.error('Failed to copy game code:', err);
    }
  };

  const handleJoinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onJoinGame) {
      onJoinGame(gameCode, false); // Default to joining as player
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
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback: show URL in an alert
      alert(`Game URL: ${shareUrl}`);
    }
  };

  return (
    <GameCard
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
        <div>
          <FlexContainer align="center" gap="0.5rem">
            <GameCodeTitle 
              onClick={handleCopyGameCode}
              title="Click to copy game code"
            >
              {gameCode}
            </GameCodeTitle>
            {isShareCopied ? (
              <Check 
                size={16} 
                onClick={handleShareClick}
                title="Link copied!"
                style={{ 
                  cursor: 'pointer', 
                  color: glassTheme.success,
                  transition: 'all 0.2s ease',
                  transform: 'scale(1.1)'
                }}
              />
            ) : (
              <Share2 
                size={16} 
                onClick={handleShareClick}
                title="Share game link"
                style={{ 
                  cursor: 'pointer', 
                  color: 'rgba(255, 255, 255, 0.6)', 
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 1)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'}
              />
            )}
          </FlexContainer>
          <GameStats>
            <FlexContainer align="center" gap="0.25rem">
              <Users size={16} />
              {game.playerCount || 0}/{game.maxPlayers || 0}
            </FlexContainer>
            {isCompleted && winningsClaimed ? (
              <CrossedOutPot 
                originalAmount={formatEth(game.buyIn || '0')}
              />
            ) : (
              <span>💰 {formatEth(game.buyIn || '0')} ETH</span>
            )}
            {game.isLocked && (
              <FlexContainer align="center" gap="0.25rem" style={{ color: '#ff6b6b' }}>
                <Lock size={16} />
                Locked
              </FlexContainer>
            )}
            {game.prizeSplits && game.prizeSplits.length > 0 && (
              <FlexContainer align="center" gap="0.25rem" style={{ color: '#7877c6', fontSize: '0.75rem' }} title={`Prize splits: ${game.prizeSplits.map((split, idx) => `${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}${(split / 10).toFixed(1)}%`).join(' ')}`}>
                <Trophy size={14} />
                Custom Prizes
              </FlexContainer>
            )}
          </GameStats>
        </div>
        
        <FlexContainer direction="column" align="flex-end" gap="0.5rem">
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
          {/* Judge eligibility badge */}
          {!hasJoined && !isCompleted && isUserEligibleJudge(gameCode, currentUser) && (
            <GameBadge variant="judge-eligible">⚖️ JUDGE ELIGIBLE</GameBadge>
          )}
          
          {/* Join button - lowest priority */}
          {canJoin && !isCompleted && (
            <JoinDropdown
              gameCode={gameCode}
              buyIn={game.buyIn || '0'}
              onJoin={(gameCode, joinAsJudge) => onJoinGame && onJoinGame(gameCode, joinAsJudge)}
              isUserEligibleJudge={isUserEligibleJudge(gameCode, currentUser)}
              onEligibilityCheck={() => onEligibilityCheck(gameCode)}
            />
          )}
        </FlexContainer>
      </GameHeader>
      
      <FlexContainer justify="space-between" align="center">
        <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
          Host: {getDisplayNameByAddressSync(game.host || '')}
        </div>
        
        {game.autoLockTime && game.autoLockTime > 0 && !game.isLocked && (
          <FlexContainer align="center" gap="0.25rem" style={{ fontSize: '0.8rem', color: '#ff6b6b' }}>
            <Clock size={14} />
            Auto-lock
          </FlexContainer>
        )}
      </FlexContainer>
    </GameCard>
  );
};

// Helper function to get current block number
async function getCurrentBlock(): Promise<number> {
  try {
    const response = await fetch('https://ethereum-sepolia.publicnode.com', {
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