import React, { useState, useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import toast from 'react-hot-toast';
import { X, Search, Users, ExternalLink } from 'lucide-react';
import { useGameData } from '../contexts/GameDataContext';
import { 
  BlockButton, 
  BlockInput,
  BlockModal,
  BlockModalContent,
  blockTheme,
  PixelText
} from '../styles/blocks';
import { SimpleRetroLoader } from './RetroLoader';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import { formatEth, formatAddress } from '../thirdweb';
import { getDisplayNameByAddressSync } from '../utils/userUtils';
import { normalizeGameCode, extractGameCode } from '../utils/gameCodeUtils';
import { useUser } from '../contexts/UserContext';

interface FindGameModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  initialCode?: string;
  autoSearch?: boolean;
}

const ModalOverlay = styled(BlockModal)`
  /* Inherits from BlockModal */
`;

const ModalContainer = styled(BlockModalContent)`
  max-width: 500px;
  background: ${blockTheme.pastelYellow};
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
  color: ${blockTheme.darkText};
`;

const CloseButton = styled.button`
  background: ${blockTheme.pastelCoral};
  border: 3px solid ${blockTheme.darkText};
  color: ${blockTheme.darkText};
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  
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

const InputContainer = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
`;

const GameInfoCard = styled(motion.div)`
  background: ${blockTheme.pastelBlue};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
`;

const GameCodeTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 1rem 0;
  color: ${blockTheme.primary};
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
  color: ${blockTheme.darkText};
  font-weight: 600;
`;

const HostInfo = styled.div`
  font-size: 0.85rem;
  color: ${blockTheme.textMuted};
  padding-top: 0.75rem;
  border-top: 3px solid ${blockTheme.darkText};
`;

const ErrorMessage = styled(motion.div)`
  background: ${blockTheme.pastelCoral};
  border: 3px solid ${blockTheme.error};
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
  color: ${blockTheme.darkText};
  font-size: 0.9rem;
  font-weight: 600;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
`;

const FindGameModal: React.FC<FindGameModalProps> = ({ onClose, onSuccess, initialCode = '', autoSearch = false }) => {
  const account = useActiveAccount();
  const { user } = useUser();
  const { addFoundGame } = useGameData();
  const [gameCode, setGameCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [gameFound, setGameFound] = useState(false);
  const [foundGame, setFoundGame] = useState<any>(null);
  const [error, setError] = useState('');

  // Auto-search when component mounts if autoSearch is enabled
  useEffect(() => {
    if (autoSearch && initialCode && account) {
      handleSearch();
    }
  }, [autoSearch, initialCode, account]);

  const handleSearch = async () => {
    if (!gameCode.trim() || !account) return;

    try {
      setLoading(true);
      setError('');
      setGameFound(false);
      setFoundGame(null);

      // Extract and normalize game code with fuzzy matching
      const extractedCode = extractGameCode(gameCode.trim());
      if (!extractedCode) {
        setError('Invalid game code format');
        return;
      }

      const codeVariations = normalizeGameCode(extractedCode);
      console.log('🔍 FindGameModal trying code variations:', codeVariations);

      // Try each variation until one works
      let gameData = null;
      let lastError = null;

      for (const variation of codeVariations) {
        try {
          gameData = await addFoundGame(variation, account.address);
          console.log('✅ Found game with code variation:', variation);
          break;
        } catch (err) {
          console.log('❌ Game not found with variation:', variation);
          lastError = err;
        }
      }

      if (!gameData) {
        throw lastError || new Error('Game not found with any variation');
      }
      
      setFoundGame(gameData);
      setGameFound(true);
      
      // Show success toast
      toast.success(`Game ${gameData.code} found and added to dashboard!`, {
        duration: 3000
      });
      
    } catch (err: any) {
      console.error('Failed to find game:', err);
      const errorMessage = err.message || 'Failed to find game';
      setError(errorMessage);
      
      // Show error toast
      toast.error(errorMessage, {
        duration: 4000
      });
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
          <BlockInput
            placeholder="Enter game code (e.g. ABC-123)"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            maxLength={10}
            style={{ flex: 1 }}
            disabled={loading}
          />
          <BlockButton
            onClick={handleSearch}
            disabled={loading || !gameCode.trim()}
            $loading={loading}
          >
            {loading ? (
              <SimpleRetroLoader />
            ) : (
              <Search size={16} />
            )}
            Search
          </BlockButton>
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
          <BlockButton
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </BlockButton>
          
          {gameFound && (
            <BlockButton
              onClick={handleAddToList}
            >
              <ExternalLink size={16} />
              Added to Dashboard
            </BlockButton>
          )}
        </ActionButtons>
      </ModalContainer>
    </ModalOverlay>
  );
};

export default FindGameModal;