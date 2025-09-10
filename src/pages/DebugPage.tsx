import React, { useState, useEffect, useMemo } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { motion, AnimatePresence } from 'framer-motion';
import styled from '@emotion/styled';
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Lock, 
  Unlock, 
  Users, 
  Scale,
  RefreshCw 
} from 'lucide-react';
import { useGameData } from '../contexts/GameDataContext';
import { getDisplayNameByAddressSync } from '../utils/userUtils';
import GameDetailModal from '../components/GameDetailModal';
import { 
  GlassCard, 
  GlassButton, 
  GlassInput,
  LoadingSpinner 
} from '../styles/glass';
import { FlexBlock, blockTheme, mediumShadow } from '../styles/blocks';

const PageContainer = styled.div`
  min-height: 100vh;
  padding: 2rem;
  background: transparent;
  
  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const Header = styled.div`
  margin-bottom: 2rem;
  text-align: center;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  margin: 0 0 0.5rem 0;
`;

const Subtitle = styled.p`
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
`;

const FiltersCard = styled(GlassCard)`
  padding: 1.5rem;
  margin-bottom: 2rem;
`;

const FilterRow = styled.div`
  display: flex;
  gap: 2rem;
  align-items: flex-start;
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
  }
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 200px;
`;

const FilterLabel = styled.label`
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const RadioGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const RadioOption = styled.label<{ checked: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s ease;
  border: 3px solid ${blockTheme.darkText};
  color: ${blockTheme.darkText};
  ${mediumShadow}
  
  background: ${({ checked }) => checked ? blockTheme.pastelBlue : blockTheme.lightText};
  
  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0px ${blockTheme.shadowDark};
  }
  
  &:active {
    transform: translate(1px, 1px);
    box-shadow: 2px 2px 0px ${blockTheme.shadowDark};
  }
  
  input {
    display: none;
  }
  
  @media (max-width: 768px) {
    padding: 0.4rem 0.8rem;
    font-size: 0.85rem;
    box-shadow: 2px 2px 0px ${blockTheme.shadowDark};
    
    &:hover {
      box-shadow: 3px 3px 0px ${blockTheme.shadowDark};
    }
  }
`;

const StatsRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
`;

const StatsText = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 1rem;
`;

const GamesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const GameCard = styled(motion.div)<{ $isWinner?: boolean; $isCompleted?: boolean }>`
  background: ${({ $isWinner, $isCompleted }) => {
    if ($isWinner) return 'rgba(255, 215, 0, 0.15)';
    if ($isCompleted) return 'rgba(0, 0, 0, 0.5)';
    return 'rgba(0, 0, 0, 0.4)';
  }};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1.5px solid ${({ $isWinner, $isCompleted }) => {
    if ($isWinner) return 'rgba(255, 215, 0, 0.5)';
    if ($isCompleted) return 'rgba(255, 255, 255, 0.1)';
    return 'rgba(255, 255, 255, 0.15)';
  }};
  border-radius: 20px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-4px);
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

const GameTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  margin: 0;
`;

const GameHost = styled.p`
  color: rgba(255, 255, 255, 0.6);
  margin: 0.25rem 0 0 0;
  font-size: 0.9rem;
`;

const StatusBadge = styled.div<{ type: 'locked' | 'unlocked' | 'judge' | 'player' | 'completed' }>`
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  border: 3px solid ${blockTheme.darkText};
  color: ${blockTheme.darkText};
  position: relative;
  transition: all 0.2s ease;
  ${mediumShadow}
  
  background: ${({ type }) => {
    switch (type) {
      case 'locked': return blockTheme.pastelYellow;
      case 'unlocked': return blockTheme.pastelMint;
      case 'judge': return blockTheme.pastelLavender;
      case 'player': return blockTheme.pastelBlue;
      case 'completed': return blockTheme.pastelMint;
      default: return blockTheme.pastelPink;
    }
  }};
  
  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0px ${blockTheme.shadowDark};
  }
  
  @media (max-width: 768px) {
    padding: 0.3rem 0.6rem;
    font-size: 0.7rem;
    box-shadow: 2px 2px 0px ${blockTheme.shadowDark};
    
    &:hover {
      box-shadow: 3px 3px 0px ${blockTheme.shadowDark};
    }
  }
`;

const GameStats = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-top: 1rem;
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
`;

const StatLabel = styled.div`
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
`;

const PageButton = styled(GlassButton)<{ disabled?: boolean }>`
  padding: 0.5rem 1rem;
  ${({ disabled }) => disabled && `
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  `}
`;

const PageInfo = styled.span`
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
`;

interface Game {
  code: string;
  gameCode?: string;
  host: string;
  buyIn: string;
  maxPlayers: number;
  playerCount: number;
  isLocked?: boolean;
  isCompleted?: boolean;
  hasJudges?: boolean;
  blockNumber?: number;
  timestamp?: number;
  players?: string[];
  winners?: string[];
}

const GAMES_PER_PAGE = 10;

export default function DebugPage() {
  const account = useActiveAccount();
  const { games, loading, fetchRecentGames } = useGameData();
  
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filters
  const [lockFilter, setLockFilter] = useState<'all' | 'locked' | 'unlocked'>('all');
  const [decisionFilter, setDecisionFilter] = useState<'all' | 'judge' | 'player'>('all');
  const [usernameFilter, setUsernameFilter] = useState('');

  // Load games on mount
  useEffect(() => {
    if (account?.address) {
      fetchRecentGames(account.address);
    }
  }, [account?.address, fetchRecentGames]);

  // Filter and sort games
  const filteredAndSortedGames = useMemo(() => {
    let filtered = [...games];

    // Apply lock filter
    if (lockFilter !== 'all') {
      filtered = filtered.filter(game => 
        lockFilter === 'locked' ? game.isLocked : !game.isLocked
      );
    }

    // Apply decision filter
    if (decisionFilter !== 'all') {
      filtered = filtered.filter(game => 
        decisionFilter === 'judge' ? game.hasJudges : !game.hasJudges
      );
    }

    // Apply username filter
    if (usernameFilter.trim()) {
      const searchTerm = usernameFilter.toLowerCase();
      filtered = filtered.filter(game => {
        const hostName = getDisplayNameByAddressSync(game.host).toLowerCase();
        return hostName.includes(searchTerm) || game.host.toLowerCase().includes(searchTerm);
      });
    }

    // Sort by recent activity (block number descending, then timestamp)
    filtered.sort((a, b) => {
      if (a.blockNumber && b.blockNumber) {
        return b.blockNumber - a.blockNumber;
      }
      if (a.timestamp && b.timestamp) {
        return b.timestamp - a.timestamp;
      }
      return 0;
    });

    return filtered;
  }, [games, lockFilter, decisionFilter, usernameFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedGames.length / GAMES_PER_PAGE);
  const startIndex = (currentPage - 1) * GAMES_PER_PAGE;
  const endIndex = startIndex + GAMES_PER_PAGE;
  const paginatedGames = filteredAndSortedGames.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [lockFilter, decisionFilter, usernameFilter]);

  const handleGameClick = (game: Game) => {
    setSelectedGame(game);
  };

  const handleRefresh = () => {
    if (account?.address) {
      fetchRecentGames(account.address);
    }
  };

  const formatEth = (wei: string) => {
    const eth = parseFloat(wei) / Math.pow(10, 18);
    return eth.toFixed(4);
  };

  return (
    <>
      <PageContainer>
        <Header>
          <Title>🔧 Debug Console</Title>
          <Subtitle>All games sorted by recent activity • {filteredAndSortedGames.length} total</Subtitle>
        </Header>

        <FiltersCard>
          <FilterRow>
            <FilterGroup>
              <FilterLabel>Lock Status</FilterLabel>
              <RadioGroup>
                {(['all', 'locked', 'unlocked'] as const).map((option) => (
                  <RadioOption 
                    key={option}
                    checked={lockFilter === option}
                    onClick={() => setLockFilter(option)}
                  >
                    <input
                      type="radio"
                      checked={lockFilter === option}
                      onChange={() => setLockFilter(option)}
                    />
                    {option === 'locked' && <Lock size={14} />}
                    {option === 'unlocked' && <Unlock size={14} />}
                    {option === 'all' && <Filter size={14} />}
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </RadioOption>
                ))}
              </RadioGroup>
            </FilterGroup>

            <FilterGroup>
              <FilterLabel>Decision Type</FilterLabel>
              <RadioGroup>
                {(['all', 'judge', 'player'] as const).map((option) => (
                  <RadioOption 
                    key={option}
                    checked={decisionFilter === option}
                    onClick={() => setDecisionFilter(option)}
                  >
                    <input
                      type="radio"
                      checked={decisionFilter === option}
                      onChange={() => setDecisionFilter(option)}
                    />
                    {option === 'judge' && <Scale size={14} />}
                    {option === 'player' && <Users size={14} />}
                    {option === 'all' && <Filter size={14} />}
                    {option.charAt(0).toUpperCase() + option.slice(1)} Vote
                  </RadioOption>
                ))}
              </RadioGroup>
            </FilterGroup>

            <FilterGroup>
              <FilterLabel>Host Username</FilterLabel>
              <GlassInput
                type="text"
                placeholder="Filter by host name..."
                value={usernameFilter}
                onChange={(e) => setUsernameFilter(e.target.value)}
                style={{ minWidth: '200px' }}
              />
            </FilterGroup>
          </FilterRow>
        </FiltersCard>

        <StatsRow>
          <StatsText>
            Showing {paginatedGames.length} of {filteredAndSortedGames.length} games
            {currentPage > 1 && ` • Page ${currentPage} of ${totalPages}`}
          </StatsText>
          <GlassButton onClick={handleRefresh} disabled={loading}>
            <RefreshCw size={16} />
            Refresh
          </GlassButton>
        </StatsRow>

        {loading ? (
          <FlexBlock justify="center" align="center" style={{ minHeight: '200px' }}>
            <LoadingSpinner />
          </FlexBlock>
        ) : (
          <>
            <GamesGrid>
              <AnimatePresence>
                {paginatedGames.map((game, index) => (
                  <GameCard
                    key={game.code || game.gameCode}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    onClick={() => handleGameClick(game)}
                    $isCompleted={game.isCompleted}
                    $isWinner={game.winners?.length > 0}
                  >
                    <GameHeader>
                      <div>
                        <GameTitle>{game.code || game.gameCode}</GameTitle>
                        <GameHost>Host: {getDisplayNameByAddressSync(game.host)}</GameHost>
                      </div>
                      
                      <FlexBlock direction="column" gap="0.5rem" align="flex-end">
                        {game.isCompleted && (
                          <StatusBadge type="completed">COMPLETE</StatusBadge>
                        )}
                        {game.isLocked && !game.isCompleted && (
                          <StatusBadge type="locked">
                            <Lock size={11} />
                            Locked
                          </StatusBadge>
                        )}
                        {!game.isLocked && !game.isCompleted && (
                          <StatusBadge type="unlocked">
                            <Unlock size={11} />
                            Open
                          </StatusBadge>
                        )}
                        <StatusBadge type={game.hasJudges ? "judge" : "player"}>
                          {game.hasJudges ? <Scale size={11} /> : <Users size={11} />}
                          {game.hasJudges ? 'Judge' : 'Player'} Vote
                        </StatusBadge>
                      </FlexBlock>
                    </GameHeader>

                    <GameStats>
                      <StatItem>
                        <StatValue>{formatEth(game.buyIn)} ETH</StatValue>
                        <StatLabel>Buy-In</StatLabel>
                      </StatItem>
                      
                      <StatItem>
                        <StatValue>{game.playerCount || 0}/{game.maxPlayers}</StatValue>
                        <StatLabel>Players</StatLabel>
                      </StatItem>
                      
                      <StatItem>
                        <StatValue>{formatEth((BigInt(game.buyIn || '0') * BigInt(game.playerCount || 0)).toString())} ETH</StatValue>
                        <StatLabel>Pot</StatLabel>
                      </StatItem>
                    </GameStats>
                  </GameCard>
                ))}
              </AnimatePresence>
            </GamesGrid>

            {totalPages > 1 && (
              <PaginationContainer>
                <PageButton
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} />
                  Previous
                </PageButton>
                
                <PageInfo>
                  Page {currentPage} of {totalPages}
                </PageInfo>
                
                <PageButton
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight size={16} />
                </PageButton>
              </PaginationContainer>
            )}
          </>
        )}
      </PageContainer>

      {/* Game Detail Modal */}
      {selectedGame && (
        <GameDetailModal 
          game={{
            code: selectedGame.code || selectedGame.gameCode || '',
            host: selectedGame.host,
            buyIn: selectedGame.buyIn,
            maxPlayers: selectedGame.maxPlayers,
            playerCount: selectedGame.playerCount || 0,
            userRole: 'unknown' as const
          }} 
          onClose={() => setSelectedGame(null)}
          onRefresh={handleRefresh}
        />
      )}
    </>
  );
}