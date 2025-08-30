import React, { useState, useRef, useEffect } from 'react';
import { Users, Shield, ChevronDown } from 'lucide-react';
import { GlassButton } from '../styles/glass';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import { formatEth } from '../thirdweb';

interface JoinDropdownProps {
  gameCode: string;
  buyIn: string;
  onJoin: (gameCode: string, joinAsJudge: boolean) => void;
  disabled?: boolean;
  isUserEligibleJudge?: boolean; // Whether user is a unanimous judge for this game
  onEligibilityCheck?: () => void; // Callback to check eligibility if not already known
}

const DropdownContainer = styled.div`
  position: relative;
  display: inline-block;
  z-index: 999; /* Create proper stacking context */
`;

const JoinButton = styled(GlassButton)<{ $open: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  position: relative;
  
  .chevron {
    transition: transform 0.2s ease;
    transform: ${({ $open }) => $open ? 'rotate(180deg)' : 'rotate(0deg)'};
  }
  
  &:hover .chevron {
    transform: ${({ $open }) => $open ? 'rotate(180deg) scale(1.1)' : 'rotate(0deg) scale(1.1)'};
  }
`;

const DropdownMenu = styled(motion.div)<{ $leftOffset?: number }>`
  position: absolute;
  bottom: 100%; /* Open upward instead of downward */
  left: ${({ $leftOffset = 0 }) => `${$leftOffset}px`}; /* Dynamic positioning */
  transform: translateX(-50%); /* Center horizontally */
  z-index: 9999; /* Maximum z-index to appear above everything */
  min-width: 280px; /* Slightly wider for better game card coverage */
  background: rgba(30, 30, 40, 0.95); /* Dark background for better contrast */
  backdrop-filter: blur(40px); /* Stronger blur for better separation */
  -webkit-backdrop-filter: blur(40px);
  border: 2px solid rgba(255, 255, 255, 0.2); /* Subtle border for dark background */
  border-radius: 16px;
  margin-bottom: 0.5rem; /* Space from button when opening upward */
  overflow: hidden;
  box-shadow: 
    0 12px 48px rgba(0, 0, 0, 0.6), /* Stronger shadow for depth */
    0 0 0 1px rgba(255, 255, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  
  /* Ensure text doesn't wrap */
  white-space: nowrap;
`;

const DropdownItem = styled.button`
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }
  
  &:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    
    &:hover {
      background: transparent;
    }
  }
`;

const ItemLabel = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1;
`;

const ItemTitle = styled.div`
  font-weight: 600;
`;

const ItemSubtitle = styled.div`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.25rem;
`;

const JudgeTag = styled.div`
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid rgba(34, 197, 94, 0.4);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: #4ade80;
`;

const JoinDropdown: React.FC<JoinDropdownProps> = ({
  gameCode,
  buyIn,
  onJoin,
  disabled = false,
  isUserEligibleJudge = false,
  onEligibilityCheck
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedMode, setSelectedMode] = useState<'player' | 'judge'>('player');
  const [dropdownLeft, setDropdownLeft] = useState<number>(0);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMainButtonClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent parent card's onClick
    if (disabled) return;
    
    // Always show dropdown for mode selection
    if (!isOpen) {
      // Check eligibility when opening dropdown
      onEligibilityCheck?.();
      
      // Calculate position to center dropdown over game card
      if (dropdownRef.current) {
        // Find the parent game card element
        const gameCard = dropdownRef.current.closest('[class*="GameCard"]') || 
                         dropdownRef.current.closest('[class*="emotion-"]');
        
        if (gameCard) {
          const cardRect = gameCard.getBoundingClientRect();
          const containerRect = dropdownRef.current.getBoundingClientRect();
          
          // Calculate offset to center dropdown over the card
          const cardCenter = cardRect.width / 2;
          const containerCenter = containerRect.left - cardRect.left + (containerRect.width / 2);
          const offset = cardCenter - containerCenter;
          
          setDropdownLeft(offset);
        }
      }
    }
    setIsOpen(!isOpen);
  };

  const handleJoinAsPlayer = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent any parent handlers
    setSelectedMode('player');
    setIsOpen(false);
    onJoin(gameCode, false);
  };

  const handleJoinAsJudge = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent any parent handlers
    setSelectedMode('judge');
    setIsOpen(false);
    onJoin(gameCode, true);
  };

  const buyInEth = formatEth(buyIn);

  return (
    <DropdownContainer 
      ref={dropdownRef}
      onClick={(e) => e.stopPropagation()} // Prevent any parent card clicks
    >
      <JoinButton
        size="sm"
        $open={isOpen}
        onClick={handleMainButtonClick}
        disabled={disabled}
        title={`Join game - Click to choose player or judge mode`}
      >
        {selectedMode === 'judge' ? <Shield size={14} /> : <Users size={14} />}
        Join
        <ChevronDown size={12} className="chevron" />
      </JoinButton>

      <AnimatePresence>
        {isOpen && (
          <DropdownMenu
            $leftOffset={dropdownLeft}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <DropdownItem 
              onClick={handleJoinAsPlayer}
              style={{
                backgroundColor: selectedMode === 'player' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
              }}
            >
              <Users size={16} />
              <ItemLabel>
                <ItemTitle>Join as Player</ItemTitle>
                <ItemSubtitle>Pay {buyInEth} ETH buy-in</ItemSubtitle>
              </ItemLabel>
              {selectedMode === 'player' && <span style={{ color: '#4ade80' }}>✓</span>}
            </DropdownItem>
            
            <DropdownItem 
              onClick={handleJoinAsJudge}
              style={{
                backgroundColor: selectedMode === 'judge' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
              }}
              disabled={!isUserEligibleJudge}
            >
              <Shield size={16} />
              <ItemLabel>
                <ItemTitle>Join as Judge</ItemTitle>
                <ItemSubtitle>
                  {isUserEligibleJudge ? 
                    'Free entry, help determine winners' : 
                    'Not eligible - need unanimous judge status'
                  }
                </ItemSubtitle>
              </ItemLabel>
              {selectedMode === 'judge' && <span style={{ color: '#4ade80' }}>✓</span>}
              {isUserEligibleJudge && <JudgeTag>FREE</JudgeTag>}
            </DropdownItem>
          </DropdownMenu>
        )}
      </AnimatePresence>
    </DropdownContainer>
  );
};

export default JoinDropdown;