import React, { useState, useEffect } from 'react';
import { X, Trophy, TrendingUp, Calendar, Coins, Target, Award } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { databaseService } from '../services/databaseService';
import { Database } from '../lib/database.types';
import {
  GlassModal,
  GlassModalContent,
  GlassButton,
  FlexContainer,
  LoadingSpinner
} from '../styles/glass';

type GameHistory = Database['public']['Tables']['game_history']['Row'];

interface GameHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserStats {
  totalGames: number;
  gamesWon: number;
  gamesLost: number;
  totalWinnings: string;
  winRate: number;
}

export const GameHistoryModal: React.FC<GameHistoryModalProps> = ({ isOpen, onClose }) => {
  const { user } = useUser();
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalGames: 0,
    gamesWon: 0,
    gamesLost: 0,
    totalWinnings: '0',
    winRate: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const [history, userStats] = await Promise.all([
        databaseService.gameHistory.getUserGameHistory(user.id, 50),
        databaseService.gameHistory.getUserStats(user.id)
      ]);

      setGameHistory(history);
      setStats(userStats);
    } catch (err) {
      console.error('Error loading game data:', err);
      setError('Failed to load game history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user?.id) {
      loadData();
    }
  }, [isOpen, user?.id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatEth = (weiString: string) => {
    try {
      const wei = parseFloat(weiString || '0');
      const eth = wei / 1e18;
      return eth.toFixed(4);
    } catch {
      return '0.0000';
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'won': return 'rgba(34, 197, 94, 0.9)';
      case 'lost': return 'rgba(239, 68, 68, 0.9)';
      case 'active': return 'rgba(59, 130, 246, 0.9)';
      default: return 'rgba(107, 114, 128, 0.9)';
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'won': return <Trophy size={16} />;
      case 'lost': return <X size={16} />;
      case 'active': return <Target size={16} />;
      default: return null;
    }
  };

  if (!isOpen) return null;

  return (
    <GlassModal>
      <GlassModalContent style={{ maxWidth: '800px', maxHeight: '85vh', overflow: 'auto' }}>
        <FlexContainer justify="space-between" align="center" style={{ marginBottom: '1.5rem' }}>
          <FlexContainer align="center" gap="0.5rem">
            <TrendingUp size={24} style={{ color: 'rgba(139, 92, 246, 0.9)' }} />
            <h2 style={{ 
              margin: 0, 
              fontSize: '1.5rem', 
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: '600'
            }}>
              Game History & Stats
            </h2>
          </FlexContainer>
          <GlassButton 
            onClick={onClose}
            style={{ 
              padding: '0.5rem',
              minWidth: 'auto',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}
          >
            <X size={18} />
          </GlassButton>
        </FlexContainer>

        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.3)', 
            padding: '0.75rem', 
            borderRadius: '8px', 
            marginBottom: '1rem',
            color: 'rgba(239, 68, 68, 0.9)'
          }}>
            {error}
          </div>
        )}

        {/* Statistics Overview */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ 
            margin: '0 0 1rem 0', 
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Award size={20} />
            Your Gaming Stats
          </h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: '1rem' 
          }}>
            <StatCard
              icon={<Target size={20} />}
              label="Total Games"
              value={stats.totalGames.toString()}
              color="rgba(59, 130, 246, 0.9)"
            />
            <StatCard
              icon={<Trophy size={20} />}
              label="Games Won"
              value={stats.gamesWon.toString()}
              color="rgba(34, 197, 94, 0.9)"
            />
            <StatCard
              icon={<X size={20} />}
              label="Games Lost"
              value={stats.gamesLost.toString()}
              color="rgba(239, 68, 68, 0.9)"
            />
            <StatCard
              icon={<TrendingUp size={20} />}
              label="Win Rate"
              value={`${stats.winRate.toFixed(1)}%`}
              color="rgba(139, 92, 246, 0.9)"
            />
            <StatCard
              icon={<Coins size={20} />}
              label="Total Winnings"
              value={`${formatEth(stats.totalWinnings)} ETH`}
              color="rgba(245, 158, 11, 0.9)"
            />
          </div>
        </div>

        {/* Game History */}
        <div>
          <h3 style={{ 
            margin: '0 0 1rem 0', 
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Calendar size={20} />
            Recent Games
          </h3>

          {loading ? (
            <FlexContainer justify="center" align="center" style={{ padding: '2rem' }}>
              <LoadingSpinner size="2rem" />
              <span style={{ marginLeft: '1rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                Loading game history...
              </span>
            </FlexContainer>
          ) : gameHistory.length === 0 ? (
            <FlexContainer 
              direction="column" 
              align="center" 
              justify="center" 
              style={{ padding: '3rem', textAlign: 'center' }}
            >
              <Calendar size={48} style={{ color: 'rgba(255, 255, 255, 0.3)', marginBottom: '1rem' }} />
              <h4 style={{ color: 'rgba(255, 255, 255, 0.7)', margin: '0 0 0.5rem 0' }}>
                No Game History
              </h4>
              <p style={{ color: 'rgba(255, 255, 255, 0.5)', margin: 0 }}>
                Your game results will appear here once you start playing
              </p>
            </FlexContainer>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {gameHistory.map((game) => (
                <div
                  key={game.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <FlexContainer justify="space-between" align="center">
                    <FlexContainer direction="column" gap="0.25rem" style={{ flex: 1 }}>
                      <FlexContainer align="center" gap="0.5rem">
                        <code style={{ 
                          background: 'rgba(255, 255, 255, 0.1)', 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          color: 'rgba(255, 255, 255, 0.9)'
                        }}>
                          {game.game_code}
                        </code>
                        <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.8rem' }}>
                          {game.game_type}
                        </span>
                      </FlexContainer>
                      <FlexContainer align="center" gap="1rem">
                        <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
                          Buy-in: {formatEth(game.buy_in_amount)} ETH
                        </span>
                        {game.winnings && (
                          <span style={{ color: 'rgba(245, 158, 11, 0.9)', fontSize: '0.9rem' }}>
                            Winnings: {formatEth(game.winnings)} ETH
                          </span>
                        )}
                      </FlexContainer>
                      <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.8rem' }}>
                        {formatDate(game.created_at)}
                      </span>
                    </FlexContainer>
                    
                    <FlexContainer 
                      align="center" 
                      gap="0.5rem"
                      style={{ 
                        color: getResultColor(game.result),
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        fontSize: '0.9rem'
                      }}
                    >
                      {getResultIcon(game.result)}
                      {game.result}
                    </FlexContainer>
                  </FlexContainer>
                </div>
              ))}
            </div>
          )}
        </div>
      </GlassModalContent>
    </GlassModal>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '1rem',
    textAlign: 'center',
  }}>
    <FlexContainer direction="column" align="center" gap="0.5rem">
      <div style={{ color }}>{icon}</div>
      <div style={{ 
        fontSize: '1.5rem', 
        fontWeight: '700', 
        color: 'rgba(255, 255, 255, 0.9)',
        marginBottom: '0.25rem'
      }}>
        {value}
      </div>
      <div style={{ 
        fontSize: '0.8rem', 
        color: 'rgba(255, 255, 255, 0.6)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {label}
      </div>
    </FlexContainer>
  </div>
);