import React from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { CheckCircle, DollarSign, Banknote, Coins } from 'lucide-react';
import { blockTheme } from '../styles/blocks';

// Block-style animations
const blockPulse = keyframes`
  0%, 100% { 
    box-shadow: 6px 6px 0px ${blockTheme.shadowDark};
    transform: translateY(0px);
  }
  50% { 
    box-shadow: 8px 8px 0px ${blockTheme.shadowDark};
    transform: translateY(-2px);
  }
`;

const checkmark = keyframes`
  0% { transform: scale(0.8); opacity: 0.7; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 0.9; }
`;

const coinFlip = keyframes`
  0%, 100% { transform: rotateY(0deg); }
  25% { transform: rotateY(90deg); }
  50% { transform: rotateY(180deg); }
  75% { transform: rotateY(270deg); }
`;

const blockBounce = keyframes`
  0%, 100% { 
    transform: translateY(0px);
    box-shadow: 4px 4px 0px ${blockTheme.shadowMedium};
  }
  50% { 
    transform: translateY(-3px);
    box-shadow: 6px 6px 0px ${blockTheme.shadowMedium};
  }
`;

// Styled components
const ClaimedBadgeContainer = styled.div<{ variant: 'success' | 'money' | 'subtle'; size?: 'sm' | 'md' | 'lg' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: ${({ size = 'md' }) => {
    switch (size) {
      case 'sm': return '0.3rem 0.6rem';
      case 'lg': return '0.6rem 1rem';
      default: return '0.4rem 0.8rem';
    }
  }};
  
  background: ${({ variant }) => {
    switch (variant) {
      case 'success':
        return blockTheme.pastelMint;
      case 'money':
        return blockTheme.pastelYellow;
      default:
        return blockTheme.pastelLavender;
    }
  }};
  
  border: 3px solid ${blockTheme.darkText};
  
  border-radius: 12px;
  color: ${blockTheme.darkText};
  font-size: ${({ size = 'md' }) => {
    switch (size) {
      case 'sm': return '0.7rem';
      case 'lg': return '0.9rem';
      default: return '0.8rem';
    }
  }};
  font-weight: 700;
  text-shadow: none;
  box-shadow: 6px 6px 0px ${blockTheme.shadowDark};
  
  animation: ${({ variant }) => variant === 'subtle' ? blockBounce : blockPulse} 3s ease-in-out infinite;
  
  .icon {
    animation: ${({ variant }) => {
      switch (variant) {
        case 'success': return checkmark;
        case 'money': return coinFlip;
        default: return 'none';
      }
    }} 2s ease-in-out infinite;
  }
  
  &:hover {
    transform: translateY(2px);
    box-shadow: 4px 4px 0px ${blockTheme.shadowMedium};
    transition: all 0.2s ease;
  }
  
  &:active {
    transform: translateY(4px);
    box-shadow: 2px 2px 0px ${blockTheme.shadowMedium};
  }
`;

const ClaimedContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const CrossedOutAmount = styled.div`
  position: relative;
  font-family: monospace;
  font-size: 0.85rem;
  color: ${blockTheme.textMuted};
  
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 2px;
    background: ${blockTheme.error};
    transform: translateY(-50%) rotate(-5deg);
  }
`;

const ClaimedOverlay = styled.div`
  position: absolute;
  top: -8px;
  right: -12px;
  background: ${blockTheme.pastelMint};
  color: ${blockTheme.darkText};
  padding: 0.25rem 0.5rem;
  border-radius: 8px;
  font-size: 0.65rem;
  font-weight: 700;
  border: 2px solid ${blockTheme.darkText};
  box-shadow: 3px 3px 0px ${blockTheme.shadowMedium};
  animation: ${blockPulse} 3s ease-in-out infinite;
  z-index: 1;
`;

// Badge component props
interface ClaimedWinningsBadgeProps {
  variant?: 'success' | 'money' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  amount?: string;
  showAmount?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const ClaimedWinningsBadge: React.FC<ClaimedWinningsBadgeProps> = ({
  variant = 'success',
  size = 'md',
  amount,
  showAmount = false,
  children,
  className
}) => {
  const getIcon = () => {
    const iconSize = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;
    
    switch (variant) {
      case 'money':
        return <Coins size={iconSize} className="icon" />;
      case 'success':
        return <CheckCircle size={iconSize} className="icon" />;
      default:
        return <CheckCircle size={iconSize} className="icon" />;
    }
  };

  const getBadgeText = () => {
    if (children) return children;
    
    switch (variant) {
      case 'money': return 'CLAIMED';
      case 'success': return 'PAID OUT';
      default: return 'COMPLETED';
    }
  };

  return (
    <ClaimedContainer className={className}>
      <ClaimedBadgeContainer variant={variant} size={size}>
        {getIcon()}
        {getBadgeText()}
      </ClaimedBadgeContainer>
      
      {showAmount && amount && (
        <ClaimedOverlay>
          +{amount}
        </ClaimedOverlay>
      )}
    </ClaimedContainer>
  );
};

// Component for showing crossed out pot amount
export const CrossedOutPot: React.FC<{
  originalAmount: string;
  className?: string;
}> = ({ originalAmount, className }) => {
  return (
    <ClaimedContainer className={className}>
      <CrossedOutAmount>
        💰 {originalAmount} ETH
      </CrossedOutAmount>
      <ClaimedOverlay>
        CLAIMED
      </ClaimedOverlay>
    </ClaimedContainer>
  );
};

// Specialized claimed badges
export const SuccessBadge: React.FC<Omit<ClaimedWinningsBadgeProps, 'variant'>> = (props) => (
  <ClaimedWinningsBadge variant="success" {...props} />
);

export const MoneyBadge: React.FC<Omit<ClaimedWinningsBadgeProps, 'variant'>> = (props) => (
  <ClaimedWinningsBadge variant="money" {...props} />
);

export const SubtleBadge: React.FC<Omit<ClaimedWinningsBadgeProps, 'variant'>> = (props) => (
  <ClaimedWinningsBadge variant="subtle" {...props} />
);

export default ClaimedWinningsBadge;