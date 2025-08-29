import React from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { Trophy, Crown, Star } from 'lucide-react';
import { glassTheme } from '../styles/glass';

// Winner badge animations
const goldGlow = keyframes`
  0%, 100% { 
    box-shadow: 
      0 0 20px rgba(255, 215, 0, 0.4),
      0 0 40px rgba(255, 215, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  50% { 
    box-shadow: 
      0 0 30px rgba(255, 215, 0, 0.6),
      0 0 60px rgba(255, 215, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.4);
  }
`;

const sparkle = keyframes`
  0%, 100% { opacity: 0.4; transform: scale(1) rotate(0deg); }
  25% { opacity: 1; transform: scale(1.1) rotate(90deg); }
  50% { opacity: 0.6; transform: scale(1.05) rotate(180deg); }
  75% { opacity: 1; transform: scale(1.1) rotate(270deg); }
`;

const bounce = keyframes`
  0%, 20%, 53%, 80%, 100% { transform: translateY(0); }
  40%, 43% { transform: translateY(-8px); }
  70% { transform: translateY(-4px); }
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
        return 'linear-gradient(135deg, rgba(255, 215, 0, 0.9), rgba(255, 193, 7, 0.9), rgba(255, 171, 0, 0.9))';
      case 'star':
        return 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(240, 248, 255, 0.9))';
      default:
        return 'linear-gradient(135deg, rgba(255, 215, 0, 0.9), rgba(255, 193, 7, 0.9))';
    }
  }};
  
  border: 2px solid ${({ variant }) => {
    switch (variant) {
      case 'crown': return 'rgba(255, 215, 0, 0.8)';
      case 'star': return 'rgba(255, 255, 255, 0.8)';
      default: return 'rgba(255, 193, 7, 0.8)';
    }
  }};
  
  border-radius: 12px;
  color: ${({ variant }) => variant === 'star' ? '#1a1a1a' : '#1a1a1a'};
  font-size: ${({ size = 'md' }) => {
    switch (size) {
      case 'sm': return '0.75rem';
      case 'lg': return '1rem';
      default: return '0.85rem';
    }
  }};
  font-weight: 700;
  text-shadow: ${({ variant }) => variant === 'star' ? '0 1px 2px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.2)'};
  
  animation: ${goldGlow} 3s ease-in-out infinite;
  
  .icon {
    animation: ${bounce} 2s infinite;
  }
  
  &:hover {
    transform: scale(1.05);
    transition: transform 0.2s ease;
  }
`;

const SparkleIcon = styled.div`
  position: absolute;
  color: rgba(255, 215, 0, 0.8);
  animation: ${sparkle} 2s ease-in-out infinite;
  pointer-events: none;
  
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