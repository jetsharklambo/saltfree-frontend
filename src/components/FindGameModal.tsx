import React, { useState } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { X, Search, Users, ExternalLink } from 'lucide-react';
import { useGameData } from '../contexts/GameDataContext';
import { 
  GlassButton, 
  GlassInput,
  LoadingSpinner,
  glassTheme 
} from '../styles/glass';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import { formatEth, formatAddress } from '../thirdweb';
import { getDisplayNameByAddressSync } from '../utils/userUtils';
import { useUser } from '../contexts/UserContext';

interface FindGameModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const ModalContainer = styled(motion.div)`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 2rem;
  max-width: 500px;
  width: 100%;
  position: relative;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const ModalTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), ${glassTheme.primary});
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
`;

const InputContainer = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
`;

const GameInfoCard = styled(motion.div)`
  background: rgba(102, 126, 234, 0.15);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
`;

const GameCodeTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 1rem 0;
  color: ${glassTheme.primary};
`;

const GameStats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.8);
`;

const HostInfo = styled.div`
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`;

const ErrorMessage = styled(motion.div)`
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
  color: #ff6b6b;
  font-size: 0.9rem;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
`;

const FindGameModal: React.FC<FindGameModalProps> = ({ onClose, onSuccess }) => {
  const account = useActiveAccount();
  const { user } = useUser();
  const { addFoundGame } = useGameData();
  const [gameCode, setGameCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [gameFound, setGameFound] = useState(false);
  const [foundGame, setFoundGame] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!gameCode.trim() || !account) return;

    try {
      setLoading(true);
      setError('');
      setGameFound(false);
      setFoundGame(null);

      const gameData = await addFoundGame(gameCode.trim().toUpperCase(), account.address);
      
      setFoundGame(gameData);
      setGameFound(true);
      
    } catch (err: any) {
      console.error('Failed to find game:', err);
      setError(err.message || 'Failed to find game');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToList = () => {
    // Game is already added by addFoundGame function
    if (onSuccess) {
      onSuccess();
    }
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <ModalOverlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <ModalContainer
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
      >
        <ModalHeader>
          <ModalTitle>Find Game</ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <InputContainer>
          <GlassInput
            placeholder="Enter game code (e.g. ABC-123)"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            maxLength={10}
            style={{ flex: 1 }}
            disabled={loading}
          />
          <GlassButton
            onClick={handleSearch}
            disabled={loading || !gameCode.trim()}
            $loading={loading}
          >
            {loading ? (
              <LoadingSpinner />
            ) : (
              <Search size={16} />
            )}
            Search
          </GlassButton>
        </InputContainer>

        <AnimatePresence mode="wait">
          {error && (
            <ErrorMessage
              key="error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {error}
            </ErrorMessage>
          )}

          {gameFound && foundGame && (
            <GameInfoCard
              key="found-game"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <GameCodeTitle>{foundGame.code}</GameCodeTitle>
              
              <GameStats>
                <StatItem>
                  <Users size={16} />
                  {foundGame.playerCount || 0}/{foundGame.maxPlayers || 0} Players
                </StatItem>
                <StatItem>
                  <span>💰</span>
                  {formatEth(foundGame.buyIn || '0')} ETH
                </StatItem>
              </GameStats>

              <HostInfo>
                Host: {getDisplayNameByAddressSync(foundGame.host || '')}
              </HostInfo>
            </GameInfoCard>
          )}
        </AnimatePresence>

        <ActionButtons>
          <GlassButton
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </GlassButton>
          
          {gameFound && (
            <GlassButton
              onClick={handleAddToList}
            >
              <ExternalLink size={16} />
              Added to Dashboard
            </GlassButton>
          )}
        </ActionButtons>
      </ModalContainer>
    </ModalOverlay>
  );
};

export default FindGameModal;