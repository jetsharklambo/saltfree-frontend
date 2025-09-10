import React from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { Trophy, Crown, Star } from 'lucide-react';
import { blockTheme } from '../styles/blocks';

// Block-style winner animations
const blockWinnerPulse = keyframes`
  0%, 100% { 
    box-shadow: 8px 8px 0px ${blockTheme.shadowDark};
    transform: translateY(0px) scale(1);
  }
  50% { 
    box-shadow: 10px 10px 0px ${blockTheme.shadowDark};
    transform: translateY(-3px) scale(1.02);
  }
`;

const sparkle = keyframes`
  0%, 100% { opacity: 0.4; transform: scale(1) rotate(0deg); }
  25% { opacity: 1; transform: scale(1.1) rotate(90deg); }
  50% { opacity: 0.6; transform: scale(1.05) rotate(180deg); }
  75% { opacity: 1; transform: scale(1.1) rotate(270deg); }
`;

const blockBounce = keyframes`
  0%, 20%, 53%, 80%, 100% { transform: translateY(0) rotate(0deg); }
  40%, 43% { transform: translateY(-6px) rotate(5deg); }
  70% { transform: translateY(-3px) rotate(-3deg); }
`;

// Styled components
const WinnerBadgeContainer = styled.div<{ variant: 'trophy' | 'crown' | 'star'; size?: 'sm' | 'md' | 'lg' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: ${({ size = 'md' }) => {
    switch (size) {
      case 'sm': return '0.4rem 0.7rem';
      case 'lg': return '0.7rem 1.2rem';
      default: return '0.5rem 0.9rem';
    }
  }};
  
  background: ${({ variant }) => {
    switch (variant) {
      case 'crown':
        return blockTheme.pastelYellow;
      case 'star':
        return blockTheme.lightText;
      default:
        return blockTheme.pastelPeach;
    }
  }};
  
  border: 4px solid ${blockTheme.darkText};
  
  border-radius: 16px;
  color: ${blockTheme.darkText};
  font-size: ${({ size = 'md' }) => {
    switch (size) {
      case 'sm': return '0.75rem';
      case 'lg': return '1rem';
      default: return '0.85rem';
    }
  }};
  font-weight: 800;
  text-shadow: none;
  box-shadow: 8px 8px 0px ${blockTheme.shadowDark};
  
  animation: ${blockWinnerPulse} 3s ease-in-out infinite;
  
  .icon {
    animation: ${blockBounce} 2s infinite;
  }
  
  &:hover {
    transform: translateY(2px);
    box-shadow: 6px 6px 0px ${blockTheme.shadowMedium};
    transition: all 0.2s ease;
  }
  
  &:active {
    transform: translateY(4px);
    box-shadow: 4px 4px 0px ${blockTheme.shadowMedium};
  }
`;

const SparkleIcon = styled.div`
  position: absolute;
  color: ${blockTheme.darkText};
  animation: ${sparkle} 2s ease-in-out infinite;
  pointer-events: none;
  filter: drop-shadow(2px 2px 0px ${blockTheme.shadowMedium});
  
  &.sparkle-1 { top: -8px; right: -8px; animation-delay: 0s; }
  &.sparkle-2 { top: -4px; left: -8px; animation-delay: 0.5s; }
  &.sparkle-3 { bottom: -8px; right: -4px; animation-delay: 1s; }
  &.sparkle-4 { bottom: -4px; left: -4px; animation-delay: 1.5s; }
`;

const WinnerContainer = styled.div`
  position: relative;
  display: inline-block;
`;

// Badge component props
interface WinnerBadgeProps {
  variant?: 'trophy' | 'crown' | 'star';
  size?: 'sm' | 'md' | 'lg';
  showSparkles?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const WinnerBadge: React.FC<WinnerBadgeProps> = ({
  variant = 'trophy',
  size = 'md',
  showSparkles = true,
  children,
  className
}) => {
  const getIcon = () => {
    const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;
    
    switch (variant) {
      case 'crown':
        return <Crown size={iconSize} className="icon" />;
      case 'star':
        return <Star size={iconSize} className="icon" fill="currentColor" />;
      default:
        return <Trophy size={iconSize} className="icon" />;
    }
  };

  const getBadgeText = () => {
    if (children) return children;
    
    switch (variant) {
      case 'crown': return 'CHAMPION';
      case 'star': return 'WINNER';
      default: return 'WINNER';
    }
  };

  return (
    <WinnerContainer className={className}>
      <WinnerBadgeContainer variant={variant} size={size}>
        {getIcon()}
        {getBadgeText()}
      </WinnerBadgeContainer>
      
      {showSparkles && (
        <>
          <SparkleIcon className="sparkle-1">
            <Star size={8} fill="currentColor" />
          </SparkleIcon>
          <SparkleIcon className="sparkle-2">
            <Star size={6} fill="currentColor" />
          </SparkleIcon>
          <SparkleIcon className="sparkle-3">
            <Star size={8} fill="currentColor" />
          </SparkleIcon>
          <SparkleIcon className="sparkle-4">
            <Star size={6} fill="currentColor" />
          </SparkleIcon>
        </>
      )}
    </WinnerContainer>
  );
};

// Specialized winner badges
export const TrophyBadge: React.FC<Omit<WinnerBadgeProps, 'variant'>> = (props) => (
  <WinnerBadge variant="trophy" {...props} />
);

export const CrownBadge: React.FC<Omit<WinnerBadgeProps, 'variant'>> = (props) => (
  <WinnerBadge variant="crown" {...props} />
);

export const StarBadge: React.FC<Omit<WinnerBadgeProps, 'variant'>> = (props) => (
  <WinnerBadge variant="star" {...props} />
);

export default WinnerBadge;