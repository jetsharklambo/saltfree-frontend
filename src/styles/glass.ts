import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';

// Glass theme colors
export const glassTheme = {
  primary: 'rgba(120, 119, 198, 0.3)',
  secondary: 'rgba(255, 119, 198, 0.15)',
  accent: 'rgba(120, 219, 226, 0.2)',
  surface: 'rgba(255, 255, 255, 0.1)',
  surfaceHover: 'rgba(255, 255, 255, 0.15)',
  border: 'rgba(255, 255, 255, 0.2)',
  text: 'rgba(255, 255, 255, 0.9)',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textMuted: 'rgba(255, 255, 255, 0.5)',
  success: 'rgba(34, 197, 94, 0.3)',
  warning: 'rgba(251, 191, 36, 0.3)',
  error: 'rgba(239, 68, 68, 0.3)',
  shadow: 'rgba(0, 0, 0, 0.3)',
};

// Glass effects mixins
export const glassEffect = css`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
`;

export const strongGlassEffect = css`
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 16px 48px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    inset 0 -1px 0 rgba(255, 255, 255, 0.1);
`;

export const subtleGlassEffect = css`
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
`;

// Animation keyframes
const shimmer = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(120, 119, 198, 0.2); }
  50% { box-shadow: 0 0 40px rgba(120, 119, 198, 0.4); }
`;

// Responsive breakpoints
export const breakpoints = {
  mobile: '480px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1400px',
};

export const media = {
  mobile: `@media (max-width: ${breakpoints.mobile})`,
  tablet: `@media (max-width: ${breakpoints.tablet})`,
  desktop: `@media (min-width: ${breakpoints.desktop})`,
  wide: `@media (min-width: ${breakpoints.wide})`,
  portrait: '@media (orientation: portrait)',
  landscape: '@media (orientation: landscape)',
};

// Glass components
export const GlassCard = styled.div<{
  variant?: 'subtle' | 'normal' | 'strong';
  interactive?: boolean;
  floating?: boolean;
}>`
  ${({ variant = 'normal' }) => {
    switch (variant) {
      case 'subtle': return subtleGlassEffect;
      case 'strong': return strongGlassEffect;
      default: return glassEffect;
    }
  }}
  
  border-radius: 16px;
  padding: 1.5rem;
  transition: all 0.3s ease;
  
  ${({ interactive }) => interactive && css`
    cursor: pointer;
    
    &:hover {
      transform: translateY(-4px);
      background: rgba(255, 255, 255, 0.15);
      box-shadow: 
        0 16px 48px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
    }
  `}
  
  ${({ floating }) => floating && css`
    animation: ${float} 6s ease-in-out infinite;
  `}
  
  ${media.mobile} {
    padding: 1rem;
    border-radius: 12px;
  }
`;

export const GlassButton = styled.button<{
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  $loading?: boolean;
}>`
  ${glassEffect}
  
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: none;
  border-radius: 12px;
  font-weight: 500;
  font-family: inherit;
  text-decoration: none;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  
  color: ${glassTheme.text};
  
  ${({ size = 'md' }) => {
    switch (size) {
      case 'sm':
        return css`
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          height: 2.5rem;
        `;
      case 'lg':
        return css`
          padding: 0.875rem 2rem;
          font-size: 1.125rem;
          height: 3.5rem;
        `;
      default:
        return css`
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          height: 3rem;
        `;
    }
  }}
  
  ${({ variant = 'primary' }) => {
    const variants = {
      primary: glassTheme.primary,
      secondary: glassTheme.secondary,
      success: glassTheme.success,
      warning: glassTheme.warning,
      error: glassTheme.error,
    };
    
    return css`
      background: ${variants[variant]};
      
      &:hover:not(:disabled) {
        background: ${variants[variant].replace('0.3', '0.4').replace('0.15', '0.25')};
        transform: translateY(-2px);
        animation: ${glow} 2s ease-in-out infinite;
      }
    `;
  }}
  
  ${({ fullWidth }) => fullWidth && css`
    width: 100%;
  `}
  
  ${({ $loading }) => $loading && css`
    opacity: 0.7;
    cursor: not-allowed;
    
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.2),
        transparent
      );
      animation: ${shimmer} 1.5s infinite;
    }
  `}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    
    &:hover {
      transform: none;
      animation: none;
    }
  }
  
  ${media.mobile} {
    min-height: 48px; // Touch-friendly
  }
`;

export const GlassInput = styled.input<{
  hasError?: boolean;
}>`
  ${subtleGlassEffect}
  
  width: 100%;
  padding: 0.875rem 1rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid ${({ hasError }) => hasError ? glassTheme.error : 'rgba(255, 255, 255, 0.1)'};
  color: ${glassTheme.text};
  font-size: 1rem;
  font-family: inherit;
  transition: all 0.2s ease;
  
  &::placeholder {
    color: ${glassTheme.textMuted};
  }
  
  &:focus {
    outline: none;
    border-color: ${glassTheme.primary};
    background: rgba(255, 255, 255, 0.1);
    box-shadow: 
      0 0 0 2px rgba(120, 119, 198, 0.2),
      0 4px 16px rgba(0, 0, 0, 0.2);
  }
  
  ${media.mobile} {
    padding: 1rem;
    font-size: 16px; // Prevent zoom on iOS
  }
`;

export const GlassSelect = styled.select`
  ${subtleGlassEffect}
  
  width: 100%;
  padding: 0.875rem 1rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: ${glassTheme.text};
  font-size: 1rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: ${glassTheme.primary};
    background: rgba(255, 255, 255, 0.1);
    box-shadow: 
      0 0 0 2px rgba(120, 119, 198, 0.2),
      0 4px 16px rgba(0, 0, 0, 0.2);
  }
  
  option {
    background: rgba(31, 41, 55, 0.95);
    color: ${glassTheme.text};
  }
  
  ${media.mobile} {
    padding: 1rem;
    font-size: 16px;
  }
`;

export const GlassModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  
  ${media.mobile} {
    align-items: flex-end;
  }
`;

export const GlassModalContent = styled.div`
  ${strongGlassEffect}
  
  border-radius: 20px;
  padding: 2rem;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  
  ${media.mobile} {
    border-radius: 20px 20px 0 0;
    max-height: 85vh;
    margin-bottom: 0;
  }
`;

export const LoadingSpinner = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top: 2px solid ${glassTheme.text};
  border-radius: 50%;
  animation: ${pulse} 1s linear infinite;
`;

export const GlassGrid = styled.div<{
  columns?: number;
  gap?: string;
}>`
  display: grid;
  grid-template-columns: repeat(${({ columns = 1 }) => columns}, 1fr);
  gap: ${({ gap = '1rem' }) => gap};
  
  ${media.tablet} {
    grid-template-columns: 1fr;
  }
`;

export const FlexContainer = styled.div<{
  direction?: 'row' | 'column';
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  gap?: string;
  wrap?: boolean;
}>`
  display: flex;
  flex-direction: ${({ direction = 'row' }) => direction};
  align-items: ${({ align = 'stretch' }) => align};
  justify-content: ${({ justify = 'flex-start' }) => justify};
  gap: ${({ gap = '0' }) => gap};
  ${({ wrap }) => wrap && 'flex-wrap: wrap;'}
  
  ${media.mobile} {
    ${({ direction = 'row' }) => direction === 'row' && 'flex-direction: column;'}
  }
`;