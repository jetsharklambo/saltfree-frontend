import React from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { CheckCircle, DollarSign, Banknote, Coins } from 'lucide-react';
import { glassTheme } from '../styles/glass';

// Claimed winnings animations
const successPulse = keyframes`
  0%, 100% { 
    box-shadow: 
      0 0 15px rgba(34, 197, 94, 0.3),
      0 0 30px rgba(34, 197, 94, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  50% { 
    box-shadow: 
      0 0 25px rgba(34, 197, 94, 0.5),
      0 0 50px rgba(34, 197, 94, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
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

const fadeInOut = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
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
        return 'linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))';
      case 'money':
        return 'linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 0.9))';
      default:
        return 'linear-gradient(135deg, rgba(156, 163, 175, 0.8), rgba(107, 114, 128, 0.8))';
    }
  }};
  
  border: 1.5px solid ${({ variant }) => {
    switch (variant) {
      case 'success': return 'rgba(34, 197, 94, 0.7)';
      case 'money': return 'rgba(16, 185, 129, 0.7)';
      default: return 'rgba(156, 163, 175, 0.6)';
    }
  }};
  
  border-radius: 10px;
  color: white;
  font-size: ${({ size = 'md' }) => {
    switch (size) {
      case 'sm': return '0.7rem';
      case 'lg': return '0.9rem';
      default: return '0.8rem';
    }
  }};
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  
  animation: ${({ variant }) => variant === 'subtle' ? fadeInOut : successPulse} 4s ease-in-out infinite;
  
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
    transform: translateY(-1px);
    transition: transform 0.2s ease;
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
  color: rgba(255, 255, 255, 0.6);
  
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.8), transparent);
    transform: translateY(-50%) rotate(-5deg);
  }
`;

const ClaimedOverlay = styled.div`
  position: absolute;
  top: -8px;
  right: -12px;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.95), rgba(22, 163, 74, 0.95));
  color: white;
  padding: 0.2rem 0.4rem;
  border-radius: 6px;
  font-size: 0.6rem;
  font-weight: 700;
  border: 1px solid rgba(34, 197, 94, 0.8);
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
  animation: ${successPulse} 3s ease-in-out infinite;
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