import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useActiveAccount } from "thirdweb/react";
import { readContract } from 'thirdweb';
import { ArrowLeft, Users, Clock, Lock, Trophy, Share2 } from 'lucide-react';
import { getGameContract, formatEth } from '../thirdweb';
import { getDisplayNameByAddressSync } from '../utils/userUtils';
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
  loading?: boolean;
  error?: string;
}

const PageContainer = styled.div`
  min-height: 100vh;
  padding: 2rem;
  background: transparent;
  
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

const GamesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const GameCard = styled(GlassCard)`
  padding: 1.5rem;
  cursor: pointer;
  transition: transform 0.2s ease;
  
  &:hover {
    transform: translateY(-4px);
  }
`;

const GameHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
`;

const GameTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  margin: 0;
`;

const GameStats = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
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

const ErrorCard = styled(GlassCard)`
  padding: 1.5rem;
  text-align: center;
  color: #ff6b6b;
`;

const LoadingCard = styled(GlassCard)`
  padding: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export default function MultiGamePage() {
  const { '*': pathParams } = useParams();
  const navigate = useNavigate();
  const account = useActiveAccount();
  
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null);

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
    
    return [...new Set(variations)]; // Remove duplicates
  };

  // Parse game codes from URL
  const parseGameCodes = (pathParams: string | undefined): string[] => {
    if (!pathParams) return [];
    
    const codes = pathParams
      .split('/')
      .filter(code => code.trim().length > 0)
      .slice(0, 5); // Limit to 5 games max
    
    console.log('🎮 Parsed game codes from URL:', codes);
    return codes;
  };

  // Load a single game
  const loadSingleGame = async (gameCode: string): Promise<GameInfo> => {
    const codeVariations = normalizeGameCode(gameCode);
    console.log('🔍 Loading game:', gameCode, 'variations:', codeVariations);
    
    const contract = getGameContract();
    
    // Try each variation
    for (const codeVariation of codeVariations) {
      try {
        const gameInfo = await readContract({
          contract,
          method: "function getGameInfo(string code) view returns (address host, uint256 buyIn, uint256 maxPlayers, uint256 playerCount, bool isLocked, uint256[] splits, address[] judges)",
          params: [codeVariation],
        }) as [string, bigint, bigint, bigint, boolean, bigint[], string[]];

        const [host, buyIn, maxPlayers, playerCount, isLocked, splits, judges] = gameInfo;

        // Check if game exists
        if (host !== '0x0000000000000000000000000000000000000000') {
          console.log('✅ Found game:', codeVariation);
          
          // Fetch players list
          const players = await readContract({
            contract,
            method: "function getPlayers(string code) view returns (address[] players)",
            params: [codeVariation],
          }) as string[];

          // Check completion status
          let isCompleted = false;
          let winners: string[] = [];
          try {
            const gameState = await readContract({
              contract,
              method: "function isGameCompleted(string code) view returns (bool)",
              params: [codeVariation],
            }) as boolean;
            isCompleted = gameState;

            if (isCompleted) {
              winners = await readContract({
                contract,
                method: "function getWinners(string code) view returns (address[] winners)",
                params: [codeVariation],
              }) as string[];
            }
          } catch (e) {
            // Game not completed
          }

          return {
            gameCode: codeVariation,
            host,
            buyIn: buyIn.toString(),
            maxPlayers: Number(maxPlayers),
            playerCount: Number(playerCount),
            currentPlayers: players.length,
            players,
            isLocked,
            isCompleted,
            winners,
          };
        }
      } catch (error) {
        // Continue to next variation
      }
    }
    
    // If no variation worked, return error state
    throw new Error(`Game ${gameCode} not found`);
  };

  // Load all games
  useEffect(() => {
    const loadGames = async () => {
      const gameCodes = parseGameCodes(pathParams);
      
      if (gameCodes.length === 0) {
        navigate('/');
        return;
      }

      if (gameCodes.length === 1) {
        // Redirect to single game page
        navigate(`/game/${gameCodes[0]}`);
        return;
      }

      setLoading(true);
      const gamePromises = gameCodes.map(async (code) => {
        try {
          const gameData = await loadSingleGame(code);
          return { ...gameData, loading: false };
        } catch (error) {
          return {
            gameCode: code,
            host: '',
            buyIn: '0',
            maxPlayers: 0,
            playerCount: 0,
            currentPlayers: 0,
            players: [],
            isLocked: false,
            isCompleted: false,
            winners: [],
            loading: false,
            error: `Game ${code} not found`,
          } as GameInfo;
        }
      });

      const loadedGames = await Promise.all(gamePromises);
      setGames(loadedGames);
      setLoading(false);

      logGameAction('Multi-game page loaded', gameCodes.join(','), {
        gameCount: loadedGames.length,
        foundGames: loadedGames.filter(g => !g.error).length,
      });
    };

    loadGames();
  }, [pathParams, navigate]);

  const handleGameClick = (game: GameInfo) => {
    setSelectedGame(game);
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      console.log('Multi-game URL copied to clipboard:', shareUrl);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert(`Multi-game URL: ${shareUrl}`);
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

  const validGames = games.filter(g => !g.error);
  const shareTitle = `${validGames.length} Games on Pony Up!`;
  const shareDescription = validGames.length > 0 
    ? `View ${validGames.length} poker games: ${validGames.map(g => g.gameCode).join(', ')}`
    : 'Multiple poker games on the blockchain';

  return (
    <>
      <Helmet>
        <title>{shareTitle}</title>
        <meta name="description" content={shareDescription} />
        <meta property="og:title" content={shareTitle} />
        <meta property="og:description" content={shareDescription} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={shareTitle} />
        <meta name="twitter:description" content={shareDescription} />
      </Helmet>
      
      <PageContainer>
        <FlexContainer justify="space-between" align="center" style={{ marginBottom: '2rem' }}>
          <BackButton onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
            Back to Dashboard
          </BackButton>
          
          <GlassButton onClick={handleShare}>
            <Share2 size={20} />
            Share Games
          </GlassButton>
        </FlexContainer>

        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: 'rgba(255, 255, 255, 0.95)', margin: '0 0 0.5rem 0', fontSize: '2rem' }}>
            {games.length} Games
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: 0 }}>
            {validGames.length} found, {games.filter(g => g.error).length} not found
          </p>
        </div>

        <GamesGrid>
          {games.map((game, index) => (
            game.error ? (
              <ErrorCard key={game.gameCode}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#ff6b6b' }}>
                  {game.gameCode}
                </h3>
                <p style={{ margin: 0 }}>{game.error}</p>
              </ErrorCard>
            ) : (
              <GameCard key={game.gameCode} onClick={() => handleGameClick(game)}>
                <GameHeader>
                  <div>
                    <GameTitle>{game.gameCode}</GameTitle>
                    <p style={{ color: 'rgba(255, 255, 255, 0.6)', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
                      Host: {getDisplayNameByAddressSync(game.host)}
                    </p>
                  </div>
                  
                  <FlexContainer direction="column" align="flex-end" gap="0.5rem">
                    {game.isCompleted && (
                      <div style={{ 
                        padding: '0.25rem 0.75rem', 
                        backgroundColor: 'rgba(34, 197, 94, 0.2)', 
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        color: '#22c55e'
                      }}>
                        COMPLETE
                      </div>
                    )}
                    {game.isLocked && !game.isCompleted && (
                      <div style={{ 
                        padding: '0.3rem 0.8rem', 
                        background: 'rgba(251, 191, 36, 0.15)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: 'rgba(245, 158, 11, 0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
                      }}>
                        <Lock size={11} />
                        Locked
                      </div>
                    )}
                  </FlexContainer>
                </GameHeader>

                <GameStats>
                  <StatItem>
                    <StatValue>{formatEth(game.buyIn)} ETH</StatValue>
                    <StatLabel>Buy-In</StatLabel>
                  </StatItem>
                  
                  <StatItem>
                    <StatValue>{game.currentPlayers}/{game.maxPlayers}</StatValue>
                    <StatLabel>Players</StatLabel>
                  </StatItem>
                  
                  <StatItem>
                    <StatValue>{formatEth((BigInt(game.buyIn) * BigInt(game.currentPlayers)).toString())} ETH</StatValue>
                    <StatLabel>Pot</StatLabel>
                  </StatItem>
                </GameStats>

                {game.winners.length > 0 && (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.75rem', 
                    backgroundColor: 'rgba(255, 215, 0, 0.1)', 
                    borderRadius: '8px',
                    borderLeft: '3px solid #ffd700'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      fontSize: '0.9rem',
                      color: '#ffd700'
                    }}>
                      <Trophy size={16} />
                      Winners: {game.winners.length}
                    </div>
                  </div>
                )}
              </GameCard>
            )
          ))}
        </GamesGrid>
      </PageContainer>
      
      {/* Game Detail Modal */}
      {selectedGame && (
        <GameDetailModal 
          game={{
            code: selectedGame.gameCode,
            host: selectedGame.host,
            buyIn: selectedGame.buyIn,
            maxPlayers: selectedGame.maxPlayers,
            playerCount: selectedGame.currentPlayers,
            userRole: 'unknown' as const
          }} 
          onClose={() => setSelectedGame(null)}
          onRefresh={() => {
            // Refresh the games list
            const gameCodes = games.map(g => g.gameCode);
            // Re-trigger the loadSingleGame for all games
            setLoading(true);
            // This will re-run the effect that loads games
          }}
        />
      )}
    </>
  );
}